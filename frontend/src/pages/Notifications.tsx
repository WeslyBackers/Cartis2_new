import { useState, useEffect, useMemo, useRef, DragEvent, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, WMSTileLayer } from 'react-leaflet';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import { useTableSort } from '../hooks/useTableSort';
import FileUpload from '../components/FileUpload';
import CoordinateField, { CoordFormatSelector, CoordFormat, isProjectedFormat, ProjectedCoordinateInput } from '../components/CoordinateInput';
import PostalMime from 'postal-mime';
import { getApiErrorMessage } from '../utils/errorUtils';

type ProductionLine = {
  id: number;
  code: string;
  name: string;
};

// Fix for default marker icon in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper function to strip HTML tags from content
const stripHtml = (html: string): string => {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
};

// Helper function to extract OBJNAM from product description
const getProductObjnam = (product: any): string => {
  if (!product.description) return product.code;
  
  // Extract OBJNAM value from description
  // Format: "AttributeValueOBJNAM<value>"
  const match = product.description.match(/OBJNAM(.+)$/);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return product.name || product.code;
};

const isPublCorrectionListProduct = (product: any): boolean => {
  const code = String(product?.code || '').trim().toUpperCase();
  const name = String(product?.name || '').trim().toLowerCase();

  return (
    code.startsWith('VL-') ||
    name.includes('verbeterlijst') ||
    name.includes('list of corrections') ||
    name.includes('listofcorrections')
  );
};

const INTEGRATED_CORRECTION_LIST_CODES = new Set([
  'VL-BG',
  'VL-BL',
  'VL-BNZ',
  'VL-D11',
  'VL-NP',
  'VL-OS',
  'VL-ZB_AH',
  'VL-ZB_VH',
  'VL-ZB-VH',
]);

const isIntegratedCorrectionListCode = (code: string): boolean => {
  const normalized = String(code || '').trim().toUpperCase().replace(/[_-]/g, '');

  for (const candidate of INTEGRATED_CORRECTION_LIST_CODES) {
    if (candidate.replace(/[_-]/g, '') === normalized) {
      return true;
    }
  }

  return false;
};

const VL101_ALIAS_CODES = new Set(['VL-BL', 'VL-ZB_AH', 'VL-ZB-VH']);
const VL102_ALIAS_CODES = new Set(['VL-NP', 'VL_OS']);

const normalizePublCorrectionListCode = (code: string): string => {
  const normalized = String(code || '').trim().toUpperCase();
  if (VL101_ALIAS_CODES.has(normalized)) {
    return 'VL-101';
  }
  if (VL102_ALIAS_CODES.has(normalized)) {
    return 'VL-102';
  }
  return normalized;
};

const coalescePublCorrectionListProducts = (products: any[] = []) => {
  const byCode = new Map<string, any>();

  for (const product of products) {
    if (isIntegratedCorrectionListCode(product?.code)) {
      continue;
    }

    const normalizedCode = normalizePublCorrectionListCode(product?.code);
    const existing = byCode.get(normalizedCode);

    if (existing) {
      continue;
    }

    byCode.set(normalizedCode, {
      ...product,
      code: normalizedCode,
    });
  }

  return Array.from(byCode.values());
};

const getAffectedProductsForCurrentLine = (products: any[] = [], currentProductionLineId: number | null) => {
  const lineProducts = products.filter((p: any) => currentProductionLineId ? p.production_line_id === currentProductionLineId : true);

  if (currentProductionLineId === 4) {
    return coalescePublCorrectionListProducts(lineProducts.filter(isPublCorrectionListProduct));
  }

  return lineProducts;
};

// Helper function to clean zone name (strip HTML and parse JSON)
const cleanZoneName = (zoneName: string): string => {
  if (!zoneName) return '';
  
  // Try to parse as JSON if it looks like an object
  if (zoneName.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(zoneName);
      if (parsed && parsed.value) {
        zoneName = parsed.value;
      }
    } catch (e) {
      // Not valid JSON, use as-is
    }
  }
  
  // Strip HTML tags
  const temp = document.createElement('div');
  temp.innerHTML = zoneName;
  return temp.textContent || temp.innerText || '';
};

const parseGeoJsonObject = (value: any): any | null => {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

const formatEmailSourceDetail = (name?: string | null, address?: string | null): string => {
  const cleanName = String(name || '').trim();
  const cleanAddress = String(address || '').trim();

  if (cleanName && cleanAddress) {
    return `${cleanName} <${cleanAddress}>`;
  }
  return cleanName || cleanAddress;
};

const sanitizeImportedEmailHtml = (html: string): string => {
  if (!html) return '';

  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '');
};

const escapeHtml = (value: string): string =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const plainTextToHtml = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const paragraphs = trimmed.split(/\r?\n\s*\r?\n/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length === 0) return '';

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
};

const parseNotificationDateValue = (value: any): Date | null => {
  if (!value) return null;

  const raw = String(value).trim();
  const exactIsoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactIsoDate) {
    const [, year, month, day] = exactIsoDate;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const normalizeDateForFilter = (value: any): string => {
  const parsed = parseNotificationDateValue(value);
  if (!parsed) {
    return '';
  }

  return format(parsed, 'dd-MM-yyyy');
};

const extractRenderableGeometries = (geojson: any): any[] => {
  if (!geojson) return [];

  if (geojson.type === 'FeatureCollection') {
    return (geojson.features || []).flatMap((feature: any) =>
      extractRenderableGeometries(feature?.geometry)
    );
  }

  if (geojson.type === 'Feature') {
    return extractRenderableGeometries(geojson.geometry);
  }

  if (geojson.type === 'GeometryCollection') {
    return (geojson.geometries || []).flatMap((geometry: any) =>
      extractRenderableGeometries(geometry)
    );
  }

  return geojson.type && geojson.coordinates ? [geojson] : [];
};

const getFirstCoordinate = (geojson: any): [number, number] | null => {
  if (!geojson) return null;

  if (geojson.type === 'Point' && Array.isArray(geojson.coordinates) && geojson.coordinates.length >= 2) {
    return [geojson.coordinates[1], geojson.coordinates[0]];
  }

  if (geojson.type === 'LineString' && Array.isArray(geojson.coordinates) && geojson.coordinates.length > 0) {
    return [geojson.coordinates[0][1], geojson.coordinates[0][0]];
  }

  if (geojson.type === 'Polygon' && Array.isArray(geojson.coordinates) && geojson.coordinates[0]?.length > 0) {
    return [geojson.coordinates[0][0][1], geojson.coordinates[0][0][0]];
  }

  if (geojson.type === 'MultiLineString' && Array.isArray(geojson.coordinates) && geojson.coordinates[0]?.length > 0) {
    return [geojson.coordinates[0][0][1], geojson.coordinates[0][0][0]];
  }

  if (geojson.type === 'MultiPolygon' && Array.isArray(geojson.coordinates) && geojson.coordinates[0]?.[0]?.length > 0) {
    return [geojson.coordinates[0][0][0][1], geojson.coordinates[0][0][0][0]];
  }

  const extracted = extractRenderableGeometries(geojson);
  if (extracted.length > 0) {
    return getFirstCoordinate(extracted[0]);
  }

  return null;
};

// Helper function to collect all geometries for a notification
const collectNotificationGeometries = (notification: any, coordinates: any[]) => {
  const features: any[] = [];
  
  // Add main notification geometry
  if (notification.geometry) {
    const parsedMainGeometry = parseGeoJsonObject(notification.geometry);
    const mainGeometries = extractRenderableGeometries(parsedMainGeometry);

    mainGeometries.forEach((geom: any, index: number) => {
      features.push({
        type: 'Feature',
        geometry: geom,
        properties: {
          id: `notification-${notification.id}-${index}`,
          code: notification.code || '',
          title: notification.title || '',
          content: notification.content || '',
          type: 'main',
          source: notification.source || ''
        }
      });
    });
  }
  
  // Add additional coordinates if provided
  if (coordinates && coordinates.length > 0) {
    coordinates.forEach((coord: any) => {
      if (coord.geometry) {
        const parsedCoordGeometry = parseGeoJsonObject(coord.geometry);
        const coordGeometries = extractRenderableGeometries(parsedCoordGeometry);

        coordGeometries.forEach((geom: any, index: number) => {
          features.push({
            type: 'Feature',
            geometry: geom,
            properties: {
              id: `coordinate-${coord.id}-${index}`,
              label: coord.label || '',
              description: coord.description || '',
              type: 'additional',
              added_by: coord.first_name ? `${coord.first_name} ${coord.last_name}` : ''
            }
          });
        });
      } else if (coord.latitude !== null && coord.latitude !== undefined && coord.longitude !== null && coord.longitude !== undefined) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(coord.longitude), parseFloat(coord.latitude)]
          },
          properties: {
            id: `coordinate-${coord.id}`,
            label: coord.label || '',
            description: coord.description || '',
            type: 'additional',
            added_by: coord.first_name ? `${coord.first_name} ${coord.last_name}` : ''
          }
        });
      }
    });
  }
  
  return features;
};

