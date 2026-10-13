import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@tmcw/togeojson';

export type ParsedGeometry = Record<string, any>;

const asXmlDocument = (text: string) => {
  if (typeof globalThis.DOMParser !== 'undefined') {
    return new globalThis.DOMParser().parseFromString(text, 'text/xml');
  }

  return new XmlDomParser().parseFromString(text, 'text/xml');
};

const flattenFeatures = (value: any): any[] => {
  if (!value) return [];

  if (value.type === 'FeatureCollection') {
    return (value.features || []).flatMap((feature: any) => flattenFeatures(feature));
  }

  if (value.type === 'Feature') {
    return flattenFeatures(value.geometry);
  }

  if (value.type === 'GeometryCollection') {
    return (value.geometries || []).flatMap((geometry: any) => flattenFeatures(geometry));
  }

  if (value.type && value.coordinates !== undefined) {
    return [value];
  }

  return [];
};

const normalizePoint = (coordinates: number[]) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const x = Number(coordinates[0]);
  const y = Number(coordinates[1]);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return [x, y];
};

const normalizeRing = (ring: any[]) => {
  if (!Array.isArray(ring)) {
    return [];
  }

  const normalized = ring
    .map((point: any) => {
      if (!Array.isArray(point)) return null;
      const normalizedPoint = normalizePoint(point);
      return normalizedPoint;
    })
    .filter(Boolean)
    .map((point: any) => [Number(point[0]), Number(point[1])]);

  if (normalized.length < 4) {
    return [];
  }

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    normalized.push([...first]);
  }

  return normalized;
};

const parseCoordinateList = (rawValue: string): number[][] => {
  if (!rawValue) {
    return [];
  }

  const compact = rawValue
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!compact) {
    return [];
  }

  const values = compact.split(' ').map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (values.length < 2 || values.length % 2 !== 0) {
    return [];
  }

  const pairs: number[][] = [];
  for (let i = 0; i < values.length; i += 2) {
    pairs.push([values[i], values[i + 1]]);
  }

  return pairs;
};

const getNodeText = (node: any): string => {
  return typeof (node as any)?.textContent === 'string' ? (node as any).textContent : '';
};

const collectGmlMembers = (node: any): any[] => {
  if (!node || !node.childNodes) {
    return [];
  }

  const candidates: any[] = [];
  const childNodes = Array.from(node.childNodes);

  childNodes.forEach((child: any) => {
    if (!child || child.nodeType !== 1) {
      return;
    }

    const localName = (child.localName || child.nodeName || '').toLowerCase();
    if (['pointmember', 'linemember', 'curvemember', 'surfacemember', 'geometrymember', 'member'].includes(localName)) {
      const inner = child.firstChild || child;
      if (inner && inner.nodeType === 1) {
        candidates.push(inner);
      }
      return;
    }

    if (localName === 'featuremember') {
      const inner = child.firstChild || child;
      if (inner && inner.nodeType === 1) {
        const featureChildren = Array.from(inner.childNodes || []).filter((grandChild: any) => grandChild && grandChild.nodeType === 1);
        featureChildren.forEach((grandChild: any) => {
          const grandName = (grandChild.localName || grandChild.nodeName || '').toLowerCase();
          if (grandName.includes('geometry') || grandName.includes('point') || grandName.includes('line') || grandName.includes('polygon') || grandName.includes('surface') || grandName.includes('curve')) {
            candidates.push(grandChild);
          }
        });
      }
      return;
    }

    if (localName === 'features') {
      candidates.push(...collectGmlMembers(child));
      return;
    }

    candidates.push(child);
  });

  return candidates;
};

