import { useParams, useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { pointInGeometry, parseGeom } from '../utils/mapGeoUtils';
import { MapContainer, TileLayer, GeoJSON, WMSTileLayer, useMap, useMapEvents, Popup } from 'react-leaflet';
import { getApiErrorMessage } from '../utils/errorUtils';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

const isHtmlEmpty = (html: string): boolean => {
  if (!html) return true;
  const text = html.replace(/<[^>]*>/g, '').trim();
  return text === '';
};

const sanitizeHtmlForDisplay = (html: string): string => {
  if (!html) return '';

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '');
};

const getPlainTextPreview = (content: string, maxLength = 200): string => {
  if (!content) return '';

  const plainText = content
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.substring(0, maxLength)}...`;
};

const extractEmailAddress = (value: string): string => {
  if (!value) return '';

  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : '';
};

const buildTaskInfoRequestDraft = (task: any) => {
  const firstNotification = task?.notifications?.[0];
  const subject = task?.title?.trim() || firstNotification?.title?.trim() || `Vraag om meer info over taak ${task?.task_number || ''}`.trim();
  const recipient =
    extractEmailAddress(firstNotification?.source_detail || '') ||
    extractEmailAddress(firstNotification?.source || '');
  const reference = firstNotification?.code || task?.task_number || task?.baz_number || task?.id;

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

// Helper function to get product color based on type
const getProductColor = (product: any): string => {
  const type = product.product_type || product.type; // Handle both task products and notification products
  if (!type) return '#9c27b0';
  
  if (type === 'pilot_enc') {
    return '#ff6b6b';
  } else if (type === 'ienc') {
    return '#51cf66';
  } else if (type === 'enc') {
    return '#3388ff';
  } else if (type === 'chart') {
    return '#ffd43b';
  }
  return '#9c27b0';
};

export interface MapHitItem {
  id: string;
  kind: 'task' | 'notif' | 'all';
  geometry: any;
  product: any;
  notifCode?: string;
  isLinked?: boolean;
}

function MapMultiClickHandler({ items, onHit }: {
  items: MapHitItem[];
  onHit: (result: { latlng: L.LatLng; items: MapHitItem[] } | null) => void;
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

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentProductionLineId = useAuthStore((state) => state.currentProductionLineId);
  const currentUserId = useAuthStore((state) => state.user?.id);
  
  const [workflowContent, setWorkflowContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [collapsedProductionLines, setCollapsedProductionLines] = useState<Record<string, boolean>>({});
  const [notificationsCollapsed, setNotificationsCollapsed] = useState(true);
  const [selectedMapProductionLines, setSelectedMapProductionLines] = useState<number[]>([]);
  const [selectedMapProductTypes, setSelectedMapProductTypes] = useState<string[]>(['enc', 'ienc', 'pilot_enc', 'chart']);
  const [selectedWmsLayers, setSelectedWmsLayers] = useState<string[]>([]);
  const [wmsLayersPanelOpen, setWmsLayersPanelOpen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [selectedProductLineId, setSelectedProductLineId] = useState<number | null>(null);
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState('');
  const [showAllProductsOnMap, setShowAllProductsOnMap] = useState(false);
  const [multiPopup, setMultiPopup] = useState<{ latlng: L.LatLng; items: MapHitItem[] } | null>(null);
  const [isEmailFormVisible, setIsEmailFormVisible] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isInfoRequestsCollapsed, setIsInfoRequestsCollapsed] = useState(true);
  const [selectedNotificationIdToAdd, setSelectedNotificationIdToAdd] = useState('');
  const [notificationSearchTerm, setNotificationSearchTerm] = useState('');

  // BaZ Article state
  const [articleContentNl, setArticleContentNl] = useState('');
  const [articleContentEn, setArticleContentEn] = useState('');
  const [articleTitleNl, setArticleTitleNl] = useState('');
  const [articleTitleEn, setArticleTitleEn] = useState('');
  const [articleBookNumber, setArticleBookNumber] = useState('1');
  const [articleIsTemporary, setArticleIsTemporary] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [articlesCollapsed, setArticlesCollapsed] = useState(true);
  const [expandedArticleId, setExpandedArticleId] = useState<number | null>(null);
  const [previewArticle, setPreviewArticle] = useState<any>(null);
  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const container = document.getElementById('task-resizable-container');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
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

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      const response = await api.get(`/tasks/${id}`);
      return response.data;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ['taskComments', id],
    queryFn: async () => {
      const response = await api.get(`/tasks/${id}/comments`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: infoRequests } = useQuery({
    queryKey: ['taskInfoRequests', id],
    queryFn: async () => {
      const response = await api.get(`/tasks/${id}/info-requests`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: workflow } = useQuery({
    queryKey: ['taskWorkflow', id, currentProductionLineId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${id}/workflow`, {
        params: { productionLineId: currentProductionLineId }
      });
      return response.data;
    },
    enabled: !!id && !!currentProductionLineId,
  });

  const { data: productionLines } = useQuery({
    queryKey: ['productionLines'],
    queryFn: async () => {
      const response = await api.get('/production-lines');
      return response.data;
    },
  });

  const { data: productionLineStatuses } = useQuery({
    queryKey: ['taskProductionLineStatuses', id],
    queryFn: async () => {
      const response = await api.get(`/tasks/${id}/production-line-status`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: hpdProjects } = useQuery({
    queryKey: ['taskHpdProjects', id],
    queryFn: async () => {
      const response = await api.get(`/tasks/${id}/hpd-projects`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: availableProducts } = useQuery({
    queryKey: ['productsForTaskAdd', selectedProductLineId],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: {
          productionLineId: selectedProductLineId,
          isActive: true,
        },
      });
      return response.data;
    },
    enabled: !!selectedProductLineId,
  });

  const { data: allMapProducts } = useQuery({
    queryKey: ['allActiveProducts'],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: { isActive: true },
      });
      return response.data;
    },
    enabled: showAllProductsOnMap,
  });

  const { data: candidateNotificationsData, isLoading: isLoadingCandidateNotifications } = useQuery({
    queryKey: ['taskNotificationCandidates', id, notificationSearchTerm],
    queryFn: async () => {
      const response = await api.get('/notifications', {
        params: {
          page: 1,
          limit: 200,
          undecidedOnly: true,
          search: notificationSearchTerm || undefined,
        },
      });
      return response.data?.data || [];
    },
    enabled: !!id,
  });

  // BaZ-2 Articles query - only for PUBL production line
  const isPUBL = task?.production_line_code === 'PUBL';
  const isZK = currentProductionLineId === 1;

  const { data: articles } = useQuery({
    queryKey: ['taskArticles', id],
    queryFn: async () => {
      const response = await api.get(`/tasks/${id}/articles`);
      return response.data;
    },
    enabled: !!id,
  });

  // Load workflow content when it changes
  useEffect(() => {
    if (workflow?.workflow_content) {
      setWorkflowContent(workflow.workflow_content);
    } else {
      setWorkflowContent('');
    }
  }, [workflow]);

  // Initialize selected map production lines with task's production line
  useEffect(() => {
    if (task?.production_line_id && selectedMapProductionLines.length === 0) {
      setSelectedMapProductionLines([task.production_line_id]);
    }
  }, [task?.production_line_id]);

  useEffect(() => {
    if (selectedProductLineId) return;

    if (currentProductionLineId) {
      setSelectedProductLineId(currentProductionLineId);
      return;
    }

    if (productionLines && productionLines.length > 0) {
      setSelectedProductLineId(productionLines[0].id);
    }
  }, [selectedProductLineId, currentProductionLineId, productionLines]);

  // Edit comment mutation
  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, comment }: { commentId: number; comment: string }) => {
      return await api.put(`/tasks/comments/${commentId}`, { comment });
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditCommentText('');
      queryClient.invalidateQueries({ queryKey: ['taskComments', id] });
    },
  });

  // Create info request mutation
  const createInfoRequestMutation = useMutation({
    mutationFn: async ({ recipient, subject, body }: { recipient: string; subject: string; body: string }) => {
      const response = await api.post(`/tasks/${id}/info-requests`, {
        recipient,
        subject,
        body,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskInfoRequests', id] });
    },
  });

  // Workflow mutation
  const workflowMutation = useMutation({
    mutationFn: async ({ workflowContent }: { workflowContent: string }) => {
      return await api.post(`/tasks/${id}/workflow`, {
        workflowContent,
        productionLineId: currentProductionLineId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskWorkflow', id, currentProductionLineId] });
    },
  });

  // Update product status mutation
  const updateProductStatusMutation = useMutation({
    mutationFn: async ({ productId, status }: { productId: number; status: string }) => {
      console.log('Updating product status:', { taskId: id, productId, status });
      return await api.put(`/tasks/${id}/products/${productId}`, { status });
    },
    onSuccess: (data) => {
      console.log('Product status updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      console.error('Error updating product status:', error.response?.data || error.message);
      alert(`Fout bij updaten productstatus: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  // Update production line status mutation
  const updateProductionLineStatusMutation = useMutation({
    mutationFn: async ({ productionLineId, status }: { productionLineId: number; status: string }) => {
      console.log('Updating production line status:', { taskId: id, productionLineId, status });
      return await api.put(`/tasks/${id}/production-line-status/${productionLineId}`, { status });
    },
    onSuccess: (data) => {
      console.log('Production line status updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['taskProductionLineStatuses', id] });
      queryClient.invalidateQueries({ queryKey: ['taskHpdProjects', id] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      console.error('Error updating production line status:', error.response?.data || error.message);
      alert(`Fout bij updaten taakstatus: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  const toggleWaitForZkMutation = useMutation({
    mutationFn: async ({ productionLineId, waitForZk }: { productionLineId: number; waitForZk: boolean }) => {
      return await api.patch(`/tasks/${id}/production-line-status/${productionLineId}/wait-for-zk`, { waitForZk });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskProductionLineStatuses', id] });
      queryClient.invalidateQueries({ queryKey: ['taskHpdProjects', id] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      alert(`Fout bij updaten 'wachten op ZK': ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  const toggleTaskFlagsMutation = useMutation({
    mutationFn: async ({ flags }: { flags: { needsFollowup?: boolean; needsExtraInfo?: boolean } }) => {
      const response = await api.patch(`/tasks/${id}/flags`, flags);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const addTaskProductMutation = useMutation({
    mutationFn: async ({ productId, productionLineId }: { productId: number; productionLineId: number }) => {
      return await api.post(`/tasks/${id}/products`, {
        productId,
        productionLineId,
        status: 'hoog_te_verwerken',
      });
    },
    onSuccess: () => {
      setSelectedProductIdToAdd('');
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      alert(getApiErrorMessage(error, 'Fout bij toevoegen van product.'));
    },
  });

  const addNotificationToTaskMutation = useMutation({
    mutationFn: async ({ notificationId }: { notificationId: number }) => {
      const response = await api.post(`/tasks/${id}/notifications`, { notificationId });
      return response.data;
    },
    onSuccess: () => {
      setSelectedNotificationIdToAdd('');
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      alert(getApiErrorMessage(error, 'Fout bij koppelen van melding aan taak.'));
    },
  });

  // BaZ Article mutations
  const createArticleMutation = useMutation({
    mutationFn: async (data: { bookNumber: number; isTemporary: boolean; contentNl: string; contentEn: string; titleNl: string; titleEn: string }) => {
      const response = await api.post(`/tasks/${id}/articles`, data);
      return response.data;
    },
    onSuccess: () => {
      setArticleContentNl('');
      setArticleContentEn('');
      setArticleTitleNl('');
      setArticleTitleEn('');
      setArticleIsTemporary(false);
      queryClient.invalidateQueries({ queryKey: ['taskArticles', id] });
    },
    onError: (error: any) => {
      alert(getApiErrorMessage(error, 'Fout bij aanmaken artikel.'));
    },
  });

  const updateArticleMutation = useMutation({
    mutationFn: async ({ articleId, ...data }: { articleId: number; contentNl?: string; contentEn?: string; isTemporary?: boolean; titleNl?: string; titleEn?: string }) => {
      const response = await api.put(`/tasks/${id}/articles/${articleId}`, data);
      return response.data;
    },
    onSuccess: () => {
      setEditingArticleId(null);
      setArticleContentNl('');
      setArticleContentEn('');
      setArticleTitleNl('');
      setArticleTitleEn('');
      queryClient.invalidateQueries({ queryKey: ['taskArticles', id] });
    },
    onError: (error: any) => {
      alert(getApiErrorMessage(error, 'Fout bij bijwerken artikel.'));
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: async (articleId: number) => {
      await api.delete(`/tasks/${id}/articles/${articleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskArticles', id] });
    },
  });

  const handleTranslate = async () => {
    if (!articleContentNl || isHtmlEmpty(articleContentNl)) return;
    setIsTranslating(true);
    try {
      const response = await api.post(`/tasks/${id}/articles/translate`, { text: articleContentNl });
      setArticleContentEn(response.data.translatedText);
    } catch (err: any) {
      alert(getApiErrorMessage(err, 'Vertaling mislukt.'));
    } finally {
      setIsTranslating(false);
    }
  };

  // Set document title
  useEffect(() => {
    if (task?.task_number) {
      document.title = `Taak ${task.task_number} - CARTIS`;
    }
    return () => {
      document.title = 'CARTIS 2.0';
    };
  }, [task]);

  // Group comments by production line
  const commentsByProductionLine = comments?.reduce((acc: any, comment: any) => {
    const plId = comment.production_line_id;
    if (!acc[plId]) {
      acc[plId] = {
        productionLineId: plId,
        productionLineName: comment.production_line_name,
        productionLineCode: comment.production_line_code,
        comments: [],
      };
    }
    acc[plId].comments.push(comment);
    return acc;
  }, {}) || {};

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', width: '100%' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1.2rem', color: '#6c757d' }}>Laden...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', width: '100%' }}>
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '1rem', 
          borderRadius: '4px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Fout bij laden:</strong> {getApiErrorMessage(error, 'Onbekende fout')}
        </div>
        <button 
          onClick={() => navigate('/tasks')}
          style={{ 
            marginTop: '1rem',
            padding: '0.6rem 1.5rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Terug naar taken
        </button>
      </div>
    );
  }

  if (!task) {
    console.log('TaskDetail: task is null/undefined');
    return (
      <div style={{ padding: '2rem', width: '100%' }}>
        <div style={{ 
          backgroundColor: '#fff3cd', 
          color: '#856404', 
          padding: '1rem', 
          borderRadius: '4px',
          border: '1px solid #ffeaa7'
        }}>
          Taak niet gevonden
        </div>
        <button 
          onClick={() => navigate('/tasks')}
          style={{ 
            marginTop: '1rem',
            padding: '0.6rem 1.5rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Terug naar taken
        </button>
      </div>
    );
  }

  console.log('TaskDetail: Rendering task', task);
  console.log('TaskDetail: Comments', comments);
  console.log('TaskDetail: Workflow', workflow);
  console.log('TaskDetail: Production Lines', productionLines);

  const selectedProductionLine = productionLines?.find(
    (pl: any) => pl.id === currentProductionLineId
  );
  const selectedProductionLineStatusEntry = productionLineStatuses?.find(
    (s: any) => s.production_line_id === currentProductionLineId
  );
  const selectedProductionLineStatus = selectedProductionLineStatusEntry?.status || 'under_construction';
  const isWaitForZkLine = selectedProductionLine?.code === 'IENC' || selectedProductionLine?.code === 'PILOT_ENC';
  const selectedProductionLineWaitForZk = selectedProductionLineStatusEntry
    ? !!selectedProductionLineStatusEntry.wait_for_zk
    : selectedProductionLine?.code === 'PILOT_ENC';

  const selectedAddProductionLineStatus = productionLineStatuses?.find(
    (s: any) => s.production_line_id === selectedProductLineId
  )?.status || 'under_construction';

  const productsForSelectedAddLine = task.task_products?.filter(
    (prod: any) => prod.product_production_line_id === selectedProductLineId
  ) || [];

  const selectedAddLine = productionLines?.find((line: any) => line.id === selectedProductLineId);
  const hasAnyCompletedProductionLine = (productionLineStatuses || []).some(
    (statusEntry: any) => statusEntry.status === 'completed'
  );
  const linkedNotificationIds = new Set((task.notifications || []).map((notification: any) => Number(notification.id)));
  const candidateNotifications = (candidateNotificationsData || []).filter(
    (notification: any) => !linkedNotificationIds.has(Number(notification.id))
  );

  const canAddProductsForLine = !!selectedProductLineId && selectedAddProductionLineStatus !== 'completed';
  const linkedTaskProductIds = new Set(productsForSelectedAddLine.map((prod: any) => Number(prod.product_id)));
  const unlinkedProducts = (availableProducts || []).filter(
    (prod: any) => !linkedTaskProductIds.has(Number(prod.id))
  );
  const infoRequestDraft = buildTaskInfoRequestDraft(task);

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
      // Save the email to database first
      await createInfoRequestMutation.mutateAsync({
        recipient: emailRecipient.trim(),
        subject: emailSubject.trim(),
        body: emailBody.trim(),
      });

      // Then open the mailto link
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
      console.error('Error saving info request:', error);
      alert('Fout bij opslaan van e-mailverzoek');
    }
  };

  const handleAddNotificationToTask = async () => {
    const parsedNotificationId = Number(selectedNotificationIdToAdd);
    if (!parsedNotificationId || Number.isNaN(parsedNotificationId)) {
      alert('Selecteer een geldige melding.');
      return;
    }

    await addNotificationToTaskMutation.mutateAsync({ notificationId: parsedNotificationId });
  };

  // Filter products for map based on selected production lines (and type when ZK)
  const mapFilteredProducts = task.task_products?.filter(
    (prod: any) => selectedMapProductionLines.includes(prod.product_production_line_id)
      && (!isZK || selectedMapProductTypes.includes(prod.product_type || prod.type || ''))
  ) || [];

  // Calculate map center from notifications and products
  let mapCenter: [number, number] = [51.0, 3.7]; // Default Flanders
  let mapZoom = 9;
  
  // Collect all geometries
  const allGeometries: any[] = [];
  
  // Add notification geometries
  task.notifications?.forEach((notif: any) => {
    const notifGeometry = parseGeom(notif.geometry);
    if (notifGeometry) {
      allGeometries.push({ type: 'notification', data: notif, geometry: notifGeometry });
    }
    // Add geometries from products within notifications
    notif.products?.forEach((prod: any) => {
      const notificationProductGeometry = parseGeom(prod.geometry);
      if (notificationProductGeometry) {
        allGeometries.push({ type: 'notification-product', data: prod, geometry: notificationProductGeometry });
      }
    });
  });
  
  // Add task product geometries (filtered by selected production lines for map)
  mapFilteredProducts.forEach((prod: any) => {
    const taskProductGeometry = parseGeom(prod.geometry);
    if (taskProductGeometry) {
      allGeometries.push({ type: 'task-product', data: prod, geometry: taskProductGeometry });
    }
  });

  // Set map center based on first geometry
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
    if (geojson.type === 'Feature') {
      return getFirstCoordinate(geojson.geometry);
    }
    if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features) && geojson.features.length > 0) {
      return getFirstCoordinate(geojson.features[0]);
    }
    if (geojson.type === 'GeometryCollection' && Array.isArray(geojson.geometries) && geojson.geometries.length > 0) {
      return getFirstCoordinate(geojson.geometries[0]);
    }
    return null;
  };

  if (allGeometries.length > 0) {
    const firstGeom = allGeometries[0].geometry;
    const firstPoint = getFirstCoordinate(firstGeom);
    if (firstPoint) {
      mapCenter = firstPoint;
      mapZoom = firstGeom.type === 'Point' ? 11 : 10;
    }
  }

  // Build the list of all product items visible on the map for multi-click hit testing
  const allProductsForHitTest: MapHitItem[] = [
    ...mapFilteredProducts
      .filter((p: any) => p.geometry)
      .map((p: any) => ({
        id: `task-${p.id}`,
        kind: 'task' as const,
        geometry: parseGeom(p.geometry),
        product: p,
      }))
      .filter((item: any) => item && item.geometry),
    ...(task.notifications?.flatMap((notif: any) =>
      (notif.products || [])
        .filter((prod: any) =>
          selectedMapProductionLines.includes(prod.production_line_id) &&
          (!isZK || selectedMapProductTypes.includes(prod.product_type || prod.type || '')) &&
          prod.geometry
        )
        .map((prod: any) => {
          const geom = parseGeom(prod.geometry);
          if (!geom) return null;
          return {
            id: `notif-${notif.id}-${prod.id}`,
            kind: 'notif' as const,
            geometry: geom,
            product: prod,
            notifCode: notif.code,
          };
        })
        .filter((item: any) => item)
    ) || []) as MapHitItem[],
    ...(showAllProductsOnMap && allMapProducts
      ? allMapProducts
          .filter((p: any) =>
            selectedMapProductionLines.includes(p.production_line_id) &&
            (!isZK || selectedMapProductTypes.includes(p.type || '')) &&
            p.geometry
          )
          .map((p: any) => {
            const geom = parseGeom(p.geometry);
            if (!geom) return null;
            return {
              id: `all-${p.id}`,
              kind: 'all' as const,
              geometry: geom,
              product: p,
              isLinked: task.task_products?.some((tp: any) => Number(tp.product_id) === Number(p.id)),
            };
          })
          .filter(Boolean) as MapHitItem[]
      : []),
  ];

  return (
    <div style={{ padding: '2rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Taak Details - {task.task_number}</h1>
        <button 
          onClick={() => navigate('/tasks')}
          style={{
            padding: '0.6rem 1.5rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '500',
          }}
        >
          ← Terug naar taken
        </button>
      </div>

      {/* Two Column Layout */}
      <div id="task-resizable-container" style={{ display: 'flex', gap: '0', alignItems: 'start', position: 'relative' }}>
        {/* Left Column */}
        <div style={{ width: `${leftWidth}%`, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '0.5rem' }}>
          {/* Task Details Card */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>Taakinformatie</h2>
        
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>
                Taaknummer
              </label>
              <div style={{ color: '#343a40', fontSize: '1.2rem', fontWeight: 'bold' }}>
                {task.task_number}
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>
                BaZ Nummer
              </label>
              <div style={{ color: '#343a40', fontSize: '1.1rem' }}>
                {task.baz_number || '-'}
              </div>
              {task.articles && task.articles.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    BaZ Artikelen
                  </label>
                  {task.articles.map((a: any) => (
                    <span
                      key={a.id}
                      onClick={() => {
                        const full = articles?.find((art: any) => art.id === a.id);
                        if (full) setPreviewArticle(full);
                      }}
                      style={{
                        display: 'inline-block',
                        backgroundColor: a.is_temporary ? '#fff3cd' : '#d4edda',
                        color: a.is_temporary ? '#856404' : '#155724',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '3px',
                        fontSize: '0.85rem',
                        marginRight: '0.3rem',
                        marginBottom: '0.2rem',
                        cursor: 'pointer',
                      }}
                      title={a.is_temporary ? 'Tijdelijk artikel' : 'Artikel'}
                    >
                      {a.baz_number}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>
              Titel
            </label>
            <div style={{ color: '#343a40', fontSize: '1.1rem' }}>
              {task.title}
            </div>
          </div>

          {task.description && (
            <div>
              <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>
                Beschrijving
              </label>
              {isHtmlEmpty(task.description) ? (
                <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Geen beschrijving beschikbaar</div>
              ) : (
                <div
                  style={{ color: '#343a40', lineHeight: '1.6' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(task.description) }}
                />
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>
                Productielijn
              </label>
              <div style={{ color: '#343a40' }}>
                {task.production_line_name} ({task.production_line_code})
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>
                Aangemaakt op
              </label>
              <div style={{ color: '#343a40' }}>
                {format(new Date(task.created_at), 'dd/MM/yyyy HH:mm')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: '#6c757d', flexWrap: 'wrap' }}>
            {task.msi_active && (
              <span style={{ color: '#856404', fontWeight: '500', background: '#fff3cd', padding: '0.25rem 0.5rem', borderRadius: '3px' }}>
                ⚠️ MSI actief
              </span>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!task.needs_followup}
                onChange={() => toggleTaskFlagsMutation.mutate({ flags: { needsFollowup: !task.needs_followup } })}
                style={{ cursor: 'pointer', transform: 'scale(1.3)', accentColor: '#0066cc' }}
              />
              <span style={{ fontWeight: task.needs_followup ? '600' : '400', color: '#004085' }}>Opvolgen</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!task.needs_extra_info}
                onChange={() => toggleTaskFlagsMutation.mutate({ flags: { needsExtraInfo: !task.needs_extra_info } })}
                style={{ cursor: 'pointer', transform: 'scale(1.3)', accentColor: '#e67700' }}
              />
              <span style={{ fontWeight: task.needs_extra_info ? '600' : '400', color: '#721c24' }}>Info opvragen</span>
            </label>
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
                padding: '0.45rem 0.85rem',
                backgroundColor: '#e67700',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              {isEmailFormVisible ? 'Formulier sluiten' : 'Meer info vragen'}
            </button>
          </div>

          {isEmailFormVisible && (
            <div style={{ padding: '1rem', backgroundColor: '#fff8e1', borderRadius: '6px', border: '1px solid #ffe69c' }}>
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
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '0.95rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleCreateInfoRequestEmail}
                    style={{
                      padding: '0.65rem 1rem',
                      backgroundColor: '#0066cc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                    }}
                  >
                    E-mail openen
                  </button>
                  <button
                    type="button"
                    onClick={openInfoRequestForm}
                    style={{
                      padding: '0.65rem 1rem',
                      backgroundColor: '#f8f9fa',
                      color: '#343a40',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                    }}
                  >
                    Herstellen
                  </button>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                  Het onderwerp wordt standaard gevuld met de titel van de taak of gekoppelde melding.
                </div>
              </div>
            </div>
          )}

          {task.created_by_first_name && (
            <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
              Aangemaakt door: {task.created_by_first_name} {task.created_by_last_name}
            </div>
          )}
        </div>
      </div>

      {/* Production Line Status */}
      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>
          Status geselecteerde productielijn
        </h2>

        {!currentProductionLineId ? (
          <div style={{ padding: '0.75rem', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '6px', border: '1px solid #ffe69c' }}>
            Selecteer eerst een productielijn om de taakstatus te wijzigen.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              border: '1px solid #dee2e6'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', color: '#343a40', marginBottom: '0.25rem' }}>
                {selectedProductionLine?.name || 'Onbekende productielijn'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                Code: {selectedProductionLine?.code || '-'}
              </div>
              {(() => {
                const hpdProject = (hpdProjects || []).find((p: any) => p.production_line_id === currentProductionLineId);
                return hpdProject ? (
                  <div style={{ fontSize: '0.85rem', color: '#0066cc', fontWeight: '500', marginTop: '0.25rem' }}>
                    HPD Project: {hpdProject.project_code}
                  </div>
                ) : null;
              })()}
            </div>

            <div style={{ flex: 1, maxWidth: '300px' }}>
              <select
                value={selectedProductionLineStatus}
                onChange={(e) => {
                  updateProductionLineStatusMutation.mutate({
                    productionLineId: currentProductionLineId,
                    status: e.target.value
                  });
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  border: '1px solid #dee2e6',
                  background:
                    selectedProductionLineStatus === 'completed'
                      ? '#d4edda'
                      : selectedProductionLineStatus === 'rejected'
                      ? '#f8d7da'
                      : '#fff3cd',
                  color: '#343a40',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <option value="under_construction">🔨 In Behandeling</option>
                <option value="completed">✅ Afgerond</option>
                <option value="rejected">❌ Afgewezen</option>
              </select>
              {isWaitForZkLine && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.65rem', fontSize: '0.9rem', color: '#343a40' }}>
                  <input
                    type="checkbox"
                    checked={selectedProductionLineWaitForZk}
                    onChange={(e) => {
                      if (!currentProductionLineId) return;
                      toggleWaitForZkMutation.mutate({
                        productionLineId: currentProductionLineId,
                        waitForZk: e.target.checked,
                      });
                    }}
                    disabled={toggleWaitForZkMutation.isPending}
                  />
                  wachten op ZK
                </label>
              )}
              {isWaitForZkLine && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#6c757d' }}>
                  Als deze optie aan staat, wordt IENC of Pilot ENC automatisch afgerond zodra ZK voor deze taak afgerond is.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

          {/* HPD Projects */}
          {hpdProjects && hpdProjects.length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>HPD Projecten</h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {hpdProjects.map((proj: any) => (
                  <div
                    key={proj.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#343a40' }}>
                        {proj.project_code}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#6c757d', marginTop: '0.25rem' }}>
                        {proj.production_line_name} ({proj.production_line_code})
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          background:
                            proj.status === 'completed'
                              ? '#d4edda'
                              : proj.status === 'rejected'
                              ? '#f8d7da'
                              : '#fff3cd',
                          color: '#343a40',
                        }}
                      >
                        {proj.status === 'completed'
                          ? '\u2705 Afgerond'
                          : proj.status === 'rejected'
                          ? '\u274c Afgewezen'
                          : '\ud83d\udd28 In Behandeling'}
                      </span>
                      {proj.synced_to_oracle ? (
                        <span style={{ fontSize: '0.8rem', color: '#28a745' }} title={`Gesynchroniseerd op ${proj.oracle_sync_date ? format(new Date(proj.oracle_sync_date), 'dd/MM/yyyy HH:mm') : '-'}`}>
                          \u2601 Oracle
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#6c757d' }} title="Nog niet gesynchroniseerd met Oracle">
                          \u23f3 Wacht op Oracle
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Notifications */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 
                onClick={() => setNotificationsCollapsed(!notificationsCollapsed)}
                style={{ 
                  marginBottom: '1rem', 
                  color: '#343a40',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  userSelect: 'none'
                }}
              >
                <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: notificationsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
                Gekoppelde Meldingen ({task.notifications?.length || 0})
              </h2>
              
              {!notificationsCollapsed && (
              <>
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.85rem',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#343a40', marginBottom: '0.5rem' }}>
                  Melding koppelen aan deze taak
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Zoek op code, titel of inhoud"
                    value={notificationSearchTerm}
                    onChange={(e) => setNotificationSearchTerm(e.target.value)}
                    disabled={hasAnyCompletedProductionLine || addNotificationToTaskMutation.isPending}
                    style={{
                      padding: '0.5rem 0.6rem',
                      borderRadius: '4px',
                      border: '1px solid #ced4da',
                      minWidth: '280px',
                      width: '100%',
                      maxWidth: '460px',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={selectedNotificationIdToAdd}
                    onChange={(e) => setSelectedNotificationIdToAdd(e.target.value)}
                    disabled={hasAnyCompletedProductionLine || addNotificationToTaskMutation.isPending}
                    style={{
                      padding: '0.5rem 0.6rem',
                      borderRadius: '4px',
                      border: '1px solid #ced4da',
                      minWidth: '360px',
                      maxWidth: '100%',
                    }}
                  >
                    <option value="">
                      {isLoadingCandidateNotifications ? 'Meldingen laden...' : 'Selecteer een melding'}
                    </option>
                    {candidateNotifications.map((notification: any) => (
                      <option key={notification.id} value={String(notification.id)}>
                        {(notification.code || `#${notification.id}`)} - {notification.title}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddNotificationToTask}
                    disabled={hasAnyCompletedProductionLine || addNotificationToTaskMutation.isPending || !selectedNotificationIdToAdd}
                    style={{
                      padding: '0.5rem 0.9rem',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: hasAnyCompletedProductionLine ? '#adb5bd' : '#0d6efd',
                      color: 'white',
                      cursor: hasAnyCompletedProductionLine ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {addNotificationToTaskMutation.isPending ? 'Koppelen...' : 'Koppel Melding'}
                  </button>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: hasAnyCompletedProductionLine ? '#b02a37' : '#6c757d' }}>
                  {hasAnyCompletedProductionLine
                    ? 'Deze taak heeft al minstens één afgeronde productielijn. Nieuwe meldingen kunnen niet meer gekoppeld worden.'
                    : 'Alleen open taken zonder afgeronde productielijn kunnen extra meldingen krijgen.'}
                </div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#6c757d' }}>
                  {candidateNotifications.length > 0
                    ? `${candidateNotifications.length} mogelijke melding(en) gevonden (reeds gekoppelde meldingen zijn verborgen).`
                    : 'Geen beschikbare meldingen gevonden voor de huidige zoekterm.'}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {(task.notifications || []).map((notification: any) => (
                  <div 
                    key={notification.id}
                    onClick={() => navigate(`/notifications/${notification.id}`)}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      border: '1px solid #e9ecef',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e9ecef';
                      e.currentTarget.style.borderColor = '#dee2e6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                      e.currentTarget.style.borderColor = '#e9ecef';
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: '#343a40', marginBottom: '0.5rem', fontSize: '1rem' }}>
                      Melding: {notification.code || notification.id}
                    </div>
                    <div style={{ color: '#343a40', marginBottom: '0.5rem' }}>
                      {notification.title}
                    </div>
                    
                    <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                      📅 {format(new Date(notification.notification_date), 'dd/MM/yyyy')}
                      {notification.received_date && ` • Ontvangen: ${format(new Date(notification.received_date), 'dd/MM/yyyy')}`}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                      Bron: {notification.source_detail || notification.source}
                    </div>

                    {notification.products && notification.products.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #dee2e6' }}>
                        <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                          Gekoppelde producten:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {notification.products.map((p: any) => (
                            <span
                              key={p.id}
                              style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#e9ecef',
                                borderRadius: '3px',
                                fontSize: '0.85rem',
                                color: '#343a40'
                              }}
                            >
                              {p.code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {notification.content && (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        fontSize: '0.9rem', 
                        color: '#6c757d',
                        lineHeight: '1.5',
                        maxHeight: '100px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {getPlainTextPreview(notification.content)}
                      </div>
                    )}
                  </div>
                ))}
                {(!task.notifications || task.notifications.length === 0) && (
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f8f9fa',
                      border: '1px dashed #ced4da',
                      borderRadius: '6px',
                      color: '#6c757d',
                      fontSize: '0.9rem',
                    }}
                  >
                    Nog geen meldingen gekoppeld aan deze taak.
                  </div>
                )}
              </div>
              </>
              )}
            </div>

           {/* Info Requests */}
           {infoRequests && infoRequests.length > 0 && (
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h2 
                  style={{ 
                    marginBottom: '1rem', 
                    color: '#343a40',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    userSelect: 'none'
                  }}
                  onClick={() => setIsInfoRequestsCollapsed(!isInfoRequestsCollapsed)}
                >
                  <span style={{ 
                    display: 'inline-flex',
                    transform: isInfoRequestsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    fontSize: '1.2rem'
                  }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                          <div style={{ flex: 1 }}>
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          {/* Task Products */}
          {(productsForSelectedAddLine.length > 0 || !!selectedProductLineId) && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>
                Product Statussen {selectedAddLine ? `(${selectedAddLine.name})` : ''} ({productsForSelectedAddLine.length})
              </h2>

              {productionLines && productionLines.length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#495057', marginBottom: '0.5rem' }}>
                    Product toevoegen per productielijn
                  </div>

                  {!canAddProductsForLine && (
                    <div style={{ marginBottom: '0.5rem', color: '#856404', background: '#fff3cd', border: '1px solid #ffe69c', borderRadius: '4px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                      Toevoegen is geblokkeerd omdat de taakstatus voor deze productielijn op afgerond staat.
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <select
                      value={selectedProductLineId ?? ''}
                      onChange={(e) => {
                        const nextLineId = Number(e.target.value);
                        setSelectedProductLineId(Number.isNaN(nextLineId) ? null : nextLineId);
                        setSelectedProductIdToAdd('');
                      }}
                      style={{ minWidth: '220px' }}
                    >
                      {(productionLines || []).map((line: any) => (
                        <option key={line.id} value={line.id}>
                          {line.code} - {line.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedProductIdToAdd}
                      onChange={(e) => setSelectedProductIdToAdd(e.target.value)}
                      disabled={!canAddProductsForLine || addTaskProductMutation.isPending || unlinkedProducts.length === 0}
                      style={{ minWidth: '280px', flex: 1 }}
                    >
                      <option value="">
                        {unlinkedProducts.length === 0 ? 'Geen extra producten beschikbaar voor deze lijn' : 'Selecteer product'}
                      </option>
                      {unlinkedProducts.map((product: any) => (
                        <option key={product.id} value={product.id}>
                          {product.code} - {product.name} ({product.type || 'onbekend'})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedProductIdToAdd || !selectedProductLineId) return;
                        addTaskProductMutation.mutate({
                          productId: Number(selectedProductIdToAdd),
                          productionLineId: selectedProductLineId,
                        });
                      }}
                      disabled={!canAddProductsForLine || !selectedProductIdToAdd || addTaskProductMutation.isPending}
                      style={{
                        padding: '0.6rem 1rem',
                        backgroundColor: '#0d6efd',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    >
                      {addTaskProductMutation.isPending ? 'Toevoegen...' : 'Product toevoegen'}
                    </button>
                  </div>
                </div>
              )}

              {productsForSelectedAddLine.length === 0 ? (
                <div style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                  Geen producten gekoppeld aan deze taak voor deze productielijn.
                </div>
              ) : (
              
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6c757d', fontSize: '0.9rem' }}>
                      Product
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6c757d', fontSize: '0.9rem' }}>
                      Versie
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6c757d', fontSize: '0.9rem' }}>
                      Status
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6c757d', fontSize: '0.9rem' }}>
                      Toegewezen aan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productsForSelectedAddLine.map((tp: any) => (
                    <tr key={tp.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '0.75rem', color: '#343a40' }}>
                        <strong>{tp.product_code}</strong>
                        <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                          {tp.product_name}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', color: '#343a40' }}>
                        {tp.version_number || '-'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <select
                          value={tp.status || 'hoog_te_verwerken'}
                          onChange={(e) => {
                            const targetId = tp.product_id ?? tp.id;
                            if (!targetId) {
                              alert('Kon productstatus niet bijwerken: ontbrekende productreferentie.');
                              return;
                            }
                            updateProductStatusMutation.mutate({
                              productId: Number(targetId),
                              status: e.target.value
                            });
                          }}
                          style={{
                            padding: '0.4rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            border: '1px solid #dee2e6',
                            background:
                              tp.status === 'voltooid'
                                ? '#d4edda'
                                : tp.status === 'in_inspectie'
                                ? '#cce5ff'
                                : tp.status === 'hoog_te_verwerken'
                                ? '#f8d7da'
                                : '#fff3cd',
                            color: '#343a40',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="hoog_te_verwerken">Hoog Te Verwerken</option>
                          <option value="te_verwerken">Te Verwerken</option>
                          <option value="in_inspectie">In Inspectie</option>
                          <option value="voltooid">Voltooid</option>
                          <option value="niet_van_toepassing">Niet Van Toepassing</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem', color: '#343a40' }}>
                        {tp.assigned_to_name || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}

          {/* BaZ-2 Article Editor - only for PUBL */}
          {(isPUBL || (articles && articles.length > 0)) && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2
                onClick={() => setArticlesCollapsed(!articlesCollapsed)}
                style={{
                  marginBottom: articlesCollapsed ? 0 : '1rem',
                  color: '#343a40',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  userSelect: 'none'
                }}
              >
                <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: articlesCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
                BaZ-2 Artikelen ({articles?.length || 0})
              </h2>

              {!articlesCollapsed && (<>
              {/* Existing articles list */}
              {articles && articles.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#6c757d', fontSize: '0.85rem' }}>BaZ Nummer</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#6c757d', fontSize: '0.85rem' }}>Boek Nr.</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#6c757d', fontSize: '0.85rem' }}>Tijdelijk</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#6c757d', fontSize: '0.85rem' }}>Aangemaakt door</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#6c757d', fontSize: '0.85rem' }}>Datum</th>
                        {isPUBL && <th style={{ padding: '0.5rem', textAlign: 'right', color: '#6c757d', fontSize: '0.85rem' }}>Acties</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {articles.map((article: any) => (
                        <React.Fragment key={article.id}>
                        <tr
                          onClick={() => setExpandedArticleId(expandedArticleId === article.id ? null : article.id)}
                          style={{ borderBottom: expandedArticleId === article.id ? 'none' : '1px solid #dee2e6', cursor: 'pointer', backgroundColor: expandedArticleId === article.id ? '#f0f7ff' : 'transparent' }}
                          onMouseEnter={(e) => { if (expandedArticleId !== article.id) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                          onMouseLeave={(e) => { if (expandedArticleId !== article.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <td style={{ padding: '0.5rem', fontWeight: 600, fontFamily: 'monospace' }}>
                            <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: expandedArticleId === article.id ? 'rotate(90deg)' : 'rotate(0deg)', marginRight: '0.4rem', fontSize: '0.75rem' }}>▶</span>
                            {article.baz_number}
                          </td>
                          <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>
                            {article.book_number}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {article.is_temporary ? (
                              <span style={{ color: '#fd7e14', fontWeight: 600 }}>Ja (T)</span>
                            ) : 'Nee'}
                          </td>
                          <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                            {article.created_by_first_name ? `${article.created_by_first_name} ${article.created_by_last_name}` : '-'}
                          </td>
                          <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                            {article.created_at ? format(new Date(article.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                          </td>
                          {isPUBL && <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setEditingArticleId(article.id);
                                setArticleContentNl(article.content_nl || '');
                                setArticleContentEn(article.content_en || '');
                                setArticleTitleNl(article.title_nl || '');
                                setArticleTitleEn(article.title_en || '');
                                setArticleIsTemporary(article.is_temporary);
                                setArticleBookNumber(String(article.book_number));
                              }}
                              style={{
                                padding: '0.3rem 0.6rem',
                                backgroundColor: '#0d6efd',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                marginRight: '0.3rem',
                              }}
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Artikel ${article.baz_number} verwijderen?`)) {
                                  deleteArticleMutation.mutate(article.id);
                                }
                              }}
                              style={{
                                padding: '0.3rem 0.6rem',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                              }}
                            >
                              Verwijderen
                            </button>
                          </td>}
                        </tr>
                        {expandedArticleId === article.id && (
                          <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                            <td colSpan={6} style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nederlands</div>
                                  {article.title_nl && (
                                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f0f7ff', border: '1px solid #bee5eb', borderRadius: '4px', fontSize: '0.95rem', fontWeight: 600, color: '#343a40', marginBottom: '0.5rem' }}>
                                      {article.title_nl}
                                    </div>
                                  )}
                                  <div
                                    style={{ padding: '0.75rem', backgroundColor: 'white', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem', lineHeight: '1.6', color: '#343a40', minHeight: '60px' }}
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(article.content_nl || '<em style="color:#6c757d">Geen inhoud</em>') }}
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>English</div>
                                  {article.title_en && (
                                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f0f7ff', border: '1px solid #bee5eb', borderRadius: '4px', fontSize: '0.95rem', fontWeight: 600, color: '#343a40', marginBottom: '0.5rem' }}>
                                      {article.title_en}
                                    </div>
                                  )}
                                  <div
                                    style={{ padding: '0.75rem', backgroundColor: 'white', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem', lineHeight: '1.6', color: '#343a40', minHeight: '60px' }}
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(article.content_en || '<em style="color:#6c757d">No content</em>') }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Article editor form - only for PUBL */}
              {isPUBL && <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#343a40' }}>
                  {editingArticleId ? 'Artikel Bewerken' : 'Nieuw Artikel'}
                </h3>

                {/* Book number and Temporary checkbox */}
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: '0.25rem' }}>
                      Boeknummer (BB)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={articleBookNumber}
                      onChange={(e) => setArticleBookNumber(e.target.value)}
                      disabled={!!editingArticleId}
                      style={{
                        padding: '0.4rem 0.6rem',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        width: '80px',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.2rem' }}>
                    <input
                      type="checkbox"
                      id="articleTemporary"
                      checked={articleIsTemporary}
                      onChange={(e) => setArticleIsTemporary(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="articleTemporary" style={{ fontSize: '0.9rem', cursor: 'pointer', color: '#495057' }}>
                      Tijdelijk (T)
                    </label>
                  </div>
                </div>

                {/* Side-by-side WYSIWYG editors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057' }}>Titel (Nederlands)</label>
                      <button
                        onClick={() => setArticleTitleNl(articleTitleEn)}
                        disabled={!articleTitleEn}
                        title="Kopieer Engelse titel naar Nederlands"
                        style={{
                          padding: '0.15rem 0.5rem',
                          backgroundColor: !articleTitleEn ? '#e9ecef' : '#6f42c1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: !articleTitleEn ? 'not-allowed' : 'pointer',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                        }}
                      >
                        EN → NL
                      </button>
                    </div>
                    <input
                      type="text"
                      value={articleTitleNl}
                      onChange={(e) => setArticleTitleNl(e.target.value)}
                      placeholder="Titel van het artikel in het Nederlands..."
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.6rem',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#495057' }}>Nederlands</label>
                      <button
                        onClick={() => setArticleContentNl(articleContentEn)}
                        disabled={isHtmlEmpty(articleContentEn)}
                        title="Kopieer Engelse inhoud naar Nederlands"
                        style={{
                          padding: '0.2rem 0.6rem',
                          backgroundColor: isHtmlEmpty(articleContentEn) ? '#e9ecef' : '#6f42c1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: isHtmlEmpty(articleContentEn) ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        EN → NL
                      </button>
                    </div>
                    <SunEditor
                      setContents={articleContentNl}
                      onChange={setArticleContentNl}
                      placeholder="Schrijf hier het artikel in het Nederlands..."
                      height="300px"
                      setOptions={{
                        buttonList: [
                          ['formatBlock'],
                          ['bold', 'italic', 'underline', 'strike'],
                          ['list', 'align'],
                          ['table'],
                          ['fontColor', 'hiliteColor'],
                          ['link', 'image'],
                          ['removeFormat']
                        ]
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057' }}>Title (English)</label>
                      <button
                        onClick={() => setArticleTitleEn(articleTitleNl)}
                        disabled={!articleTitleNl}
                        title="Copy Dutch title to English"
                        style={{
                          padding: '0.15rem 0.5rem',
                          backgroundColor: !articleTitleNl ? '#e9ecef' : '#6f42c1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: !articleTitleNl ? 'not-allowed' : 'pointer',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                        }}
                      >
                        NL → EN
                      </button>
                    </div>
                    <input
                      type="text"
                      value={articleTitleEn}
                      onChange={(e) => setArticleTitleEn(e.target.value)}
                      placeholder="Article title in English..."
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.6rem',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#495057' }}>Engels</label>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => setArticleContentEn(articleContentNl)}
                          disabled={isHtmlEmpty(articleContentNl)}
                          title="Copy Dutch content to English"
                          style={{
                            padding: '0.2rem 0.6rem',
                            backgroundColor: isHtmlEmpty(articleContentNl) ? '#e9ecef' : '#6f42c1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: isHtmlEmpty(articleContentNl) ? 'not-allowed' : 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                        >
                          NL → EN
                        </button>
                        <button
                          onClick={handleTranslate}
                          disabled={isTranslating || isHtmlEmpty(articleContentNl)}
                          style={{
                            padding: '0.2rem 0.6rem',
                            backgroundColor: isTranslating ? '#6c757d' : '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: isTranslating ? 'not-allowed' : 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                        >
                          {isTranslating ? 'Vertalen...' : 'Auto-vertalen NL → EN'}
                        </button>
                      </div>
                    </div>
                    <SunEditor
                      setContents={articleContentEn}
                      onChange={setArticleContentEn}
                      placeholder="Write the article in English here..."
                      height="300px"
                      setOptions={{
                        buttonList: [
                          ['formatBlock'],
                          ['bold', 'italic', 'underline', 'strike'],
                          ['list', 'align'],
                          ['table'],
                          ['fontColor', 'hiliteColor'],
                          ['link', 'image'],
                          ['removeFormat']
                        ]
                      }}
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {editingArticleId ? (
                    <>
                      <button
                        onClick={() => updateArticleMutation.mutate({
                          articleId: editingArticleId,
                          contentNl: articleContentNl,
                          contentEn: articleContentEn,
                          isTemporary: articleIsTemporary,
                          titleNl: articleTitleNl,
                          titleEn: articleTitleEn,
                        })}
                        disabled={updateArticleMutation.isPending}
                        style={{
                          padding: '0.6rem 1.5rem',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                          fontWeight: '500',
                        }}
                      >
                        {updateArticleMutation.isPending ? 'Opslaan...' : '💾 Artikel Opslaan'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingArticleId(null);
                          setArticleContentNl('');
                          setArticleContentEn('');
                          setArticleTitleNl('');
                          setArticleTitleEn('');
                          setArticleIsTemporary(false);
                        }}
                        style={{
                          padding: '0.6rem 1.5rem',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                        }}
                      >
                        Annuleren
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => createArticleMutation.mutate({
                        bookNumber: parseInt(articleBookNumber) || 1,
                        isTemporary: articleIsTemporary,
                        contentNl: articleContentNl,
                        contentEn: articleContentEn,
                        titleNl: articleTitleNl,
                        titleEn: articleTitleEn,
                      })}
                      disabled={createArticleMutation.isPending || isHtmlEmpty(articleContentNl)}
                      style={{
                        padding: '0.6rem 1.5rem',
                        backgroundColor: '#0d6efd',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '500',
                      }}
                    >
                      {createArticleMutation.isPending ? 'Aanmaken...' : '➕ Artikel Aanmaken'}
                    </button>
                  )}
                </div>
              </div>}
              </>)}
            </div>
          )}

          {/* Related Tasks */}
          {task.related_tasks && task.related_tasks.length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>
                Gerelateerde Taken ({task.related_tasks.length})
              </h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {task.related_tasks.map((relatedTask: any) => (
                  <div 
                    key={relatedTask.id}
                    onClick={() => navigate(`/tasks/${relatedTask.id}`)}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      border: '1px solid #e9ecef',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  >
                    <div style={{ fontWeight: 'bold', color: '#343a40', marginBottom: '0.25rem' }}>
                      Taak #{relatedTask.task_number}
                    </div>
                    <div style={{ color: '#343a40', fontSize: '0.9rem' }}>
                      {relatedTask.title}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6c757d', marginTop: '0.25rem' }}>
                      {relatedTask.relation_type || 'Gerelateerd'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Resizer */}
        <div
          onMouseDown={() => setIsResizing(true)}
          style={{
            width: '8px',
            cursor: 'col-resize',
            backgroundColor: isResizing ? '#0066cc' : '#e0e0e0',
            transition: 'background-color 0.2s',
            position: 'relative',
            flexShrink: 0,
            margin: '0 0.5rem',
            borderRadius: '4px',
            zIndex: 10,
            alignSelf: 'stretch',
          }}
          onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.backgroundColor = '#0066cc'; }}
          onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.backgroundColor = '#e0e0e0'; }}
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

        {/* Right Column */}
        <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingLeft: '0.5rem' }}>
          {/* Geographical Overview */}
          {allGeometries.length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>
                Geografisch Overzicht
              </h2>
              
              {/* Production Line Filters */}
              {productionLines && productionLines.length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#495057' }}>
                    Toon producten van productielijn:
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {productionLines.map((pl: any) => {
                  // Count task products for this production line
                  const taskProductCount = task.task_products?.filter(
                    (prod: any) => prod.product_production_line_id === pl.id
                  ).length || 0;
                  
                  // Count notification products for this production line
                  const notificationProductCount = task.notifications?.reduce((count: number, notif: any) => {
                    return count + (notif.products?.filter((prod: any) => prod.production_line_id === pl.id).length || 0);
                  }, 0) || 0;
                  
                  const totalProductCount = taskProductCount + notificationProductCount;
                  
                  if (totalProductCount === 0) return null; // Don't show production lines with no products
                  
                  return (
                    <label
                      key={pl.id}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: '#495057'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMapProductionLines.includes(pl.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMapProductionLines(prev => [...prev, pl.id]);
                          } else {
                            setSelectedMapProductionLines(prev => prev.filter(id => id !== pl.id));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>
                        {pl.name} <span style={{ color: '#6c757d' }}>({totalProductCount})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Product Type Filter - ZK only */}
          {isZK && (
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

          <div
            style={isMapExpanded ? {
              position: 'fixed',
              inset: '1rem',
              zIndex: 2000,
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #dee2e6',
              boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
            } : undefined}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowAllProductsOnMap(prev => !prev)}
                style={{
                  backgroundColor: showAllProductsOnMap ? '#28a745' : '#6c757d',
                  padding: '0.45rem 0.8rem',
                  fontSize: '0.85rem'
                }}
              >
                {showAllProductsOnMap ? '🗺️ Producten verbergen' : '🗺️ Alle producten tonen'}
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
                height: isMapExpanded ? '100%' : '500px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #dee2e6',
                minHeight: 0,
              }}
            >
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%' }}
              >
                <MapResizeHandler trigger={isMapExpanded} />
                <MapMultiClickHandler items={allProductsForHitTest} onHit={setMultiPopup} />
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
                        const color = getProductColor(item.product);
                        const code = item.kind === 'task' ? item.product.product_code : item.product.code;
                        const name = item.kind === 'task' ? item.product.product_name : item.product.name;
                        return (
                          <div key={item.id} style={{ marginBottom: '0.6rem', paddingBottom: '0.6rem', borderBottom: '1px solid #f0f0f0' }}>
                            <div style={{ fontWeight: '600', color }}>{code}</div>
                            <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{name}</div>
                            {item.product.type && <div style={{ fontSize: '0.75rem', color: '#888' }}>Type: {item.product.type}</div>}
                            {item.kind === 'task' && item.product.status && (
                              <div style={{ fontSize: '0.75rem' }}>Status: {item.product.status}</div>
                            )}
                            {item.kind === 'notif' && (
                              <div style={{ fontSize: '0.75rem', color: '#888' }}>Van melding: {item.notifCode}</div>
                            )}
                            {item.kind === 'all' && (
                              <div style={{ marginTop: '0.3rem' }}>
                                {item.isLinked ? (
                                  <span style={{ fontSize: '0.75rem', color: '#155724', backgroundColor: '#d4edda', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>✓ Gekoppeld aan taak</span>
                                ) : (
                                  <button
                                    onClick={() => { addTaskProductMutation.mutate({ productId: item.product.id, productionLineId: item.product.production_line_id }); setMultiPopup(null); }}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  >+ Toevoegen aan taak</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Popup>
                )}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
              
              {/* Render notification geometries */}
              {task.notifications?.map((notif: any) => {
                const geom = parseGeom(notif.geometry);
                if (!geom) return null;
                
                return (
                  <GeoJSON
                    key={`notif-${notif.id}`}
                    data={geom}
                    style={() => ({
                      color: '#ff0000',
                      weight: 3,
                      opacity: 0.7,
                      fillOpacity: 0.2,
                    })}
                    onEachFeature={(_feature, layer) => {
                      layer.bindPopup(`
                        <div style="font-family: sans-serif;">
                          <strong style="font-size: 1.1em; color: #343a40;">Melding: ${notif.code || notif.id}</strong><br/>
                          <span style="color: #6c757d;">${notif.title}</span><br/>
                          <span style="font-size: 0.9em; color: #999;">📅 ${format(new Date(notif.notification_date), 'dd/MM/yyyy')}</span>
                        </div>
                      `);
                    }}
                  />
                );
              })}
              
              {/* Render task product geometries */}
              {mapFilteredProducts.map((prod: any) => {
                const geom = parseGeom(prod.geometry);
                if (!geom) return null;
                
                const color = getProductColor(prod);
                
                return (
                  <GeoJSON
                    key={`task-prod-${prod.id}`}
                    data={geom}
                    style={() => ({
                      color: color,
                      weight: 2,
                      opacity: 0.8,
                      fillOpacity: 0.3,
                    })}
                  />
                );
              })}
              
              {/* Render products from notifications */}
              {task.notifications?.map((notif: any) => 
                notif.products
                  ?.filter((prod: any) => selectedMapProductionLines.includes(prod.production_line_id)
                    && (!isZK || selectedMapProductTypes.includes(prod.product_type || prod.type || '')))
                  .map((prod: any) => {
                  const geom = parseGeom(prod.geometry);
                  if (!geom) return null;
                  
                  const color = getProductColor(prod);
                  
                  return (
                    <GeoJSON
                      key={`notif-prod-${notif.id}-${prod.id}`}
                      data={geom}
                      style={() => ({
                        color: color,
                        weight: 2,
                        opacity: 0.6,
                        fillOpacity: 0.2,
                        dashArray: '5, 5',
                      })}
                    />
                  );
                })
              )}

              {/* All available products overlay for adding from map */}
              {showAllProductsOnMap && allMapProducts && allMapProducts
                .filter((product: any) => selectedMapProductionLines.includes(product.production_line_id)
                  && (!isZK || selectedMapProductTypes.includes(product.type || '')))
                .map((product: any) => {
                  if (!product.geometry) return null;
                  try {
                    const geom = typeof product.geometry === 'string' ? JSON.parse(product.geometry) : product.geometry;
                    const isLinked = task.task_products?.some((tp: any) => Number(tp.product_id) === Number(product.id));
                    const color = isLinked ? '#28a745' : '#ffc107';
                    const feature = {
                      type: 'Feature' as const,
                      geometry: geom,
                      properties: { code: product.code, name: product.name },
                    };
                    return (
                      <GeoJSON
                        key={`all-prod-${product.id}`}
                        data={feature}
                        style={{ color, weight: 2, opacity: 0.7, fillOpacity: 0.15 }}
                      />
                    );
                  } catch (e) {
                    return null;
                  }
                })}

              </MapContainer>
            </div>
          </div>
          
          <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#6c757d', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '3px', backgroundColor: '#ff0000' }}></div>
              <span>Meldingen</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '3px', backgroundColor: '#3388ff' }}></div>
              <span>ENC Producten</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '3px', backgroundColor: '#51cf66' }}></div>
              <span>iENC Producten</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '3px', backgroundColor: '#ff6b6b' }}></div>
              <span>Pilot_ENC Producten</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '3px', backgroundColor: '#ffd43b' }}></div>
              <span>Chart Producten</span>
            </div>
            {showAllProductsOnMap && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '20px', height: '3px', backgroundColor: '#28a745' }}></div>
                  <span>Gekoppeld product</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '20px', height: '3px', backgroundColor: '#ffc107' }}></div>
                  <span>Beschikbaar product (klik om toe te voegen)</span>
                </div>
              </>
            )}
          </div>
            </div>
          )}

          {/* Workflow Editor for Current Production Line */}
          {currentProductionLineId ? (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 style={{ marginBottom: '1rem', color: '#343a40' }}>
                Werkstappen / Workflow ({productionLines?.find((pl: any) => pl.id === currentProductionLineId)?.name})
              </h2>

              <SunEditor
                setContents={workflowContent}
                onChange={setWorkflowContent}
                placeholder="Beschrijf hier de werkstappen of workflow voor deze taak..."
                height="400px"
                setOptions={{
                  buttonList: [
                    ['formatBlock'],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['list', 'align'],
                    ['table'],
                    ['fontColor', 'hiliteColor'],
                    ['link', 'image'],
                    ['blockquote'],
                    ['removeFormat']
                  ]
                }}
              />

              <div style={{ marginTop: '1rem' }}>
                <button
                  onClick={() => workflowMutation.mutate({ workflowContent })}
                  disabled={workflowMutation.isPending}
                  style={{
                    padding: '0.6rem 1.5rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                  }}
                >
                  {workflowMutation.isPending ? '💾 Opslaan...' : '💾 Workflow Opslaan'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#fff3cd', 
              borderRadius: '4px', 
              color: '#856404',
              marginBottom: '1.5rem',
              fontSize: '0.9rem'
            }}>
              ⚠️ Selecteer een productielijn om opmerkingen toe te voegen.
            </div>
          )}

        {/* Render comments grouped by production line */}
        {Object.keys(commentsByProductionLine).length > 0 ? (
          Object.keys(commentsByProductionLine).map((productionLineId) => {
            const plData = commentsByProductionLine[productionLineId];
            const productionLine = productionLines?.find((pl: any) => pl.id === parseInt(productionLineId));
            const isCollapsed = collapsedProductionLines[productionLineId];

            return (
              <div 
                key={productionLineId}
                style={{ 
                  marginBottom: '1rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                {/* Production Line Header */}
                <div
                  onClick={() => setCollapsedProductionLines(prev => ({
                    ...prev,
                    [productionLineId]: !prev[productionLineId]
                  }))}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#f8f9fa',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: isCollapsed ? 'none' : '1px solid #dee2e6'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                    <strong style={{ color: '#343a40' }}>
                      {productionLine?.name || plData.productionLineName || 'Onbekende Productielijn'}
                    </strong>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {plData.comments.length}
                    </span>
                  </div>
                </div>

                {/* Comments for this production line */}
                {!isCollapsed && (
                  <div style={{ padding: '1rem' }}>
                    {plData.comments.map((comment: any) => (
                      <div
                        key={comment.id}
                        style={{
                          marginBottom: '1rem',
                          padding: '1rem',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '4px',
                          border: '1px solid #e9ecef'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                            <strong>{comment.first_name} {comment.last_name}</strong> • {format(new Date(comment.created_at), 'dd/MM/yyyy HH:mm')}
                          </div>
                          {comment.created_by === currentUserId && (
                            <button
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditCommentText(comment.comment);
                              }}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.8rem',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              ✏️ Bewerken
                            </button>
                          )}
                        </div>

                        {editingCommentId === comment.id ? (
                          <div>
                            <SunEditor
                              setContents={editCommentText}
                              onChange={setEditCommentText}
                              height="150px"
                              setOptions={{
                                buttonList: [
                                  ['bold', 'italic', 'underline'],
                                  ['list'],
                                  ['fontColor', 'hiliteColor'],
                                  ['removeFormat']
                                ]
                              }}
                            />
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => {
                                  editCommentMutation.mutate({
                                    commentId: comment.id,
                                    comment: editCommentText
                                  });
                                  setEditingCommentId(null);
                                }}
                                disabled={editCommentMutation.isPending}
                                style={{
                                  padding: '0.4rem 1rem',
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem'
                                }}
                              >
                                Opslaan
                              </button>
                              <button
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditCommentText('');
                                }}
                                style={{
                                  padding: '0.4rem 1rem',
                                  backgroundColor: '#6c757d',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem'
                                }}
                              >
                                Annuleren
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            style={{ color: '#343a40', lineHeight: '1.6' }}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(comment.comment || '') }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ 
            padding: '1rem', 
            textAlign: 'center', 
            color: '#6c757d',
            fontSize: '0.9rem'
          }}>
            Nog geen opmerkingen toegevoegd.
          </div>
        )}
      </div>
      </div>

      {/* Article Preview Modal */}
      {previewArticle && (
        <div
          onClick={() => setPreviewArticle(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white', borderRadius: '8px', padding: '1.5rem',
              maxWidth: '90vw', width: 'fit-content', minWidth: '400px', maxHeight: '90vh', overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#343a40' }}>
                {previewArticle.baz_number}
                {previewArticle.is_temporary && <span style={{ color: '#fd7e14', fontWeight: 400, fontSize: '0.85rem', marginLeft: '0.5rem' }}>(Tijdelijk)</span>}
              </h3>
              <button
                onClick={() => setPreviewArticle(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6c757d', padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nederlands</div>
                {previewArticle.title_nl && (
                  <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f0f7ff', border: '1px solid #bee5eb', borderRadius: '4px', fontSize: '0.95rem', fontWeight: 600, color: '#343a40', marginBottom: '0.5rem' }}>
                    {previewArticle.title_nl}
                  </div>
                )}
                <div
                  style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem', lineHeight: '1.6', color: '#343a40', minHeight: '60px' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(previewArticle.content_nl || '<em style="color:#6c757d">Geen inhoud</em>') }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>English</div>
                {previewArticle.title_en && (
                  <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f0f7ff', border: '1px solid #bee5eb', borderRadius: '4px', fontSize: '0.95rem', fontWeight: 600, color: '#343a40', marginBottom: '0.5rem' }}>
                    {previewArticle.title_en}
                  </div>
                )}
                <div
                  style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem', lineHeight: '1.6', color: '#343a40', minHeight: '60px' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(previewArticle.content_en || '<em style="color:#6c757d">No content</em>') }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}