import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, useMapEvents, WMSTileLayer } from 'react-leaflet';
import { format } from 'date-fns';
import { useState, useEffect, useMemo, useRef } from 'react';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import 'leaflet/dist/leaflet.css';
import { pointInGeometry, parseGeom } from '../utils/mapGeoUtils';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import FileUpload from '../components/FileUpload';
import CoordinateField, { CoordFormatSelector, CoordFormat, isProjectedFormat, ProjectedCoordinateInput } from '../components/CoordinateInput';
import { getApiErrorMessage } from '../utils/errorUtils';

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

// Helper function to check if HTML content is empty
const isHtmlEmpty = (html: string): boolean => {
  if (!html) return true;
  // Remove HTML tags and check if there's any text content
  const text = html.replace(/<[^>]*>/g, '').trim();
  return text === '';
};

// Basic HTML sanitizer for rich-text fields shown with dangerouslySetInnerHTML.
const sanitizeHtmlForDisplay = (html: string): string => {
  if (!html) return '';

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '');
};

const extractEmailAddress = (value: string): string => {
  if (!value) return '';

  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : '';
};

const buildNotificationInfoRequestDraft = (notification: any) => {
  const subject =
    notification?.title?.trim() ||
    `Vraag om meer info over melding ${notification?.code || notification?.id || ''}`.trim();
  const recipient =
    extractEmailAddress(notification?.source_detail || '') ||
    extractEmailAddress(notification?.source || '');
  const reference = notification?.code || notification?.id;

  return {
    recipient,
    subject,
    body: [
      'Beste,',
      '',
      `Graag hadden we meer informatie ontvangen over "${subject}".`,
      reference ? `Referentie: ${reference}` : '',
      '',
      'Alvast bedankt.',
      '',
      'Met vriendelijke groeten,',
    ]
      .filter(Boolean)
      .join('\n'),
  };
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

// Helper function to collect all geometries
const collectAllGeometries = (notification: any, coordinates: any[]) => {
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
          type: 'main',
          source: notification.source || ''
        }
      });
    });
  }
  
  // Add additional coordinates
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