const escapeXml = (value: any): string => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Convert a single GeoJSON geometry to GML markup
const geometryToGML = (geom: any): string => {
  if (!geom) {
    return '';
  }

  if (geom.type === 'Feature') {
    return geometryToGML(geom.geometry);
  }

  if (geom.type === 'FeatureCollection') {
    const geometries = extractRenderableGeometries(geom);
    let gml = `        <gml:MultiGeometry>
`;
    geometries.forEach((g: any) => {
      gml += `          <gml:geometryMember>
${geometryToGML(g)}          </gml:geometryMember>
`;
    });
    gml += `        </gml:MultiGeometry>
`;
    return gml;
  }

  if (geom.type === 'Point') {
    return `        <gml:Point>
          <gml:pos>${geom.coordinates[0]} ${geom.coordinates[1]}</gml:pos>
        </gml:Point>
`;
  } else if (geom.type === 'LineString') {
    const coords = geom.coordinates.map((c: number[]) => `${c[0]} ${c[1]}`).join(' ');
    return `        <gml:LineString>
          <gml:posList>${coords}</gml:posList>
        </gml:LineString>
`;
  } else if (geom.type === 'Polygon') {
    const coords = geom.coordinates[0].map((c: number[]) => `${c[0]} ${c[1]}`).join(' ');
    return `        <gml:Polygon>
          <gml:exterior>
            <gml:LinearRing>
              <gml:posList>${coords}</gml:posList>
            </gml:LinearRing>
          </gml:exterior>
        </gml:Polygon>
`;
  } else if (geom.type === 'MultiPoint') {
    let gml = `        <gml:MultiPoint>
`;
    geom.coordinates.forEach((pt: number[]) => {
      gml += `          <gml:pointMember>
            <gml:Point>
              <gml:pos>${pt[0]} ${pt[1]}</gml:pos>
            </gml:Point>
          </gml:pointMember>
`;
    });
    gml += `        </gml:MultiPoint>
`;
    return gml;
  } else if (geom.type === 'MultiLineString') {
    let gml = `        <gml:MultiCurve>
`;
    geom.coordinates.forEach((line: number[][]) => {
      const coords = line.map((c: number[]) => `${c[0]} ${c[1]}`).join(' ');
      gml += `          <gml:curveMember>
            <gml:LineString>
              <gml:posList>${coords}</gml:posList>
            </gml:LineString>
          </gml:curveMember>
`;
    });
    gml += `        </gml:MultiCurve>
`;
    return gml;
  } else if (geom.type === 'MultiPolygon') {
    let gml = `        <gml:MultiSurface>
`;
    geom.coordinates.forEach((poly: number[][][]) => {
      const coords = poly[0].map((c: number[]) => `${c[0]} ${c[1]}`).join(' ');
      gml += `          <gml:surfaceMember>
            <gml:Polygon>
              <gml:exterior>
                <gml:LinearRing>
                  <gml:posList>${coords}</gml:posList>
                </gml:LinearRing>
              </gml:exterior>
            </gml:Polygon>
          </gml:surfaceMember>
`;
    });
    gml += `        </gml:MultiSurface>
`;
    return gml;
  } else if (geom.type === 'GeometryCollection') {
    let gml = `        <gml:MultiGeometry>
`;
    geom.geometries.forEach((g: any) => {
      gml += `          <gml:geometryMember>
${geometryToGML(g)}          </gml:geometryMember>
`;
    });
    gml += `        </gml:MultiGeometry>
`;
    return gml;
  }
  return '';
};

