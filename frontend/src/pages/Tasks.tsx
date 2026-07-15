




import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { useTableSort } from '../hooks/useTableSort';
import { format } from 'date-fns';
import { getApiErrorMessage } from '../utils/errorUtils';

const getStatusStyles = (status: string) => ({
  background:
    status === 'completed'
      ? '#d4edda'
      : status === 'rejected'
      ? '#f8d7da'
      : '#fff3cd',
  color: '#343a40',
});

const getStatusLabel = (status: string) => {
  if (status === 'completed') return '✅ Afgerond';
  if (status === 'rejected') return '❌ Afgewezen';
  return '🔨 In Behandeling';
};

const getStatusSymbol = (status: string) => {
  if (status === 'completed') return '✅';
  if (status === 'rejected') return '❌';
  return '🔨';
};

const getPlainTextPreview = (content: string, maxLength = 200) => {
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

const isIntegratedCorrectionListCode = (code: string | null | undefined): boolean => {
  const normalized = String(code || '').trim().toUpperCase().replace(/[_-]/g, '');

  for (const candidate of INTEGRATED_CORRECTION_LIST_CODES) {
    if (candidate.replace(/[_-]/g, '') === normalized) {
      return true;
    }
  }

  return false;
};

export default function Tasks() {
  const currentProductionLineId = useAuthStore((state) => state.currentProductionLineId);
  const user = useAuthStore((state) => state.user);
  const activeLineName = user?.rights?.find((r) => Number(r.id) === Number(currentProductionLineId))?.name;
  const defaultLineName = user?.defaultProductionLineName ?? null;
  const isDefaultLine = Number(currentProductionLineId) === Number(user?.defaultProductionLineId);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [otherStatusFilter, setOtherStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [notificationsCollapsed, setNotificationsCollapsed] = useState(true);
  const [previewArticle, setPreviewArticle] = useState<any>(null);
  const [isEmailFormVisible, setIsEmailFormVisible] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Column filters (inline, client-side) - similar to Notifications page
  const [colFilterTaskNumber, setColFilterTaskNumber] = useState('');
  const [colFilterTitle, setColFilterTitle] = useState('');
  const [colFilterBaz, setColFilterBaz] = useState('');
  const [colFilterMsi, setColFilterMsi] = useState('');
  const [colFilterFollowup, setColFilterFollowup] = useState('');
  const [colFilterInfo, setColFilterInfo] = useState('');
  const [colFilterProducts, setColFilterProducts] = useState('');
  const [colFilterStatus, setColFilterStatus] = useState('');
  const [colFilterWaitForZk, setColFilterWaitForZk] = useState('');
  const [colFilterOtherLineStatus, setColFilterOtherLineStatus] = useState<Record<number, string>>({});

  const fetchArticlePreview = async (taskId: number, articleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await api.get(`/tasks/${taskId}/articles`);
      const article = response.data.find((a: any) => a.id === articleId);
      if (article) setPreviewArticle(article);
    } catch (err) {
      console.error('Failed to fetch article:', err);
    }
  };

  // Pre-fill search from URL parameter
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearch(searchParam);
    }
  }, [searchParams]);

  // Update document title when search parameter is present
  useEffect(() => {
    const searchParam = searchParams.get('search');
    const lineNames: Record<number, string> = { 1: 'Zeekaart', 2: 'Inland ENC', 3: 'Pilot ENC', 4: 'Publicaties' };
    const lineName = currentProductionLineId ? lineNames[currentProductionLineId] : null;
    if (searchParam) {
      document.title = lineName ? `Taak ${searchParam} - ${lineName} - CARTIS` : `Taak ${searchParam} - CARTIS`;
    } else {
      document.title = lineName ? `Taken - ${lineName} - CARTIS` : 'Taken - CARTIS';
    }
    
    // Restore original title on unmount
    return () => {
      document.title = 'CARTIS 2.0';
    };
  }, [searchParams, currentProductionLineId]);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', currentProductionLineId, statusFilter, otherStatusFilter, search, page],
    queryFn: async () => {
      const response = await api.get('/tasks', {
        params: {
          productionLineId: currentProductionLineId,
          status: statusFilter || undefined,
          otherStatus: otherStatusFilter || undefined,
          search: search || undefined,
          page,
          limit: 50,
        },
      });
      return response.data;
    },
    enabled: !!currentProductionLineId,
  });

  const { data: productionLines } = useQuery({
    queryKey: ['productionLinesForTaskColumns'],
    queryFn: async () => {
      const response = await api.get('/production-lines');
      return response.data;
    },
  });

  const { data: expandedTask } = useQuery({
    queryKey: ['task', expandedId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${expandedId}`);
      return response.data;
    },
    enabled: expandedId !== null && !!currentProductionLineId,
  });

  const { data: expandedTaskInfoRequests } = useQuery({
    queryKey: ['taskInfoRequests', expandedId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${expandedId}/info-requests`);
      return response.data;
    },
    enabled: expandedId !== null,
  });

  // Update production line status mutation
  const updateProductionLineStatusMutation = useMutation({
    mutationFn: async ({ taskId, productionLineId, status }: { taskId: number; productionLineId: number; status: string }) => {
      console.log('Updating production line status:', { taskId, productionLineId, status });
      return await api.put(`/tasks/${taskId}/production-line-status/${productionLineId}`, { status });
    },
    onSuccess: (data) => {
      console.log('Production line status updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['task', expandedId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      console.error('Error updating production line status:', error.response?.data || error.message);
      alert(`Fout bij updaten taakstatus: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  // Update product status mutation
  const updateProductStatusMutation = useMutation({
    mutationFn: async ({ taskId, productId, status }: { taskId: number; productId: number; status: string }) => {
      console.log('Updating product status:', { taskId, productId, status });
      return await api.put(`/tasks/${taskId}/products/${productId}`, { status });
    },
    onSuccess: (data) => {
      console.log('Product status updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['task', expandedId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      console.error('Error updating product status:', error.response?.data || error.message);
      alert(`Fout bij updaten productstatus: ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  const toggleTaskFlagsMutation = useMutation({
    mutationFn: async ({ taskId, flags }: { taskId: number; flags: { msiActive?: boolean; needsFollowup?: boolean; needsExtraInfo?: boolean } }) => {
      const response = await api.patch(`/tasks/${taskId}/flags`, flags);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', expandedId] });
    },
  });

  // Create info request mutation
  const createInfoRequestMutation = useMutation({
    mutationFn: async ({ taskId, recipient, subject, body }: { taskId: number; recipient: string; subject: string; body: string }) => {
      const response = await api.post(`/tasks/${taskId}/info-requests`, {
        recipient,
        subject,
        body,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskInfoRequests', expandedId] });
    },
  });

  const { sortedData, handleSort, getSortIcon } = useTableSort(data?.data);

  const currentProductionLineCode = productionLines?.find((pl: any) => pl.id === currentProductionLineId)?.code;
  const isCurrentLineWaitForZk = currentProductionLineCode === 'IENC' || currentProductionLineCode === 'PILOT_ENC';

  const getWaitForZkChecked = (task: any) => {
    if (currentProductionLineCode === 'PILOT_ENC' && task.wait_for_zk == null) {
      return true;
    }
    return !!task.wait_for_zk;
  };

  const filteredData = useMemo(() => {
    if (!sortedData) return sortedData;

    const includesText = (source: string, filter: string) =>
      source.toLowerCase().includes(filter.toLowerCase());

    return sortedData.filter((task: any) => {
      if (colFilterTaskNumber && !includesText(String(task.task_number || ''), colFilterTaskNumber)) return false;
      if (colFilterTitle && !includesText(task.title || '', colFilterTitle)) return false;

      const bazText = task.articles && task.articles.length > 0
        ? task.articles.map((a: any) => a.baz_number || '').join(' ')
        : (task.baz_number || '');
      if (colFilterBaz && !includesText(bazText, colFilterBaz)) return false;

      if (colFilterMsi === 'ja' && !task.msi_active) return false;
      if (colFilterMsi === 'nee' && !!task.msi_active) return false;

      if (colFilterFollowup === 'ja' && !task.needs_followup) return false;
      if (colFilterFollowup === 'nee' && !!task.needs_followup) return false;

      if (colFilterInfo === 'ja' && !task.needs_extra_info) return false;
      if (colFilterInfo === 'nee' && !!task.needs_extra_info) return false;

      const productsText = (task.products || [])
        .map((p: any) => `${p.productCode || ''} ${p.productName || ''}`.trim())
        .join(' ');
      if (colFilterProducts && !includesText(productsText, colFilterProducts)) return false;

      const ownStatusLabel = getStatusLabel(task.production_line_status || 'under_construction');
      if (colFilterStatus && !includesText(ownStatusLabel, colFilterStatus)) return false;

      if (isCurrentLineWaitForZk) {
        const waitForZkChecked = getWaitForZkChecked(task);
        if (colFilterWaitForZk === 'ja' && !waitForZkChecked) return false;
        if (colFilterWaitForZk === 'nee' && waitForZkChecked) return false;
      }

      for (const [plIdStr, filterValue] of Object.entries(colFilterOtherLineStatus)) {
        if (!filterValue) continue;
        const plId = Number(plIdStr);
        const lineStatus = task.all_production_line_statuses?.find((status: any) => status.productionLineId === plId);
        const label = getStatusLabel(lineStatus?.status || 'under_construction');
        if (!includesText(label, filterValue)) return false;
      }

      return true;
    });
  }, [
    sortedData,
    colFilterTaskNumber,
    colFilterTitle,
    colFilterBaz,
    colFilterMsi,
    colFilterFollowup,
    colFilterInfo,
    colFilterProducts,
    colFilterStatus,
    colFilterWaitForZk,
    colFilterOtherLineStatus,
    isCurrentLineWaitForZk,
  ]);

  const productionLineColumns = (productionLines || [])
    .filter((pl: any) => !currentProductionLineId || pl.id !== currentProductionLineId)
    .sort((a: any, b: any) => (a.code || '').localeCompare(b.code || ''));

  const clearColumnFilters = () => {
    setColFilterTaskNumber('');
    setColFilterTitle('');
    setColFilterBaz('');
    setColFilterMsi('');
    setColFilterFollowup('');
    setColFilterInfo('');
    setColFilterProducts('');
    setColFilterStatus('');
    setColFilterWaitForZk('');
    setColFilterOtherLineStatus({});
  };

  const hasColumnFilters =
    !!colFilterTaskNumber ||
    !!colFilterTitle ||
    !!colFilterBaz ||
    !!colFilterMsi ||
    !!colFilterFollowup ||
    !!colFilterInfo ||
    !!colFilterProducts ||
    !!colFilterStatus ||
    !!colFilterWaitForZk ||
    Object.values(colFilterOtherLineStatus).some(Boolean);

  const navigateToProductVersion = (e: any, product: any) => {
    e.stopPropagation();

    if (product?.productVersionId) {
      window.open(`/product-versions?versionId=${product.productVersionId}`, '_blank', 'noopener,noreferrer');
      return;
    }

    window.open('/product-versions', '_blank', 'noopener,noreferrer');
  };

  const toggleWaitForZkMutation = useMutation({
    mutationFn: async ({ taskId, productionLineId, waitForZk }: { taskId: number; productionLineId: number; waitForZk: boolean }) => {
      return await api.patch(`/tasks/${taskId}/production-line-status/${productionLineId}/wait-for-zk`, { waitForZk });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', expandedId] });
    },
    onError: (error: any) => {
      alert(`Fout bij updaten 'wachten op ZK': ${getApiErrorMessage(error, 'onbekende fout')}`);
    },
  });

  const filteredExpandedTaskProducts = currentProductionLineId
    ? (expandedTask?.task_products || []).filter(
        (tp: any) => tp.product_production_line_id === currentProductionLineId && !isIntegratedCorrectionListCode(tp.product_code)
      )
    : [];
  const infoRequestDraft = expandedTask ? buildTaskInfoRequestDraft(expandedTask) : null;

  const openInfoRequestForm = () => {
    if (!infoRequestDraft) return;

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
        taskId: expandedId!,
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
      alert(`Fout bij opslaan van e-mailverzoek: ${getApiErrorMessage(error, 'onbekende fout')}`);
    }
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setIsEmailFormVisible(false);
    } else {
      setExpandedId(id);
      setNotificationsCollapsed(true); // Reset to collapsed when opening a new task
      setIsEmailFormVisible(false);
    }
  };

  if (!currentProductionLineId) {
    return (
      <div>
        <h1 className="page-title">Taken</h1>
        <div className="alert alert-warning">
          Geen productielijn geselecteerd. Selecteer eerst een productielijn om taken te bekijken.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className={`page-title${!!currentProductionLineId ? (isDefaultLine ? ' page-title--default' : ' page-title--non-default') : ''}`}>
        Taken
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
          placeholder="Zoeken op taaknummer of titel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Alle statussen</option>
          <option value="under_construction">🔨 In Behandeling</option>
          <option value="completed">✅ Afgerond</option>
          <option value="rejected">❌ Afgewezen</option>
        </select>

        <select value={otherStatusFilter} onChange={(e) => setOtherStatusFilter(e.target.value)}>
          <option value="">Alle statussen andere lijnen</option>
          <option value="under_construction">Andere lijnen: 🔨 In Behandeling</option>
          <option value="completed">Andere lijnen: ✅ Afgerond</option>
          <option value="rejected">Andere lijnen: ❌ Afgewezen</option>
        </select>

        {hasColumnFilters && (
          <button type="button" className="btn-secondary" onClick={clearColumnFilters}>
            Kolomfilters wissen
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="loading-text">Laden...</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('task_number')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Taaknummer{getSortIcon('task_number')}
                </th>
                <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Titel{getSortIcon('title')}
                </th>
                <th onClick={() => handleSort('baz_number')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  BaZ Nr.{getSortIcon('baz_number')}
                </th>
                <th onClick={() => handleSort('msi_active')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  MSI Actief{getSortIcon('msi_active')}
                </th>
                <th onClick={() => handleSort('needs_followup')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Opvolgen{getSortIcon('needs_followup')}
                </th>
                <th onClick={() => handleSort('needs_extra_info')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Info{getSortIcon('needs_extra_info')}
                </th>
                <th>Producten</th>
                <th className={!isDefaultLine ? 'pl-col--active--non-default' : ''}>Status</th>
                {isCurrentLineWaitForZk && <th>Wachten op ZK</th>}
                {productionLineColumns.map((pl: any) => (
                  <th key={`pl-col-${pl.id}`}>{pl.code}</th>
                ))}
                <th>Acties</th>
              </tr>
              <tr>
                <th>
                  <input value={colFilterTaskNumber} onChange={(e) => setColFilterTaskNumber(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                </th>
                <th>
                  <input value={colFilterTitle} onChange={(e) => setColFilterTitle(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                </th>
                <th>
                  <input value={colFilterBaz} onChange={(e) => setColFilterBaz(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                </th>
                <th>
                  <select value={colFilterMsi} onChange={(e) => setColFilterMsi(e.target.value)} style={{ width: '100%' }}>
                    <option value="">Alle</option>
                    <option value="ja">Ja</option>
                    <option value="nee">Nee</option>
                  </select>
                </th>
                <th>
                  <select value={colFilterFollowup} onChange={(e) => setColFilterFollowup(e.target.value)} style={{ width: '100%' }}>
                    <option value="">Alle</option>
                    <option value="ja">Ja</option>
                    <option value="nee">Nee</option>
                  </select>
                </th>
                <th>
                  <select value={colFilterInfo} onChange={(e) => setColFilterInfo(e.target.value)} style={{ width: '100%' }}>
                    <option value="">Alle</option>
                    <option value="ja">Ja</option>
                    <option value="nee">Nee</option>
                  </select>
                </th>
                <th>
                  <input value={colFilterProducts} onChange={(e) => setColFilterProducts(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                </th>
                <th className={!isDefaultLine ? 'pl-col--active--non-default' : ''}>
                  <input value={colFilterStatus} onChange={(e) => setColFilterStatus(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                </th>
                {isCurrentLineWaitForZk && (
                  <th>
                    <select value={colFilterWaitForZk} onChange={(e) => setColFilterWaitForZk(e.target.value)} style={{ width: '100%' }}>
                      <option value="">Alle</option>
                      <option value="ja">Ja</option>
                      <option value="nee">Nee</option>
                    </select>
                  </th>
                )}
                {productionLineColumns.map((pl: any) => (
                  <th key={`pl-col-filter-${pl.id}`}>
                    <input
                      value={colFilterOtherLineStatus[pl.id] || ''}
                      onChange={(e) => setColFilterOtherLineStatus((prev) => ({ ...prev, [pl.id]: e.target.value }))}
                      placeholder="Filter"
                      style={{ width: '100%' }}
                    />
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>





                          <tbody>
              {filteredData?.map((task: any) => {
                const isExpanded = expandedId === task.id;
                const taskProducts = Array.isArray(task.products)
                  ? task.products.filter((p: any) => !isIntegratedCorrectionListCode(p.productCode || p.code))
                  : [];
                
                return (
                  <>
                    <tr 
                      key={task.id}
                      style={{ 
                        cursor: 'pointer',
                        backgroundColor: isExpanded ? 'var(--color-table-row-active)' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.backgroundColor = 'var(--color-table-row-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.backgroundColor = '';
                        }
                      }}
                    >
                      <td onClick={() => toggleExpand(task.id)}>
                        <span className="task-tag">
                          {task.task_number}
                        </span>
                      </td>
                      <td onClick={() => toggleExpand(task.id)}>{task.title}</td>
                      <td onClick={() => toggleExpand(task.id)}>
                        <div>
                          {task.baz_number && (
                            <span
                              style={{
                                display: 'inline-block',
                                backgroundColor: '#e9ecef',
                                color: '#495057',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '3px',
                                fontSize: '0.8rem',
                                marginRight: '0.25rem',
                                marginBottom: '0.15rem',
                              }}
                              title="Taak BaZ nummer"
                            >
                              {task.baz_number}
                            </span>
                          )}
                          {task.articles && task.articles.length > 0 ? (
                            task.articles.map((a: any) => (
                              <span
                                key={a.id}
                                onClick={(e) => fetchArticlePreview(task.id, a.id, e)}
                                style={{
                                  display: 'inline-block',
                                  backgroundColor: a.is_temporary ? '#fff3cd' : '#d4edda',
                                  color: a.is_temporary ? '#856404' : '#155724',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '3px',
                                  fontSize: '0.8rem',
                                  marginRight: '0.25rem',
                                  marginBottom: '0.15rem',
                                  cursor: 'pointer',
                                }}
                                title={a.is_temporary ? 'Tijdelijk artikel' : 'Artikel'}
                              >
                                {a.baz_number}
                              </span>
                            ))
                          ) : !task.baz_number ? (
                            '-'
                          ) : null}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!task.msi_active}
                          onChange={() => toggleTaskFlagsMutation.mutate({ taskId: task.id, flags: { msiActive: !task.msi_active } })}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)', accentColor: '#856404' }}
                          title="MSI actief"
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!task.needs_followup}
                          onChange={() => toggleTaskFlagsMutation.mutate({ taskId: task.id, flags: { needsFollowup: !task.needs_followup } })}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)', accentColor: '#0066cc' }}
                          title="Opvolgen"
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!task.needs_extra_info}
                          onChange={() => toggleTaskFlagsMutation.mutate({ taskId: task.id, flags: { needsExtraInfo: !task.needs_extra_info } })}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)', accentColor: '#e67700' }}
                          title="Info opvragen"
                        />
                      </td>
                      <td onClick={() => toggleExpand(task.id)}>
                        {taskProducts.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {taskProducts.map((p: any) => (
                              <span
                                key={`${task.id}-${p.productId}-${p.productVersionId || 'no-version'}`}
                                onClick={(e) => navigateToProductVersion(e, p)}
                                className="product-tag product-tag--current"
                                style={{ cursor: 'pointer' }}
                                title={p.versionNumber ? `Open productversie ${p.versionNumber}` : 'Open productversies'}
                              >
                                {p.productCode}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td
                        onClick={() => toggleExpand(task.id)}
                        className={isDefaultLine ? 'pl-col--active' : 'pl-col--active--non-default'}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                          <span
                            className={`status-pill ${
                              (task.production_line_status || 'under_construction') === 'completed' ? 'status-pill--completed' :
                              (task.production_line_status || 'under_construction') === 'rejected' ? 'status-pill--rejected' :
                              'status-pill--in-progress'
                            }`}
                          >
                            {getStatusLabel(task.production_line_status || 'under_construction')}
                          </span>
                        </div>
                      </td>
                      {isCurrentLineWaitForZk && (
                        <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={getWaitForZkChecked(task)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleWaitForZkMutation.mutate({
                                taskId: task.id,
                                productionLineId: currentProductionLineId,
                                waitForZk: e.target.checked,
                              });
                            }}
                            style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                            title="wachten op ZK"
                          />
                        </td>
                      )}
                      {productionLineColumns.map((pl: any) => {
                        const lineStatus = task.all_production_line_statuses?.find(
                          (status: any) => status.productionLineId === pl.id
                        );

                        return (
                          <td key={`${task.id}-pl-${pl.id}`} onClick={() => toggleExpand(task.id)}>
                            {lineStatus ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.45rem',
                                    borderRadius: '999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    border: '1px solid #dee2e6',
                                    ...getStatusStyles(lineStatus.status || 'under_construction'),
                                  }}
                                  title={`${lineStatus.productionLineName || lineStatus.productionLineCode}: ${getStatusLabel(lineStatus.status || 'under_construction')}`}
                                >
                                  {getStatusSymbol(lineStatus.status || 'under_construction')}
                                </span>
                                {/* wait-for-zk checkbox is only shown/editable on the currently selected IENC/PILOT_ENC line */}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                        );
                      })}
                      <td onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`/tasks/${task.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="action-btn action-btn--primary"
                          title="Open detail pagina in nieuw tabblad"
                        >
                          Details
                        </a>
                      </td>
                    </tr>
                    {isExpanded && expandedTask && (
                      <tr key={`${task.id}-details`}>
                        <td colSpan={(isCurrentLineWaitForZk ? 10 : 9) + productionLineColumns.length} style={{ padding: 0, backgroundColor: 'var(--color-bg)' }}>
                          <div style={{ padding: '2rem', backgroundColor: 'var(--color-bg-white)', margin: '1rem', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
                            {/* Task Details */}
                            <div style={{ marginBottom: '2rem' }}>
                              <h2 style={{ marginBottom: '1rem', color: 'var(--color-dark)', fontSize: '1.3rem' }}>
                                Taak {expandedTask.task_number}
                              </h2>
                              
                              <div style={{ display: 'grid', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                  <div>
                                    <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                      Titel
                                    </label>
                                    <div style={{ color: '#343a40' }}>
                                      {expandedTask.title}
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                      BaZ Nummer
                                    </label>
                                    <div style={{ color: '#343a40' }}>
                                      {expandedTask.baz_number || '-'}
                                    </div>
                                    {expandedTask.articles && expandedTask.articles.length > 0 && (
                                      <div style={{ marginTop: '0.5rem' }}>
                                        <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                          BaZ Artikelen
                                        </label>
                                        {expandedTask.articles.map((a: any) => (
                                          <span
                                            key={a.id}
                                            onClick={(e) => fetchArticlePreview(expandedTask.id, a.id, e)}
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

                                {expandedTask.description && (
                                  <div>
                                    <label style={{ fontWeight: 'bold', color: '#6c757d', display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                      Beschrijving
                                    </label>
                                    <div style={{ color: '#343a40', lineHeight: '1.6', whiteSpace: 'pre-wrap', backgroundColor: '#f8f9fa', padding: '0.75rem', borderRadius: '4px' }}>
                                      {expandedTask.description}
                                    </div>
                                  </div>
                                )}

                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={!!expandedTask.msi_active}
                                      onChange={() => toggleTaskFlagsMutation.mutate({ taskId: expandedTask.id, flags: { msiActive: !expandedTask.msi_active } })}
                                      style={{ cursor: 'pointer', transform: 'scale(1.3)', accentColor: '#856404' }}
                                    />
                                    <span style={{ fontWeight: expandedTask.msi_active ? '600' : '400', color: '#856404' }}>MSI actief</span>
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={!!expandedTask.needs_followup}
                                      onChange={() => toggleTaskFlagsMutation.mutate({ taskId: expandedTask.id, flags: { needsFollowup: !expandedTask.needs_followup } })}
                                      style={{ cursor: 'pointer', transform: 'scale(1.3)', accentColor: '#0066cc' }}
                                    />
                                    <span style={{ fontWeight: expandedTask.needs_followup ? '600' : '400', color: '#004085' }}>Opvolgen</span>
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={!!expandedTask.needs_extra_info}
                                      onChange={() => toggleTaskFlagsMutation.mutate({ taskId: expandedTask.id, flags: { needsExtraInfo: !expandedTask.needs_extra_info } })}
                                      style={{ cursor: 'pointer', transform: 'scale(1.3)', accentColor: '#e67700' }}
                                    />
                                    <span style={{ fontWeight: expandedTask.needs_extra_info ? '600' : '400', color: '#721c24' }}>Info opvragen</span>
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

                                <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                  Aangemaakt op: {format(new Date(expandedTask.created_at), 'dd/MM/yyyy HH:mm')}
                                  {expandedTask.created_by_first_name && (
                                    <span> door {expandedTask.created_by_first_name} {expandedTask.created_by_last_name}</span>
                                  )}
                                </div>

                                {/* Production Line Status */}
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                                  <div style={{ fontWeight: '600', color: '#495057', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                    Status Taak
                                  </div>
                                  <select
                                    value={expandedTask.production_line_status || 'under_construction'}
                                    onChange={(e) => {
                                      updateProductionLineStatusMutation.mutate({
                                        taskId: expandedTask.id,
                                        productionLineId: expandedTask.production_line_id,
                                        status: e.target.value
                                      });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      padding: '0.5rem 0.75rem',
                                      borderRadius: '4px',
                                      fontSize: '0.9rem',
                                      border: '1px solid #dee2e6',
                                      background:
                                        expandedTask.production_line_status === 'completed'
                                          ? '#d4edda'
                                          : expandedTask.production_line_status === 'rejected'
                                          ? '#f8d7da'
                                          : '#fff3cd',
                                      color: '#343a40',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      minWidth: '200px'
                                    }}
                                  >
                                    <option value="under_construction">🔨 In Behandeling</option>
                                    <option value="completed">✅ Afgerond</option>
                                    <option value="rejected">❌ Afgewezen</option>
                                  </select>
                                  {isCurrentLineWaitForZk && (
                                    <label
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.65rem', fontSize: '0.85rem', color: '#495057' }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={getWaitForZkChecked(task)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleWaitForZkMutation.mutate({
                                            taskId: task.id,
                                            productionLineId: currentProductionLineId,
                                            waitForZk: e.target.checked,
                                          });
                                        }}
                                        style={{ cursor: 'pointer' }}
                                      />
                                      wachten op ZK
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Linked Notifications */}
                            {expandedTask.notifications && expandedTask.notifications.length > 0 && (
                              <div style={{ marginBottom: '2rem' }}>
                                <h3 
                                  onClick={() => setNotificationsCollapsed(!notificationsCollapsed)}
                                  style={{ 
                                    marginBottom: '1rem', 
                                    color: '#343a40', 
                                    fontSize: '1.1rem',
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
                                  Gekoppelde Meldingen ({expandedTask.notifications.length})
                                </h3>
                                
                                {!notificationsCollapsed && (
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                  {expandedTask.notifications.map((notification: any) => (
                                    <div 
                                      key={notification.id}
                                      onClick={() => window.open(`/notifications/${notification.id}`, '_blank')}
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
                                        e.currentTarget.style.borderColor = '#0066cc';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                                        e.currentTarget.style.borderColor = '#e9ecef';
                                        e.currentTarget.style.boxShadow = 'none';
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#343a40', marginBottom: '0.25rem' }}>
                                            {notification.code || `#${notification.id}`}
                                          </div>
                                          <div style={{ color: '#343a40', marginBottom: '0.5rem' }}>
                                            {notification.title}
                                          </div>
                                          <div style={{ fontSize: '0.85rem', color: '#6c757d', display: 'flex', gap: '1rem' }}>
                                            <span>
                                              📅 {format(new Date(notification.notification_date), 'dd/MM/yyyy')}
                                            </span>
                                            <span>
                                              📥 {format(new Date(notification.received_date), 'dd/MM/yyyy HH:mm')}
                                            </span>
                                            <span>
                                              🔗 {notification.source}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {notification.products && notification.products.filter((p: any) => !isIntegratedCorrectionListCode(p.code)).length > 0 && (
                                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #dee2e6' }}>
                                          <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                                            Gekoppelde producten:
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                            {notification.products.filter((p: any) => !isIntegratedCorrectionListCode(p.code)).map((p: any) => (
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
                                </div>
                                )}
                              </div>
                            )}

                            {/* Info Requests */}
                            {expandedTaskInfoRequests && expandedTaskInfoRequests.length > 0 && (
                              <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ marginBottom: '1rem', color: '#343a40', fontSize: '1.1rem' }}>
                                  Verzoeken om meer informatie ({expandedTaskInfoRequests.length})
                                </h3>
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                  {expandedTaskInfoRequests.map((request: any) => (
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
                                      <div style={{ fontSize: '0.9rem', color: '#343a40', lineHeight: '1.5', backgroundColor: '#ffffff', padding: '0.75rem', borderRadius: '4px', border: '1px solid #dee2e6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflow: 'auto' }}>
                                        {request.body}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Task Products */}
                            {filteredExpandedTaskProducts.length > 0 && (
                              <div>
                                <h3 style={{ marginBottom: '1rem', color: '#343a40', fontSize: '1.1rem' }}>
                                  Product Statussen ({filteredExpandedTaskProducts.length})
                                </h3>
                                
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
                                    {filteredExpandedTaskProducts.map((tp: any) => (
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
                                              updateProductStatusMutation.mutate({
                                                taskId: expandedTask.id,
                                                productId: tp.id,
                                                status: e.target.value
                                              });
                                            }}
                                            onClick={(e) => e.stopPropagation()}
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
                              </div>
                            )}
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
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
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
                  dangerouslySetInnerHTML={{ __html: previewArticle.content_nl || '<em style="color:#6c757d">Geen inhoud</em>' }}
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
                  dangerouslySetInnerHTML={{ __html: previewArticle.content_en || '<em style="color:#6c757d">No content</em>' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