const parseGeoJsonObject = (value: any): any | null => {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
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

// Export to GML format
const exportToGML = (notification: any, coordinates: any[]) => {
  const features = collectAllGeometries(notification, coordinates);
  
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
        gml += `      <${key}>${value}</${key}>
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

function MapResizeHandler({ trigger }: { trigger: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [map, trigger]);

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

interface NotifMapHitItem {
  id: number;
  code: string;
  name: string;
  type?: string;
  geometry: any; // parsed
  rawProduct: any;
}

interface ZoneMapHitItem {
  id: number;
  code: string;
  name: string;
  detectionMethod?: 'automatic' | 'manual' | null;
  geometry: any; // parsed
}

function MapNotifMultiClickHandler({ items, onHit }: {
  items: NotifMapHitItem[];
  onHit: (result: { latlng: L.LatLng; items: NotifMapHitItem[] } | null) => void;
}) {
  const map = useMapEvents({
    click(e) {
      const { lng, lat } = e.latlng;
      const hits = items.filter((item) => {
        if (!item.geometry) return false;
        return pointInGeometry(lng, lat, item.geometry, map, e.containerPoint);
      });
      onHit(hits.length > 0 ? { latlng: e.latlng, items: hits } : null);
    },
  });
  return null;
}

function MapZoneMultiClickHandler({ items, onHit }: {
  items: ZoneMapHitItem[];
  onHit: (result: { latlng: L.LatLng; items: ZoneMapHitItem[] } | null) => void;
}) {
  const map = useMapEvents({
    click(e) {
      const { lng, lat } = e.latlng;
      const hits = items.filter((item) => {
        if (!item.geometry) return false;
        return pointInGeometry(lng, lat, item.geometry, map, e.containerPoint);
      });

      if (hits.length === 0) {
        onHit(null);
        return;
      }

      // Deduplicate by zone id because one zone can contain multiple geometries.
      const uniqueByZoneId = Array.from(new Map(hits.map((item) => [item.id, item])).values());
      onHit({ latlng: e.latlng, items: uniqueByZoneId });
    },
  });

  return null;
}

export default function NotificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentProductionLineId = useAuthStore((state) => state.currentProductionLineId);
  const isZK = currentProductionLineId === 1;
  const [notes, setNotes] = useState('');
  const [opmerkingen, setOpmerkingen] = useState('');
  const [isEditingOpmerkingen, setIsEditingOpmerkingen] = useState(false);
  const [collapsedProductionLines, setCollapsedProductionLines] = useState<Set<number>>(new Set());
  const [collapsedActivities, setCollapsedActivities] = useState(false);
  const [isEmailFormVisible, setIsEmailFormVisible] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isInfoRequestsCollapsed, setIsInfoRequestsCollapsed] = useState(false);
  const [basisinformatieHeight, setBasisinformatieHeight] = useState<number | null>(null);
  
  // Resizable layout state
  const [leftWidth, setLeftWidth] = useState(40); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [isRightPaneCollapsed, setIsRightPaneCollapsed] = useState(false);
  
  // Coordinate management states
  const [showCoordinateForm, setShowCoordinateForm] = useState(false);
  const [newCoordinate, setNewCoordinate] = useState({ latitude: '', longitude: '', label: '', description: '' });
  const [drawingMode, setDrawingMode] = useState<'none' | 'point' | 'line' | 'area'>('none');
  const [pendingGeometry, setPendingGeometry] = useState<any>(null);
  const [inputMode, setInputMode] = useState<'single' | 'manual-line' | 'manual-area'>('single');
  const [manualCoordinates, setManualCoordinates] = useState<Array<{ lat: string; lon: string }>>([{ lat: '', lon: '' }]);
  const [coordFormat, setCoordFormat] = useState<CoordFormat>('DD');
  const [editingCoordinateId, setEditingCoordinateId] = useState<number | null>(null);
  const [editCoordinate, setEditCoordinate] = useState<any>(null);
  const [clickedGeometryCoords, setClickedGeometryCoords] = useState<Array<{ lat: number; lon: number; index: number }> | null>(null);
  const [clickedGeometryLabel, setClickedGeometryLabel] = useState<string>('');
  const [selectedWmsLayers, setSelectedWmsLayers] = useState<string[]>([]);
  const [showWmsLayersOnMap, setShowWmsLayersOnMap] = useState(true);
  const [wmsLayersPanelOpen, setWmsLayersPanelOpen] = useState(false);
  const [showZoneAreas, setShowZoneAreas] = useState(true);
  const [zoneAreaScope, setZoneAreaScope] = useState<'active' | 'all'>('active');
  const [selectedZoneAreaIds, setSelectedZoneAreaIds] = useState<number[]>([]);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Manual product linking states
  const [showAddProductPanel, setShowAddProductPanel] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductsOnMap, setShowProductsOnMap] = useState(true);
  const [selectedMapProductTypes, setSelectedMapProductTypes] = useState<string[]>(['enc', 'ienc', 'pilot_enc', 'chart']);
  const [multiPopup, setMultiPopup] = useState<{ latlng: L.LatLng; items: NotifMapHitItem[] } | null>(null);
  const [zonePopup, setZonePopup] = useState<{ latlng: L.LatLng; items: ZoneMapHitItem[] } | null>(null);
  const zoneHitOnLastMapClickRef = useRef(false);
  const basisinformatieRef = useRef<HTMLDivElement | null>(null);

  // Manual zone linking states
  const [showAddZonePanel, setShowAddZonePanel] = useState(false);
  const [zoneSearchQuery, setZoneSearchQuery] = useState('');

  useEffect(() => {
    document.body.style.overflow = isMapExpanded ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMapExpanded]);

  useEffect(() => {
    if (!isMapExpanded) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMapExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapExpanded]);

  useEffect(() => {
    const element = basisinformatieRef.current;
    if (!element) return;

    const updateHeight = () => {
      setBasisinformatieHeight(element.getBoundingClientRect().height);
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isEditingOpmerkingen, opmerkingen]);

  const { data: notification, isLoading } = useQuery({
    queryKey: ['notification', id],
    queryFn: async () => {
      const response = await api.get(`/notifications/${id}`);
      return response.data;
    },
  });

  // Set opmerkingen when notification loads or updates
  useEffect(() => {
    if (notification) {
      setOpmerkingen(notification.opmerkingen || '');
    }
  }, [notification]);

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (isHtmlEmpty(notes)) {
        throw new Error('Opmerking kan niet leeg zijn');
      }
      console.log('Sending comment with:', {
        notificationId: id,
        productionLineId: currentProductionLineId,
        notes: notes
      });
      await api.post(`/notifications/${id}/comment`, {
        productionLineId: currentProductionLineId,
        notes: notes,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
      setNotes('');
      alert('Opmerking succesvol toegevoegd!');
    },
    onError: (error: any) => {
      console.error('Error adding comment:', error);
      alert(`Fout bij toevoegen opmerking: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(`/notifications/${id}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
      alert('Bestand succesvol geüpload!');
    },
    onError: (error: any) => {
      console.error('Error uploading file:', error);
      alert(`Fout bij uploaden bestand: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      await api.delete(`/notifications/${id}/attachments/${attachmentId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
      alert('Bijlage succesvol verwijderd!');
    },
    onError: (error: any) => {
      console.error('Error deleting attachment:', error);
      alert(`Fout bij verwijderen bijlage: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  const updateOpmerkingenMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/notifications/${id}`, {
        code: notification.code,
        title: notification.title,
        content: notification.content,
        source: notification.source,
        sourceDetail: notification.source_detail,
        notificationDate: notification.notification_date,
        geometry: notification.geometry,
        metadata: notification.metadata,
        opmerkingen: opmerkingen,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
      setIsEditingOpmerkingen(false);
      alert('Opmerkingen succesvol opgeslagen!');
    },
    onError: (error: any) => {
      console.error('Error updating opmerkingen:', error);
      alert(`Fout bij opslaan opmerkingen: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  // Query for notification coordinates
  const { data: coordinates, refetch: refetchCoordinates } = useQuery({
    queryKey: ['notificationCoordinates', id],
    queryFn: async () => {
      const response = await api.get(`/notifications/${id}/coordinates`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: infoRequests } = useQuery({
    queryKey: ['notificationInfoRequests', id],
    queryFn: async () => {
      const response = await api.get(`/notifications/${id}/info-requests`);
      return response.data;
    },
    enabled: !!id,
  });

  // Query for available products (for manual linking and map display)
  const { data: availableProducts } = useQuery({
    queryKey: ['availableProducts', currentProductionLineId],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: { productionLineId: currentProductionLineId, isActive: true }
      });
      return response.data;
    },
    enabled: !!currentProductionLineId,
  });

  // Query for all zone coverages (contains zone geometry for map overlay)
  const { data: availableZones } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const response = await api.get('/coverages/zones');
      return response.data;
    },
  });

  const activeZoneCoverageIds = useMemo<number[]>(() => {
    const ids = (notification?.zones || [])
      .map((zone: any) => Number(zone.product_id || zone.kml_coverage_id))
      .filter((zoneId: number) => Number.isFinite(zoneId));

    return Array.from(new Set<number>(ids));
  }, [notification?.zones]);

  useEffect(() => {
    if (!availableZones || availableZones.length === 0) {
      setSelectedZoneAreaIds([]);
      return;
    }

    const allZoneIds: number[] = availableZones
      .map((zone: any) => Number(zone.id))
      .filter((zoneId: number) => Number.isFinite(zoneId));

    if (zoneAreaScope === 'all') {
      setSelectedZoneAreaIds(allZoneIds);
      return;
    }

    const activeIds: number[] = activeZoneCoverageIds.filter((zoneId) => allZoneIds.includes(zoneId));
    setSelectedZoneAreaIds(activeIds);
  }, [availableZones, zoneAreaScope, activeZoneCoverageIds]);

  const selectedZoneAreas = useMemo(() => {
    if (!availableZones || selectedZoneAreaIds.length === 0) {
      return [];
    }

    const selectedSet = new Set(selectedZoneAreaIds);
    return availableZones.filter((zone: any) => selectedSet.has(Number(zone.id)));
  }, [availableZones, selectedZoneAreaIds]);

  const activeZonesForDisplay = useMemo(() => {
    const uniqueByCoverageId = new Map<number, any>();
    (notification?.zones || []).forEach((zone: any) => {
      const coverageId = Number(zone.product_id || zone.kml_coverage_id);
      if (!Number.isFinite(coverageId)) return;
      if (!uniqueByCoverageId.has(coverageId)) {
        uniqueByCoverageId.set(coverageId, zone);
      }
    });
    return Array.from(uniqueByCoverageId.values());
  }, [notification?.zones]);

  const zoneHitItems = useMemo(() => {
    if (!showZoneAreas || selectedZoneAreas.length === 0) {
      return [] as ZoneMapHitItem[];
    }

    const items: ZoneMapHitItem[] = [];
    selectedZoneAreas.forEach((zone: any) => {
      const zoneGeometry = parseGeoJsonObject(zone.geometry);
      const geometries = extractRenderableGeometries(zoneGeometry);
      const zoneDetection = (notification?.zones || []).find(
        (nz: any) => Number(nz.product_id || nz.kml_coverage_id) === Number(zone.id)
      );
      geometries.forEach((geom: any) => {
        items.push({
          id: Number(zone.id),
          code: zone.code,
          name: zone.name,
          detectionMethod: zoneDetection?.detection_method || null,
          geometry: geom,
        });
      });
    });

    return items;
  }, [selectedZoneAreas, showZoneAreas, notification?.zones]);

  // Link zone to notification mutation
  const addZoneMutation = useMutation({
    mutationFn: async (zoneCoverageId: number) => {
      await api.post(`/notifications/${id}/zones/${zoneCoverageId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
    },
    onError: (error: any) => {
      console.error('Error adding zone:', error);
      alert(`Fout bij toevoegen zone: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  // Unlink zone from notification mutation
  const removeZoneMutation = useMutation({
    mutationFn: async (zoneCoverageId: number) => {
      await api.delete(`/notifications/${id}/zones/${zoneCoverageId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
    },
    onError: (error: any) => {
      console.error('Error removing zone:', error);
      alert(`Fout bij verwijderen zone: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  // Detect zones mutation
  const detectZonesMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/notifications/${id}/detect-zones`);
      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
      alert(`Zone detectie voltooid: ${data.zones?.length || 0} zone(s) gekoppeld.`);
    },
    onError: (error: any) => {
      console.error('Error detecting zones:', error);
      alert(`Fout bij herberekenen zones: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  // Link product to notification mutation
  const linkProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      await api.post('/products/link-to-notification', {
        notificationId: parseInt(id!),
        productId,
        isRelevant: true,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
    },
    onError: (error: any) => {
      console.error('Error linking product:', error);
      alert(`Fout bij koppelen product: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  // Detect products mutation
  const detectProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/notifications/${id}/detect-products`);
      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
      alert(`Productdetectie voltooid: ${data.productsCount} product(en) gekoppeld.`);
    },
    onError: (error: any) => {
      console.error('Error detecting products:', error);
      alert(`Fout bij herberekenen producten: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  const createInfoRequestMutation = useMutation({
    mutationFn: async ({ recipient, subject, body }: { recipient: string; subject: string; body: string }) => {
      const response = await api.post(`/notifications/${id}/info-requests`, {
        recipient,
        subject,
        body,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationInfoRequests', id] });
    },
  });

  // Unlink product from notification mutation
  const unlinkProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      await api.delete(`/products/unlink-from-notification/${id}/${productId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification', id] });
      await queryClient.refetchQueries({ queryKey: ['notification', id] });
    },
    onError: (error: any) => {
      console.error('Error unlinking product:', error);
      alert(`Fout bij ontkoppelen product: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  // Add coordinate mutation
  const addCoordinateMutation = useMutation({
    mutationFn: async (coordinate: any) => {
      await api.post(`/notifications/${id}/coordinates`, coordinate);
    },
    onSuccess: () => {
      refetchCoordinates();
      setShowCoordinateForm(false);
      setNewCoordinate({ latitude: '', longitude: '', label: '', description: '' });
      setDrawingMode('none');
      setPendingGeometry(null);
      setInputMode('single');
      setManualCoordinates([{ lat: '', lon: '' }]);
      setEditingCoordinateId(null);
      setEditCoordinate(null);
    },
  });

  // Update coordinate mutation
  const updateCoordinateMutation = useMutation({
    mutationFn: async ({ coordinateId, coordinate }: { coordinateId: number; coordinate: any }) => {
      await api.put(`/notifications/${id}/coordinates/${coordinateId}`, coordinate);
    },
    onSuccess: () => {
      refetchCoordinates();
      setEditingCoordinateId(null);
      setEditCoordinate(null);
    },
  });

  // Handle shape drawn on map
  const handleShapeCreated = (geometry: any) => {
    setPendingGeometry(geometry);
    setShowCoordinateForm(true);
  };

  // Delete coordinate mutation
  const deleteCoordinateMutation = useMutation({
    mutationFn: async (coordinateId: number) => {
      await api.delete(`/notifications/${id}/coordinates/${coordinateId}`);
    },
    onSuccess: () => {
      refetchCoordinates();
    },
  });

  // Set document title to notification code
  useEffect(() => {
    if (notification?.code) {
      document.title = `${notification.code} - CARTIS`;
    } else if (notification?.id) {
      document.title = `Melding #${notification.id} - CARTIS`;
    }
    // Reset title when component unmounts
    return () => {
      document.title = 'CARTIS 2.0';
    };
  }, [notification]);

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const container = document.getElementById('resizable-container');
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Constrain between 20% and 80%
      if (newLeftWidth >= 20 && newLeftWidth <= 80) {
        setLeftWidth(newLeftWidth);
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
  }, [isResizing]);

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isRightPaneCollapsed) return;
    setIsResizing(false);
  }, [isRightPaneCollapsed]);

  // Handle geometry click to extract and display coordinates
  const handleGeometryClick = (geometry: any, label: string) => {
    const coords: Array<{ lat: number; lon: number; index: number }> = [];
    
    if (geometry.type === 'Point') {
      coords.push({ lon: geometry.coordinates[0], lat: geometry.coordinates[1], index: 0 });
    } else if (geometry.type === 'LineString') {
      geometry.coordinates.forEach((coord: number[], index: number) => {
        coords.push({ lon: coord[0], lat: coord[1], index });
      });
    } else if (geometry.type === 'Polygon') {
      geometry.coordinates[0].forEach((coord: number[], index: number) => {
        coords.push({ lon: coord[0], lat: coord[1], index });
      });
    }
    
    setClickedGeometryCoords(coords);
    setClickedGeometryLabel(label);
  };

  if (isLoading) {
    return <div>Laden...</div>;
  }

  if (!notification) {
    return <div>Melding niet gevonden</div>;
  }

  const infoRequestDraft = buildNotificationInfoRequestDraft(notification);

  const openInfoRequestForm = () => {
    setEmailRecipient(infoRequestDraft.recipient);
    setEmailSubject(infoRequestDraft.subject);
    setEmailBody(infoRequestDraft.body);
    setIsEmailFormVisible(true);
  };

  const handleCreateInfoRequestEmail = async () => {
    if (!emailRecipient.trim()) {
      alert('Voer een ontvanger in');
      return;
    }

    try {
      await createInfoRequestMutation.mutateAsync({
        recipient: emailRecipient.trim(),
        subject: emailSubject.trim(),
        body: emailBody.trim(),
      });

      const query = new URLSearchParams();

      if (emailSubject.trim()) {
        query.set('subject', emailSubject.trim());
      }

      if (emailBody.trim()) {
        query.set('body', emailBody);
      }

      const recipient = emailRecipient.trim();
      const queryString = query.toString();
      const mailtoUrl = `mailto:${recipient}${queryString ? `?${queryString}` : ''}`;

      window.location.href = mailtoUrl;
    } catch (error) {
      console.error('Error saving notification info request:', error);
      alert('Fout bij opslaan van e-mailverzoek');
    }
  };

  const geometry = parseGeoJsonObject(notification.geometry);
  const mainGeometries = extractRenderableGeometries(geometry);
  let center: [number, number] = [51.2, 3.5]; // Default Belgium center
  let zoom = 8;

  if (geometry) {
    const firstPoint = getFirstCoordinate(geometry);
    if (firstPoint) {
      center = firstPoint;
      const firstGeometry = mainGeometries[0];
      zoom = firstGeometry?.type === 'Point' ? 12 : 10;
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Melding Details - {notification.code || `#${notification.id}`}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" onClick={() => setIsRightPaneCollapsed(prev => !prev)}>
            {isRightPaneCollapsed ? 'Toon rechter paneel' : 'Verberg rechter paneel'}
          </button>
          <button onClick={() => navigate('/notifications')}>← Terug naar overzicht</button>
        </div>
      </div>

      <div id="resizable-container" style={{ display: 'flex', gap: '0', marginTop: '1rem', position: 'relative' }}>
        {/* Details Section */}
        <div style={{ width: isRightPaneCollapsed ? '100%' : `${leftWidth}%`, minWidth: '300px', paddingRight: isRightPaneCollapsed ? '0' : '1rem' }}>
          {/* Basisinformatie */}
          <div ref={basisinformatieRef} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#343a40', marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>Basisinformatie</h2>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>Code</label>
                <div style={{ color: '#343a40', fontSize: '1.1rem', fontWeight: '600' }}>{notification.code || '-'}</div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>Omschrijving/Titel</label>
                <div style={{ color: '#343a40', fontSize: '1.1rem' }}>{notification.title}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>Datum Bericht</label>
                  <div style={{ color: '#343a40' }}>
                    {notification.notification_date 
                      ? format(new Date(notification.notification_date), 'dd/MM/yyyy')
                      : '-'}
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>Ontvangen</label>
                  <div style={{ color: '#343a40' }}>
                    {notification.received_date 
                      ? format(new Date(notification.received_date), 'dd/MM/yyyy HH:mm')
                      : '-'}
                  </div>
                </div>
              </div>

<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>Bron</label>
                  <div style={{ color: '#343a40' }}>{notification.source || '-'}</div>
                </div>

                <div>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>Bron Detail</label>
                  <div style={{ color: '#343a40' }}>{notification.source_detail || '-'}</div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block' }}>Actieve Zone(s)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => detectZonesMutation.mutate()}
                      disabled={detectZonesMutation.isPending || !geometry}
                      style={{
                        padding: '0.4rem 0.8rem',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (detectZonesMutation.isPending || !geometry) ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        opacity: (detectZonesMutation.isPending || !geometry) ? 0.7 : 1,
                      }}
                      title={!geometry ? "Geen geometrie beschikbaar voor zone detectie" : "Zones herberekenen op basis van coördinaten"}
                    >
                      {detectZonesMutation.isPending ? '⟳ Bezig...' : '⟳ Herbereken zones'}
                    </button>
                    <button
                      onClick={() => setShowAddZonePanel(!showAddZonePanel)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        backgroundColor: showAddZonePanel ? '#6c757d' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                      }}
                    >
                      {showAddZonePanel ? '✕ Sluiten' : '+ Zone toevoegen'}
                    </button>
                  </div>
                </div>

                {/* Add zone panel */}
                {showAddZonePanel && (
                  <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0f7ff', borderRadius: '6px', border: '1px solid #b8daff' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#004085' }}>
                      Zoek een zone om toe te voegen
                    </label>
                    <input
                      type="text"
                      value={zoneSearchQuery}
                      onChange={(e) => setZoneSearchQuery(e.target.value)}
                      placeholder="Zoek op code of naam..."
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ced4da', marginBottom: '0.5rem' }}
                    />
                    <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: 'white' }}>
                      {(() => {
                        const linkedZoneIds = new Set(activeZoneCoverageIds);
                        const filtered = (availableZones || []).filter((z: any) => {
                          if (linkedZoneIds.has(Number(z.id))) return false;
                          if (!zoneSearchQuery) return true;
                          const q = zoneSearchQuery.toLowerCase();
                          return (z.code?.toLowerCase().includes(q) || z.name?.toLowerCase().includes(q));
                        });

                        if (!availableZones) {
                          return <div style={{ padding: '1rem', color: '#6c757d', textAlign: 'center' }}>Laden...</div>;
                        }
                        if (filtered.length === 0) {
                          return <div style={{ padding: '1rem', color: '#6c757d', textAlign: 'center' }}>Geen zones gevonden</div>;
                        }
                        return filtered.map((z: any) => (
                          <div
                            key={z.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.5rem 0.75rem',
                              borderBottom: '1px solid #f1f3f5',
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e9ecef'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                          >
                            <span style={{ fontSize: '0.9rem' }}>
                              <strong>{z.code}</strong> - {z.name}
                            </span>
                            <button
                              onClick={() => {
                                addZoneMutation.mutate(Number(z.id));
                                setZoneSearchQuery('');
                              }}
                              disabled={addZoneMutation.isPending}
                              style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                flexShrink: 0,
                              }}
                            >
                              + Toevoegen
                            </button>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Linked zones list */}
                {activeZonesForDisplay.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {activeZonesForDisplay.map((zone: any) => (
                      <span
                        key={zone.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.35rem 0.7rem',
                          borderRadius: '14px',
                          fontSize: '0.8rem',
                          border: `1px solid ${zone.detection_method === 'manual' ? '#ffb74d' : '#90caf9'}`,
                          color: zone.detection_method === 'manual' ? '#f57c00' : '#1976d2',
                          backgroundColor: zone.detection_method === 'manual' ? '#fff3e0' : '#e3f2fd',
                        }}
                        title={`${zone.zone_code}${zone.detection_method === 'manual' ? ' (handmatig toegevoegd)' : ' (automatisch gedetecteerd)'}`}
                      >
                        <strong>{zone.zone_name || zone.zone_code}</strong>
                        {zone.detection_method === 'manual' && <span style={{ fontSize: '0.7rem' }}>✎</span>}
                        <button
                          onClick={() => {
                            if (window.confirm(`Weet u zeker dat u zone '${zone.zone_name || zone.zone_code}' wilt ontkoppelen?`)) {
                              removeZoneMutation.mutate(Number(zone.product_id || zone.kml_coverage_id));
                            }
                          }}
                          disabled={removeZoneMutation.isPending}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: zone.detection_method === 'manual' ? '#f57c00' : '#1976d2',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: '0 0.25rem',
                            lineHeight: 1,
                            fontWeight: 'bold',
                          }}
                          title="Ontkoppel zone"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Geen actieve zones</div>
                )}
              </div>

              <div>
                <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.5rem' }}>Gekoppelde Producten</label>
                {(() => {
                  const filteredProducts = (notification.products || []).filter(
                    (p: any) => {
                      if (isIntegratedCorrectionListCode(p?.code)) return false;
                      return currentProductionLineId ? p.production_line_id === currentProductionLineId : true;
                    }
                  );
                  return filteredProducts.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {filteredProducts.map((p: any) => (
                        <span
                          key={p.id}
                          style={{
                            padding: '0.35rem 0.7rem',
                            borderRadius: '14px',
                            fontSize: '0.8rem',
                            border: '1px solid #b2dfdb',
                            color: '#00695c',
                            backgroundColor: '#e0f2f1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                          title={p.name}
                        >
                          <strong>{p.code}</strong>
                          {p.name && <span style={{ color: '#00897b' }}>– {p.name}</span>}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Geen gekoppelde producten</div>
                  );
                })()}
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (isEmailFormVisible) {
                      setIsEmailFormVisible(false);
                      return;
                    }
                    openInfoRequestForm();
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#e67700',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                  }}
                >
                  {isEmailFormVisible ? 'Formulier sluiten' : 'Meer info opvragen'}
                </button>

                {isEmailFormVisible && (
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff8e1', borderRadius: '6px', border: '1px solid #ffe69c' }}>
                    <div style={{ fontWeight: 600, color: '#7a4b00', marginBottom: '0.75rem' }}>
                      Nieuwe e-mail opstellen
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                          Aan
                        </label>
                        <input
                          type="email"
                          value={emailRecipient}
                          onChange={(e) => setEmailRecipient(e.target.value)}
                          placeholder="naam@example.com"
                          style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '0.95rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                          Onderwerp
                        </label>
                        <input
                          type="text"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Onderwerp"
                          style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '0.95rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                          Bericht
                        </label>
                        <textarea
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          rows={8}
                          style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '0.95rem', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={openInfoRequestForm}
                          style={{
                            padding: '0.55rem 0.9rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                          }}
                        >
                          Herstel voorstel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateInfoRequestEmail}
                          disabled={createInfoRequestMutation.isPending || !emailRecipient.trim() || !emailSubject.trim() || !emailBody.trim()}
                          style={{
                            padding: '0.55rem 0.9rem',
                            backgroundColor: '#e67700',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor:
                              createInfoRequestMutation.isPending || !emailRecipient.trim() || !emailSubject.trim() || !emailBody.trim()
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              createInfoRequestMutation.isPending || !emailRecipient.trim() || !emailSubject.trim() || !emailBody.trim()
                                ? 0.7
                                : 1,
                            fontSize: '0.9rem',
                            fontWeight: 600,
                          }}
                        >
                          {createInfoRequestMutation.isPending ? 'Bezig...' : 'Opslaan + Open e-mail'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Opmerkingen Section */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e9ecef' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block' }}>Opmerkingen</label>
                  {!isEditingOpmerkingen ? (
                    <button
                      onClick={() => setIsEditingOpmerkingen(true)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        backgroundColor: '#0066cc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                      }}
                    >
                      {opmerkingen ? 'Bewerken' : 'Toevoegen'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => updateOpmerkingenMutation.mutate()}
                        disabled={updateOpmerkingenMutation.isPending}
                        style={{
                          padding: '0.4rem 0.8rem',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: updateOpmerkingenMutation.isPending ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        {updateOpmerkingenMutation.isPending ? 'Opslaan...' : 'Opslaan'}
                      </button>
                      <button
                        onClick={() => {
                          setOpmerkingen(notification.opmerkingen || '');
                          setIsEditingOpmerkingen(false);
                        }}
                        disabled={updateOpmerkingenMutation.isPending}
                        style={{
                          padding: '0.4rem 0.8rem',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: updateOpmerkingenMutation.isPending ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        Annuleren
                      </button>
                    </div>
                  )}
                </div>
                {isEditingOpmerkingen ? (
                  <div>
                    <SunEditor
                      setContents={opmerkingen}
                      onChange={setOpmerkingen}
                      placeholder="Voeg opmerkingen toe..."
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
                ) : (
                  <div 
                    style={{ 
                      color: '#343a40', 
                      lineHeight: '1.6',
                      padding: '0.75rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      minHeight: '3rem',
                    }}
                    dangerouslySetInnerHTML={{ __html: opmerkingen || '<em style="color: #6c757d;">Geen opmerkingen</em>' }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Inhoud */}
          <div
            style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              color: '#343a40',
              marginBottom: '1.5rem',
              height: basisinformatieHeight ? `${basisinformatieHeight}px` : undefined,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h2 style={{ marginBottom: '1rem', color: '#343a40', flexShrink: 0 }}>Inhoud</h2>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.25rem' }}>
              {notification.content && !isHtmlEmpty(notification.content) ? (
                <div
                  style={{ color: '#343a40', lineHeight: '1.6' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(notification.content) }}
                />
              ) : (
                <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Geen inhoud beschikbaar</div>
              )}
            </div>
          </div>

          {/* Bijlagen */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#343a40', marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', color: '#343a40', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📎 Bijlagen
              {notification.attachments && notification.attachments.length > 0 && (
                <span style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 'normal', 
                  backgroundColor: '#0066cc', 
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px'
                }}>
                  {notification.attachments.length}
                </span>
              )}
            </h2>
            
            {/* Upload Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                color: '#0066cc', 
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                ⬆️ Nieuw bestand uploaden
              </h3>
              <FileUpload 
                onUpload={(file) => uploadMutation.mutate(file)}
                disabled={uploadMutation.isPending}
                maxSize={10485760} // 10MB
              />
              {uploadMutation.isPending && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '4px', color: '#856404', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>⏳</span>
                  <span>Bezig met uploaden...</span>
                </div>
              )}
            </div>

            {/* Separator */}
            {notification.attachments && notification.attachments.length > 0 && (
              <div style={{ borderTop: '2px solid #e9ecef', marginBottom: '1rem' }}>
                <h3 style={{ 
                  fontSize: '1rem', 
                  fontWeight: '600', 
                  color: '#495057', 
                  marginTop: '1rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  📋 Geüploade bestanden ({notification.attachments.length})
                </h3>
              </div>
            )}

            {/* Existing Attachments */}
            {notification.attachments && notification.attachments.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {notification.attachments.map((att: any) => (
                  <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e9ecef';
                      e.currentTarget.style.borderColor = '#adb5bd';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                      e.currentTarget.style.borderColor = '#dee2e6';
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>📄</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#343a40', marginBottom: '0.25rem' }}>{att.filename}</div>
                      <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                        {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : 'Bestandsgrootte onbekend'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={async () => {
                          try {
                            const response = await api.get(`/notifications/${id}/attachments/${att.id}/download`, {
                              responseType: 'blob'
                            });
                            
                            // Create blob URL and trigger download/view
                            const blob = new Blob([response.data], { type: response.headers['content-type'] as string | undefined });
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = att.filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (error: any) {
                            console.error('Download error:', error);
                            // Try to extract the real error message from the server response
                            let msg = 'Fout bij downloaden van bestand';
                            try {
                              const text = await error?.response?.data?.text?.();
                              const parsed = text ? JSON.parse(text) : null;
                              if (parsed?.error) msg = parsed.error;
                            } catch { /* ignore parse errors */ }
                            alert(msg);
                          }
                        }}
                        style={{
                          background: '#0066cc',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                        }}
                        title="Open/download bijlage"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#0052a3';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#0066cc';
                        }}
                      >
                        📥 Bekijk
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Weet u zeker dat u '${att.filename}' wilt verwijderen?`)) {
                            deleteAttachmentMutation.mutate(att.id);
                          }
                        }}
                        disabled={deleteAttachmentMutation.isPending}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem',
                          cursor: deleteAttachmentMutation.isPending ? 'not-allowed' : 'pointer',
                          fontWeight: '600',
                          opacity: deleteAttachmentMutation.isPending ? 0.6 : 1,
                          transition: 'all 0.2s',
                        }}
                        title="Verwijder bijlage"
                        onMouseEnter={(e) => {
                          if (!deleteAttachmentMutation.isPending) {
                            e.currentTarget.style.backgroundColor = '#c82333';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#dc3545';
                        }}
                      >
                        🗑️ Verwijder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lijst Producten */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#343a40', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: '#343a40' }}>
                Gekoppelde Producten
                {notification.products && (() => {
                  const count = notification.products.filter(
                    (p: any) => {
                      if (isIntegratedCorrectionListCode(p?.code)) return false;
                      return currentProductionLineId ? p.production_line_id === currentProductionLineId : true;
                    }
                  ).length;
                  return count > 0 ? (
                    <span style={{ fontSize: '0.85rem', fontWeight: 'normal', backgroundColor: '#0066cc', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '12px', marginLeft: '0.5rem' }}>
                      {count}
                    </span>
                  ) : null;
                })()}
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => detectProductsMutation.mutate()}
                  disabled={detectProductsMutation.isPending}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: detectProductsMutation.isPending ? 'wait' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    opacity: detectProductsMutation.isPending ? 0.7 : 1,
                  }}
                  title="Producten herberekenen op basis van coördinaten"
                >
                  {detectProductsMutation.isPending ? '⟳ Bezig...' : '⟳ Herbereken producten'}
                </button>
              {currentProductionLineId && (
                <button
                  onClick={() => setShowAddProductPanel(!showAddProductPanel)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: showAddProductPanel ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                  }}
                >
                  {showAddProductPanel ? '✕ Sluiten' : '+ Kaart toevoegen'}
                </button>
              )}
              </div>
            </div>

            {/* Add product panel */}
            {showAddProductPanel && currentProductionLineId && (
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0f7ff', borderRadius: '6px', border: '1px solid #b8daff' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#004085' }}>
                  Zoek een kaart/product om toe te voegen
                </label>
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Zoek op code of naam..."
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ced4da', marginBottom: '0.5rem' }}
                />
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: 'white' }}>
                  {(() => {
                    const linkedProductIds = new Set((notification.products || []).map((p: any) => p.id));
                    const filtered = (availableProducts || []).filter((p: any) => {
                      if (isIntegratedCorrectionListCode(p?.code)) return false;
                      if (linkedProductIds.has(p.id)) return false;
                      if (!productSearchQuery) return true;
                      const q = productSearchQuery.toLowerCase();
                      return (p.code?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q));
                    });

                    if (!availableProducts) {
                      return <div style={{ padding: '1rem', color: '#6c757d', textAlign: 'center' }}>Laden...</div>;
                    }
                    if (filtered.length === 0) {
                      return <div style={{ padding: '1rem', color: '#6c757d', textAlign: 'center' }}>Geen producten gevonden</div>;
                    }
                    return filtered.map((p: any) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderBottom: '1px solid #f1f3f5',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e9ecef'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>
                          <strong>{p.code}</strong> - {p.name}
                          {p.type && <span style={{ marginLeft: '0.5rem', color: '#6c757d', fontSize: '0.8rem' }}>({p.type})</span>}
                        </span>
                        <button
                          onClick={() => linkProductMutation.mutate(p.id)}
                          disabled={linkProductMutation.isPending}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            flexShrink: 0,
                          }}
                        >
                          + Toevoegen
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Linked products list */}
            {(() => {
              const filteredProducts = (notification.products || []).filter(
                (p: any) => {
                  if (isIntegratedCorrectionListCode(p?.code)) return false;
                  return currentProductionLineId ? p.production_line_id === currentProductionLineId : true;
                }
              );
              return filteredProducts.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {filteredProducts.map((p: any) => (
                  <span
                    key={p.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5em 1em',
                      backgroundColor: '#e9ecef',
                      borderRadius: '4px',
                      fontWeight: '500',
                    }}
                  >
                    {p.code} - {p.name}
                    {currentProductionLineId && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Weet u zeker dat u '${p.code} - ${p.name}' wilt ontkoppelen?`)) {
                            unlinkProductMutation.mutate(p.id);
                          }
                        }}
                        disabled={unlinkProductMutation.isPending}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc3545',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '0 0.25rem',
                          lineHeight: 1,
                          fontWeight: 'bold',
                        }}
                        title="Ontkoppel product"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Geen gekoppelde producten</div>
            );
            })()}
          </div>

          {/* Beslissing - v2.0 - Always show comment form */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#343a40', marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>Beslissing en Opmerkingen</h2>
            
            {(() => {
              // Check if current production line has already decided
              const currentLineDecision = notification.decisions?.find(
                (d: any) => d.production_line_id === currentProductionLineId
              );
              
              // Show all decisions if any exist
              const hasAnyDecisions = notification.decisions && notification.decisions.length > 0;
              
              console.log('Debug NotificationDetail:', {
                notificationId: id,
                currentProductionLineId,
                hasAnyDecisions,
                currentLineDecision,
                decisions: notification.decisions
              });
              
              return (
                <>
                  {hasAnyDecisions && (
                    <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                      {notification.decisions.map((dec: any) => (
                        <div key={dec.id} style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            {dec.production_line_name} ({dec.production_line_code})
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                            <div>
                              <span style={{ color: '#6c757d' }}>Beslissing: </span>
                              <span style={{ fontWeight: '500' }}>{dec.decision || '-'}</span>
                            </div>
                            {dec.decided_at && (
                              <div>
                                <span style={{ color: '#6c757d' }}>Datum: </span>
                                <span>{format(new Date(dec.decided_at), 'dd/MM/yyyy HH:mm')}</span>
                              </div>
                            )}
                            {dec.first_name && (
                              <div>
                                <span style={{ color: '#6c757d' }}>Door: </span>
                                <span>{dec.first_name} {dec.last_name}</span>
                              </div>
                            )}
                          </div>
                          {dec.notes && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                              <span style={{ color: '#6c757d' }}>Opmerkingen: </span>
                              <div dangerouslySetInnerHTML={{ __html: dec.notes }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Always show comment form */}
                  <div>
                    {!currentProductionLineId && (
                      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107', color: '#856404' }}>
                        ⚠️ <strong>Let op:</strong> Selecteer eerst een productielijn in het menu bovenaan voordat u een opmerking toevoegt.
                      </div>
                    )}
                    {currentLineDecision ? (
                      <p style={{ marginBottom: '1rem', color: '#6c757d', fontStyle: 'italic' }}>
                        {currentLineDecision.decision 
                          ? `Beslissing genomen: ${currentLineDecision.decision}. U kunt nog steeds opmerkingen toevoegen.`
                          : 'U kunt opmerkingen toevoegen of een beslissing nemen.'}
                      </p>
                    ) : (
                      <p style={{ marginBottom: '1rem', color: '#6c757d' }}>
                        {hasAnyDecisions 
                          ? 'Andere productielijnen hebben beslissingen genomen. U kunt nu uw beslissing nemen of opmerkingen toevoegen.'
                          : 'Nog geen beslissing genomen voor deze productielijn.'}
                      </p>
                    )}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#343a40' }}>
                        Opmerkingen {currentLineDecision?.decision ? '(toevoegen/bijwerken)' : '(optioneel)'}
                      </label>
                      <SunEditor
                        setContents={notes}
                        onChange={setNotes}
                        placeholder="Voeg opmerkingen toe..."
                        height="400px"
                        setOptions={{
                          buttonList: [
                            ['formatBlock'],
                            ['bold', 'italic', 'underline', 'strike'],
                            ['list'],
                            ['table'],
                            ['fontColor', 'hiliteColor'],
                            ['link', 'image', 'video'],
                            ['blockquote', 'codeView'],
                            ['removeFormat']
                          ]
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                      <button
                        onClick={() => commentMutation.mutate()}
                        disabled={commentMutation.isPending || isHtmlEmpty(notes) || !currentProductionLineId}
                        style={{ 
                          background: (isHtmlEmpty(notes) || !currentProductionLineId) ? '#6c757d' : 'var(--color-primary)',
                          color: 'white',
                          padding: '0.75rem 1.5rem',
                          fontSize: '1rem',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: (isHtmlEmpty(notes) || !currentProductionLineId) ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold'
                        }}
                        title={!currentProductionLineId ? 'Selecteer eerst een productielijn' : isHtmlEmpty(notes) ? 'Typ eerst een opmerking om op te slaan' : 'Klik om opmerking op te slaan'}
                      >
                        💬 Opmerking opslaan
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {infoRequests && infoRequests.length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#343a40', marginBottom: '1.5rem' }}>
              <h2
                style={{
                  marginBottom: '1rem',
                  color: '#343a40',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  userSelect: 'none',
                }}
                onClick={() => setIsInfoRequestsCollapsed(!isInfoRequestsCollapsed)}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    transform: isInfoRequestsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    fontSize: '1.2rem',
                  }}
                >
                  ▼
                </span>
                Verzoeken om meer informatie ({infoRequests.length})
              </h2>
              {!isInfoRequestsCollapsed && (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {infoRequests.map((request: any) => (
                    <div
                      key={request.id}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '4px',
                        border: '1px solid #e9ecef',
                      }}
                    >
                      <div style={{ fontWeight: '600', color: '#343a40', marginBottom: '0.25rem' }}>
                        Aan: {request.recipient}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                        {request.first_name} {request.last_name} • {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                      </div>
                      <div style={{ fontWeight: '500', color: '#343a40', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                        Onderwerp: {request.subject}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#343a40', lineHeight: '1.5', backgroundColor: '#ffffff', padding: '0.75rem', borderRadius: '4px', border: '1px solid #dee2e6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {request.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Alle Opmerkingen */}
          {notification.comments && notification.comments.length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#343a40', marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>Alle Opmerkingen ({notification.comments.length})</h2>
              
              {(() => {
                // Group comments by production line
                const commentsByLine = notification.comments.reduce((acc: any, comment: any) => {
                  const lineId = comment.production_line_id || 'no-line';
                  if (!acc[lineId]) {
                    acc[lineId] = {
                      name: comment.production_line_name || 'Geen productielijn',
                      code: comment.production_line_code || '',
                      comments: []
                    };
                  }
                  acc[lineId].comments.push(comment);
                  return acc;
                }, {});

                const toggleProductionLine = (lineId: string) => {
                  setCollapsedProductionLines(prev => {
                    const newSet = new Set(prev);
                    const lineIdNum = lineId === 'no-line' ? -1 : Number(lineId);
                    if (newSet.has(lineIdNum)) {
                      newSet.delete(lineIdNum);
                    } else {
                      newSet.add(lineIdNum);
                    }
                    return newSet;
                  });
                };

                return (
                  <div>
                    {Object.entries(commentsByLine).map(([lineId, lineData]: [string, any]) => {
                      const lineIdNum = lineId === 'no-line' ? -1 : Number(lineId);
                      const isCollapsed = !collapsedProductionLines.has(lineIdNum);
                      
                      return (
                        <div key={lineId} style={{ marginBottom: '1rem', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            onClick={() => toggleProductionLine(lineId)}
                            style={{
                              padding: '0.75rem 1rem',
                              backgroundColor: '#f8f9fa',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontWeight: 'bold',
                              color: '#495057',
                              userSelect: 'none',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                          >
                            <span>
                              {lineData.code ? `${lineData.name} (${lineData.code})` : lineData.name} - {lineData.comments.length} {lineData.comments.length === 1 ? 'opmerking' : 'opmerkingen'}
                            </span>
                            <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                              ▼
                            </span>
                          </div>
                          {!isCollapsed && (
                            <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem', backgroundColor: 'white' }}>
                              {lineData.comments.map((comment: any) => (
                                <div key={comment.id} style={{ padding: '1rem', backgroundColor: '#f0f8ff', borderRadius: '4px', border: '1px solid #b8daff' }}>
                                  <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                                    Door: {comment.first_name} {comment.last_name} • {format(new Date(comment.created_at), 'dd/MM/yyyy HH:mm')}
                                  </div>
                                  <div style={{ fontSize: '0.95rem', color: '#343a40', lineHeight: '1.5' }}>
                                    <div dangerouslySetInnerHTML={{ __html: comment.comment }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Gerelateerde Taken */}
          {notification.tasks && notification.tasks.length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#343a40', marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>Gerelateerde Taken</h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {notification.tasks.map((task: any) => (
                  <div key={task.id} style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#343a40' }}>
                          Taak #{task.task_number}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '0.25rem' }}>
                          {task.production_line_name} ({task.production_line_code})
                        </div>
                      </div>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: '12px',
                        backgroundColor: task.baz_number ? '#d4edda' : '#e2e3e5',
                        color: '#343a40',
                        fontWeight: '500'
                      }}>
                        {task.baz_number ? `BaZ ${task.baz_number}` : 'Geen BaZ'}
                      </span>
                    </div>
                    <div style={{ color: '#343a40', marginBottom: '0.5rem' }}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '0.5rem' }}>
                        {task.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.85rem', color: '#6c757d' }}>
                      {task.msi_active && (
                        <span style={{ color: '#856404', fontWeight: '500' }}>⚠️ MSI actief</span>
                      )}
                      {task.needs_followup && (
                        <span style={{ color: '#004085', fontWeight: '500' }}>👁️ Opvolging nodig</span>
                      )}
                      {task.needs_extra_info && (
                        <span style={{ color: '#721c24', fontWeight: '500' }}>ℹ️ Extra info nodig</span>
                      )}
                      <span>
                        Aangemaakt: {format(new Date(task.created_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                      {task.created_by_first_name && (
                        <span>
                          Door: {task.created_by_first_name} {task.created_by_last_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {notification.metadata && Object.keys(notification.metadata).length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#343a40', marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>Extra Informatie (Metadata)</h2>
              <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
                {Object.entries(notification.metadata).map(([key, value]) => (
                  <div key={key} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '1rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', color: '#6c757d' }}>{key}:</div>
                    <div style={{ color: '#343a40', wordBreak: 'break-word' }}>
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!isRightPaneCollapsed && (
        <>
        {/* Resizer */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            width: '8px',
            cursor: 'col-resize',
            backgroundColor: isResizing ? '#0066cc' : '#e0e0e0',
            transition: 'background-color 0.2s',
            position: 'relative',
            flexShrink: 0,
            margin: '0 0.5rem',
            borderRadius: '4px',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = '#0066cc';
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = '#e0e0e0';
            }
          }}
        >
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '3px',
            height: '40px',
            backgroundColor: 'white',
            borderRadius: '2px',
            pointerEvents: 'none'
          }} />
        </div>

        {/* Map Section - Geografisch Overzicht */}
        <div style={{ flex: 1, minWidth: '400px', paddingLeft: '0.5rem' }}>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: '#343a40' }}>Geografisch Overzicht</h2>
              
              {/* Export button */}
              {(geometry || (coordinates && coordinates.length > 0)) && (
                <button
                  onClick={() => exportToGML(notification, coordinates || [])}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    background: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  title="Exporteer alle geometrieën naar GML formaat"
                >
                  📥 Export GML
                </button>
              )}
            </div>
            
            {geometry ? (
              <>
                {geometry.type === 'Point' && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px', color: '#343a40' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Coördinaten</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>
                      {geometry.coordinates[1].toFixed(6)}°N, {geometry.coordinates[0].toFixed(6)}°E
                    </div>
                  </div>
                )}

                {/* Add Coordinates Section */}
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => setShowCoordinateForm(!showCoordinateForm)}
                    style={{ 
                      padding: '0.6rem 1.2rem',
                      background: showCoordinateForm ? '#dc3545' : 'var(--color-success)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {showCoordinateForm ? '✕ Annuleren' : '+ Extra Coördinaten Toevoegen'}
                  </button>
                </div>

                {showCoordinateForm && (
                  <div style={{ 
                    marginBottom: '1rem', 
                    padding: '1rem', 
                    backgroundColor: '#f0f7ff', 
                    borderRadius: '4px',
                    border: '1px solid #0066cc'
                  }}>
                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.95rem', color: '#343a40' }}>
                      {editingCoordinateId ? 'Coördinaat Bewerken' : 'Nieuwe Coördinaat Toevoegen'}
                    </h4>

                    {/* Input mode selector */}
                    {!editingCoordinateId && !pendingGeometry && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                          Invoermethode:
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                          <button
                            onClick={() => { setInputMode('single'); setManualCoordinates([{ lat: '', lon: '' }]); }}
                            style={{ 
                              padding: '0.5rem 1rem',
                              background: inputMode === 'single' ? 'var(--color-primary)' : '#fff',
                              color: inputMode === 'single' ? '#fff' : '#333',
                              border: '2px solid var(--color-primary)',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            📍 Enkel punt
                          </button>
                          <button
                            onClick={() => { setInputMode('manual-line'); setManualCoordinates([{ lat: '', lon: '' }, { lat: '', lon: '' }]); }}
                            style={{ 
                              padding: '0.5rem 1rem',
                              background: inputMode === 'manual-line' ? 'var(--color-primary)' : '#fff',
                              color: inputMode === 'manual-line' ? '#fff' : '#333',
                              border: '2px solid var(--color-primary)',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            📏 Lijn (handmatig)
                          </button>
                          <button
                            onClick={() => { setInputMode('manual-area'); setManualCoordinates([{ lat: '', lon: '' }, { lat: '', lon: '' }, { lat: '', lon: '' }]); }}
                            style={{ 
                              padding: '0.5rem 1rem',
                              background: inputMode === 'manual-area' ? 'var(--color-primary)' : '#fff',
                              color: inputMode === 'manual-area' ? '#fff' : '#333',
                              border: '2px solid var(--color-primary)',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            ⬛ Gebied (handmatig)
                          </button>
                        </div>
                      </div>
                    )}
              
                    {/* Map drawing controls */}
                    {!editingCoordinateId && !pendingGeometry && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                          Of teken op de kaart:
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setDrawingMode('point')}
                            style={{ 
                              padding: '0.5rem 1rem',
                              background: drawingMode === 'point' ? 'var(--color-primary)' : '#fff',
                              color: drawingMode === 'point' ? '#fff' : '#333',
                              border: '2px solid var(--color-primary)',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            📍 Punt
                          </button>
                          <button
                            onClick={() => setDrawingMode('line')}
                            style={{ 
                              padding: '0.5rem 1rem',
                              background: drawingMode === 'line' ? 'var(--color-primary)' : '#fff',
                              color: drawingMode === 'line' ? '#fff' : '#333',
                              border: '2px solid var(--color-primary)',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            📏 Lijn
                          </button>
                          <button
                            onClick={() => setDrawingMode('area')}
                            style={{ 
                              padding: '0.5rem 1rem',
                              background: drawingMode === 'area' ? 'var(--color-primary)' : '#fff',
                              color: drawingMode === 'area' ? '#fff' : '#333',
                              border: '2px solid var(--color-primary)',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            ⬛ Gebied
                          </button>
                          {drawingMode !== 'none' && (
                            <button
                              onClick={() => setDrawingMode('none')}
                              style={{ 
                                padding: '0.5rem 1rem',
                                background: '#dc3545',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              ✕ Annuleren
                            </button>
                          )}
                        </div>
                        {drawingMode !== 'none' && (
                          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                            Klik op de kaart om een {drawingMode === 'point' ? 'punt' : drawingMode === 'line' ? 'lijn' : 'gebied'} te tekenen
                          </p>
                        )}
                      </div>
                    )}

                    {pendingGeometry && (
                      <div style={{ 
                        marginBottom: '1rem', 
                        padding: '0.75rem', 
                        backgroundColor: '#d4edda', 
                        border: '1px solid #c3e6cb',
                        borderRadius: '4px',
                        fontSize: '0.9rem'
                      }}>
                        ✓ Geometrie getekend op de kaart. Voeg een label en beschrijving toe en klik op toevoegen.
                      </div>
                    )}

                    {/* Single point input */}
                    {(inputMode === 'single' || (editingCoordinateId && !editCoordinate?.geometry)) && !pendingGeometry && (
                      <div>
                        <CoordFormatSelector value={coordFormat} onChange={setCoordFormat} />
                        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
                          {isProjectedFormat(coordFormat) ? (
                            <ProjectedCoordinateInput
                              latValue={editingCoordinateId ? editCoordinate?.latitude || '' : newCoordinate.latitude}
                              lonValue={editingCoordinateId ? editCoordinate?.longitude || '' : newCoordinate.longitude}
                              onLatChange={(v) => editingCoordinateId
                                ? setEditCoordinate((prev: any) => prev ? { ...prev, latitude: v } : prev)
                                : setNewCoordinate(prev => ({ ...prev, latitude: v }))
                              }
                              onLonChange={(v) => editingCoordinateId
                                ? setEditCoordinate((prev: any) => prev ? { ...prev, longitude: v } : prev)
                                : setNewCoordinate(prev => ({ ...prev, longitude: v }))
                              }
                              format={coordFormat}
                              style={{ backgroundColor: '#f0f7ff', color: '#000' }}
                            />
                          ) : (
                            <>
                              <CoordinateField
                                label="Breedtegraad (Latitude) *"
                                value={editingCoordinateId ? editCoordinate?.latitude || '' : newCoordinate.latitude}
                                onChange={(v) => editingCoordinateId
                                  ? setEditCoordinate({ ...editCoordinate, latitude: v })
                                  : setNewCoordinate({ ...newCoordinate, latitude: v })
                                }
                                isLatitude={true}
                                format={coordFormat}
                                style={{ backgroundColor: '#f0f7ff', color: '#000' }}
                              />
                              <CoordinateField
                                label="Lengtegraad (Longitude) *"
                                value={editingCoordinateId ? editCoordinate?.longitude || '' : newCoordinate.longitude}
                                onChange={(v) => editingCoordinateId
                                  ? setEditCoordinate({ ...editCoordinate, longitude: v })
                                  : setNewCoordinate({ ...newCoordinate, longitude: v })
                                }
                                isLatitude={false}
                                format={coordFormat}
                                style={{ backgroundColor: '#f0f7ff', color: '#000' }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Geometry edit display */}
                    {editingCoordinateId && editCoordinate?.geometry && (
                      <div style={{ 
                        marginBottom: '0.75rem', 
                        padding: '0.75rem', 
                        backgroundColor: '#fff3cd', 
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        fontSize: '0.9rem'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                          ⚠️ Geometrie bewerken
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                          Type: {(() => {
                            try {
                              const geom = typeof editCoordinate.geometry === 'string' 
                                ? JSON.parse(editCoordinate.geometry) 
                                : editCoordinate.geometry;
                              return `${geom.type} (${
                                geom.type === 'LineString' ? `${geom.coordinates.length} punten` :
                                geom.type === 'Polygon' ? `${geom.coordinates[0].length} hoekpunten` :
                                'geometrie'
                              })`;
                            } catch (e) {
                              return 'Onbekend';
                            }
                          })()}
                        </div>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontStyle: 'italic', color: '#856404' }}>
                          Je kunt alleen de label en beschrijving aanpassen. Om de geometrie te wijzigen, verwijder deze en maak een nieuwe aan.
                        </div>
                      </div>
                    )}

                    {/* Manual line/area input */}
                    {(inputMode === 'manual-line' || inputMode === 'manual-area') && !pendingGeometry && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                          Coördinaten ({inputMode === 'manual-line' ? 'Lijn' : 'Gebied'}) *
                        </label>
                        <CoordFormatSelector value={coordFormat} onChange={setCoordFormat} />
                        {manualCoordinates.map((coord, index) => (
                          <div key={index} style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr auto', marginBottom: '0.5rem' }}>
                            {isProjectedFormat(coordFormat) ? (
                              <ProjectedCoordinateInput
                                latValue={coord.lat}
                                lonValue={coord.lon}
                                onLatChange={(v) => {
                                  const newCoords = [...manualCoordinates];
                                  newCoords[index].lat = v;
                                  setManualCoordinates(newCoords);
                                }}
                                onLonChange={(v) => {
                                  const newCoords = [...manualCoordinates];
                                  newCoords[index].lon = v;
                                  setManualCoordinates(newCoords);
                                }}
                                format={coordFormat}
                                style={{ backgroundColor: '#f0f7ff', color: '#000' }}
                              />
                            ) : (
                              <>
                                <CoordinateField
                                  label={`Punt ${index + 1} Lat`}
                                  value={coord.lat}
                                  onChange={(v) => {
                                    const newCoords = [...manualCoordinates];
                                    newCoords[index].lat = v;
                                    setManualCoordinates(newCoords);
                                  }}
                                  isLatitude={true}
                                  format={coordFormat}
                                  style={{ backgroundColor: '#f0f7ff', color: '#000' }}
                                />
                                <CoordinateField
                                  label={`Punt ${index + 1} Lon`}
                                  value={coord.lon}
                                  onChange={(v) => {
                                    const newCoords = [...manualCoordinates];
                                    newCoords[index].lon = v;
                                    setManualCoordinates(newCoords);
                                  }}
                                  isLatitude={false}
                                  format={coordFormat}
                                  style={{ backgroundColor: '#f0f7ff', color: '#000' }}
                                />
                              </>
                            )}
                            {index > 0 && (
                              <button
                                onClick={() => setManualCoordinates(manualCoordinates.filter((_, i) => i !== index))}
                                style={{ 
                                  padding: '0.5rem',
                                  background: '#dc3545',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => setManualCoordinates([...manualCoordinates, { lat: '', lon: '' }])}
                          style={{ 
                            padding: '0.5rem 1rem',
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          + Punt toevoegen
                        </button>
                      </div>
                    )}
                    
                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#000' }}>
                        Label (optioneel)
                      </label>
                      <input
                        type="text"
                        value={editingCoordinateId ? editCoordinate?.label || '' : newCoordinate.label}
                        onChange={(e) => editingCoordinateId
                          ? setEditCoordinate({ ...editCoordinate, label: e.target.value })
                          : setNewCoordinate({ ...newCoordinate, label: e.target.value })
                        }
                        placeholder="Bijv. 'Startpunt', 'Boeipositie'"
                        style={{ width: '100%', backgroundColor: '#f0f7ff', color: '#000' }}
                      />
                    </div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#000' }}>
                        Beschrijving (optioneel)
                      </label>
                      <textarea
                        value={editingCoordinateId ? editCoordinate?.description || '' : newCoordinate.description}
                        onChange={(e) => editingCoordinateId
                          ? setEditCoordinate({ ...editCoordinate, description: e.target.value })
                          : setNewCoordinate({ ...newCoordinate, description: e.target.value })
                        }
                        placeholder="Extra informatie over deze locatie"
                        rows={2}
                        style={{ width: '100%', resize: 'vertical', backgroundColor: '#f0f7ff', color: '#000' }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        // Handle edit mode
                        if (editingCoordinateId) {
                          if (editCoordinate.geometry) {
                            // Editing geometry
                            updateCoordinateMutation.mutate({
                              coordinateId: editingCoordinateId,
                              coordinate: {
                                geometry: editCoordinate.geometry,
                                label: editCoordinate.label || null,
                                description: editCoordinate.description || null
                              }
                            });
                          } else {
                            // Editing point
                            if (!editCoordinate.latitude || !editCoordinate.longitude) {
                              alert('Breedtegraad en lengtegraad zijn verplicht');
                              return;
                            }
                            updateCoordinateMutation.mutate({
                              coordinateId: editingCoordinateId,
                              coordinate: {
                                latitude: parseFloat(editCoordinate.latitude),
                                longitude: parseFloat(editCoordinate.longitude),
                                label: editCoordinate.label || null,
                                description: editCoordinate.description || null
                              }
                            });
                          }
                          return;
                        }

                        // If we have a drawn geometry, use that
                        if (pendingGeometry) {
                          addCoordinateMutation.mutate({
                            geometry: JSON.stringify(pendingGeometry),
                            label: newCoordinate.label || null,
                            description: newCoordinate.description || null
                          });
                        } else if (inputMode === 'manual-line' || inputMode === 'manual-area') {
                          // Manual line or area input
                          const validCoords = manualCoordinates.filter(c => c.lat && c.lon);
                          const minPoints = inputMode === 'manual-area' ? 3 : 2;
                          if (validCoords.length < minPoints) {
                            alert(`Minimaal ${minPoints} punten nodig voor een ${inputMode === 'manual-area' ? 'gebied' : 'lijn'}`);
                            return;
                          }
                          
                          const coordinates = validCoords.map(c => [parseFloat(c.lon), parseFloat(c.lat)]);
                          
                          // For polygon, close the loop if not already closed
                          if (inputMode === 'manual-area') {
                            const first = coordinates[0];
                            const last = coordinates[coordinates.length - 1];
                            if (first[0] !== last[0] || first[1] !== last[1]) {
                              coordinates.push([...first]);
                            }
                          }
                          
                          const geometry = inputMode === 'manual-line'
                            ? { type: 'LineString', coordinates }
                            : { type: 'Polygon', coordinates: [coordinates] };
                          
                          addCoordinateMutation.mutate({
                            geometry: JSON.stringify(geometry),
                            label: newCoordinate.label || null,
                            description: newCoordinate.description || null
                          });
                        } else {
                          // Otherwise use latitude/longitude for point
                          if (!newCoordinate.latitude || !newCoordinate.longitude) {
                            alert('Breedtegraad en lengtegraad zijn verplicht');
                            return;
                          }
                          addCoordinateMutation.mutate({
                            latitude: parseFloat(newCoordinate.latitude),
                            longitude: parseFloat(newCoordinate.longitude),
                            label: newCoordinate.label || null,
                            description: newCoordinate.description || null
                          });
                        }
                      }}
                      disabled={
                        editingCoordinateId 
                          ? updateCoordinateMutation.isPending 
                          : addCoordinateMutation.isPending || 
                            (!pendingGeometry && inputMode === 'single' && (!newCoordinate.latitude || !newCoordinate.longitude)) ||
                            (inputMode === 'manual-line' && manualCoordinates.filter(c => c.lat && c.lon).length < 2) ||
                            (inputMode === 'manual-area' && manualCoordinates.filter(c => c.lat && c.lon).length < 3)
                      }
                      style={{ marginTop: '0.75rem', width: '100%', background: editingCoordinateId ? '#ffc107' : 'var(--color-success)' }}
                    >
                      {editingCoordinateId 
                        ? (updateCoordinateMutation.isPending ? 'Bijwerken...' : '✓ Bijwerken')
                        : (addCoordinateMutation.isPending ? 'Toevoegen...' : '✓ Coördinaat toevoegen')
                      }
                    </button>
                    {editingCoordinateId && (
                      <button
                        onClick={() => {
                          setEditingCoordinateId(null);
                          setEditCoordinate(null);
                        }}
                        style={{ marginTop: '0.5rem', width: '100%', background: '#6c757d', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Annuleren
                      </button>
                    )}
                  </div>
                )}
                
                {/* Product Type Filter - ZK only */}
                {isZK && showProductsOnMap && (
                  <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#495057' }}>
                      Filter op producttype:
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {[
                        { value: 'enc', label: 'ENC', color: '#3388ff' },
                        { value: 'ienc', label: 'IENC', color: '#51cf66' },
                        { value: 'pilot_enc', label: 'Pilot ENC', color: '#ff6b6b' },
                        { value: 'chart', label: 'Papieren kaart', color: '#ffd43b' },
                      ].map(({ value, label, color }) => (
                        <label
                          key={value}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#495057' }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMapProductTypes.includes(value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMapProductTypes(prev => [...prev, value]);
                              } else {
                                setSelectedMapProductTypes(prev => prev.filter(t => t !== value));
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: color, display: 'inline-block' }} />
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* WMS Layers Panel */}
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
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

                {/* Zone Areas Panel */}
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#495057', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={showZoneAreas}
                        onChange={(e) => setShowZoneAreas(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      Zone-oppervlakken tonen
                    </label>
                    <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                      Actief: {activeZoneCoverageIds.length} • Totaal: {availableZones?.length || 0}
                    </div>
                  </div>

                  {showZoneAreas && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setZoneAreaScope('active')}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.8rem',
                          backgroundColor: zoneAreaScope === 'active' ? '#0d6efd' : 'white',
                          color: zoneAreaScope === 'active' ? 'white' : '#495057',
                          border: '1px solid #0d6efd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Actieve zones
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneAreaScope('all')}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.8rem',
                          backgroundColor: zoneAreaScope === 'all' ? '#0d6efd' : 'white',
                          color: zoneAreaScope === 'all' ? 'white' : '#495057',
                          border: '1px solid #0d6efd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Alle zones
                      </button>
                      <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                        Weergegeven: {selectedZoneAreas.length}
                      </span>
                    </div>
                  )}
                </div>

                <div
                  style={isMapExpanded ? {
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2000,
                    backgroundColor: '#ffffff',
                    borderRadius: 0,
                    border: 'none',
                    boxShadow: 'none',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  } : undefined}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: isMapExpanded ? 0 : '0.5rem', padding: isMapExpanded ? '0.75rem' : 0, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setShowZoneAreas(prev => !prev)}
                      style={{
                        backgroundColor: showZoneAreas ? '#17a2b8' : '#6c757d',
                        padding: '0.45rem 0.8rem',
                        fontSize: '0.85rem',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {showZoneAreas ? '🧭 Zones verbergen' : '🧭 Zones tonen'}
                    </button>
                    {currentProductionLineId && (
                      <button
                        type="button"
                        onClick={() => setShowProductsOnMap(prev => !prev)}
                        style={{
                          backgroundColor: showProductsOnMap ? '#28a745' : '#6c757d',
                          padding: '0.45rem 0.8rem',
                          fontSize: '0.85rem',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        {showProductsOnMap ? '🗺️ Producten verbergen' : '🗺️ Producten tonen'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowWmsLayersOnMap(prev => !prev)}
                      style={{
                        backgroundColor: showWmsLayersOnMap ? '#6f42c1' : '#6c757d',
                        padding: '0.45rem 0.8rem',
                        fontSize: '0.85rem',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {showWmsLayersOnMap ? '🛰️ WMS verbergen' : '🛰️ WMS tonen'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMapExpanded(prev => !prev)}
                      style={{
                        backgroundColor: isMapExpanded ? '#6c757d' : '#0d6efd',
                        padding: '0.45rem 0.8rem',
                        fontSize: '0.85rem'
                      }}
                    >
                      {isMapExpanded ? 'Verklein kaart (Esc)' : 'Vergroot kaart'}
                    </button>
                  </div>

                  <div
                    style={{
                      height: isMapExpanded ? '100%' : '700px',
                      minHeight: 0,
                      flex: isMapExpanded ? 1 : undefined,
                    }}
                  >
                  <MapContainer
                    center={center}
                    zoom={zoom}
                    style={{ height: '100%', width: '100%', borderRadius: isMapExpanded ? 0 : '4px' }}
                  >
                  <MapResizeHandler trigger={isMapExpanded} />
                  {showZoneAreas && (
                    <>
                      <MapZoneMultiClickHandler
                        items={zoneHitItems}
                        onHit={(result) => {
                          zoneHitOnLastMapClickRef.current = !!result;
                          setZonePopup(result);
                          if (result) {
                            setMultiPopup(null);
                          }
                        }}
                      />
                      {zonePopup && (
                        <Popup
                          position={zonePopup.latlng}
                          eventHandlers={{ remove: () => setZonePopup(null) }}
                          maxWidth={340}
                        >
                          <div style={{ maxHeight: '320px', overflowY: 'auto', minWidth: '240px' }}>
                            <strong style={{ fontSize: '0.9rem', borderBottom: '1px solid #dee2e6', display: 'block', marginBottom: '0.5rem', paddingBottom: '0.3rem' }}>
                              {zonePopup.items.length} zone{zonePopup.items.length !== 1 ? 's' : ''} op deze positie
                            </strong>
                            {zonePopup.items.map((item) => {
                              const isActive = activeZoneCoverageIds.includes(item.id);
                              const zoneActionsEnabled = !showProductsOnMap;
                              return (
                                <div key={item.id} style={{ marginBottom: '0.6rem', paddingBottom: '0.6rem', borderBottom: '1px solid #f0f0f0' }}>
                                  <div style={{ fontWeight: '600' }}>{item.code}</div>
                                  <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{item.name}</div>
                                  <div style={{ marginTop: '0.25rem' }}>
                                    {item.detectionMethod === 'manual' ? (
                                      <span
                                        style={{
                                          padding: '0.15rem 0.5rem',
                                          backgroundColor: '#fff3e0',
                                          color: '#f57c00',
                                          border: '1px solid #ffb74d',
                                          borderRadius: '12px',
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                        }}
                                      >
                                        Handmatig
                                      </span>
                                    ) : item.detectionMethod === 'automatic' ? (
                                      <span
                                        style={{
                                          padding: '0.15rem 0.5rem',
                                          backgroundColor: '#e3f2fd',
                                          color: '#1976d2',
                                          border: '1px solid #90caf9',
                                          borderRadius: '12px',
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                        }}
                                      >
                                        Automatisch
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          padding: '0.15rem 0.5rem',
                                          backgroundColor: '#f1f3f5',
                                          color: '#6c757d',
                                          border: '1px solid #dee2e6',
                                          borderRadius: '12px',
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                        }}
                                      >
                                        Niet actief
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ marginTop: '0.3rem' }}>
                                    {!zoneActionsEnabled && (
                                      <div style={{ fontSize: '0.72rem', color: '#6c757d', marginBottom: '0.35rem' }}>
                                        Schakel 'Producten tonen' uit om zones te koppelen of ontkoppelen.
                                      </div>
                                    )}
                                    {isActive ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm(`Zone '${item.name || item.code}' verwijderen?`)) {
                                            removeZoneMutation.mutate(item.id);
                                            setZonePopup(null);
                                          }
                                        }}
                                        disabled={!zoneActionsEnabled || removeZoneMutation.isPending}
                                        style={{
                                          fontSize: '0.75rem',
                                          padding: '0.2rem 0.6rem',
                                          backgroundColor: '#dc3545',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: (!zoneActionsEnabled || removeZoneMutation.isPending) ? 'not-allowed' : 'pointer',
                                          opacity: 1,
                                        }}
                                      >
                                        ✕ Ontkoppelen
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addZoneMutation.mutate(item.id);
                                          setZonePopup(null);
                                        }}
                                        disabled={!zoneActionsEnabled || addZoneMutation.isPending}
                                        style={{
                                          fontSize: '0.75rem',
                                          padding: '0.2rem 0.6rem',
                                          backgroundColor: '#28a745',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: (!zoneActionsEnabled || addZoneMutation.isPending) ? 'not-allowed' : 'pointer',
                                          opacity: 1,
                                        }}
                                      >
                                        + Koppelen
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </Popup>
                      )}
                    </>
                  )}
                  {showProductsOnMap && (() => {
                    const hitItems: NotifMapHitItem[] = (availableProducts || [])
                      .filter((p: any) => !isZK || selectedMapProductTypes.includes(p.type || ''))
                      .map((p: any) => {
                        const geom = parseGeom(p.geometry);
                        if (!geom) return null;
                        return { id: p.id, code: p.code, name: p.name, type: p.type, geometry: geom, rawProduct: p };
                      })
                      .filter(Boolean) as NotifMapHitItem[];
                    return (
                      <>
                        <MapNotifMultiClickHandler
                          items={hitItems}
                          onHit={(result) => {
                            // If zone handler already found hits on this same click,
                            // keep focus on zone popup so zone link/unlink remains accessible.
                            if (zoneHitOnLastMapClickRef.current) {
                              zoneHitOnLastMapClickRef.current = false;
                              setMultiPopup(null);
                              return;
                            }

                            zoneHitOnLastMapClickRef.current = false;
                            setMultiPopup(result);
                            if (result) {
                              setZonePopup(null);
                            }
                          }}
                        />
                        {multiPopup && (
                          <Popup
                            position={multiPopup.latlng}
                            eventHandlers={{ remove: () => setMultiPopup(null) }}
                            maxWidth={320}
                          >
                            <div style={{ maxHeight: '320px', overflowY: 'auto', minWidth: '220px' }}>
                              <strong style={{ fontSize: '0.9rem', borderBottom: '1px solid #dee2e6', display: 'block', marginBottom: '0.5rem', paddingBottom: '0.3rem' }}>
                                {multiPopup.items.length} product{multiPopup.items.length !== 1 ? 'en' : ''} op deze positie
                              </strong>
                              {multiPopup.items.map((item) => {
                                const isLinked = (notification.products || []).some((p: any) => p.id === item.id);
                                return (
                                  <div key={item.id} style={{ marginBottom: '0.6rem', paddingBottom: '0.6rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ fontWeight: '600' }}>{item.code}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{item.name}</div>
                                    {item.type && <div style={{ fontSize: '0.75rem', color: '#888' }}>Type: {item.type}</div>}
                                    <div style={{ marginTop: '0.3rem' }}>
                                      {isLinked ? (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); if (window.confirm(`'${item.code}' ontkoppelen?`)) { unlinkProductMutation.mutate(item.id); setMultiPopup(null); } }}
                                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >✕ Ontkoppelen</button>
                                      ) : (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); linkProductMutation.mutate(item.id); setMultiPopup(null); }}
                                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >+ Koppelen</button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </Popup>
                        )}
                      </>
                    );
                  })()}
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* WMS layers from gis.afdelingkust.be */}
                  {showWmsLayersOnMap && selectedWmsLayers.map(layerName => (
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

                  {/* Zone areas overlay (active zones by default, optional all zones) */}
                  {showZoneAreas && selectedZoneAreas.flatMap((zone: any) => {
                    const zoneGeometry = parseGeoJsonObject(zone.geometry);
                    const zoneGeometries = extractRenderableGeometries(zoneGeometry);
                    if (zoneGeometries.length === 0) {
                      return [];
                    }

                    const isActiveZone = activeZoneCoverageIds.includes(Number(zone.id));
                    const zoneDetection = (notification?.zones || []).find(
                      (nz: any) => Number(nz.product_id || nz.kml_coverage_id) === Number(zone.id)
                    );

                    return zoneGeometries.map((geom: any, index: number) => (
                      <GeoJSON
                        key={`zone-area-${zone.id}-${index}`}
                        data={{
                          type: 'Feature',
                          geometry: geom,
                          properties: {
                            code: zone.code,
                            name: zone.name,
                            active: isActiveZone,
                          }
                        } as any}
                        style={{
                          color: isActiveZone ? '#0ea5e9' : '#94a3b8',
                          weight: isActiveZone ? 2 : 1,
                          opacity: isActiveZone ? 0.85 : 0.55,
                          fillOpacity: isActiveZone ? 0.2 : 0.08,
                        }}
                        eventHandlers={{
                          click: (e) => {
                            zoneHitOnLastMapClickRef.current = true;
                            setMultiPopup(null);
                            setZonePopup({
                              latlng: e.latlng,
                              items: [
                                {
                                  id: Number(zone.id),
                                  code: zone.code,
                                  name: zone.name,
                                  detectionMethod: zoneDetection?.detection_method || null,
                                  geometry: geom,
                                },
                              ],
                            });
                          },
                        }}
                      />
                    ));
                  })}

                  {/* Drawing controls */}
                  <DrawControl 
                    onShapeCreated={handleShapeCreated}
                    drawingMode={drawingMode}
                    notificationId={notification.id}
                  />
                  
                  {mainGeometries.map((geom: any, index: number) => (
                    <GeoJSON 
                      key={`main-geom-${notification.id}-${index}`}
                      data={{
                        type: 'Feature',
                        geometry: geom,
                        properties: {
                          code: notification.code,
                          title: notification.title,
                        }
                      } as any}
                      style={{ color: '#0066cc', weight: 3 }}
                      eventHandlers={{
                        click: () => handleGeometryClick(geom, `${notification.code} - ${notification.title}`)
                      }}
                      onEachFeature={(feature, layer) => {
                        const code = feature?.properties?.code || notification.code;
                        const title = feature?.properties?.title || notification.title;
                        layer.bindPopup(`<strong>${code || ''}</strong><br/>${title || ''}`);
                      }}
                    />
                  ))}

                  {/* Product geometries overlay */}
                  {showProductsOnMap && availableProducts && availableProducts
                    .filter((product: any) => !isZK || selectedMapProductTypes.includes(product.type || ''))
                    .map((product: any) => {
                      if (!product.geometry) return null;
                      try {
                        const geom = typeof product.geometry === 'string' ? JSON.parse(product.geometry) : product.geometry;
                        const isLinked = (notification.products || []).some((p: any) => p.id === product.id);
                        const color = isLinked ? '#28a745' : '#ffc107';
                        const feature = {
                          type: 'Feature' as const,
                          geometry: geom,
                          properties: { code: product.code, name: product.name }
                        };
                        return (
                          <GeoJSON
                            key={`product-${product.id}`}
                            data={feature}
                            style={{ color, weight: 2, opacity: 0.7, fillOpacity: 0.15 }}
                          />
                        );
                      } catch (e) {
                        return null;
                      }
                    })}

                  {/* Additional coordinates as markers and geometries */}
                  {coordinates?.map((coord: any) => {
                    // If coordinate has geometry, render it as GeoJSON
                    if (coord.geometry) {
                      try {
                        const geom = typeof coord.geometry === 'string' ? JSON.parse(coord.geometry) : coord.geometry;
                        // Wrap geometry in a Feature object for GeoJSON component
                        const feature = {
                          type: 'Feature' as const,
                          geometry: geom,
                          properties: {
                            label: coord.label,
                            description: coord.description
                          }
                        };
                        return (
                          <GeoJSON 
                            key={coord.id}
                            data={feature}
                            style={{ color: '#f357a1', weight: 3 }}
                            eventHandlers={{
                              click: () => handleGeometryClick(geom, coord.label || 'Extra geometrie')
                            }}
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
                    } else if (coord.latitude && coord.longitude) {
                      // Otherwise it's a simple point coordinate
                      // Create point geometry from latitude/longitude
                      const pointGeom = {
                        type: 'Point' as const,
                        coordinates: [parseFloat(coord.longitude), parseFloat(coord.latitude)]
                      };
                      return (
                        <Marker 
                          key={coord.id}
                          position={[parseFloat(coord.latitude), parseFloat(coord.longitude)]}
                          icon={new L.Icon({
                            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHoiIGZpbGw9IiNmMzU3YTEiLz48Y2lyY2xlIGN4PSIxMi41IiBjeT0iMTIuNSIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                          })}
                          eventHandlers={{
                            click: () => handleGeometryClick(pointGeom, coord.label || 'Extra coördinaat')
                          }}
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
                  </MapContainer>
                  </div>
                </div>
                
                {/* Clicked Geometry Coordinates Table */}
                {clickedGeometryCoords && clickedGeometryCoords.length > 0 && (
                  <div style={{ marginTop: '1rem', backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#343a40' }}>
                        Coördinaten: {clickedGeometryLabel}
                      </h4>
                      <button
                        onClick={() => {
                          setClickedGeometryCoords(null);
                          setClickedGeometryLabel('');
                        }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem',
                          background: '#6c757d',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Sluiten
                      </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse',
                        fontSize: '0.85rem',
                        tableLayout: 'auto'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: '#495057' }}>
                              #
                            </th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: '#495057' }}>
                              Breedtegraad (Latitude)
                            </th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: '#495057' }}>
                              Lengtegraad (Longitude)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {clickedGeometryCoords.map((coord, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                              <td style={{ padding: '0.5rem', color: '#6c757d' }}>
                                {coord.index + 1}
                              </td>
                              <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#343a40' }}>
                                {coord.lat.toFixed(6)}°N
                              </td>
                              <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#343a40' }}>
                                {coord.lon.toFixed(6)}°E
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#6c757d' }}>
                      Totaal aantal punten: {clickedGeometryCoords.length}
                    </div>
                  </div>
                )}
                
                {/* Display existing coordinates */}
                {coordinates && coordinates.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.95rem', color: '#343a40' }}>
                      Extra Coördinaten ({coordinates.length})
                    </h4>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {coordinates.map((coord: any) => (
                        <div key={coord.id} style={{ 
                          padding: '0.75rem', 
                          backgroundColor: coord.geometry ? '#ffe7f3' : '#e7f3ff', 
                          borderRadius: '4px',
                          border: coord.geometry ? '1px solid #f357a1' : '1px solid #0066cc',
                          fontSize: '0.9rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ flex: 1 }}>
                              {coord.label && (
                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{coord.label}</div>
                              )}
                              {coord.geometry ? (
                                <div style={{ fontFamily: 'monospace', color: '#f357a1' }}>
                                  {(() => {
                                    try {
                                      const geom = typeof coord.geometry === 'string' ? JSON.parse(coord.geometry) : coord.geometry;
                                      return `${geom.type} (${
                                        geom.type === 'LineString' ? `${geom.coordinates.length} punten` :
                                        geom.type === 'Polygon' ? `${geom.coordinates[0].length} hoekpunten` :
                                        geom.type === 'Point' ? 'punt' : 'geometrie'
                                      })`;
                                    } catch (e) {
                                      return 'Geometrie';
                                    }
                                  })()}
                                </div>
                              ) : (
                                <div style={{ fontFamily: 'monospace', color: '#0066cc' }}>
                                  {parseFloat(coord.latitude).toFixed(6)}°N, {parseFloat(coord.longitude).toFixed(6)}°E
                                </div>
                              )}
                              {coord.description && (
                                <div style={{ marginTop: '0.5rem', color: '#6c757d', fontSize: '0.85rem' }}>
                                  {coord.description}
                                </div>
                              )}
                              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6c757d' }}>
                                {coord.first_name && `Toegevoegd door ${coord.first_name} ${coord.last_name}`}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => {
                                  setEditingCoordinateId(coord.id);
                                  setEditCoordinate({
                                    latitude: coord.latitude,
                                    longitude: coord.longitude,
                                    label: coord.label || '',
                                    description: coord.description || '',
                                    geometry: coord.geometry
                                  });
                                  setShowCoordinateForm(true);
                                }}
                                style={{ 
                                  padding: '0.4rem 0.75rem',
                                  fontSize: '0.8rem',
                                  background: '#ffc107',
                                  color: '#000',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✏️ Bewerken
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Weet je zeker dat je deze coördinaat wilt verwijderen?')) {
                                    deleteCoordinateMutation.mutate(coord.id);
                                  }
                                }}
                                style={{ 
                                  padding: '0.4rem 0.75rem',
                                  fontSize: '0.8rem',
                                  background: 'var(--color-danger)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✕ Verwijderen
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6c757d' }}>
                  <strong>Type:</strong> {geometry.type}
                  {geometry.type === 'LineString' && ` (${geometry.coordinates.length} punten)`}
                  {geometry.type === 'Polygon' && ` (${geometry.coordinates[0].length} hoekpunten)`}
                </div>
              </>
            ) : (
              <div style={{ 
                height: '700px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                color: '#6c757d'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
                  <div>Geen geografische locatie beschikbaar</div>
                </div>
              </div>
            )}
          </div>

          {/* Activity Log - Collapsible */}
          {notification.activityLog && notification.activityLog.length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#343a40', marginTop: '1.5rem' }}>
              <div
                onClick={() => setCollapsedActivities(!collapsedActivities)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: collapsedActivities ? 0 : '1rem',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  userSelect: 'none',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <h2 style={{ margin: 0, color: '#343a40', fontSize: '1.1rem' }}>
                  Activiteiten Geschiedenis ({notification.activityLog.length})
                </h2>
                <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: collapsedActivities ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </div>
              {!collapsedActivities && (
                <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
                  {notification.activityLog.map((log: any) => (
                    <div key={log.id} style={{ display: 'flex', gap: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '0.9rem' }}>
                      <div style={{ minWidth: '140px', color: '#6c757d' }}>
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>
                          {log.action}
                        </span>
                        {log.first_name && (
                          <span style={{ color: '#6c757d', marginLeft: '0.5rem' }}>
                            door {log.first_name} {log.last_name}
                          </span>
                        )}
                        {log.changes && (
                          <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#6c757d', fontFamily: 'monospace' }}>
                            {JSON.stringify(log.changes)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