// Export notification to GML format (fetches coordinates from API)
const exportNotificationToGML = async (notification: any) => {
  // Fetch coordinates for this notification
  let coords: any[] = [];
  try {
    const response = await api.get(`/notifications/${notification.id}/coordinates`);
    coords = response.data || [];
  } catch (e) {
    // Continue with empty coordinates
  }

  const features = collectNotificationGeometries(notification, coords);
  
  if (features.length === 0) {
    alert('Geen geometrieën om te exporteren');
    return;
  }
  
  // Build GML XML
  let gml = `<?xml version="1.0" encoding="UTF-8"?>
<gml:FeatureCollection 
  xmlns:gml="http://www.opengis.net/gml"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/gml http://schemas.opengis.net/gml/3.1.1/base/gml.xsd">
`;

  features.forEach((feature, index) => {
    gml += `  <gml:featureMember>
    <Feature gml:id="feature-${index}">
`;
    
    // Add properties
    Object.keys(feature.properties).forEach(key => {
      const value = feature.properties[key];
      if (value) {
        gml += `      <${key}>${escapeXml(value)}</${key}>
`;
      }
    });
    
    // Add geometry
    gml += `      <geometry>
`;
    gml += geometryToGML(feature.geometry);
    gml += `      </geometry>
    </Feature>
  </gml:featureMember>
`;
  });
  
  gml += `</gml:FeatureCollection>`;
  
  // Download file
  const blob = new Blob([gml], { type: 'application/gml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${notification.code || 'notification-' + notification.id}_geometries.gml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Drawing control component
function DrawControl({ onShapeCreated, drawingMode, notificationId }: any) {
  const map = useMap();

  useEffect(() => {
    if (!map || !drawingMode || drawingMode === 'none') return;

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: drawingMode === 'line' ? { shapeOptions: { color: '#f357a1', weight: 3 } } : false,
        polygon: drawingMode === 'area' ? { shapeOptions: { color: '#3388ff' } } : false,
        circle: false,
        circlemarker: false,
        rectangle: drawingMode === 'area' ? { shapeOptions: { color: '#3388ff' } } : false,
        marker: drawingMode === 'point' ? {} : false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: false,
      },
    });

    map.addControl(drawControl);

    const handleDrawCreated = (e: any) => {
      const layer = e.layer;
      const geoJSON = layer.toGeoJSON();
      onShapeCreated(geoJSON.geometry);
      drawnItems.addLayer(layer);
    };

    map.on(L.Draw.Event.CREATED as any, handleDrawCreated);

    return () => {
      map.off(L.Draw.Event.CREATED as any, handleDrawCreated);
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map, drawingMode, onShapeCreated, notificationId]);

  return null;
}

// WMS service configuration
const WMS_URL = 'https://gis.afdelingkust.be/ows';
const WMS_LAYERS = [
  { name: 'nautischPortaal:Militaire.zones', title: 'Militaire zones' },
  { name: 'nautischPortaal:Offshore.zones', title: 'Offshore zones' },
  { name: 'nautischPortaal:Verkeersscheidingsstelsel', title: 'Verkeersscheidingsstelsel' },
  { name: 'nautischPortaal:Akoestische.referentiezone', title: 'Akoestische referentiezone' },
  { name: 'nautischPortaal:Ankergebieden', title: 'Ankergebieden' },
  { name: 'nautischPortaal:Baggergeulen', title: 'Baggergeulen' },
  { name: 'nautischPortaal:Baggerstortvakken', title: 'Baggerstortvakken' },
  { name: 'nautischPortaal:Boeien', title: 'Boeien' },
  { name: 'nautischPortaal:Combined.Bathy.Grid', title: 'Combined Bathymetry Grid' },
  { name: 'nautischPortaal:Geografische.namen', title: 'Geografische namen' },
  { name: 'nautischPortaal:Herkenningspunten', title: 'Herkenningspunten' },
  { name: 'nautischPortaal:Internationale.Maritieme.Grens', title: 'Internationale Maritieme Grens' },
  { name: 'nautischPortaal:Kustlijn', title: 'Kustlijn' },
  { name: 'nautischPortaal:Lichten', title: 'Lichten' },
  { name: 'nautischPortaal:MG.12-mijlsgrens', title: 'MG 12-mijlsgrens' },
  { name: 'nautischPortaal:MG.200-metergrens', title: 'MG 200-metergrens' },
  { name: 'nautischPortaal:MG.24-mijlsgrens', title: 'MG 24-mijlsgrens' },
  { name: 'nautischPortaal:MG.3-mijlsgrens', title: 'MG 3-mijlsgrens' },
  { name: 'nautischPortaal:MG.6-mijlsgrens', title: 'MG 6-mijlsgrens' },
  { name: 'nautischPortaal:MG.basislijn', title: 'MG Basislijn' },
  { name: 'nautischPortaal:Natuurbeschermingsgebieden', title: 'Natuurbeschermingsgebieden' },
  { name: 'nautischPortaal:Wrakken.Obstructies', title: 'Wrakken & Obstructies' },
  { name: 'nautischPortaal:Zand-grind.ontginningsgebieden', title: 'Zand-grind ontginningsgebieden' },
];

const NOTIFICATION_SOURCE_OPTIONS = [
  'FRHO (Franse Hydrografische Dienst)',
  'GNA (Gemeenschappelijk Nautische Autoriteit)',
  'PoO (Port of Ostend)',
  'POAB (Port of Antwerp-Bruges)',
  'KGL (Kennisgeving Loodswezen)',
  'LB (Lokaal Bericht MRCC)',
  'NLHO (Nederlandse Hydrografische Dienst)',
  'NSP (North Sea Port)',
  'Notice to Skippers (NtS)',
  'RWS (Rijkswaterstaat)',
  'UKHO (UK Hydrografische Dienst)',
  'Andere (telefoon, mail, etc.)',
  'Vlaamse Hydrografie',
];

export default function Notifications() {
  const queryClient = useQueryClient();
  const currentProductionLineId = useAuthStore((state) => state.currentProductionLineId);
  const user = useAuthStore((state) => state.user);
  const activeLineName = user?.rights?.find((r) => Number(r.id) === Number(currentProductionLineId))?.name;
  const defaultLineName = user?.defaultProductionLineName ?? null;
  const isDefaultLine = Number(currentProductionLineId) === Number(user?.defaultProductionLineId);

  const { data: productionLinesData } = useQuery<ProductionLine[]>({
    queryKey: ['productionLines'],
    queryFn: async () => {
      const response = await api.get('/production-lines');
      return response.data;
    },
  });
  const productionLines: ProductionLine[] = productionLinesData || [];
  const orderedProductionLines = useMemo(() => {
    if (!productionLines.length) return productionLines;
    const activeLine = productionLines.find((pl: ProductionLine) => pl.id === currentProductionLineId);
    if (!activeLine) return productionLines;
    return [activeLine, ...productionLines.filter((pl: ProductionLine) => pl.id !== currentProductionLineId)];
  }, [productionLines, currentProductionLineId]);

  const [search, setSearch] = useState('');
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkNotes, setBulkNotes] = useState('');
  
  // Resizable layout state for expanded notifications
  const [expandedLeftWidth, setExpandedLeftWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  
  // Column filters (inline, client-side)
  const [colFilterCode, setColFilterCode] = useState('');
  const [colFilterDatePicker, setColFilterDatePicker] = useState('');
  const [colFilterDate, setColFilterDate] = useState('');
  const [colFilterTitle, setColFilterTitle] = useState('');
  const [colFilterContent, setColFilterContent] = useState('');
  const [colFilterZones, setColFilterZones] = useState('');
  const [colFilterProducts, setColFilterProducts] = useState('');
  const [colFilterTask, setColFilterTask] = useState('');
  const [colFilterDecisions, setColFilterDecisions] = useState<Record<number, string>>({});
  
  // New notification modal
  const [showNewNotificationModal, setShowNewNotificationModal] = useState(false);













    const [newNotification, setNewNotification] = useState({
    code: '',
    title: '',
    content: '',
    source: 'Vlaamse Hydrografie',
    sourceDetail: '',
    notificationDate: new Date().toISOString().split('T')[0],
    opmerkingen: '',
  });
  const [newNotificationGeometries, setNewNotificationGeometries] = useState<any[]>([]);
  const [newNotificationDrawingMode, setNewNotificationDrawingMode] = useState<'none' | 'point' | 'line' | 'area'>('none');
  const [newNotificationInputMode, setNewNotificationInputMode] = useState<'draw' | 'type'>('draw');
  const [newNotificationManualCoords, setNewNotificationManualCoords] = useState({ lat: '', lon: '' });
  const [newNotificationGeometryName, setNewNotificationGeometryName] = useState('');
  const [newNotificationGeometryDescription, setNewNotificationGeometryDescription] = useState('');
  const [coordFormat, setCoordFormat] = useState<CoordFormat>('DD');
  const [newNotificationSelectedWmsLayers, setNewNotificationSelectedWmsLayers] = useState<string[]>([]);
  const [newNotificationWmsLayersPanelOpen, setNewNotificationWmsLayersPanelOpen] = useState(false);
  const [newNotificationAttachments, setNewNotificationAttachments] = useState<File[]>([]);
  const [isEmailDragOver, setIsEmailDragOver] = useState(false);
  const emailFileInputRef = useRef<HTMLInputElement>(null);

  // Task creation modal for bulk decisions
  const [showTaskCreationModal, setShowTaskCreationModal] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'Ja' | 'Nee' | null>(null);

  // Zone management
  const [showZoneManagementDialog, setShowZoneManagementDialog] = useState(false);
  const [zoneManagementNotificationId, setZoneManagementNotificationId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedWmsLayers, setSelectedWmsLayers] = useState<string[]>([]);
  const [wmsLayersPanelOpen, setWmsLayersPanelOpen] = useState(false);

  // Set document title
  useEffect(() => {
    const line = productionLines.find((l: ProductionLine) => l.id === currentProductionLineId);
    document.title = line ? `Meldingen - ${line.name} - CARTIS` : 'Meldingen - CARTIS';
    return () => { document.title = 'CARTIS 2.0'; };
  }, [currentProductionLineId, productionLines]);

  const { data, isLoading, refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications', currentProductionLineId, showAllNotices, search, page],
    queryFn: async () => {
      const params: any = {
        productionLineId: currentProductionLineId,
        undecidedOnly: showAllNotices ? undefined : true,
        search: search || undefined,
        page,
        limit: 50,
      };

      const response = await api.get('/notifications', { params });
      return response.data;
    },
    enabled: !!currentProductionLineId,
  });

  const { sortedData, handleSort, getSortIcon } = useTableSort(data?.data);

  const navigateToProductVersion = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();

    if (product?.productVersionId) {
      window.open(`/product-versions?versionId=${product.productVersionId}`, '_blank', 'noopener,noreferrer');
      return;
    }

    window.open('/product-versions', '_blank', 'noopener,noreferrer');
  };

  // Client-side column filtering
  const filteredData = useMemo(() => {
    if (!sortedData) return sortedData;
    return sortedData.filter((n: any) => {
      if (colFilterCode && !(n.code || '').toLowerCase().includes(colFilterCode.toLowerCase())) return false;
      if (colFilterDate) {
        const dateValue = normalizeDateForFilter(n.notification_date);
        if (dateValue !== colFilterDate) return false;
      }
      if (colFilterTitle && !(n.title || '').toLowerCase().includes(colFilterTitle.toLowerCase())) return false;
      if (colFilterContent) {
        const content = stripHtml(n.content || '').toLowerCase();
        if (!content.includes(colFilterContent.toLowerCase())) return false;
      }
      if (colFilterZones) {
        const zoneText = (n.zones || []).map((z: any) => cleanZoneName(z.zone_name)).join(' ').toLowerCase();
        if (!zoneText.includes(colFilterZones.toLowerCase())) return false;
      }
      if (colFilterProducts) {
        const prodText = getAffectedProductsForCurrentLine(n.products || [], currentProductionLineId)
          .map((p: any) => `${p.code} ${getProductObjnam(p)}`)
          .join(' ')
          .toLowerCase();
        if (!prodText.includes(colFilterProducts.toLowerCase())) return false;
      }
      if (colFilterTask) {
        const taskText = (n.tasks || []).map((t: any) => t.task_number || '').join(' ').toLowerCase();
        if (!taskText.includes(colFilterTask.toLowerCase())) return false;
      }
      // Per-production-line decision filters
      for (const [plIdStr, filterVal] of Object.entries(colFilterDecisions)) {
        if (!filterVal) continue;
        const plId = Number(plIdStr);
        const decision = n.all_decisions?.find((d: any) => d.production_line_id === plId);
        const decVal = (decision?.decision || '-').toLowerCase();
        if (!decVal.includes(filterVal.toLowerCase())) return false;
      }
      return true;
    });
  }, [sortedData, colFilterCode, colFilterDate, colFilterTitle, colFilterContent, colFilterZones, colFilterProducts, colFilterTask, colFilterDecisions, currentProductionLineId]);

  // Query for expanded notification details
  const { data: expandedNotification } = useQuery({
    queryKey: ['notification', expandedId],
    queryFn: async () => {
      const response = await api.get(`/notifications/${expandedId}`);
      return response.data;
    },
    enabled: expandedId !== null && !!currentProductionLineId,
  });

  // Query for notification coordinates
  const { data: coordinates } = useQuery({
    queryKey: ['notificationCoordinates', expandedId],
    queryFn: async () => {
      const response = await api.get(`/notifications/${expandedId}/coordinates`);
      return response.data;
    },
    enabled: expandedId !== null && !!currentProductionLineId,
  });

  // Query for notification comments
  const { refetch: _refetchComments } = useQuery({
    queryKey: ['notificationComments', expandedId],
    queryFn: async () => {
      console.log('Fetching comments for notification:', expandedId);
      const response = await api.get(`/notifications/${expandedId}/comments`);
      console.log('Comments response:', response.data);
      return response.data;
    },
    enabled: expandedId !== null && !!currentProductionLineId,
  });

  // Query for available products (auto-detected) for expanded notification
  const { refetch: refetchAvailableProductsExpanded } = useQuery({
    queryKey: ['availableProductsExpanded', expandedId, currentProductionLineId],
    queryFn: async () => {
      if (!currentProductionLineId || !expandedId) return [];
      const response = await api.get(`/products/for-notification/${expandedId}`, {
        params: { productionLineId: currentProductionLineId }
      });
      return response.data;
    },
    enabled: !!expandedId && !!currentProductionLineId,
  });

  const detectProductsMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await api.post(`/notifications/${notificationId}/detect-products`);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification', expandedId] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await refetchAvailableProductsExpanded();
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ notificationId, decision }: { notificationId: number; decision: 'Ja' | 'Nee' }) => {
      await api.post(`/notifications/${notificationId}/decide`, {
        productionLineId: currentProductionLineId,
        decision,
        notes: notes || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notification', expandedId] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await refetchNotifications();
      setNotes('');
    },
  });

  const bulkDecisionMutation = useMutation({
    mutationFn: async ({ notificationIds, decision }: { notificationIds: number[]; decision: 'Ja' | 'Nee' }) => {
      await Promise.all(
        notificationIds.map(id =>
          api.post(`/notifications/${id}/decide`, {
            productionLineId: currentProductionLineId,
            decision,
            notes: bulkNotes || undefined,
          })
        )
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await refetchNotifications();
      setSelectedIds([]);
      setBulkNotes('');
    },
  });

  const bulkDecisionWithTaskMutation = useMutation({
    mutationFn: async ({ notificationIds, decision, taskMode }: { notificationIds: number[]; decision: 'Ja' | 'Nee'; taskMode: 'individual' | 'combined' }) => {
      await api.post('/notifications/bulk-decide', {
        notificationIds,
        productionLineId: currentProductionLineId,
        decision,
        notes: bulkNotes || undefined,
        taskMode,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await refetchNotifications();
      setSelectedIds([]);
      setBulkNotes('');
      setShowTaskCreationModal(false);
      setPendingDecision(null);
      alert('Beslissingen verwerkt en taken aangemaakt!');
    },
    onError: (error: any) => {
      console.error('Bulk decision with task error:', error);
      alert(`Fout bij verwerken beslissingen: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  const createNotificationMutation = useMutation({
    mutationFn: async (notificationData: any) => {
      const response = await api.post('/notifications', notificationData);
      return response.data;
    },
    onSuccess: async (data: any) => {
      // Upload pending attachments
      if (newNotificationAttachments.length > 0) {
        const notificationId = data.id;
        const failedUploads: string[] = [];
        for (const file of newNotificationAttachments) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            await api.post(`/notifications/${notificationId}/attachments`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (err) {
            console.error('Error uploading attachment:', err);
            failedUploads.push(file.name);
          }
        }
        if (failedUploads.length > 0) {
          alert(`Melding aangemaakt, maar ${failedUploads.length} bijlage(n) konden niet worden geüpload: ${failedUploads.join(', ')}`);
        } else {
          alert('Melding succesvol aangemaakt met bijlagen!');
        }
      } else {
        alert('Melding succesvol aangemaakt!');
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setShowNewNotificationModal(false);
      setNewNotification({
        code: '',
        title: '',
        content: '',
        source: 'Vlaamse Hydrografie',
        sourceDetail: '',
        notificationDate: new Date().toISOString().split('T')[0],
        opmerkingen: '',
      });
      setNewNotificationGeometries([]);
      setNewNotificationDrawingMode('none');
      setNewNotificationInputMode('draw');
      setNewNotificationManualCoords({ lat: '', lon: '' });
      setNewNotificationGeometryName('');
      setNewNotificationGeometryDescription('');
      setNewNotificationAttachments([]);
    },
    onError: (error: any) => {
      console.error('Error creating notification:', error);
      alert(`Fout bij aanmaken melding: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  // Fetch available zones
  const { data: availableZones } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const response = await api.get('/coverages/zones');
      return response.data;
    },
  });

  // Add zone mutation
  const addZoneMutation = useMutation({
    mutationFn: async ({ notificationId, zoneCoverageId }: { notificationId: number; zoneCoverageId: number }) => {
      await api.post(`/notifications/${notificationId}/zones/${zoneCoverageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification', zoneManagementNotificationId] });
      setShowZoneManagementDialog(false);
      setSelectedZoneId('');
    },
  });

  // Remove zone mutation
  const removeZoneMutation = useMutation({
    mutationFn: async ({ notificationId, zoneCoverageId }: { notificationId: number; zoneCoverageId: number }) => {
      await api.delete(`/notifications/${notificationId}/zones/${zoneCoverageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification', zoneManagementNotificationId] });
    },
  });

  const handleDecision = async (notificationId: number, decision: 'Ja' | 'Nee') => {
    decisionMutation.mutate({ notificationId, decision });
  };

  const handleCreateNotification = () => {
    if (!newNotification.title.trim()) {
      alert('Titel is verplicht');
      return;
    }
    if (!newNotification.notificationDate) {
      alert('Meldingsdatum is verplicht');
      return;
    }
    const dataToSend = {
      ...newNotification,
      geometries: newNotificationGeometries.length > 0 ? JSON.stringify(newNotificationGeometries) : null,
    };
    console.log('[Notifications] Creating notification with data:', { title: dataToSend.title, source: dataToSend.source, hasGeometries: !!dataToSend.geometries });
    createNotificationMutation.mutate(dataToSend);
  };

  const handleNewNotificationShapeCreated = (geometry: any) => {
    const geometryWithMeta = {
      geometry,
      name: newNotificationGeometryName,
      description: newNotificationGeometryDescription,
    };
    setNewNotificationGeometries(prev => [...prev, geometryWithMeta]);
    setNewNotificationDrawingMode('none');
    setNewNotificationGeometryName('');
    setNewNotificationGeometryDescription('');
  };

  const handleAddManualCoordinateToNewNotification = () => {
    const lat = parseFloat(newNotificationManualCoords.lat);
    const lon = parseFloat(newNotificationManualCoords.lon);
    
    if (isNaN(lat) || isNaN(lon)) {
      alert('Voer geldige coördinaten in');
      return;
    }
    
    if (lat < -90 || lat > 90) {
      alert('Breedtegraad moet tussen -90 en 90 liggen');
      return;
    }
    
    if (lon < -180 || lon > 180) {
      alert('Lengtegraad moet tussen -180 en 180 liggen');
      return;
    }
    
    const geometry = {
      type: 'Point',
      coordinates: [lon, lat]
    };
    
    const geometryWithMeta = {
      geometry,
      name: newNotificationGeometryName,
      description: newNotificationGeometryDescription,
    };
    
    setNewNotificationGeometries(prev => [...prev, geometryWithMeta]);
    setNewNotificationManualCoords({ lat: '', lon: '' });
    setNewNotificationGeometryName('');
    setNewNotificationGeometryDescription('');
  };

  const applyImportedEmailData = ({
    from,
    subject,
    content,
    attachments,
  }: {
    from?: string;
    subject?: string;
    content?: string;
    attachments?: File[];
  }) => {
    setNewNotification((prev) => ({
      ...prev,
      sourceDetail: from?.trim() ? from : prev.sourceDetail,
      title: subject?.trim() ? subject : prev.title,
      content: content?.trim() ? content : prev.content,
    }));

    if (attachments && attachments.length > 0) {
      setNewNotificationAttachments((prev) => {
        const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}`));
        const uniqueNew = attachments.filter((file) => !existingKeys.has(`${file.name}-${file.size}`));
        return [...prev, ...uniqueNew];
      });
    }
  };

  const parseEmlFile = async (file: File) => {
    const parser = new PostalMime();
    const parsed = await parser.parse(await file.arrayBuffer());

    const from = formatEmailSourceDetail(parsed.from?.name, parsed.from?.address);
    const subject = String(parsed.subject || '').trim();
    const htmlContent = String(parsed.html || '').trim();
    const textContent = String(parsed.text || '').trim();
    const content = htmlContent
      ? sanitizeImportedEmailHtml(htmlContent)
      : plainTextToHtml(textContent);

    const attachments = (parsed.attachments || [])
      .map((attachment: any, index: number) => {
        const fileName = attachment.filename || `attachment-${index + 1}`;
        const contentType = attachment.mimeType || 'application/octet-stream';
        const attachmentContent = attachment.content;
        if (!attachmentContent) return null;
        const blob = new Blob([attachmentContent], { type: contentType });
        return new File([blob], fileName, { type: contentType });
      })
      .filter(Boolean) as File[];

    return { from, subject, content, attachments };
  };

  const parseMsgFile = async (file: File) => {
    const msgModule: any = await import('msgreader');
    const MsgReaderCtor = msgModule.default || msgModule.MSGReader || msgModule;
    const msgReader = new MsgReaderCtor(await file.arrayBuffer());

    const fileData = msgReader.getFileData();
    const from = formatEmailSourceDetail(fileData.senderName, fileData.senderEmail);
    const subject = String(fileData.subject || '').trim();
    const htmlContent = String(fileData.bodyHTML || '').trim();
    const textContent = String(fileData.body || '').trim();
    const content = htmlContent
      ? sanitizeImportedEmailHtml(htmlContent)
      : plainTextToHtml(textContent);

    const attachmentsMeta = Array.isArray(fileData.attachments) ? fileData.attachments : [];
    const attachments: File[] = [];

    attachmentsMeta.forEach((meta: any, index: number) => {
      try {
        const attachmentData = msgReader.getAttachment(meta);
        const contentBytes = attachmentData?.content;
        if (!contentBytes) return;
        const fileName = attachmentData.fileName || meta.fileName || `attachment-${index + 1}`;
        const mimeType = attachmentData.mime || 'application/octet-stream';
        const blob = new Blob([contentBytes], { type: mimeType });
        attachments.push(new File([blob], fileName, { type: mimeType }));
      } catch (attachmentError) {
        console.error('Error parsing MSG attachment:', attachmentError);
      }
    });

    return { from, subject, content, attachments };
  };

  const importEmailFile = async (file: File) => {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.eml') && !fileName.endsWith('.msg')) {
      alert('Gebruik een .eml of .msg bestand.');
      return;
    }

    try {
      const parsed = fileName.endsWith('.eml')
        ? await parseEmlFile(file)
        : await parseMsgFile(file);

      applyImportedEmailData(parsed);
      alert(`E-mail geïmporteerd.${parsed.attachments?.length ? ` ${parsed.attachments.length} bijlage(n) toegevoegd.` : ''}`);
    } catch (error: any) {
      console.error('Email import error:', error);
      alert(`Kon e-mailbestand niet verwerken: ${error?.message || 'onbekende fout'}`);
    }
  };

  const handleEmailFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await importEmailFile(files[0]);
    e.target.value = '';
  };

  const handleEmailDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEmailDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    await importEmailFile(files[0]);
  };

  const handleBulkDecision = async (decision: 'Ja' | 'Nee') => {
    if (selectedIds.length === 0) {
      alert('Selecteer eerst meldingen');
      return;
    }
    
    // For single notification or "Nee" decision, proceed as normal
    if (selectedIds.length === 1 || decision === 'Nee') {
      if (confirm(`Weet je zeker dat je "${decision}" wilt beslissen voor ${selectedIds.length} melding(en)?`)) {
        bulkDecisionMutation.mutate({ notificationIds: selectedIds, decision });
      }
    } else {
      // For multiple notifications with "Ja" decision, show task creation options
      setPendingDecision(decision);
      setShowTaskCreationModal(true);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data?.data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data?.data.map((n: any) => n.id) || []);
    }
  };

  const clearColumnFilters = () => {
    setColFilterCode('');
    setColFilterDatePicker('');
    setColFilterDate('');
    setColFilterTitle('');
    setColFilterContent('');
    setColFilterZones('');
    setColFilterProducts('');
    setColFilterTask('');
    setColFilterDecisions({});
  };

  const hasColumnFilters = colFilterCode || colFilterDate || colFilterTitle || colFilterContent || colFilterZones || colFilterProducts || colFilterTask || Object.values(colFilterDecisions).some(Boolean);

  const clearAllFilters = () => {
    setSearch('');
    setShowAllNotices(false);
    clearColumnFilters();
    setPage(1);
  };

  const hasActiveFilters = hasColumnFilters || search || showAllNotices;

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setNotes('');
    } else {
      setExpandedId(id);
      setNotes('');
    }
  };

  // Handle resizing for expanded notification view
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const container = document.getElementById(`resizable-container-${expandedId}`);
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Constrain between 20% and 80%
      if (newLeftWidth >= 20 && newLeftWidth <= 80) {
        setExpandedLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, expandedId]);

  if (!currentProductionLineId) {
    return (
      <div>
        <h1 className="page-title">Meldingen</h1>
        <div className="alert alert-warning">
          Geen productielijn geselecteerd. Selecteer eerst een productielijn om meldingen te bekijken.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className={`page-title${!isDefaultLine && activeLineName ? ' page-title--non-default' : ''}`}>
        Meldingen
        {activeLineName && (
          <span className="page-title__production-line">
            {' — '}{activeLineName}
            {isDefaultLine && <span className="page-title__default-badge"> (standaard)</span>}
          </span>
        )}
      </h1>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Zoeken in alle velden..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={showAllNotices ? 'all' : 'undecided'}
          onChange={(e) => {
            setShowAllNotices(e.target.value === 'all');
            setPage(1);
          }}
        >
          <option value="undecided">Alleen niet beslist</option>
          <option value="all">Alle meldingen</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="btn-danger"
          >
            ✕ Wis alle filters
          </button>
        )}

        <button
          onClick={() => setShowNewNotificationModal(true)}
          className="btn-success"
        >
          + Nieuwe Melding
        </button>
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-panel">
          <div className="bulk-panel__header">
            <span className="bulk-panel__count">
              {selectedIds.length} melding(en) geselecteerd
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="btn-secondary btn-sm"
            >
              Deselecteer alles
            </button>
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#343a40' }}>
              Opmerkingen voor alle geselecteerde meldingen (optioneel)
            </label>
            <SunEditor
              setContents={bulkNotes}
              onChange={setBulkNotes}
              placeholder="Voeg opmerkingen toe voor alle geselecteerde meldingen..."
              height="200px"
              setOptions={{
                buttonList: [
                  ['bold', 'italic', 'underline'],
                  ['list'],
                  ['table'],
                  ['link', 'image'],
                  ['blockquote']
                ]
              }}
            />
          </div>

          <div className="bulk-panel__actions">
            <button
              onClick={() => handleBulkDecision('Ja')}
              disabled={bulkDecisionMutation.isPending}
              className="btn-success btn-lg"
            >
              ✓ Ja voor alle {selectedIds.length}
            </button>
            <button
              onClick={() => handleBulkDecision('Nee')}
              disabled={bulkDecisionMutation.isPending}
              className="btn-danger btn-lg"
            >
              ✗ Niet nodig voor alle {selectedIds.length}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="loading-text">Laden...</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th style={{ width: '50px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === data?.data.length && data?.data.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                  />
                </th>
                <th onClick={() => handleSort('code')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Code{getSortIcon('code')}
                </th>
                <th onClick={() => handleSort('notification_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Datum{getSortIcon('notification_date')}
                </th>
                <th onClick={() => handleSort('received_date')} style={{ cursor: 'pointer', userSelect: 'none', display: 'none' }}>
                  Ontvangen{getSortIcon('received_date')}
                </th>
                <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Titel{getSortIcon('title')}
                </th>
                <th>Inhoud</th>
                <th style={{ display: 'none' }}>Locatie</th>
                <th>Zone(s)</th>
                <th>Producten</th>
                <th style={{ minWidth: '80px' }}>Taak</th>
                {orderedProductionLines.map((pl: ProductionLine) => (
                  <th 
                    key={pl.id} 
                    style={{ 
                      minWidth: '80px',
                      textAlign: 'center',
                      backgroundColor: pl.id === currentProductionLineId ? '#0066cc' : undefined,
                      color: pl.id === currentProductionLineId ? '#fff' : undefined,
                      fontWeight: pl.id === currentProductionLineId ? 'bold' : undefined,
                      borderLeft: pl.id === currentProductionLineId ? '4px solid #004080' : undefined,
                      borderRight: pl.id === currentProductionLineId ? '4px solid #004080' : undefined,
                      borderTop: pl.id === currentProductionLineId ? '4px solid #004080' : undefined,
                      position: 'relative',
                      boxShadow: pl.id === currentProductionLineId ? '0 2px 8px rgba(0, 102, 204, 0.3)' : undefined
                    }} 
                    title={pl.name + (pl.id === currentProductionLineId ? ' (actief)' : '')}
                  >
                    {pl.id === currentProductionLineId && '★ '}{pl.code}
                  </th>
                ))}
                <th>Acties</th>
              </tr>
              <tr className="col-filter-row">
                <th style={{ padding: '0.25rem' }}>
                  {hasColumnFilters && (
                    <button
                      onClick={clearColumnFilters}
                      title="Wis kolomfilters"
                      className="btn-danger btn-sm"
                      style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                    >
                      ✕
                    </button>
                  )}
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input type="text" value={colFilterCode} onChange={e => setColFilterCode(e.target.value)} placeholder="Code" style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }} />
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input
                    type="date"
                    value={colFilterDatePicker}
                    onChange={e => {
                      const pickerValue = e.target.value;
                      setColFilterDatePicker(pickerValue);

                      if (!pickerValue) {
                        setColFilterDate('');
                        return;
                      }

                      const [year, month, day] = pickerValue.split('-');
                      setColFilterDate(`${day}-${month}-${year}`);
                    }}
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                  />
                </th>
                <th style={{ padding: '0.25rem', display: 'none' }}></th>
                <th style={{ padding: '0.25rem' }}>
                  <input type="text" value={colFilterTitle} onChange={e => setColFilterTitle(e.target.value)} placeholder="Titel" style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }} />
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input type="text" value={colFilterContent} onChange={e => setColFilterContent(e.target.value)} placeholder="Inhoud" style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }} />
                </th>
                <th style={{ padding: '0.25rem', display: 'none' }}></th>
                <th style={{ padding: '0.25rem' }}>
                  <input type="text" value={colFilterZones} onChange={e => setColFilterZones(e.target.value)} placeholder="Zone" style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }} />
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input type="text" value={colFilterProducts} onChange={e => setColFilterProducts(e.target.value)} placeholder="Product" style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }} />
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input type="text" value={colFilterTask} onChange={e => setColFilterTask(e.target.value)} placeholder="Taak" style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }} />
                </th>
                {orderedProductionLines.map((pl: ProductionLine) => (
                  <th key={`filter-${pl.id}`} style={{ padding: '0.25rem', textAlign: 'center' }}>
                    <select
                      value={colFilterDecisions[pl.id] || ''}
                      onChange={e => setColFilterDecisions(prev => ({ ...prev, [pl.id]: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.2rem', textAlign: 'center' }}
                    >
                      <option value="">Alle</option>
                      <option value="ja">Ja</option>
                      <option value="nee">Nee</option>
                      <option value="-">-</option>
                    </select>
                  </th>
                ))}
                <th style={{ padding: '0.25rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredData?.map((notification: any) => {
                const geometry = notification.geometry ? JSON.parse(notification.geometry) : null;
                let locationText = '-';
                if (geometry) {
                  if (geometry.type === 'Point') {
                    const [lon, lat] = geometry.coordinates;
                    locationText = `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
                  } else {
                    locationText = geometry.type;
                  }
                }
                
                const isExpanded = expandedId === notification.id;
                
                return (
                  <>
                    <tr 
                      key={notification.id}
                      style={{ 
                        cursor: 'pointer',
                        backgroundColor: isExpanded || selectedIds.includes(notification.id)
                          ? 'var(--color-table-row-active)'
                          : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded && !selectedIds.includes(notification.id)) {
                          e.currentTarget.style.backgroundColor = 'var(--color-table-row-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded && !selectedIds.includes(notification.id)) {
                          e.currentTarget.style.backgroundColor = '';
                        }
                      }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(notification.id)}
                          onChange={() => toggleSelect(notification.id)}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        />
                      </td>
                      <td onClick={() => toggleExpand(notification.id)}>
                        <span style={{ marginRight: '0.5rem' }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        {notification.code || '-'}
                      </td>
                      <td onClick={() => toggleExpand(notification.id)}>
                        {notification.notification_date
                          ? format(parseNotificationDateValue(notification.notification_date) || new Date(notification.notification_date), 'dd/MM/yyyy')
                          : '-'}
                      </td>
                      <td onClick={() => toggleExpand(notification.id)} style={{ display: 'none' }}>
                        {notification.received_date
                          ? format(new Date(notification.received_date), 'dd/MM/yyyy HH:mm')
                          : '-'}
                      </td>
                      <td style={{ maxWidth: '200px', fontWeight: '500' }} onClick={() => toggleExpand(notification.id)}>
                        {notification.title}
                      </td>
                      <td style={{ maxWidth: '250px', fontSize: '0.85rem' }} onClick={() => toggleExpand(notification.id)}>
                        {notification.content ? (
                          <div title={stripHtml(notification.content)}>
                            {stripHtml(notification.content).substring(0, 80)}
                            {stripHtml(notification.content).length > 80 ? '...' : ''}
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'none' }} title={notification.geometry || ''} onClick={() => toggleExpand(notification.id)}>
                        {locationText}
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: '200px' }} onClick={() => toggleExpand(notification.id)}>
                        {notification.zones && notification.zones.length > 0 ? (
                          (() => {
                            const uniqueZones = notification.zones.filter((z: any, index: number, self: any[]) => 
                              index === self.findIndex((t: any) => t.zone_name === z.zone_name)
                            );
                            return (
                              <span title={uniqueZones.map((z: any) => cleanZoneName(z.zone_name)).join(', ')}>
                                {uniqueZones.slice(0, 2).map((z: any) => cleanZoneName(z.zone_name)).join(', ')}
                                {uniqueZones.length > 2 && ` +${uniqueZones.length - 2} meer`}
                              </span>
                            );
                          })()
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '200px', fontSize: '0.85rem' }} onClick={() => toggleExpand(notification.id)}>
                        {(() => {
                          const currentPlProducts = getAffectedProductsForCurrentLine(notification.products || [], currentProductionLineId);
                          if (currentPlProducts.length === 0) return <span className="text-muted">-</span>;
                          
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {currentPlProducts.map((p: any) => (
                                <span
                                  key={p.id}
                                  className="product-tag product-tag--current"
                                  title={`${p.code} - ${getProductObjnam(p)}`}
                                  onClick={(e) => navigateToProductVersion(e, p)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {p.code}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ fontSize: '0.85rem' }} onClick={() => toggleExpand(notification.id)}>
                        {notification.tasks && notification.tasks.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {notification.tasks.map((task: any) => (
                              <a
                                key={task.id}
                                href={`/tasks?search=${task.task_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="task-tag"
                              >
                                {task.task_number}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      {orderedProductionLines.map((pl: ProductionLine) => {
                        const decision = notification.all_decisions?.find((d: any) => d.production_line_id === pl.id);
                        const isActive = pl.id === currentProductionLineId;
                        return (
                          <td 
                            key={pl.id} 
                            onClick={() => toggleExpand(notification.id)} 
                            className={isActive ? 'pl-col--active' : ''}
                            style={{ textAlign: 'center' }}
                          >
                            <span
                              className={`decision-badge ${
                                decision?.decision === 'Ja' ? 'decision-badge--ja' :
                                decision?.decision === 'Nee' ? 'decision-badge--nee' :
                                'decision-badge--empty'
                              }`}
                              title={decision?.decided_at ? `Beslist op ${format(new Date(decision.decided_at), 'dd/MM/yyyy HH:mm')}` : 'Nog geen beslissing'}
                            >
                              {decision?.decision || '-'}
                            </span>
                          </td>
                        );
                      })}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <a
                            href={`/notifications/${notification.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="action-btn action-btn--info"
                            title="Open detail pagina in nieuw tabblad"
                          >
                            Details
                          </a>
                          <button
                            onClick={() => exportNotificationToGML(notification)}
                            className="action-btn action-btn--info"
                            title="Exporteer alle geometrieën naar GML formaat"
                          >
                            GML
                          </button>
                          {(!notification.all_decisions || 
                            !notification.all_decisions.find((d: any) => d.production_line_id === currentProductionLineId)?.decision) && (
                            <>
                              <button
                                onClick={() => handleDecision(notification.id, 'Ja')}
                                className="action-btn action-btn--success"
                              >
                                Ja
                              </button>
                              <button
                                onClick={() => handleDecision(notification.id, 'Nee')}
                                className="action-btn action-btn--danger"
                              >
                                Nee
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && expandedNotification && (
                      <tr key={`${notification.id}-details`}>
                        <td colSpan={12 + productionLines.length} className="expanded-row">
                          <div className="detail-panel">
                            {renderNotificationDetails(expandedNotification)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {data && data.pagination && (
            <div className="pagination">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Vorige
              </button>
              <span style={{ padding: '0.6em 1em' }}>
                Pagina {page} van {data.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === data.pagination.totalPages}
              >
                Volgende
              </button>
            </div>
          )}
        </>
      )}

      {/* New Notification Modal */}
      {showNewNotificationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '2rem',
            width: '90vw',
            height: '85vh',
            minWidth: '680px',
            minHeight: '520px',
            maxWidth: '1200px',
            maxHeight: '95vh',
            resize: 'both',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Nieuwe Melding</h2>
              <button
                onClick={() => {
                  setShowNewNotificationModal(false);
                  setNewNotificationGeometryName('');
                  setNewNotificationGeometryDescription('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Titel <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                  placeholder="Titel van de melding"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Code
                </label>
                <input
                  type="text"
                  value={newNotification.code}
                  onChange={(e) => setNewNotification({ ...newNotification, code: e.target.value })}
                  placeholder="MSI 126/25, BASS 45/25, etc."
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Bron
                  </label>
                  <select
                    value={newNotification.source}
                    onChange={(e) => setNewNotification({ ...newNotification, source: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {NOTIFICATION_SOURCE_OPTIONS.map((sourceOption) => (
                      <option key={sourceOption} value={sourceOption}>
                        {sourceOption}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Bron Detail (persoon/contact)
                  </label>
                  <input
                    type="text"
                    value={newNotification.sourceDetail}
                    onChange={(e) => setNewNotification({ ...newNotification, sourceDetail: e.target.value })}
                    placeholder="Naam, e-mailadres, telefoonnummer, referentie..."
                    style={{ width: '100%' }}
                  />
                  <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#6c757d' }}>
                    Vrij veld: je kan hier bijvoorbeeld een contactpersoon, mailadres, telefoonnummer of interne referentie invullen.
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Meldingsdatum <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="date"
                  value={newNotification.notificationDate}
                  onChange={(e) => setNewNotification({ ...newNotification, notificationDate: e.target.value })}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Inhoud
                </label>
                <textarea
                  value={newNotification.content}
                  onChange={(e) => setNewNotification({ ...newNotification, content: e.target.value })}
                  placeholder="Inhoud van de melding"
                  rows={5}
                  style={{ width: '100%', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Opmerkingen
                </label>
                <textarea
                  value={newNotification.opmerkingen}
                  onChange={(e) => setNewNotification({ ...newNotification, opmerkingen: e.target.value })}
                  placeholder="Extra opmerkingen"
                  rows={3}
                  style={{ width: '100%', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  E-mail import (.eml / .msg)
                </label>
                <input
                  ref={emailFileInputRef}
                  type="file"
                  accept=".eml,.msg"
                  onChange={handleEmailFileInputChange}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => emailFileInputRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEmailDragOver(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEmailDragOver(false);
                  }}
                  onDrop={handleEmailDrop}
                  style={{
                    border: `2px dashed ${isEmailDragOver ? '#0d6efd' : '#ced4da'}`,
                    borderRadius: '8px',
                    padding: '0.9rem 1rem',
                    backgroundColor: isEmailDragOver ? '#e7f1ff' : '#f8f9fa',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#0d6efd', marginBottom: '0.25rem' }}>
                    Sleep hier een e-mailbestand of klik om te kiezen
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#495057' }}>
                    Automatisch invullen: Van/From → Bron Detail, Subject/Onderwerp → Titel, Inhoud → Inhoud, bijlagen → Bijlagen.
                  </div>
                </div>
              </div>

              {/* Attachments */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Bijlagen (optioneel)
                </label>
                <FileUpload
                  onUpload={(file) => setNewNotificationAttachments(prev => [...prev, file])}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.xml,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.zip"
                  maxSize={10485760}
                />
                {newNotificationAttachments.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    {newNotificationAttachments.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '4px',
                          marginBottom: '0.35rem',
                          border: '1px solid #dee2e6',
                          fontSize: '0.9rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          <span>📎</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                          <span style={{ color: '#6c757d', fontSize: '0.8rem', flexShrink: 0 }}>({(file.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewNotificationAttachments(prev => prev.filter((_, i) => i !== index))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc3545',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            padding: '0 0.25rem',
                            flexShrink: 0,
                          }}
                          title="Verwijderen"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Map for adding coordinates */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Locatie (optioneel)
                </label>
                
                {/* Toggle between draw and type */}
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNotificationInputMode('draw');
                      setNewNotificationDrawingMode('none');
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: newNotificationInputMode === 'draw' ? '#0066cc' : '#e9ecef',
                      color: newNotificationInputMode === 'draw' ? 'white' : '#495057',
                      border: newNotificationInputMode === 'draw' ? 'none' : '1px solid #ced4da',
                      fontSize: '0.9rem',
                    }}
                  >
                    🖊️ Tekenen op kaart
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNotificationInputMode('type');
                      setNewNotificationDrawingMode('none');
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: newNotificationInputMode === 'type' ? '#0066cc' : '#e9ecef',
                      color: newNotificationInputMode === 'type' ? 'white' : '#495057',
                      border: newNotificationInputMode === 'type' ? 'none' : '1px solid #ced4da',
                      fontSize: '0.9rem',
                    }}
                  >
                    ⌨️ Coördinaten typen
                  </button>
                </div>

                {/* Manual coordinate input */}
                {newNotificationInputMode === 'type' && (
                  <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <CoordFormatSelector value={coordFormat} onChange={setCoordFormat} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                      {isProjectedFormat(coordFormat) ? (
                        <ProjectedCoordinateInput
                          latValue={newNotificationManualCoords.lat}
                          lonValue={newNotificationManualCoords.lon}
                          onLatChange={(v) => setNewNotificationManualCoords(prev => ({ ...prev, lat: v }))}
                          onLonChange={(v) => setNewNotificationManualCoords(prev => ({ ...prev, lon: v }))}
                          format={coordFormat}
                        />
                      ) : (
                        <>
                          <CoordinateField
                            label="Breedtegraad (°N)"
                            value={newNotificationManualCoords.lat}
                            onChange={(v) => setNewNotificationManualCoords({ ...newNotificationManualCoords, lat: v })}
                            isLatitude={true}
                            format={coordFormat}
                          />
                          <CoordinateField
                            label="Lengtegraad (°E)"
                            value={newNotificationManualCoords.lon}
                            onChange={(v) => setNewNotificationManualCoords({ ...newNotificationManualCoords, lon: v })}
                            isLatitude={false}
                            format={coordFormat}
                          />
                        </>
                      )}
                      <div>
                        <button
                          type="button"
                          onClick={handleAddManualCoordinateToNewNotification}
                          style={{
                            padding: '0.6rem 1rem',
                            background: '#28a745',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          + Toevoegen
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                          Naam (optioneel)
                        </label>
                        <input
                          type="text"
                          value={newNotificationGeometryName}
                          onChange={(e) => setNewNotificationGeometryName(e.target.value)}
                          placeholder="bijv. Ankerplaats, Schipbreuk"
                          style={{ width: '100%', fontSize: '0.9rem', padding: '0.4rem 0.6rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                          Beschrijving (optioneel)
                        </label>
                        <input
                          type="text"
                          value={newNotificationGeometryDescription}
                          onChange={(e) => setNewNotificationGeometryDescription(e.target.value)}
                          placeholder="bijv. Nabij kaap De Haan"
                          style={{ width: '100%', fontSize: '0.9rem', padding: '0.4rem 0.6rem' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Drawing controls */}
                {newNotificationInputMode === 'draw' && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setNewNotificationDrawingMode(newNotificationDrawingMode === 'point' ? 'none' : 'point')}
                        style={{
                          padding: '0.5rem 1rem',
                          background: newNotificationDrawingMode === 'point' ? '#0066cc' : '#6c757d',
                          fontSize: '0.9rem',
                        }}
                      >
                        📍 Punt
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewNotificationDrawingMode(newNotificationDrawingMode === 'line' ? 'none' : 'line')}
                        style={{
                          padding: '0.5rem 1rem',
                          background: newNotificationDrawingMode === 'line' ? '#0066cc' : '#6c757d',
                          fontSize: '0.9rem',
                        }}
                      >
                        📏 Lijn
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewNotificationDrawingMode(newNotificationDrawingMode === 'area' ? 'none' : 'area')}
                        style={{
                          padding: '0.5rem 1rem',
                          background: newNotificationDrawingMode === 'area' ? '#0066cc' : '#6c757d',
                          fontSize: '0.9rem',
                        }}
                      >
                        ⬜ Gebied
                      </button>
                      {newNotificationGeometries.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewNotificationGeometries([]);
                            setNewNotificationDrawingMode('none');
                            setNewNotificationManualCoords({ lat: '', lon: '' });
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#dc3545',
                            fontSize: '0.9rem',
                          }}
                        >
                          🗑️ Verwijder alles
                        </button>
                      )}
                    </div>
                    {newNotificationDrawingMode !== 'none' && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '0.85rem' }}>
                        💡 Klik op de kaart om een {newNotificationDrawingMode === 'point' ? 'punt' : newNotificationDrawingMode === 'line' ? 'lijn' : 'gebied'} te tekenen
                      </div>
                    )}
                    {newNotificationDrawingMode !== 'none' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                            Naam (optioneel)
                          </label>
                          <input
                            type="text"
                            value={newNotificationGeometryName}
                            onChange={(e) => setNewNotificationGeometryName(e.target.value)}
                            placeholder="bijv. Ankerplaats, Schipbreuk"
                            style={{ width: '100%', fontSize: '0.9rem', padding: '0.4rem 0.6rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                            Beschrijving (optioneel)
                          </label>
                          <input
                            type="text"
                            value={newNotificationGeometryDescription}
                            onChange={(e) => setNewNotificationGeometryDescription(e.target.value)}
                            placeholder="bijv. Nabij kaap De Haan"
                            style={{ width: '100%', fontSize: '0.9rem', padding: '0.4rem 0.6rem' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Geometries added confirmation */}
                {newNotificationGeometries.length > 0 && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: '#d4edda', borderRadius: '4px', border: '1px solid #c3e6cb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold', color: '#155724' }}>
                        ✓ {newNotificationGeometries.length} geometrie(s) toegevoegd
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {newNotificationGeometries.map((item, index) => {
                        const geom = item.geometry || item;
                        const name = item.name || '';
                        const description = item.description || '';
                        return (
                          <div
                            key={index}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              padding: '0.5rem 0.75rem',
                              backgroundColor: '#fff',
                              borderRadius: '3px',
                              border: '1px solid #c3e6cb',
                              fontSize: '0.85rem',
                              color: '#155724',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                              <span>
                                {geom.type === 'Point' ? '📍' : geom.type === 'LineString' ? '📏' : geom.type === 'Polygon' ? '⬜' : '◆'}
                                {' '}
                                {geom.type}
                                {geom.type === 'Point' && ` (${geom.coordinates[1].toFixed(6)}°N, ${geom.coordinates[0].toFixed(6)}°E)`}
                              </span>
                              <button
                                type="button"
                                onClick={() => setNewNotificationGeometries(prev => prev.filter((_, i) => i !== index))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#dc3545',
                                  cursor: 'pointer',
                                  fontSize: '1rem',
                                  padding: '0',
                                  lineHeight: '1',
                                }}
                                title="Verwijder deze geometrie"
                              >
                                ✕
                              </button>
                            </div>
                            {name && <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#004085' }}>→ {name}</div>}
                            {description && <div style={{ fontSize: '0.8rem', color: '#333', fontStyle: 'italic' }}>   {description}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* WMS Layers Panel */}
                <div style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setNewNotificationWmsLayersPanelOpen(prev => !prev)}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>
                      WMS Lagen (gis.afdelingkust.be)
                      {newNotificationSelectedWmsLayers.length > 0 && (
                        <span style={{ marginLeft: '0.5rem', color: '#0d6efd', fontWeight: 'normal' }}>({newNotificationSelectedWmsLayers.length} actief)</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>{newNotificationWmsLayersPanelOpen ? '▲ Verbergen' : '▼ Tonen'}</div>
                  </div>
                  {newNotificationWmsLayersPanelOpen && (
                    <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem 1rem' }}>
                      {WMS_LAYERS.map(layer => (
                        <label key={layer.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#495057' }}>
                          <input
                            type="checkbox"
                            checked={newNotificationSelectedWmsLayers.includes(layer.name)}
                            onChange={() =>
                              setNewNotificationSelectedWmsLayers(prev =>
                                prev.includes(layer.name)
                                  ? prev.filter(l => l !== layer.name)
                                  : [...prev, layer.name]
                              )
                            }
                            style={{ cursor: 'pointer' }}
                          />
                          {layer.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <MapContainer
                  center={[51.0, 3.7]}
                  zoom={9}
                  style={{ height: '400px', width: '100%', borderRadius: '4px', border: '1px solid #dee2e6' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* WMS layers from gis.afdelingkust.be */}
                  {newNotificationSelectedWmsLayers.map(layerName => (
                    <WMSTileLayer
                      key={layerName}
                      url={WMS_URL}
                      layers={layerName}
                      format="image/png"
                      transparent={true}
                      version="1.3.0"
                      attribution="&copy; Afdeling Kust"
                    />
                  ))}
                  
                  {newNotificationInputMode === 'draw' && (
                    <DrawControl 
                      onShapeCreated={handleNewNotificationShapeCreated}
                      drawingMode={newNotificationDrawingMode}
                      notificationId="new"
                    />
                  )}

                  {newNotificationGeometries.map((item, index) => {
                    const geom = item.geometry || item;
                    const name = item.name || '';
                    return (
                      geom.type === 'Point' ? (
                        <Marker key={`geom-${index}`} position={[geom.coordinates[1], geom.coordinates[0]]}>
                          <Popup>{name || `Geometrie ${index + 1}`}</Popup>
                        </Marker>
                      ) : (
                        <GeoJSON 
                          key={`geom-${index}`}
                          data={geom}
                          style={{ color: '#0066cc', weight: 3 }}
                        />
                      )
                    );
                  })}
                </MapContainer>
                
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#6c757d' }}>
                  Kaart toont het Belgisch Continentaal Plat
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  onClick={() => {
                    setShowNewNotificationModal(false);
                    setNewNotificationGeometryName('');
                    setNewNotificationGeometryDescription('');
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#6c757d',
                  }}
                >
                  Annuleren
                </button>
                <button
                  onClick={handleCreateNotification}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--color-success)',
                  }}
                  disabled={createNotificationMutation.isPending}
                >
                  {createNotificationMutation.isPending ? 'Bezig...' : 'Aanmaken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {showTaskCreationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Taak Aanmaken</h2>
              <button
                onClick={() => {
                  setShowTaskCreationModal(false);
                  setPendingDecision(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', fontSize: '1rem', color: '#343a40' }}>
                Je hebt <strong>{selectedIds.length} meldingen</strong> geselecteerd met beslissing "<strong>Ja</strong>".
              </p>
              <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem', color: '#6c757d' }}>
                Hoe wil je de taken aanmaken?
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={() => {
                  if (pendingDecision) {
                    bulkDecisionWithTaskMutation.mutate({
                      notificationIds: selectedIds,
                      decision: pendingDecision,
                      taskMode: 'individual'
                    });
                  }
                }}
                disabled={bulkDecisionWithTaskMutation.isPending}
                style={{
                  padding: '1rem 1.5rem',
                  background: '#0066cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                  📋 Aparte taak voor elke melding
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'normal', opacity: 0.9 }}>
                  Maakt {selectedIds.length} afzonderlijke taken aan
                </div>
              </button>

              <button
                onClick={() => {
                  if (pendingDecision) {
                    bulkDecisionWithTaskMutation.mutate({
                      notificationIds: selectedIds,
                      decision: pendingDecision,
                      taskMode: 'combined'
                    });
                  }
                }}
                disabled={bulkDecisionWithTaskMutation.isPending}
                style={{
                  padding: '1rem 1.5rem',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                  📦 Eén taak voor alle meldingen
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'normal', opacity: 0.9 }}>
                  Maakt 1 gecombineerde taak aan voor alle {selectedIds.length} meldingen
                </div>
              </button>

              <button
                onClick={() => {
                  setShowTaskCreationModal(false);
                  setPendingDecision(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                }}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone Management Dialog */}
      {showZoneManagementDialog && zoneManagementNotificationId && (
        <div
          onClick={() => {
            setShowZoneManagementDialog(false);
            setZoneManagementNotificationId(null);
            setSelectedZoneId('');
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Zones Beheren</h3>
            
            {(() => {
              const notification = data?.notifications?.find((n: any) => n.id === zoneManagementNotificationId);
              const uniqueZones = notification?.zones?.filter((zone: any, index: number, self: any[]) => 
                index === self.findIndex((t: any) => t.zone_name === zone.zone_name)
              ) || [];
              return (
                <>
                  {uniqueZones.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Huidige Zones
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {uniqueZones.map((zone: any) => (
                          <span
                            key={zone.id}
                            style={{
                              padding: '0.4rem 0.8rem',
                              backgroundColor: zone.detection_method === 'automatic' ? '#e3f2fd' : '#fff3e0',
                              color: zone.detection_method === 'automatic' ? '#1976d2' : '#f57c00',
                              borderRadius: '16px',
                              fontSize: '0.9rem',
                              border: `1px solid ${zone.detection_method === 'automatic' ? '#90caf9' : '#ffb74d'}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                            title={`${zone.zone_code}${zone.detection_method === 'manual' ? ' (handmatig)' : ' (automatisch)'}`}
                          >
                            <strong>{cleanZoneName(zone.zone_name)}</strong>
                            <button
                              onClick={() => {
                                if (confirm(`Zone "${cleanZoneName(zone.zone_name)}" verwijderen?`)) {
                                  removeZoneMutation.mutate({ 
                                    notificationId: zoneManagementNotificationId, 
                                    zoneCoverageId: zone.kml_coverage_id 
                                  });
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'inherit',
                                cursor: 'pointer',
                                padding: '0',
                                fontSize: '1rem',
                                lineHeight: '1',
                                opacity: 0.7,
                              }}
                              title="Zone verwijderen"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Nieuwe Zone Toevoegen
                    </label>
                    <select
                      value={selectedZoneId}
                      onChange={(e) => setSelectedZoneId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '1rem',
                      }}
                    >
                      <option value="">-- Selecteer een zone --</option>
                      {availableZones && availableZones
                        .filter((zone: any) => 
                          !notification?.zones?.some((nz: any) => nz.kml_coverage_id === zone.id)
                        )
                        .map((zone: any) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name} ({zone.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setShowZoneManagementDialog(false);
                        setZoneManagementNotificationId(null);
                        setSelectedZoneId('');
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Sluiten
                    </button>
                    <button
                      onClick={() => {
                        if (selectedZoneId) {
                          addZoneMutation.mutate({ 
                            notificationId: zoneManagementNotificationId, 
                            zoneCoverageId: parseInt(selectedZoneId) 
                          });
                        }
                      }}
                      disabled={!selectedZoneId || addZoneMutation.isPending}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: selectedZoneId ? '#0066cc' : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: selectedZoneId ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {addZoneMutation.isPending ? 'Toevoegen...' : 'Toevoegen'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );

  function renderNotificationDetails(notification: any) {
    const geometry = parseGeoJsonObject(notification.geometry);
    const mainGeometries = extractRenderableGeometries(geometry);
    let center: [number, number] = [51.0, 3.7]; // Default Flanders center
    let zoom = 9;

    if (geometry) {
      const firstPoint = getFirstCoordinate(geometry);
      if (firstPoint) {
        center = firstPoint;
        const firstGeometry = mainGeometries[0];
        zoom = firstGeometry?.type === 'Point' ? 12 : 10;
      }
    } else if (coordinates && coordinates.length > 0) {
      // If no main geometry but there are coordinates, center on first coordinate
      const firstCoord = coordinates[0];
      if (firstCoord.geometry) {
        try {
          const geom = typeof firstCoord.geometry === 'string' ? JSON.parse(firstCoord.geometry) : firstCoord.geometry;
          if (geom.type === 'Point') {
            center = [geom.coordinates[1], geom.coordinates[0]];
            zoom = 12;
          } else if (geom.type === 'LineString' && geom.coordinates.length > 0) {
            center = [geom.coordinates[0][1], geom.coordinates[0][0]];
            zoom = 10;
          } else if (geom.type === 'Polygon' && geom.coordinates[0].length > 0) {
            center = [geom.coordinates[0][0][1], geom.coordinates[0][0][0]];
            zoom = 10;
          }
        } catch (e) {
          // Keep default center if parsing fails
        }
      } else if (firstCoord.latitude !== null && firstCoord.latitude !== undefined && firstCoord.longitude !== null && firstCoord.longitude !== undefined) {
        center = [parseFloat(firstCoord.latitude), parseFloat(firstCoord.longitude)];
        zoom = 12;
      }
    }
    // If no geometry and no coordinates, shows Flanders overview by default

    return (
      <div id={`resizable-container-${notification.id}`} style={{ display: 'flex', gap: 0 }}>
        {/* Left Column - Details */}
        <div style={{ width: `${expandedLeftWidth}%`, minWidth: '300px', paddingRight: '1rem' }}>
          {/* Basisinformatie */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', color: '#343a40', fontSize: '1.3rem' }}>Basisinformatie</h2>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Code</label>
                <div style={{ color: '#343a40', fontSize: '1rem', fontWeight: '600' }}>{notification.code || '-'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Datum Bericht</label>
                  <div style={{ color: '#343a40' }}>
                    {notification.notification_date 
                      ? format(parseNotificationDateValue(notification.notification_date) || new Date(notification.notification_date), 'dd/MM/yyyy')
                      : '-'}
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Ontvangen</label>
                  <div style={{ color: '#343a40' }}>
                    {notification.received_date 
                      ? format(new Date(notification.received_date), 'dd/MM/yyyy HH:mm')
                      : '-'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Bron Detail</label>
                  <div style={{ color: '#343a40' }}>{notification.source_detail || '-'}</div>
                </div>
              </div>

              {/* Zones Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', fontSize: '0.9rem' }}>
                    Getroffen Zone(s)
                  </label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoneManagementNotificationId(notification.id);
                      setShowZoneManagementDialog(true);
                    }}
                    style={{
                      padding: '0.4rem 0.8rem',
                      backgroundColor: '#0066cc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Zone Toevoegen
                  </button>
                </div>
                {notification.zones && notification.zones.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {notification.zones
                      .filter((zone: any, index: number, self: any[]) => 
                        index === self.findIndex((t: any) => t.zone_name === zone.zone_name)
                      )
                      .map((zone: any) => (
                      <span
                        key={zone.id}
                        style={{
                          padding: '0.4rem 0.8rem',
                          backgroundColor: zone.detection_method === 'automatic' ? '#e3f2fd' : '#fff3e0',
                          color: zone.detection_method === 'automatic' ? '#1976d2' : '#f57c00',
                          borderRadius: '16px',
                          fontSize: '0.85rem',
                          border: `1px solid ${zone.detection_method === 'automatic' ? '#90caf9' : '#ffb74d'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        title={`${zone.zone_code}${zone.detection_method === 'manual' ? ' (handmatig toegevoegd)' : ' (automatisch gedetecteerd)'}`}
                      >
                        <strong>{cleanZoneName(zone.zone_name)}</strong>
                        {zone.detection_method === 'manual' && (
                          <span style={{ fontSize: '0.7rem' }}>✎</span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Weet u zeker dat u de zone "${cleanZoneName(zone.zone_name)}" wilt verwijderen?`)) {
                              removeZoneMutation.mutate({
                                notificationId: notification.id,
                                zoneCoverageId: zone.kml_coverage_id
                              });
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: '#dc3545',
                            padding: '0 0.2rem',
                          }}
                          title="Zone verwijderen"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: '#999', fontSize: '0.9rem' }}>Geen zones gekoppeld</span>
                )}
              </div>

              {/* Products Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '0.9rem' }}>Producten</label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      detectProductsMutation.mutate(notification.id);
                    }}
                    disabled={detectProductsMutation.isPending}
                    style={{
                      padding: '0.25rem 0.6rem',
                      backgroundColor: '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: detectProductsMutation.isPending ? 'wait' : 'pointer',
                      fontSize: '0.8rem',
                      opacity: detectProductsMutation.isPending ? 0.7 : 1,
                    }}
                    title="Producten herberekenen op basis van coördinaten"
                  >
                    {detectProductsMutation.isPending ? '⟳ Bezig...' : '⟳ Herbereken producten'}
                  </button>
                </div>
                {notification.products && notification.products.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {getAffectedProductsForCurrentLine(notification.products, currentProductionLineId)
                      .map((product: any) => (
                        <span
                          key={product.id}
                          style={{
                            padding: '0.3rem 0.6rem',
                            backgroundColor: '#e8f5e9',
                            color: '#2e7d32',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            border: '1px solid #a5d6a7',
                          }}
                        >
                          {product.code} - {getProductObjnam(product)}
                        </span>
                      ))}
                  </div>
                ) : (
                  <span style={{ color: '#999', fontSize: '0.9rem' }}>Geen producten gekoppeld</span>
                )}
              </div>

              {/* Inhoud Section */}
              {notification.content && (
                <div>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Inhoud</label>
                  <div
                    style={{ fontSize: '0.9rem', color: '#343a40', height: '140px', minHeight: '100px', maxHeight: '50vh', resize: 'vertical', overflow: 'auto', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #dee2e6' }}
                    dangerouslySetInnerHTML={{ __html: notification.content }}
                  />
                </div>
              )}

              {/* Opmerkingen Section */}
              {notification.opmerkingen && (
                <div>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Opmerkingen</label>
                  <div
                    style={{ fontSize: '0.9rem', color: '#343a40', maxHeight: '200px', overflow: 'auto', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #dee2e6' }}
                    dangerouslySetInnerHTML={{ __html: notification.opmerkingen }}
                  />
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          style={{
            width: '6px',
            cursor: 'col-resize',
            backgroundColor: '#dee2e6',
            borderRadius: '3px',
            flexShrink: 0,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            const container = document.getElementById(`resizable-container-${notification.id}`);
            if (!container) return;
            const startX = e.clientX;
            const startWidth = expandedLeftWidth;
            const onMouseMove = (moveEvent: MouseEvent) => {
              const containerRect = container.getBoundingClientRect();
              const delta = moveEvent.clientX - startX;
              const deltaPercent = (delta / containerRect.width) * 100;
              const newWidth = Math.min(80, Math.max(20, startWidth + deltaPercent));
              setExpandedLeftWidth(newWidth);
            };
            const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          }}
        />

        {/* Right Column - Map */}
        <div style={{ width: `${100 - expandedLeftWidth}%`, minWidth: '300px', paddingLeft: '1rem' }}>
          {/* WMS Layers Panel */}
          <div style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setWmsLayersPanelOpen(prev => !prev)}
            >
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#495057' }}>
                WMS Lagen (gis.afdelingkust.be)
                {selectedWmsLayers.length > 0 && (
                  <span style={{ marginLeft: '0.5rem', color: '#0d6efd', fontWeight: 'normal' }}>({selectedWmsLayers.length} actief)</span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>{wmsLayersPanelOpen ? '▲ Verbergen' : '▼ Tonen'}</div>
            </div>
            {wmsLayersPanelOpen && (
              <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem 1rem' }}>
                {WMS_LAYERS.map(layer => (
                  <label key={layer.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#495057' }}>
                    <input
                      type="checkbox"
                      checked={selectedWmsLayers.includes(layer.name)}
                      onChange={() =>
                        setSelectedWmsLayers(prev =>
                          prev.includes(layer.name)
                            ? prev.filter(l => l !== layer.name)
                            : [...prev, layer.name]
                        )
                      }
                      style={{ cursor: 'pointer' }}
                    />
                    {layer.title}
                  </label>
                ))}
              </div>
            )}
          </div>

          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '500px', width: '100%', borderRadius: '4px', border: '1px solid #dee2e6' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* WMS layers from gis.afdelingkust.be */}
            {selectedWmsLayers.map(layerName => (
              <WMSTileLayer
                key={layerName}
                url={WMS_URL}
                layers={layerName}
                format="image/png"
                transparent={true}
                version="1.3.0"
                attribution="&copy; Afdeling Kust"
              />
            ))}

            {mainGeometries.map((geom: any, index: number) => (
              <GeoJSON
                key={`main-geometry-${notification.id}-${index}`}
                data={{
                  type: 'Feature',
                  geometry: geom,
                  properties: {
                    code: notification.code,
                    title: notification.title,
                  }
                } as any}
                style={{ color: '#0066cc', weight: 3 }}
                onEachFeature={(feature, layer) => {
                  const code = feature?.properties?.code || notification.code;
                  const title = feature?.properties?.title || notification.title;
                  layer.bindPopup(`<strong>${code || ''}</strong><br/>${title || ''}`);
                }}
              />
            ))}

            {/* Additional coordinates */}
            {coordinates?.map((coord: any) => {
              if (coord.geometry) {
                try {
                  const geom = typeof coord.geometry === 'string' ? JSON.parse(coord.geometry) : coord.geometry;
                  const feature = {
                    type: 'Feature' as const,
                    geometry: geom,
                    properties: { label: coord.label, description: coord.description }
                  };
                  return (
                    <GeoJSON
                      key={coord.id}
                      data={feature}
                      style={{ color: '#f357a1', weight: 3 }}
                    >
                      <Popup>
                        <strong>{coord.label || 'Extra geometrie'}</strong><br />
                        {coord.description}
                      </Popup>
                    </GeoJSON>
                  );
                } catch (e) {
                  return null;
                }
              } else if (coord.latitude !== null && coord.latitude !== undefined && coord.longitude !== null && coord.longitude !== undefined) {
                return (
                  <Marker
                    key={coord.id}
                    position={[parseFloat(coord.latitude), parseFloat(coord.longitude)]}
                  >
                    <Popup>
                      <strong>{coord.label || 'Extra coördinaat'}</strong><br />
                      {coord.description && <>{coord.description}<br /></>}
                      <small style={{ fontFamily: 'monospace' }}>
                        {parseFloat(coord.latitude).toFixed(6)}°N, {parseFloat(coord.longitude).toFixed(6)}°E
                      </small>
                    </Popup>
                  </Marker>
                );
              }
              return null;
            })}

            {/* Product geometries */}
            {getAffectedProductsForCurrentLine(notification.products || [], currentProductionLineId)
              .filter((p: any) => p.geometry)
              .map((product: any) => {
              try {
                const productGeom = typeof product.geometry === 'string' ? JSON.parse(product.geometry) : product.geometry;
                const feature = {
                  type: 'Feature' as const,
                  geometry: productGeom,
                  properties: { code: product.code, name: product.name }
                };
                return (
                  <GeoJSON
                    key={`product-${product.id}`}
                    data={feature}
                    style={{ color: '#2e7d32', weight: 2, fillOpacity: 0.08, dashArray: '6 4' }}
                  >
                    <Popup>
                      <strong>{product.code}</strong><br />
                      {getProductObjnam(product)}
                    </Popup>
                  </GeoJSON>
                );
              } catch (e) {
                return null;
              }
            })}
          </MapContainer>
        </div>
      </div>
    );
  }
}
