import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';

const lineNames: Record<number, string> = {
  1: 'Zeekaart',
  2: 'Inland ENC',
  3: 'Pilot ENC',
  4: 'Publicaties',
};

const formatDate = (value?: string | null, includeTime = false) => {
  if (!value) return '-';

  return format(new Date(value), includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy');
};

const formatDays = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return `${Number(value).toFixed(1)} d`;
};

const getAverage = (values: Array<number | null | undefined>) => {
  const validValues = values.filter((value): value is number => value !== null && value !== undefined && !Number.isNaN(Number(value)));
  if (validValues.length === 0) return null;

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
};

const getVersionPillClassName = (isPublished: boolean) =>
  `status-pill ${isPublished ? 'status-pill--completed' : 'status-pill--rejected'}`;

export default function LeadTimes() {
  const currentProductionLineId = useAuthStore((state) => state.currentProductionLineId);
  const user = useAuthStore((state) => state.user);
  const activeLineName = user?.rights?.find((r) => Number(r.id) === Number(currentProductionLineId))?.name;
  const defaultLineName = user?.defaultProductionLineName ?? null;
  const isDefaultLine = Number(currentProductionLineId) === Number(user?.defaultProductionLineId);
  const [search, setSearch] = useState('');
  const [colFilterNotification, setColFilterNotification] = useState('');
  const [colFilterReceived, setColFilterReceived] = useState('');
  const [colFilterTask, setColFilterTask] = useState('');
  const [colFilterCompleted, setColFilterCompleted] = useState('');
  const [colFilterProduct, setColFilterProduct] = useState('');
  const [colFilterVersion, setColFilterVersion] = useState('');
  const [colFilterPublished, setColFilterPublished] = useState('');
  const [colFilterNoticeToTask, setColFilterNoticeToTask] = useState('');
  const [colFilterTaskToPublication, setColFilterTaskToPublication] = useState('');
  const [colFilterTotal, setColFilterTotal] = useState('');

  useEffect(() => {
    const lineName = currentProductionLineId ? lineNames[currentProductionLineId] : null;
    document.title = lineName ? `Doorlooptijden - ${lineName} - CARTIS` : 'Doorlooptijden - CARTIS';
    return () => {
      document.title = 'CARTIS 2.0';
    };
  }, [currentProductionLineId]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['leadTimes', currentProductionLineId, search],
    queryFn: async () => {
      const response = await api.get('/tasks/lead-times', {
        params: {
          productionLineId: currentProductionLineId || undefined,
          search: search || undefined,
        },
      });
      return response.data;
    },
    enabled: !!currentProductionLineId,
  });

  const filteredRows = useMemo(() => {
    const includesText = (source: string, filter: string) =>
      source.toLowerCase().includes(filter.toLowerCase());

    return (rows || []).filter((row: any) => {
      const notificationText = `${row.notification_code || ''} ${row.notification_title || ''}`.trim();
      if (colFilterNotification && !includesText(notificationText, colFilterNotification)) return false;

      const receivedText = row.received_date ? formatDate(row.received_date, true) : '-';
      if (colFilterReceived && !includesText(receivedText, colFilterReceived)) return false;

      const taskText = `${row.task_number || ''} ${row.task_title || ''}`.trim();
      if (colFilterTask && !includesText(taskText, colFilterTask)) return false;

      const completedText = row.completed_at ? formatDate(row.completed_at, true) : '-';
      if (colFilterCompleted && !includesText(completedText, colFilterCompleted)) return false;

      const productText = `${row.product_code || ''} ${row.product_name || ''}`.trim();
      if (colFilterProduct && !includesText(productText, colFilterProduct)) return false;

      const versionText = row.version_number || '-';
      if (colFilterVersion && !includesText(versionText, colFilterVersion)) return false;

      const publishedText = row.publication_date ? formatDate(row.publication_date) : '-';
      if (colFilterPublished && !includesText(publishedText, colFilterPublished)) return false;

      const noticeToTaskText = formatDays(row.notice_to_task_days);
      if (colFilterNoticeToTask && !includesText(noticeToTaskText, colFilterNoticeToTask)) return false;

      const taskToPublicationText = formatDays(row.task_to_publication_days);
      if (colFilterTaskToPublication && !includesText(taskToPublicationText, colFilterTaskToPublication)) return false;

      const totalText = formatDays(row.total_days);
      if (colFilterTotal && !includesText(totalText, colFilterTotal)) return false;

      return true;
    });
  }, [
    rows,
    colFilterNotification,
    colFilterReceived,
    colFilterTask,
    colFilterCompleted,
    colFilterProduct,
    colFilterVersion,
    colFilterPublished,
    colFilterNoticeToTask,
    colFilterTaskToPublication,
    colFilterTotal,
  ]);

  const clearColumnFilters = () => {
    setColFilterNotification('');
    setColFilterReceived('');
    setColFilterTask('');
    setColFilterCompleted('');
    setColFilterProduct('');
    setColFilterVersion('');
    setColFilterPublished('');
    setColFilterNoticeToTask('');
    setColFilterTaskToPublication('');
    setColFilterTotal('');
  };

  const hasColumnFilters =
    !!colFilterNotification ||
    !!colFilterReceived ||
    !!colFilterTask ||
    !!colFilterCompleted ||
    !!colFilterProduct ||
    !!colFilterVersion ||
    !!colFilterPublished ||
    !!colFilterNoticeToTask ||
    !!colFilterTaskToPublication ||
    !!colFilterTotal;

  const filteredSummary = useMemo(() => {
    return {
      totalRows: filteredRows.length,
      avgNoticeToTask: getAverage(filteredRows.map((row: any) => row.notice_to_task_days)),
      avgTaskToPublication: getAverage(filteredRows.map((row: any) => row.task_to_publication_days)),
      avgTotal: getAverage(filteredRows.map((row: any) => row.total_days)),
    };
  }, [filteredRows]);

  if (!currentProductionLineId) {
    return (
      <div>
        <h1 className="page-title">Doorlooptijden</h1>
        <div className="alert alert-warning">
          Geen productielijn geselecteerd. Selecteer eerst een productielijn om de doorlooptijden te bekijken.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className={`page-title${!!currentProductionLineId ? (isDefaultLine ? ' page-title--default' : ' page-title--non-default') : ''}`}>
          Doorlooptijden
          {activeLineName && (
            <span className="page-title__production-line">
              {' — '}{activeLineName}
              {isDefaultLine && <span className="page-title__default-badge"> (standaard)</span>}
            </span>
          )}
        </h1>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op melding, taak, product of versie"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-body">
            <div style={{ color: '#6b7280', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trajecten</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#111827' }}>{filteredSummary.totalRows}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div style={{ color: '#6b7280', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gem. melding naar taak</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#111827' }}>{formatDays(filteredSummary.avgNoticeToTask)}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div style={{ color: '#6b7280', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gem. taak naar publicatie</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#111827' }}>{formatDays(filteredSummary.avgTaskToPublication)}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div style={{ color: '#6b7280', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gem. totaal</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#111827' }}>{formatDays(filteredSummary.avgTotal)}</div>
          </div>
        </div>
      </div>

      {hasColumnFilters && (
        <div className="filter-bar" style={{ marginTop: '-0.5rem' }}>
          <button type="button" className="btn-secondary" onClick={clearColumnFilters}>
            Kolomfilters wissen
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="loading-text">Laden...</p>
      ) : !filteredRows || filteredRows.length === 0 ? (
        <div className="alert alert-info">Geen doorlooptijden gevonden voor de geselecteerde productielijn.</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Melding</th>
                    <th>Ontvangen</th>
                    <th>Taak</th>
                    <th>Afgerond</th>
                    <th>Product</th>
                    <th>Versie</th>
                    <th>Gepubliceerd</th>
                    <th>Melding → taak</th>
                    <th>Taak → publicatie</th>
                    <th>Totaal</th>
                  </tr>
                  <tr>
                    <th>
                      <input value={colFilterNotification} onChange={(e) => setColFilterNotification(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                    <th>
                      <input value={colFilterReceived} onChange={(e) => setColFilterReceived(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                    <th>
                      <input value={colFilterTask} onChange={(e) => setColFilterTask(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                    <th>
                      <input value={colFilterCompleted} onChange={(e) => setColFilterCompleted(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                    <th>
                      <input value={colFilterProduct} onChange={(e) => setColFilterProduct(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                    <th>
                      <input value={colFilterVersion} onChange={(e) => setColFilterVersion(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                    <th>
                      <input value={colFilterPublished} onChange={(e) => setColFilterPublished(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                    <th>
                      <input value={colFilterNoticeToTask} onChange={(e) => setColFilterNoticeToTask(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                    <th>
                      <input value={colFilterTaskToPublication} onChange={(e) => setColFilterTaskToPublication(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                    <th>
                      <input value={colFilterTotal} onChange={(e) => setColFilterTotal(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row: any) => (
                    <tr key={`${row.notification_id}-${row.task_id}-${row.product_id}-${row.product_version_id || 'no-version'}`}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <Link to={`/notifications/${row.notification_id}`} style={{ color: '#0066cc', textDecoration: 'underline', fontWeight: 600 }}>
                            {row.notification_code || `Melding ${row.notification_id}`}
                          </Link>
                          <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>{row.notification_title}</span>
                        </div>
                      </td>
                      <td>{formatDate(row.received_date, true)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <a href={`/tasks/${row.task_id}`} className="task-tag" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>
                            {row.task_number}
                          </a>
                          <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>{row.task_title}</span>
                        </div>
                      </td>
                      <td>{formatDate(row.completed_at, true)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span style={{ fontWeight: 600 }}>{row.product_code}</span>
                          <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>{row.product_name}</span>
                        </div>
                      </td>
                      <td>
                        {row.product_version_id ? (
                          <Link to={`/product-versions?versionId=${row.product_version_id}`} style={{ textDecoration: 'none' }}>
                            <span className={getVersionPillClassName(!!row.publication_date)}>
                              {row.version_number}
                            </span>
                          </Link>
                        ) : (
                          <span className={getVersionPillClassName(false)}>
                            Geen versie
                          </span>
                        )}
                      </td>
                      <td>{formatDate(row.publication_date)}</td>
                      <td>{formatDays(row.notice_to_task_days)}</td>
                      <td>{formatDays(row.task_to_publication_days)}</td>
                      <td>{formatDays(row.total_days)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}