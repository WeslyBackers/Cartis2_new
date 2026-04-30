import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { useTableSort } from '../hooks/useTableSort';
import 'leaflet/dist/leaflet.css';

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

// Helper function to extract file category from product
// Groups products by their usage level (e.g., "ENC U3", "ENC U4", "IENC", "Pilot ENC U5")
const getProductFileCategory = (product: any): string => {
  if (!product.description) return product.type || 'Overige';
  
  // Extract usage from description (e.g., "Usage 5" -> "U5")
  const usageMatch = product.description.match(/Usage (\d+)/i);
  const usage = usageMatch ? `U${usageMatch[1]}` : '';
  
  // Determine base type
  if (product.type === 'pilot_enc') {
    return usage ? `Pilot ENC ${usage}` : 'Pilot ENC';
  } else if (product.type === 'ienc') {
    return 'IENC';
  } else if (product.type === 'enc') {
    return usage ? `ENC ${usage}` : 'ENC';
  } else if (product.type === 'chart') {
    return 'Zeekaarten';
  }
  
  return product.type || 'Overige';
};

// Color mapping for file categories
const getFileCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    'ENC U3': '#3388ff',
    'ENC U4': '#0066cc',
    'ENC U5': '#004499',
    'IENC': '#51cf66',
    'Pilot ENC U3': '#ff6b6b',
    'Pilot ENC U4': '#ff5252',
    'Pilot ENC U5': '#ff3838',
    'Pilot ENC U6': '#cc0000',
    'Zeekaarten': '#ffd43b',
  };
  return colorMap[category] || '#6c757d';
};

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