const parseGmlGeometryNode = (node: any): any => {
  if (!node || node.nodeType !== 1) {
    return null;
  }

  const localName = (node.localName || node.nodeName || '').toLowerCase();

  if (localName === 'point') {
    const pointNode = Array.from(node.childNodes || []).find((child: any) => {
      const name = (child.localName || child.nodeName || '').toLowerCase();
      return name === 'pos' || name === 'coordinates';
    });

    const posText = pointNode ? getNodeText(pointNode) : getNodeText(node);
    const coords = parseCoordinateList(posText);
    const point = coords.length > 0 ? [coords[0][0], coords[0][1]] : null;
    if (!point) {
      return null;
    }

    return { type: 'Point', coordinates: point };
  }

  if (localName === 'linestring') {
    const posListNode = Array.from(node.childNodes || []).find((child: any) => {
      const name = (child.localName || child.nodeName || '').toLowerCase();
      return name === 'poslist' || name === 'coordinates';
    });

    const raw = posListNode ? getNodeText(posListNode) : getNodeText(node);
    const coords = parseCoordinateList(raw);
    if (coords.length < 2) {
      return null;
    }

    return { type: 'LineString', coordinates: coords };
  }

  if (localName === 'linearring') {
    const raw = Array.from(node.childNodes || [])
      .map((child: any) => (child && child.nodeType === 1 ? getNodeText(child) : ''))
      .join(' ');
    const coords = parseCoordinateList(raw);
    if (coords.length < 4) {
      return null;
    }
    return { type: 'LineString', coordinates: coords };
  }

  if (localName === 'polygon') {
    const rings: any[] = [];
    Array.from(node.childNodes || []).forEach((child: any) => {
      if (!child || child.nodeType !== 1) {
        return;
      }

      const childName = (child.localName || child.nodeName || '').toLowerCase();
      if (childName === 'outerboundaryis' || childName === 'exterior' || childName === 'innerboundaryis' || childName === 'interior') {
        const ringNode = Array.from(child.childNodes || []).find((grandChild: any) => {
          const grandName = (grandChild.localName || grandChild.nodeName || '').toLowerCase();
          return grandName === 'linearring' || grandName === 'linestring' || grandName === 'ring';
        });

        if (ringNode) {
          const ringText = getNodeText(ringNode);
          const ringCoords = parseCoordinateList(ringText);
          if (ringCoords.length >= 4) {
            rings.push(ringCoords);
          }
        }
      }
    });

    if (rings.length === 0) {
      return null;
    }

    const shell = normalizeRing(rings[0]);
    if (shell.length === 0) {
      return null;
    }

    const holes = rings.slice(1).map((ring) => normalizeRing(ring)).filter((ring) => ring.length > 0);
    return { type: 'Polygon', coordinates: holes.length > 0 ? [shell, ...holes] : [shell] };
  }

  if (localName === 'multigeometry' || localName === 'geometrycollection') {
    const geometries = collectGmlMembers(node)
      .map((child: any) => parseGmlGeometryNode(child))
      .filter(Boolean);
    return geometries.length > 0 ? { type: 'GeometryCollection', geometries } : null;
  }

  if (localName === 'multipoint') {
    const points = collectGmlMembers(node)
      .map((child: any) => parseGmlGeometryNode(child))
      .filter((geometry: any) => geometry && geometry.type === 'Point');
    return points.length > 0 ? { type: 'MultiPoint', coordinates: points.map((point: any) => point.coordinates) } : null;
  }

  if (localName === 'multicurve' || localName === 'multilinestring') {
    const lines = collectGmlMembers(node)
      .map((child: any) => parseGmlGeometryNode(child))
      .filter((geometry: any) => geometry && geometry.type === 'LineString');
    return lines.length > 0 ? { type: 'MultiLineString', coordinates: lines.map((line: any) => line.coordinates) } : null;
  }

  if (localName === 'multisurface' || localName === 'multipolygon') {
    const polygons = collectGmlMembers(node)
      .map((child: any) => parseGmlGeometryNode(child))
      .filter((geometry: any) => geometry && geometry.type === 'Polygon');
    return polygons.length > 0 ? { type: 'MultiPolygon', coordinates: polygons.map((polygon: any) => polygon.coordinates) } : null;
  }

  const descendants = collectGmlMembers(node)
    .map((child: any) => parseGmlGeometryNode(child))
    .filter(Boolean);

  if (descendants.length > 0) {
    return descendants[0];
  }

  return null;
};

const parseGmlDocument = (document: any): any[] => {
  if (!document || !document.documentElement) {
    return [];
  }

  const geometries: any[] = [];
  const visit = (node: any) => {
    if (!node || node.nodeType !== 1) {
      return;
    }

    const localName = (node.localName || node.nodeName || '').toLowerCase();
    if (['point', 'linestring', 'linearring', 'polygon', 'multigeometry', 'geometrycollection', 'multipoint', 'multicurve', 'multilinestring', 'multisurface', 'multipolygon'].includes(localName)) {
      const geometry = parseGmlGeometryNode(node);
      if (geometry) {
        geometries.push(geometry);
      }
    }

    Array.from(node.childNodes || []).forEach((child: any) => visit(child));
  };

  visit(document.documentElement);

  return geometries.filter((geometry: any, index: number, list: any[]) => {
    const duplicate = list.findIndex((candidate: any) => JSON.stringify(candidate) === JSON.stringify(geometry));
    return duplicate === index;
  });
};

export const parseImportedGeometryText = (fileName: string, text: string): ParsedGeometry[] => {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return [];
  }

  const normalizedName = String(fileName || '').toLowerCase();

  if (normalizedName.endsWith('.geojson') || normalizedName.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return flattenFeatures(parsed);
    } catch {
      return [];
    }
  }

  try {
    const xmlDocument = asXmlDocument(trimmed);
    if (!xmlDocument || !xmlDocument.documentElement) {
      return [];
    }

    const rootName = (xmlDocument.documentElement.localName || xmlDocument.documentElement.nodeName || '').toLowerCase();
    if (rootName === 'kml' || normalizedName.endsWith('.kml') || trimmed.toLowerCase().includes('<kml')) {
      const parsed = toGeoJSON.kml(xmlDocument as any);
      return flattenFeatures(parsed); 
    }

    if (rootName.includes('gml') || normalizedName.endsWith('.gml') || trimmed.toLowerCase().includes('<gml')) {
      return parseGmlDocument(xmlDocument);
    }

    if (normalizedName.endsWith('.xml') || trimmed.toLowerCase().includes('<point') || trimmed.toLowerCase().includes('<polygon')) {
      const parsed = toGeoJSON.kml(xmlDocument as any);
      const geometries = flattenFeatures(parsed);
      if (geometries.length > 0) {
        return geometries;
      }

      return parseGmlDocument(xmlDocument);
    }
  } catch {
    return [];
  }

  return [];
};
