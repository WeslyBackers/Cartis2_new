import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  WMSTileLayer,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

interface ProductVersionMapOverviewProps {
  selectedVersion: any;
  productName?: string;
  productCode?: string;
  isExpanded?: boolean;
}

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [bounds, map]);

  return null;
}

export function ProductVersionMapOverview({
  selectedVersion,
  productName: _productName = '',
  productCode: _productCode = '',
  isExpanded = false,
}: ProductVersionMapOverviewProps) {

  const parseGeom = (geom: any): any => {
    if (!geom) return null;
    if (typeof geom === 'string') {
      try {
        return JSON.parse(geom);
      } catch {
        return null;
      }
    }
    return geom;
  };

  const extractRenderableGeometries = (geom: any): any[] => {
    if (!geom) return [];

    const results: any[] = [];

    const traverse = (item: any) => {
      if (!item) return;

      if (item.type === 'FeatureCollection' && Array.isArray(item.features)) {
        item.features.forEach((feature: any) => traverse(feature));
      } else if (item.type === 'Feature') {
        if (item.geometry) {
          results.push(item.geometry);
        }
      } else if (item.type === 'GeometryCollection' && Array.isArray(item.geometries)) {
        item.geometries.forEach((g: any) => results.push(g));
      } else if (
        item.type === 'Point' ||
        item.type === 'LineString' ||
        item.type === 'Polygon' ||
        item.type === 'MultiPoint' ||
        item.type === 'MultiLineString' ||
        item.type === 'MultiPolygon'
      ) {
        results.push(item);
      }
    };

    traverse(geom);
    return results;
  };

  const getFirstCoordinate = (geometry: any): [number, number] | null => {
    if (!geometry) return null;

    const findCoord = (geom: any): [number, number] | null => {
      if (!geom) return null;

      if (geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
        const [lon, lat] = geom.coordinates;
        if (typeof lon === 'number' && typeof lat === 'number') {
          return [lat, lon];
        }
      }

      if (
        (geom.type === 'LineString' || geom.type === 'MultiPoint') &&
        Array.isArray(geom.coordinates)
      ) {
        for (const coord of geom.coordinates) {
          if (Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
            return [coord[1], coord[0]];
          }
        }
      }

      if ((geom.type === 'Polygon' || geom.type === 'MultiLineString') && Array.isArray(geom.coordinates)) {
        for (const ring of geom.coordinates) {
          if (Array.isArray(ring) && ring.length > 0) {
            const coord = ring[0];
            if (Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
              return [coord[1], coord[0]];
            }
          }
        }
      }

      if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
        for (const polygon of geom.coordinates) {
          if (Array.isArray(polygon) && polygon.length > 0) {
            const ring = polygon[0];
            if (Array.isArray(ring) && ring.length > 0) {
              const coord = ring[0];
              if (Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                return [coord[1], coord[0]];
              }
            }
          }
        }
      }

      return null;
    };

    return findCoord(geometry);
  };

  const collectLatLngs = (geometry: any): L.LatLngExpression[] => {
    const points: L.LatLngExpression[] = [];

    const traverse = (item: any) => {
      if (!item) return;

      if (item.type === 'FeatureCollection' && Array.isArray(item.features)) {
        item.features.forEach((feature: any) => traverse(feature));
        return;
      }

      if (item.type === 'Feature') {
        traverse(item.geometry);
        return;
      }

      if (item.type === 'GeometryCollection' && Array.isArray(item.geometries)) {
        item.geometries.forEach((geometryItem: any) => traverse(geometryItem));
        return;
      }

      if (item.type === 'Point' && Array.isArray(item.coordinates) && item.coordinates.length >= 2) {
        points.push([item.coordinates[1], item.coordinates[0]]);
        return;
      }

      if ((item.type === 'LineString' || item.type === 'MultiPoint') && Array.isArray(item.coordinates)) {
        item.coordinates.forEach((coord: any) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            points.push([coord[1], coord[0]]);
          }
        });
        return;
      }

      if ((item.type === 'Polygon' || item.type === 'MultiLineString') && Array.isArray(item.coordinates)) {
        item.coordinates.forEach((ring: any) => {
          if (Array.isArray(ring)) {
            ring.forEach((coord: any) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                points.push([coord[1], coord[0]]);
              }
            });
          }
        });
        return;
      }

      if (item.type === 'MultiPolygon' && Array.isArray(item.coordinates)) {
        item.coordinates.forEach((polygon: any) => {
          if (Array.isArray(polygon)) {
            polygon.forEach((ring: any) => {
              if (Array.isArray(ring)) {
                ring.forEach((coord: any) => {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    points.push([coord[1], coord[0]]);
                  }
                });
              }
            });
          }
        });
      }
    };

    traverse(geometry);
    return points;
  };

  const { productGeometries, noticeGeometries, linkedNoticeCount, centerCoordinates, mapBounds } = useMemo(() => {
    const productGeoms: any[] = [];
    const noticeGeoms: Array<{ noticeCode: string; noticeTitle: string; geometry: any; taskNumber: string }> = [];
    const linkedNoticeKeys = new Set<string>();
    let firstCoord: [number, number] | null = null;
    const boundsPoints: L.LatLngExpression[] = [];

    const addGeometryToBounds = (geometry: any) => {
      boundsPoints.push(...collectLatLngs(geometry));
    };

    // Extract product geometry
    if (selectedVersion?.product_geometry) {
      const parsed = parseGeom(selectedVersion.product_geometry);
      if (parsed) {
        const renderables = extractRenderableGeometries(parsed);
        productGeoms.push(...renderables);
        renderables.forEach(addGeometryToBounds);
        if (!firstCoord) {
          for (const geom of renderables) {
            const coord = getFirstCoordinate(geom);
            if (coord) {
              firstCoord = coord;
              break;
            }
          }
        }
      }
    }

    // Extract notice geometries from tasks
    if (selectedVersion?.tasks && Array.isArray(selectedVersion.tasks)) {
      selectedVersion.tasks.forEach((task: any) => {
        const notices = task.notice_geometries || [];
        if (Array.isArray(notices)) {
          notices.forEach((notice: any) => {
            const linkedNoticeKey = String(notice.id || notice.code || `${notice.title || ''}|${task.task_number || ''}`);
            if (linkedNoticeKey) {
              linkedNoticeKeys.add(linkedNoticeKey);
            }

            const parsed = parseGeom(notice.geometry);
            if (parsed) {
              const renderables = extractRenderableGeometries(parsed);
              renderables.forEach((geom: any) => {
                noticeGeoms.push({
                  noticeCode: notice.code || 'Notice',
                  noticeTitle: notice.title || '',
                  geometry: geom,
                  taskNumber: task.task_number,
                });
                addGeometryToBounds(geom);
                if (!firstCoord) {
                  const coord = getFirstCoordinate(geom);
                  if (coord) {
                    firstCoord = coord;
                  }
                }
              });

              const coordinateGeometries = notice.coordinates || [];
              if (Array.isArray(coordinateGeometries)) {
                coordinateGeometries.forEach((coordinate: any) => {
                  const coordinateGeometry = coordinate?.geometry
                    ? parseGeom(coordinate.geometry)
                    : (coordinate?.latitude !== undefined && coordinate?.longitude !== undefined
                        ? {
                            type: 'Point',
                            coordinates: [Number(coordinate.longitude), Number(coordinate.latitude)],
                          }
                        : null);

                  if (!coordinateGeometry) return;

                  const coordinateRenderables = extractRenderableGeometries(coordinateGeometry);
                  coordinateRenderables.forEach((geom: any) => {
                    noticeGeoms.push({
                      noticeCode: notice.code || 'Notice',
                      noticeTitle: notice.title || '',
                      geometry: geom,
                      taskNumber: task.task_number,
                    });
                    addGeometryToBounds(geom);
                    if (!firstCoord) {
                      const coord = getFirstCoordinate(geom);
                      if (coord) {
                        firstCoord = coord;
                      }
                    }
                  });
                });
              }
            }
          });
        }
      });
    }

    const mapBounds = boundsPoints.length > 0 ? L.latLngBounds(boundsPoints) : null;

    return {
      productGeometries: productGeoms,
      noticeGeometries: noticeGeoms,
      linkedNoticeCount: linkedNoticeKeys.size,
      centerCoordinates: firstCoord ?? ([52.1326, 5.2913] as [number, number]), // Default center (Netherlands)
      mapBounds,
    };
  }, [selectedVersion]);

  const mapHeight = isExpanded ? 'calc(100vh - 200px)' : '400px';
  const hasGeometries = productGeometries.length > 0 || noticeGeometries.length > 0;

  const [selectedWmsLayers, setSelectedWmsLayers] = useState<string[]>([]);
  const [wmsLayersPanelOpen, setWmsLayersPanelOpen] = useState(false);

  const toggleWmsLayer = (layerName: string) => {
    setSelectedWmsLayers(prev =>
      prev.includes(layerName) ? prev.filter(l => l !== layerName) : [...prev, layerName]
    );
  };

  if (!hasGeometries) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          color: '#6c757d',
          textAlign: 'center',
          marginBottom: '1rem',
        }}
      >
        Geen geometrieën beschikbaar
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* WMS Layers Panel */}
      <div style={{ marginBottom: '0.5rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setWmsLayersPanelOpen(prev => !prev)}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#495057' }}>
            🛰️ Nautisch Portaal lagen
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
                  onChange={() => toggleWmsLayer(layer.name)}
                  style={{ cursor: 'pointer' }}
                />
                {layer.title}
              </label>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          height: mapHeight,
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          position: 'relative',
        }}
      >
        <MapContainer
          center={centerCoordinates}
          zoom={9}
          style={{ height: '100%', width: '100%' }}
          key={`map-${centerCoordinates.join(',')}`}
        >
          {mapBounds && <FitBounds bounds={mapBounds} />}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Nautisch Portaal WMS layers */}
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

          {/* Product Geometry */}
          {productGeometries.map((geometry, idx) => (
            <GeoJSON
              key={`product-${idx}`}
              data={geometry}
              style={() => ({
                color: '#2563eb',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.15,
                dashArray: undefined,
              })}
            />
          ))}

          {/* Notice Geometries */}
          {noticeGeometries.map((item, idx) => (
            <GeoJSON
              key={`notice-${idx}`}
              data={item.geometry}
              style={() => ({
                color: '#16a34a',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.25,
                dashArray: '5,5',
              })}
              onEachFeature={(_feature, layer) => {
                const popupContent = `
                  <div style="font-size: 0.9rem; line-height: 1.4;">
                    <strong>Melding: ${item.noticeCode}</strong><br/>
                    ${item.noticeTitle ? `<div>${item.noticeTitle}</div>` : ''}
                    <div style="margin-top: 0.3rem; color: #666;">Taak: ${item.taskNumber}</div>
                  </div>
                `;
                layer.bindPopup(popupContent);
              }}
            />
          ))}

        </MapContainer>
      </div>

      {/* Legend */}
      <div
        style={{
          padding: '0.75rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '0 0 4px 4px',
          fontSize: '0.9rem',
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#2563eb',
              opacity: 0.15,
              border: '2px solid #2563eb',
              borderRadius: '2px',
            }}
          />
          <span>
            Product ({productGeometries.length})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#16a34a',
              opacity: 0.25,
              border: '2px dashed #16a34a',
              borderRadius: '2px',
            }}
          />
          <span>
            Gekoppelde meldingen ({linkedNoticeCount})
          </span>
        </div>
      </div>
    </div>
  );
}