export default function Products() {
  const currentProductionLineId = useAuthStore((state) => state.currentProductionLineId);
  const user = useAuthStore((state) => state.user);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [selectedFileCategories, setSelectedFileCategories] = useState<Set<string>>(new Set());
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', type: '', description: '', isActive: true });
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [createForm, setCreateForm] = useState({ code: '', name: '', type: '', description: '' });
  const queryClient = useQueryClient();

  // Check if user can edit for the current production line
  const canEdit = user?.rights?.some(
    (r) => r.id === currentProductionLineId && r.can_edit
  ) ?? false;

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await api.put(`/products/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditingProduct(null);
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/products', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setCreatingProduct(false);
      setCreateForm({ code: '', name: '', type: '', description: '' });
    },
  });

  // Set document title
  useEffect(() => {
    const lineNames: Record<number, string> = { 1: 'Zeekaart', 2: 'Inland ENC', 3: 'Pilot ENC', 4: 'Publicaties' };
    const lineName = currentProductionLineId ? lineNames[currentProductionLineId] : null;
    document.title = lineName ? `Producten - ${lineName} - CARTIS` : 'Producten - CARTIS';
    return () => { document.title = 'CARTIS 2.0'; };
  }, [currentProductionLineId]);

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

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', currentProductionLineId],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: { productionLineId: currentProductionLineId },
      });
      return response.data;
    },
  });

  const visibleProducts = (products || []).filter((product: any) => !isIntegratedCorrectionListCode(product?.code));

  const { sortedData, handleSort, getSortIcon } = useTableSort(visibleProducts);

  // Filter products with valid geometry for map view
  const productsWithGeometry = visibleProducts.filter((p: any) => p.geometry);

  // Group products by file category
  const fileCategories: string[] = Array.from(
    new Set<string>(productsWithGeometry.map((p: any) => getProductFileCategory(p)))
  ).sort((a, b) => a.localeCompare(b));

  // Initialize selected categories when products load
  useEffect(() => {
    if (selectedFileCategories.size === 0 && fileCategories.length > 0) {
      setSelectedFileCategories(new Set(fileCategories));
    }
  }, [fileCategories.length]);

  // Filter products by selected categories
  const filteredProductsForMap = productsWithGeometry.filter((p: any) => 
    selectedFileCategories.has(getProductFileCategory(p))
  );

  // Toggle file category selection
  const toggleFileCategory = (category: string) => {
    const newSelected = new Set(selectedFileCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedFileCategories(newSelected);
  };

  // Toggle all categories
  const toggleAllCategories = () => {
    if (selectedFileCategories.size === fileCategories.length) {
      setSelectedFileCategories(new Set());
    } else {
      setSelectedFileCategories(new Set<string>(fileCategories));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Producten</h1>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--color-bg)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.375rem 0.875rem',
                background: viewMode === 'table' ? 'white' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: viewMode === 'table' ? '600' : 'normal',
                boxShadow: viewMode === 'table' ? 'var(--shadow-xs)' : 'none',
                fontSize: '0.8125rem',
                color: viewMode === 'table' ? 'var(--color-text)' : 'var(--color-text-secondary)',
              }}
            >
              Tabel
            </button>
            <button
              onClick={() => setViewMode('map')}
              style={{
                padding: '0.375rem 0.875rem',
                background: viewMode === 'map' ? 'white' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: viewMode === 'map' ? '600' : 'normal',
                boxShadow: viewMode === 'map' ? 'var(--shadow-xs)' : 'none',
                fontSize: '0.8125rem',
                color: viewMode === 'map' ? 'var(--color-text)' : 'var(--color-text-secondary)',
              }}
            >
              Kaart
            </button>
          </div>

          <button
            style={{ background: 'var(--color-success)', display: canEdit ? undefined : 'none' }}
            onClick={() => setCreatingProduct(true)}
          >
            + Nieuw Product
          </button>
        </div>
      </div>

      {!currentProductionLineId && (
        <div style={{ padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px', color: '#856404', marginBottom: '1rem' }}>
          ⚠️ Selecteer een productielijn om producten te bekijken
        </div>
      )}

      {isLoading ? (
        <p>Laden...</p>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div>
          <div style={{ marginBottom: '1rem', color: '#6c757d', fontSize: '0.9rem' }}>
            {sortedData?.length || 0} product(en) gevonden
          </div>
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('code')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Code{getSortIcon('code')}
                </th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Naam{getSortIcon('name')}
                </th>
                <th onClick={() => handleSort('description')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Beschrijving (OBJNAM){getSortIcon('description')}
                </th>
                <th onClick={() => handleSort('type')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Type{getSortIcon('type')}
                </th>
                <th onClick={() => handleSort('is_active')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Status{getSortIcon('is_active')}
                </th>
                <th>Geometrie</th>
                {canEdit && <th>Acties</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData?.map((product: any) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.code}</strong>
                  </td>
                  <td>{product.name}</td>
                  <td style={{ maxWidth: '300px' }}>{getProductObjnam(product)}</td>
                  <td>{product.type || '-'}</td>
                  <td>
                    <span
                      style={{
                        padding: '0.25em 0.5em',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        background: product.is_active ? '#d4edda' : '#f8d7da',
                      }}
                    >
                      {product.is_active ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td>
                    {product.geometry ? (
                      <span style={{ color: '#28a745', fontSize: '0.85rem' }}>✓ Ja</span>
                    ) : (
                      <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>— Nee</span>
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setEditForm({
                            name: product.name || '',
                            type: product.type || '',
                            description: product.description || '',
                            isActive: product.is_active,
                          });
                        }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem',
                          background: '#0d6efd',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Bewerken
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Map View */
        <div>
          {/* File Category Filters */}
          {fileCategories.length > 0 && (
            <div style={{ 
              marginBottom: '1rem', 
              padding: '1rem', 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              border: '1px solid #dee2e6' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#343a40' }}>
                  📁 Filter per bestand
                </h3>
                <button
                  onClick={toggleAllCategories}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.85rem',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {selectedFileCategories.size === fileCategories.length ? 'Deselecteer alles' : 'Selecteer alles'}
                </button>
              </div>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '0.75rem',
              }}>
                {fileCategories.map((category) => {
                  const count = productsWithGeometry.filter((p: any) => getProductFileCategory(p) === category).length;
                  return (
                    <label
                      key={category}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: selectedFileCategories.has(category) ? '#e7f3ff' : '#f8f9fa',
                        border: `2px solid ${selectedFileCategories.has(category) ? getFileCategoryColor(category) : '#dee2e6'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFileCategories.has(category)}
                        onChange={() => toggleFileCategory(category)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: getFileCategoryColor(category),
                        borderRadius: '3px',
                        opacity: 0.8,
                      }} />
                      <span style={{ fontWeight: '600' }}>{category}</span>
                      <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>({count})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                {filteredProductsForMap.length} product(en) weergegeven van {productsWithGeometry.length} met geometrie
              </div>
              {productsWithGeometry.length > 0 && (
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
              )}
              {productsWithGeometry.length === 0 && (
                <div style={{ color: '#dc3545', fontSize: '0.85rem' }}>
                  Geen producten met geometrie gevonden voor deze productielijn
                </div>
              )}
              {filteredProductsForMap.length === 0 && productsWithGeometry.length > 0 && (
                <div style={{ color: '#ff8c00', fontSize: '0.85rem' }}>
                  Selecteer minimaal één bestandscategorie om producten te tonen
                </div>
              )}
            </div>
            
            {productsWithGeometry.length > 0 && (
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
                <MapContainer
                  center={[51.5, 3.5]}
                  zoom={8}
                  style={{
                    height: isMapExpanded ? '100%' : '600px',
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #dee2e6'
                  }}
                >
                  <MapResizeHandler trigger={isMapExpanded} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {filteredProductsForMap.map((product: any) => {
                  try {
                    const geometry = typeof product.geometry === 'string' 
                      ? JSON.parse(product.geometry) 
                      : product.geometry;
                    
                    const fileCategory = getProductFileCategory(product);
                    const color = getFileCategoryColor(fileCategory);
                    
                    return (
                      <GeoJSON
                        key={product.id}
                        data={{
                          type: 'Feature',
                          geometry: geometry,
                          properties: {
                            code: product.code,
                            name: getProductObjnam(product),
                            type: product.type,
                            fileCategory: fileCategory,
                            isActive: product.is_active,
                          }
                        } as any}
                        style={{
                          color: color,
                          weight: 2,
                          fillColor: color,
                          fillOpacity: 0.3,
                        }}
                      >
                        <Popup>
                          <div style={{ minWidth: '200px' }}>
                            <strong style={{ fontSize: '1.1rem', color: '#343a40' }}>{product.code}</strong>
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #dee2e6' }}>
                              <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                <strong>Naam:</strong> {getProductObjnam(product)}
                              </div>
                              <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                <strong>Bestand:</strong>{' '}
                                <span style={{
                                  padding: '0.15em 0.4em',
                                  borderRadius: '3px',
                                  fontSize: '0.85rem',
                                  backgroundColor: color,
                                  color: 'white',
                                }}>
                                  {fileCategory}
                                </span>
                              </div>
                              {product.type && (
                                <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                  <strong>Type:</strong> {product.type}
                                </div>
                              )}
                              <div style={{ fontSize: '0.9rem' }}>
                                <strong>Status:</strong>{' '}
                                <span style={{
                                  padding: '0.15em 0.4em',
                                  borderRadius: '3px',
                                  fontSize: '0.85rem',
                                  background: product.is_active ? '#d4edda' : '#f8d7da',
                                  color: product.is_active ? '#155724' : '#721c24',
                                }}>
                                  {product.is_active ? 'Actief' : 'Inactief'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </GeoJSON>
                    );
                  } catch (error) {
                    console.error(`Error rendering product ${product.code}:`, error);
                    return null;
                  }
                  })}
                </MapContainer>
              </div>
            )}
          </div>

          {/* Legend - Grouped by File Category */}
          {filteredProductsForMap.length > 0 && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              border: '1px solid #dee2e6' 
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem', color: '#343a40' }}>
                Productenlegenda per bestand
              </h3>
              {fileCategories
                .filter(category => selectedFileCategories.has(category))
                .map(category => {
                  const categoryProducts = filteredProductsForMap.filter((p: any) => getProductFileCategory(p) === category);
                  if (categoryProducts.length === 0) return null;
                  
                  return (
                    <div key={category} style={{ marginBottom: '1rem' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                        paddingBottom: '0.5rem',
                        borderBottom: '2px solid ' + getFileCategoryColor(category),
                      }}>
                        <div style={{ 
                          width: '20px', 
                          height: '20px', 
                          backgroundColor: getFileCategoryColor(category),
                          borderRadius: '3px',
                          opacity: 0.8,
                        }} />
                        <strong style={{ fontSize: '0.95rem' }}>{category}</strong>
                        <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>({categoryProducts.length} producten)</span>
                      </div>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                        gap: '0.5rem',
                        marginLeft: '1.5rem',
                      }}>
                        {categoryProducts.map((product: any) => (
                          <div 
                            key={product.id}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.5rem',
                              fontSize: '0.85rem',
                            }}
                          >
                            <span style={{ fontWeight: '600', color: '#495057' }}>{product.code}</span>
                            <span style={{ color: '#6c757d' }}>— {getProductObjnam(product)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingProduct(null); }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '500px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            }}
          >
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>
              Product bewerken: {editingProduct.code}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Naam (Beschrijving)
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Type
                </label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">— Geen —</option>
                  <option value="enc">ENC</option>
                  <option value="ienc">IENC</option>
                  <option value="pilot_enc">Pilot ENC</option>
                  <option value="chart">Zeekaart</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Beschrijving (intern)
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Actief</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setEditingProduct(null)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Annuleren
              </button>
              <button
                onClick={() => {
                  updateProductMutation.mutate({
                    id: editingProduct.id,
                    data: {
                      name: editForm.name,
                      type: editForm.type || null,
                      description: editForm.description,
                      isActive: editForm.isActive,
                    },
                  });
                }}
                disabled={updateProductMutation.isPending}
                style={{
                  padding: '0.5rem 1rem',
                  background: updateProductMutation.isPending ? '#6c757d' : '#0d6efd',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: updateProductMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {updateProductMutation.isPending ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>

            {updateProductMutation.isError && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', fontSize: '0.85rem' }}>
                Fout bij opslaan: {(updateProductMutation.error as any)?.response?.data?.error || 'Onbekende fout'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {creatingProduct && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setCreatingProduct(false); }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '500px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            }}
          >
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>
              Nieuw product aanmaken
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Code *
                </label>
                <input
                  type="text"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  placeholder="bv. BE4ABCDE"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Naam (Beschrijving)
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Type
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">— Geen —</option>
                  <option value="enc">ENC</option>
                  <option value="ienc">IENC</option>
                  <option value="pilot_enc">Pilot ENC</option>
                  <option value="chart">Zeekaart</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Beschrijving (intern)
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setCreatingProduct(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Annuleren
              </button>
              <button
                onClick={() => {
                  createProductMutation.mutate({
                    productionLineId: currentProductionLineId,
                    code: createForm.code,
                    name: createForm.name,
                    type: createForm.type || null,
                    description: createForm.description || null,
                  });
                }}
                disabled={createProductMutation.isPending || !createForm.code.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: createProductMutation.isPending || !createForm.code.trim() ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: createProductMutation.isPending || !createForm.code.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {createProductMutation.isPending ? 'Aanmaken...' : 'Aanmaken'}
              </button>
            </div>

            {createProductMutation.isError && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', fontSize: '0.85rem' }}>
                Fout bij aanmaken: {(createProductMutation.error as any)?.response?.data?.error || 'Onbekende fout'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
