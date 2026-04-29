import L from 'leaflet';

/** Ray-casting point-in-polygon for one ring (GeoJSON [lng, lat] coords). */
function raycastInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Pixel distance from point p to the line segment [a, b] (all in container pixels). */
function pixelDistToSegment(p: L.Point, a: L.Point, b: L.Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

const PIXEL_TOLERANCE = 10;

/**
 * Returns true when the given latlng / containerPoint hits the geometry.
 * Works for Polygon, MultiPolygon, LineString, MultiLineString, Point.
 */
export function pointInGeometry(
  lng: number,
  lat: number,
  geom: any,
  map: L.Map,
  containerPoint: L.Point,
): boolean {
  switch (geom.type) {
    case 'Polygon':
      return raycastInRing(lng, lat, geom.coordinates[0]);

    case 'MultiPolygon':
      return geom.coordinates.some((poly: number[][][]) => raycastInRing(lng, lat, poly[0]));

    case 'Point': {
      const ptPx = map.latLngToContainerPoint(L.latLng(geom.coordinates[1], geom.coordinates[0]));
      return Math.hypot(containerPoint.x - ptPx.x, containerPoint.y - ptPx.y) < PIXEL_TOLERANCE * 2;
    }

    case 'LineString': {
      for (let i = 0; i < geom.coordinates.length - 1; i++) {
        const a = map.latLngToContainerPoint(L.latLng(geom.coordinates[i][1], geom.coordinates[i][0]));
        const b = map.latLngToContainerPoint(L.latLng(geom.coordinates[i + 1][1], geom.coordinates[i + 1][0]));
        if (pixelDistToSegment(containerPoint, a, b) < PIXEL_TOLERANCE) return true;
      }
      return false;
    }

    case 'MultiLineString': {
      return geom.coordinates.some((line: number[][]) => {
        for (let i = 0; i < line.length - 1; i++) {
          const a = map.latLngToContainerPoint(L.latLng(line[i][1], line[i][0]));
          const b = map.latLngToContainerPoint(L.latLng(line[i + 1][1], line[i + 1][0]));
          if (pixelDistToSegment(containerPoint, a, b) < PIXEL_TOLERANCE) return true;
        }
        return false;
      });
    }

    default:
      return false;
  }
}

/** Parse geometry string to object, or return object as-is. Returns null on error. */
export function parseGeom(geometry: any): any | null {
  if (!geometry) return null;
  try {
    return typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
  } catch {
    return null;
  }
}
