import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/authStore';
import { openCorrectionListPrintPreview } from '../utils/printUtils';
import { ProductVersionMapOverview } from '../components/ProductVersionMapOverview';

const getTaskStatusLabel = (status: string) => {
  if (status === 'hoog_te_verwerken') return 'Hoog te verwerken';
  if (status === 'te_verwerken') return 'Te verwerken';
  if (status === 'in_inspectie') return 'In Inspectie';
  if (status === 'voltooid') return 'Voltooid';
  if (status === 'niet_van_toepassing') return 'Niet van toepassing';
  return status || '-';
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

// Used for generated publication HTML previews where CSS (tables/lists) must remain intact.
const sanitizePublicationHtmlForDisplay = (html: string): string => {
  if (!html) return '';

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '');
};

const normalizeValue = (value: string | null | undefined): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const isCorrectionListProduct = (productCode: string | null | undefined, productName: string | null | undefined): boolean => {
  const rawCode = String(productCode || '').trim();
  const normalizedCode = normalizeValue(productCode);
  const normalizedName = normalizeValue(productName);

  return rawCode.startsWith('VL-') || normalizedCode.includes('verbeterlijst') || normalizedName.includes('verbeterlijst');
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

const parseVersionDateValue = (value: any): Date | null => {
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

const normalizeVersionDateForFilter = (value: any): string => {
  const parsed = parseVersionDateValue(value);
  if (!parsed) return '';
  return format(parsed, 'dd-MM-yyyy');
};

export default function PublishedProductVersions() {
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [previewArticle, setPreviewArticle] = useState<any | null>(null);
  const [colFilterProduct, setColFilterProduct] = useState('');
  const [colFilterVersionNumber, setColFilterVersionNumber] = useState('');
  const [colFilterVersionDatePicker, setColFilterVersionDatePicker] = useState('');
  const [colFilterVersionDate, setColFilterVersionDate] = useState('');
  const [colFilterPublicationDatePicker, setColFilterPublicationDatePicker] = useState('');
  const [colFilterPublicationDate, setColFilterPublicationDate] = useState('');
  const [colFilterCreatedBy, setColFilterCreatedBy] = useState('');
  const [colFilterNotes, setColFilterNotes] = useState('');
  const [correctionListLanguage, setCorrectionListLanguage] = useState<'nl' | 'en'>('nl');
  const [baz2PublicationLanguage, setBaz2PublicationLanguage] = useState<'nl' | 'en'>('nl');
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isMapCollapsed, setIsMapCollapsed] = useState(true);
  const currentProductionLineId = useAuthStore((state) => state.currentProductionLineId);
  const user = useAuthStore((state) => state.user);
  const activeLineName = user?.rights?.find((r) => Number(r.id) === Number(currentProductionLineId))?.name;
  const defaultLineName = user?.defaultProductionLineName ?? null;
  const isDefaultLine = Number(currentProductionLineId) === Number(user?.defaultProductionLineId);

  useEffect(() => {
    const lineNames: Record<number, string> = { 1: 'Zeekaart', 2: 'Inland ENC', 3: 'Pilot ENC', 4: 'Publicaties' };
    const lineName = currentProductionLineId ? lineNames[currentProductionLineId] : null;
    document.title = lineName ? `Gepubliceerde Productversies - ${lineName} - CARTIS` : 'Gepubliceerde Productversies - CARTIS';
    return () => {
      document.title = 'CARTIS 2.0';
    };
  }, [currentProductionLineId]);

  useEffect(() => {
    setSelectedVersionId(null);
  }, [currentProductionLineId]);

  // Handle Escape key to close expanded map
  useEffect(() => {
    if (!isMapExpanded) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMapExpanded(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMapExpanded]);

  const { data: productionLines } = useQuery({
    queryKey: ['productionLinesForPublishedVersions'],
    queryFn: async () => {
      const response = await api.get('/production-lines');
      return response.data;
    },
  });

  const { data: versions, isLoading } = useQuery({
    queryKey: ['productVersionsPublished', currentProductionLineId],
    queryFn: async () => {
      const response = await api.get('/product-versions', {
        params: {
          productionLineId: currentProductionLineId || undefined,
          status: 'published',
        },
      });
      return response.data;
    },
    enabled: !!currentProductionLineId,
  });

  const { data: selectedVersion, isLoading: isLoadingSelectedVersion } = useQuery({
    queryKey: ['publishedProductVersionDetail', selectedVersionId],
    queryFn: async () => {
      const response = await api.get(`/product-versions/${selectedVersionId}`);
      return response.data;
    },
    enabled: !!selectedVersionId,
  });

  const currentLine = (productionLines || []).find((line: any) => Number(line.id) === Number(currentProductionLineId));
  const isPublLine = (currentLine?.code || '').toUpperCase() === 'PUBL';
  // Fall back to list data so buttons are visible immediately on click, before detail query resolves
  const selectedVersionListData = (versions || []).find((v: any) => Number(v.id) === selectedVersionId);
  const selectedVersionProductCode = (selectedVersion || selectedVersionListData)?.product_code;
  const selectedVersionProductName = (selectedVersion || selectedVersionListData)?.product_name;
  const isSelectedVersionCorrectionList = isPublLine && isCorrectionListProduct(
    selectedVersionProductCode,
    selectedVersionProductName
  );
  const isSelectedVersionBaz2 = String(selectedVersionProductCode || '').trim().toLowerCase() === 'baz-2';

  const { data: correctionListPreview, isLoading: isLoadingCorrectionListPreview } = useQuery({
    queryKey: ['publishedProductVersionCorrectionListPreview', selectedVersionId],
    queryFn: async () => {
      const response = await api.get(`/product-versions/${selectedVersionId}/corrections-list`);
      return response.data;
    },
    enabled: !!selectedVersionId && !!isSelectedVersionCorrectionList,
  });

  const { data: baz2PublicationPreview, isLoading: isLoadingBaz2PublicationPreview } = useQuery({
    queryKey: ['publishedProductVersionBaz2PublicationPreview', selectedVersionId],
    queryFn: async () => {
      const response = await api.get(`/product-versions/${selectedVersionId}/baz2-publication`);
      return response.data;
    },
    enabled: !!selectedVersionId && !!isSelectedVersionBaz2,
  });

  const filteredVersions = useMemo(() => {
    const includesText = (source: string, filter: string) =>
      source.toLowerCase().includes(filter.toLowerCase());

    return (versions || []).filter((version: any) => {
      if (isIntegratedCorrectionListCode(version.product_code)) return false;

      const productText = `${version.product_code || ''} ${version.product_name || ''}`.trim();
      if (colFilterProduct && !includesText(productText, colFilterProduct)) return false;

      if (colFilterVersionNumber && !includesText(version.version_number || '', colFilterVersionNumber)) return false;

      const versionDateText = normalizeVersionDateForFilter(version.version_date);
      if (colFilterVersionDate && versionDateText !== colFilterVersionDate) return false;

      const publicationDateText = normalizeVersionDateForFilter(version.publication_date);
      if (colFilterPublicationDate && publicationDateText !== colFilterPublicationDate) return false;

      if (colFilterCreatedBy && !includesText(version.created_by_name || '-', colFilterCreatedBy)) return false;
      if (colFilterNotes && !includesText(version.notes || '-', colFilterNotes)) return false;

      return true;
    });
  }, [
    versions,
    colFilterProduct,
    colFilterVersionNumber,
    colFilterVersionDate,
    colFilterPublicationDate,
    colFilterCreatedBy,
    colFilterNotes,
  ]);

  const clearColumnFilters = () => {
    setColFilterProduct('');
    setColFilterVersionNumber('');
    setColFilterVersionDatePicker('');
    setColFilterVersionDate('');
    setColFilterPublicationDatePicker('');
    setColFilterPublicationDate('');
    setColFilterCreatedBy('');
    setColFilterNotes('');
  };

  const hasColumnFilters =
    !!colFilterProduct ||
    !!colFilterVersionNumber ||
    !!colFilterVersionDate ||
    !!colFilterPublicationDate ||
    !!colFilterCreatedBy ||
    !!colFilterNotes;

  if (!currentProductionLineId) {
    return (
      <div>
        <h1 className="page-title">Gepubliceerde Productversies</h1>
        <div className="alert alert-warning">
          Geen productielijn geselecteerd. Selecteer eerst een productielijn om gepubliceerde versies te bekijken.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className={`page-title${!isDefaultLine && activeLineName ? ' page-title--non-default' : ''}`}>
        Gepubliceerde Productversies
        {activeLineName && (
          <span className="page-title__production-line">
            {' — '}{activeLineName}
            {isDefaultLine && <span className="page-title__default-badge"> (standaard)</span>}
          </span>
        )}
      </h1>

      {isLoading ? (
        <p className="loading-text">Laden...</p>
      ) : !versions || versions.length === 0 ? (
        <div className="alert alert-warning">Geen gepubliceerde productversies gevonden voor de geselecteerde productielijn.</div>
      ) : (
        <div
          style={{
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <h2 style={{ marginBottom: '0.75rem', color: '#343a40' }}>
            {currentLine ? `${currentLine.code} - ${currentLine.name}` : 'Geselecteerde productielijn'}
          </h2>

          {hasColumnFilters && (
            <div className="filter-bar" style={{ marginBottom: '1rem' }}>
              <button type="button" className="btn-secondary" onClick={clearColumnFilters}>
                Kolomfilters wissen
              </button>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Versienummer</th>
                <th>Versiedatum</th>
                <th>Publicatiedatum</th>
                <th>Aangemaakt door</th>
                <th>Opmerkingen</th>
              </tr>
              <tr>
                <th>
                  <input value={colFilterProduct} onChange={(e) => setColFilterProduct(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                </th>
                <th>
                  <input value={colFilterVersionNumber} onChange={(e) => setColFilterVersionNumber(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                </th>
                <th>
                  <input
                    type="date"
                    value={colFilterVersionDatePicker}
                    onChange={(e) => {
                      const pickerValue = e.target.value;
                      setColFilterVersionDatePicker(pickerValue);

                      if (!pickerValue) {
                        setColFilterVersionDate('');
                        return;
                      }

                      const [year, month, day] = pickerValue.split('-');
                      setColFilterVersionDate(`${day}-${month}-${year}`);
                    }}
                    style={{ width: '100%' }}
                  />
                </th>
                <th>
                  <input
                    type="date"
                    value={colFilterPublicationDatePicker}
                    onChange={(e) => {
                      const pickerValue = e.target.value;
                      setColFilterPublicationDatePicker(pickerValue);

                      if (!pickerValue) {
                        setColFilterPublicationDate('');
                        return;
                      }

                      const [year, month, day] = pickerValue.split('-');
                      setColFilterPublicationDate(`${day}-${month}-${year}`);
                    }}
                    style={{ width: '100%' }}
                  />
                </th>
                <th>
                  <input value={colFilterCreatedBy} onChange={(e) => setColFilterCreatedBy(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                </th>
                <th>
                  <input value={colFilterNotes} onChange={(e) => setColFilterNotes(e.target.value)} placeholder="Filter" style={{ width: '100%' }} />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredVersions.map((version: any) => (
                <tr
                  key={version.id}
                  onClick={() => setSelectedVersionId(Number(version.id))}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedVersionId === Number(version.id) ? '#e7f3ff' : undefined,
                  }}
                >
                  <td>
                    {version.product_code} - {version.product_name}
                  </td>
                  <td>
                    <strong>{version.version_number}</strong>
                  </td>
                  <td>{version.version_date ? format(parseVersionDateValue(version.version_date) || new Date(version.version_date), 'dd/MM/yyyy') : '-'}</td>
                  <td>{version.publication_date ? format(parseVersionDateValue(version.publication_date) || new Date(version.publication_date), 'dd/MM/yyyy') : '-'}</td>
                  <td>{version.created_by_name || '-'}</td>
                  <td>{version.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedVersionId && (
        <div
          style={{
            marginTop: '1.5rem',
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          {isSelectedVersionCorrectionList && (
            <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8fbff', borderRadius: '8px', border: '1px solid #d8e5f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#16324f' }}>{correctionListLanguage === 'en' ? 'List of Corrections preview' : 'Verbeterlijst preview'}</h2>
                  <div style={{ color: '#516173', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                    Gepubliceerde lijst met actieve BaZ-nrs. en artikeloverzicht.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    onClick={() => setCorrectionListLanguage('nl')}
                    style={{ opacity: correctionListLanguage === 'nl' ? 1 : 0.7 }}
                  >
                    Nederlands
                  </button>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    onClick={() => setCorrectionListLanguage('en')}
                    style={{ opacity: correctionListLanguage === 'en' ? 1 : 0.7 }}
                  >
                    English
                  </button>
                </div>
              </div>

              {isLoadingCorrectionListPreview ? (
                <p className="loading-text">{correctionListLanguage === 'en' ? 'Loading List of Corrections...' : 'Verbeterlijst laden...'}</p>
              ) : correctionListPreview ? (
                <>
                  <div style={{ marginBottom: '0.75rem', color: '#516173', fontSize: '0.9rem' }}>
                    Actieve BaZ-nrs.: <strong>{(correctionListPreview.activeBazNumbers || []).join(', ') || '-'}</strong>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      className="action-btn action-btn--primary"
                      onClick={() =>
                        openCorrectionListPrintPreview({
                          title: String(correctionListPreview.productName || selectedVersion?.product_name || (correctionListLanguage === 'en' ? 'List of Corrections' : 'Verbeterlijst')),
                          html: String(correctionListPreview[correctionListLanguage]?.html || ''),
                          language: correctionListLanguage,
                        })
                      }
                      disabled={!correctionListPreview[correctionListLanguage]?.html}
                    >
                      Print A4 (PDF)
                    </button>
                  </div>
                  <div
                    style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #d8e5f2', maxHeight: '420px', overflow: 'auto' }}
                    dangerouslySetInnerHTML={{ __html: sanitizePublicationHtmlForDisplay(correctionListPreview[correctionListLanguage]?.html || '') }}
                  />
                </>
              ) : (
                <p style={{ margin: 0, color: '#6c757d' }}>{correctionListLanguage === 'en' ? 'No List of Corrections preview available.' : 'Geen verbeterlijstpreview beschikbaar.'}</p>
              )}
            </div>
          )}

          {isSelectedVersionBaz2 && (
            <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8fbff', borderRadius: '8px', border: '1px solid #d8e5f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#16324f' }}>{baz2PublicationLanguage === 'en' ? 'BaZ-2 publication preview' : 'BaZ-2 publicatie preview'}</h2>
                  <div style={{ color: '#516173', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                    Lijst van MSI-actieve items en volledige BaZ-artikelen voor deze versie.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    onClick={() => setBaz2PublicationLanguage('nl')}
                    style={{ opacity: baz2PublicationLanguage === 'nl' ? 1 : 0.7 }}
                  >
                    Nederlands
                  </button>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    onClick={() => setBaz2PublicationLanguage('en')}
                    style={{ opacity: baz2PublicationLanguage === 'en' ? 1 : 0.7 }}
                  >
                    English
                  </button>
                </div>
              </div>

              {isLoadingBaz2PublicationPreview ? (
                <p className="loading-text">{baz2PublicationLanguage === 'en' ? 'Loading BaZ-2 publication...' : 'BaZ-2 publicatie laden...'}</p>
              ) : baz2PublicationPreview ? (
                <>
                  <div style={{ marginBottom: '0.75rem', color: '#516173', fontSize: '0.9rem' }}>
                    MSI actief: <strong>{(baz2PublicationPreview.msiTasks || []).length}</strong> taak/taken
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      className="action-btn action-btn--primary"
                      onClick={() =>
                        openCorrectionListPrintPreview({
                          title: String(baz2PublicationPreview.productName || selectedVersion?.product_name || (baz2PublicationLanguage === 'en' ? 'BaZ-2 publication' : 'BaZ-2 publicatie')),
                          html: String(baz2PublicationPreview[baz2PublicationLanguage]?.html || ''),
                          language: baz2PublicationLanguage,
                        })
                      }
                      disabled={!baz2PublicationPreview[baz2PublicationLanguage]?.html}
                    >
                      Print A4 (PDF)
                    </button>
                  </div>
                  <div
                    style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #d8e5f2', maxHeight: '420px', overflow: 'auto' }}
                    dangerouslySetInnerHTML={{ __html: sanitizePublicationHtmlForDisplay(baz2PublicationPreview[baz2PublicationLanguage]?.html || '') }}
                  />
                </>
              ) : (
                <p style={{ margin: 0, color: '#6c757d' }}>{baz2PublicationLanguage === 'en' ? 'No BaZ-2 publication preview available.' : 'Geen BaZ-2 publicatiepreview beschikbaar.'}</p>
              )}
            </div>
          )}

          <h2 style={{ marginBottom: '0.75rem', color: '#343a40' }}>Gekoppelde taken</h2>

          {isLoadingSelectedVersion ? (
            <p className="loading-text">Laden...</p>
          ) : !selectedVersion?.tasks || selectedVersion.tasks.length === 0 ? (
            <p style={{ margin: 0, color: '#6c757d' }}>Geen taken gekoppeld aan deze gepubliceerde productversie.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Taaknummer</th>
                  <th>Titel</th>
                  <th>{isPublLine ? 'BaZ artikel' : 'BaZ Nr.'}</th>
                  <th>Status</th>
                  <th>Uitvoering in product</th>
                  <th>Opmerkingen</th>
                </tr>
              </thead>
              <tbody>
                {selectedVersion.tasks.map((task: any) => (
                  <tr key={task.id}>
                    <td>
                      <Link
                        to={`/tasks?search=${task.task_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="task-tag"
                      >
                        {task.task_number}
                      </Link>
                    </td>
                    <td>{task.title}</td>
                    <td>
                      {Array.isArray(task.articles) && task.articles.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {task.articles.map((article: any) => (
                            <button
                              key={article.id}
                              type="button"
                              onClick={() => setPreviewArticle(article)}
                              className="action-btn action-btn--secondary"
                              style={{ padding: '0.12rem 0.45rem', fontSize: '0.8rem' }}
                              title="Toon artikel preview"
                            >
                              {article.baz_number}
                            </button>
                          ))}
                        </div>
                      ) : (
                        isPublLine ? (task.baz_articles || task.baz_number || '-') : (task.baz_number || '-')
                      )}
                    </td>
                    <td>{getTaskStatusLabel(task.status)}</td>
                    <td>
                      {task.execution_status === 'executed'
                        ? 'uitgevoerd'
                        : task.execution_status === 'not_applicable'
                        ? 'niet nodig'
                        : 'niet uitgevoerd'}
                    </td>
                    <td>{task.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!!selectedVersion && (selectedVersion.product_geometry || (selectedVersion.tasks?.length > 0 && selectedVersion.tasks.some((t: any) => t.notice_geometries?.length > 0))) && (
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="action-btn action-btn--secondary"
                onClick={() => setIsMapCollapsed((prev) => !prev)}
                style={{ marginBottom: '0.75rem' }}
              >
                {isMapCollapsed ? 'Toon geografische overzichtskaart' : 'Verberg geografische overzichtskaart'}
              </button>

              {!isMapCollapsed && (
                <div>
                  <button
                    type="button"
                    className={isMapExpanded ? 'btn-secondary' : 'btn-primary'}
                    onClick={() => setIsMapExpanded(!isMapExpanded)}
                    style={{ marginBottom: '0.5rem' }}
                  >
                    {isMapExpanded ? 'Verklein kaart (Esc)' : 'Vergroot kaart'}
                  </button>
                  {isMapExpanded && (
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      zIndex: 1000,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        position: 'relative',
                        width: '95%',
                        height: '95%',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}>
                        <div style={{
                          flex: 1,
                          overflow: 'hidden',
                        }}>
                          <ProductVersionMapOverview
                            selectedVersion={selectedVersion}
                            productName={selectedVersion.product_name}
                            productCode={selectedVersion.product_code}
                            isExpanded={true}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMapExpanded(false)}
                          style={{
                            padding: '0.5rem 1rem',
                            margin: '0.75rem',
                            alignSelf: 'flex-end',
                          }}
                        >
                          Sluiten (Esc)
                        </button>
                      </div>
                    </div>
                  )}
                  {!isMapExpanded && (
                    <ProductVersionMapOverview
                      selectedVersion={selectedVersion}
                      productName={selectedVersion.product_name}
                      productCode={selectedVersion.product_code}
                      isExpanded={false}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
