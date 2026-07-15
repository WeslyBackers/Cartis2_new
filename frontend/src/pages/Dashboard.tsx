import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import { format } from 'date-fns';
import { getApiErrorMessage } from '../utils/errorUtils';

type NotePriority = 'laag' | 'gemiddeld' | 'hoog';
type NoteSortMode = 'newest' | 'oldest' | 'priority_desc' | 'priority_asc';

const PRIORITY_META: Record<NotePriority, { label: string; bg: string; color: string; border: string }> = {
  laag: {
    label: 'Laag',
    bg: '#e8f5e9',
    color: '#2e7d32',
    border: '#a5d6a7',
  },
  gemiddeld: {
    label: 'Gemiddeld',
    bg: '#fff8e1',
    color: '#8a6d00',
    border: '#ffe082',
  },
  hoog: {
    label: 'Hoog',
    bg: '#ffebee',
    color: '#c62828',
    border: '#ef9a9a',
  },
};

const getNotePriority = (priority: unknown): NotePriority => {
  const value = String(priority || '').toLowerCase();
  if (value === 'laag' || value === 'gemiddeld' || value === 'hoog') {
    return value;
  }
  return 'gemiddeld';
};

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentProductionLineId = useAuthStore((state) => state.currentProductionLineId);
  const user = useAuthStore((state) => state.user);
  const isDefaultLine = currentProductionLineId ? Number(currentProductionLineId) === Number(user?.defaultProductionLineId) : true;
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [notePriority, setNotePriority] = useState<NotePriority>('gemiddeld');
  const [noteSortMode, setNoteSortMode] = useState<NoteSortMode>('priority_desc');

  // Set document title
  useEffect(() => {
    const lineNames: Record<number, string> = { 1: 'Zeekaart', 2: 'Inland ENC', 3: 'Pilot ENC', 4: 'Publicaties' };
    const lineName = currentProductionLineId ? lineNames[currentProductionLineId] : null;
    document.title = lineName ? `Dashboard - ${lineName} - CARTIS` : 'Dashboard - CARTIS';
    return () => { document.title = 'CARTIS 2.0'; };
  }, [currentProductionLineId]);

  const { data: stats } = useQuery({
    queryKey: ['dashboardStats', currentProductionLineId],
    queryFn: async () => {
      const [notifications, tasks] = await Promise.all([
        api.get('/notifications', {
          params: { productionLineId: currentProductionLineId, undecidedOnly: true, limit: 10 },
        }),
        api.get('/tasks', {
          params: { productionLineId: currentProductionLineId, limit: 10 },
        }),
      ]);
      return {
        pendingNotifications: notifications.data.pagination.totalCount,
        activeTasks: tasks.data.pagination.totalCount,
      };
    },
    enabled: !!currentProductionLineId,
  });

  const editableProductionLineIds = useMemo(() => {
    return new Set(
      (user?.rights || [])
        .filter((right) => right.can_edit)
        .map((right) => Number(right.id))
    );
  }, [user]);

  const { data: allProductionLines = [] } = useQuery({
    queryKey: ['allProductionLines'],
    queryFn: async () => {
      const response = await api.get('/production-lines');
      return response.data as { id: number; code: string; name: string }[];
    },
    enabled: !!user,
  });

  const { data: notes, isLoading: isLoadingNotes } = useQuery({
    queryKey: ['dashboardNotes', currentProductionLineId],
    queryFn: async () => {
      const response = await api.get('/notes', {
        params: {
          productionLineId: currentProductionLineId || undefined,
        },
      });
      return response.data;
    },
    enabled: !!user,
  });

  const sortedNotes = useMemo(() => {
    if (!Array.isArray(notes)) return [];

    const priorityRank: Record<NotePriority, number> = {
      hoog: 3,
      gemiddeld: 2,
      laag: 1,
    };

    const byCreatedAtAsc = (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

    return [...notes].sort((a: any, b: any) => {
      const aPriority = getNotePriority(a.priority);
      const bPriority = getNotePriority(b.priority);
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();

      if (noteSortMode === 'newest') {
        return bDate - aDate;
      }

      if (noteSortMode === 'oldest') {
        return aDate - bDate;
      }

      if (noteSortMode === 'priority_desc') {
        const rankDiff = priorityRank[bPriority] - priorityRank[aPriority];
        return rankDiff !== 0 ? rankDiff : bDate - aDate;
      }

      const rankDiff = priorityRank[aPriority] - priorityRank[bPriority];
      return rankDiff !== 0 ? rankDiff : byCreatedAtAsc(a, b);
    });
  }, [notes, noteSortMode]);

  const createNoteMutation = useMutation({
    mutationFn: async (lineIds: number[]) => {
      const response = await api.post('/notes', {
        content: noteContent,
        productionLineIds: lineIds,
        priority: notePriority,
      });
      return response.data;
    },
    onSuccess: () => {
      setIsCreateNoteOpen(false);
      setNoteContent('');
      setNotePriority('gemiddeld');
      setSelectedLineIds([]);
      queryClient.invalidateQueries({ queryKey: ['dashboardNotes'] });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, lineIds }: { noteId: number; lineIds: number[] }) => {
      const response = await api.put(`/notes/${noteId}`, {
        content: noteContent,
        productionLineIds: lineIds,
        priority: notePriority,
      });
      return response.data;
    },
    onSuccess: () => {
      setIsCreateNoteOpen(false);
      setEditingNoteId(null);
      setNoteContent('');
      setNotePriority('gemiddeld');
      setSelectedLineIds([]);
      queryClient.invalidateQueries({ queryKey: ['dashboardNotes'] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const response = await api.delete(`/notes/${noteId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardNotes'] });
    },
  });

  const setNoteVisibilityMutation = useMutation({
    mutationFn: async ({ noteId, productionLineId, visible }: { noteId: number; productionLineId: number; visible: boolean }) => {
      const response = await api.put(`/notes/${noteId}/line-visibility`, {
        productionLineId,
        visible,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardNotes'] });
    },
  });

  const openCreateNote = () => {
    // Default to the current production line; fall back to all lines when
    // no production line is active (e.g. right after first login).
    const defaultSelection = currentProductionLineId
      ? [Number(currentProductionLineId)]
      : allProductionLines.map((l) => Number(l.id));

    setSelectedLineIds(defaultSelection);
    setEditingNoteId(null);
    setNoteContent('');
    setNotePriority('gemiddeld');
    setIsCreateNoteOpen(true);
  };

  const openEditNote = (note: any) => {
    setEditingNoteId(Number(note.id));
    setNoteContent(note.content || '');
    setNotePriority(getNotePriority(note.priority));
    setSelectedLineIds((note.production_lines || []).map((pl: any) => Number(pl.id)));
    setIsCreateNoteOpen(true);
  };

  const toggleLineSelection = (lineId: number) => {
    setSelectedLineIds((prev) => {
      if (prev.includes(lineId)) {
        return prev.filter((id) => id !== lineId);
      }
      return [...prev, lineId];
    });
  };

  const handleCreateNote = async () => {
    const trimmedContent = noteContent.replace(/<[^>]*>/g, '').trim();

    if (!trimmedContent) {
      alert('Voer inhoud in voor de nota.');
      return;
    }

    // If no production line is checked in the form, fall back to the user's
    // standard/default production line instead of blocking the save.
    const effectiveLineIds = selectedLineIds.length > 0
      ? selectedLineIds
      : (currentProductionLineId
          ? [Number(currentProductionLineId)]
          : allProductionLines.map((l) => Number(l.id)));

    if (effectiveLineIds.length === 0) {
      alert('Selecteer minstens een productielijn die de nota mag lezen.');
      return;
    }

    setSelectedLineIds(effectiveLineIds);

    try {
      if (editingNoteId) {
        await updateNoteMutation.mutateAsync({ noteId: editingNoteId, lineIds: effectiveLineIds });
      } else {
        await createNoteMutation.mutateAsync(effectiveLineIds);
      }
    } catch (error: any) {
      alert(`Fout bij opslaan van nota: ${getApiErrorMessage(error, 'onbekende fout')}`);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    const shouldDelete = window.confirm('Ben je zeker dat je deze nota wil verwijderen?');
    if (!shouldDelete) return;

    try {
      await deleteNoteMutation.mutateAsync(noteId);
    } catch (error: any) {
      alert(`Fout bij verwijderen van nota: ${getApiErrorMessage(error, 'onbekende fout')}`);
    }
  };

  const handleNoteVisibilityForCurrentLine = async (noteId: number, visible: boolean) => {
    if (!currentProductionLineId) {
      alert('Selecteer eerst een productielijn.');
      return;
    }

    if (!visible) {
      const shouldRemove = window.confirm('Deze nota verwijderen voor de huidige productielijn?');
      if (!shouldRemove) return;
    }

    try {
      await setNoteVisibilityMutation.mutateAsync({
        noteId,
        productionLineId: currentProductionLineId,
        visible,
      });
    } catch (error: any) {
      alert(`Fout bij aanpassen van zichtbaarheid: ${getApiErrorMessage(error, 'onbekende fout')}`);
    }
  };

  const canEditNote = (note: any) => {
    const noteLineIds = (note.production_lines || []).map((pl: any) => Number(pl.id));
    return noteLineIds.some((lineId: number) => editableProductionLineIds.has(lineId));
  };

  return (
    <div>
      <h1 className={`page-title${!!currentProductionLineId ? (isDefaultLine ? ' page-title--default' : ' page-title--non-default') : ''}`}>
        Dashboard
        {currentProductionLineId && (() => {
          const activeLine = user?.rights?.find((r) => Number(r.id) === Number(currentProductionLineId));
          const isDefault = Number(currentProductionLineId) === Number(user?.defaultProductionLineId);
          return activeLine ? (
            <span className="page-title__production-line">
              {' — '}{activeLine.name}
              {isDefault && <span className="page-title__default-badge"> (standaard)</span>}
            </span>
          ) : null;
        })()}
      </h1>

      {!currentProductionLineId && (
        <div className="dashboard-no-line-alert">
          Geen productielijn geselecteerd. Selecteer eerst een productielijn om meldingen en taken te bekijken.
        </div>
      )}
      
      <div className="dashboard-stats">
        <div className="stat-card stat-card--primary" onClick={() => navigate('/notifications')}>
          <div className="stat-card__label">Openstaande Meldingen</div>
          <div className="stat-card__value">{currentProductionLineId ? (stats?.pendingNotifications || 0) : '–'}</div>
        </div>

        <div className="stat-card stat-card--accent" onClick={() => navigate('/tasks')}>
          <div className="stat-card__label">Actieve Taken</div>
          <div className="stat-card__value">{currentProductionLineId ? (stats?.activeTasks || 0) : '–'}</div>
        </div>
      </div>

      <div className="dashboard-welcome">
        <h2>Welkom bij CARTIS 2.0</h2>
        <p>
          CARTIS 2.0 is de moderne applicatie voor de administratieve opvolging van nautische 
          meldingen en producten. Gebruik de navigatie links om te starten met het beheren van 
          meldingen, taken, producten en productversies.
        </p>

        <div className="quick-links card">
          <div className="card-body">
            <h3 className="quick-links__title">Snelle Links</h3>
            <div className="quick-links__list">
              <a href="/notifications" className="quick-links__item">
                <span className="quick-links__icon">📋</span>
                <span>Bekijk openstaande meldingen</span>
              </a>
              <a href="/tasks" className="quick-links__item">
                <span className="quick-links__icon">✅</span>
                <span>Beheer taken</span>
              </a>
              <a href="/products" className="quick-links__item">
                <span className="quick-links__icon">📦</span>
                <span>Producten overzicht</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, color: '#343a40' }}>Notities</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label htmlFor="note-sort" style={{ fontSize: '0.85rem', color: '#495057', fontWeight: 600 }}>
              Sortering
            </label>
            <select
              id="note-sort"
              value={noteSortMode}
              onChange={(e) => setNoteSortMode(e.target.value as NoteSortMode)}
              style={{
                padding: '0.4rem 0.55rem',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#343a40',
                minWidth: '200px',
              }}
            >
              <option value="priority_desc">Prioriteit: Hoog naar laag</option>
              <option value="priority_asc">Prioriteit: Laag naar hoog</option>
              <option value="newest">Datum: Nieuwste eerst</option>
              <option value="oldest">Datum: Oudste eerst</option>
            </select>
            <button className="btn-primary" onClick={openCreateNote}>Nieuwe nota</button>
          </div>
        </div>

        {isLoadingNotes ? (
          <p className="loading-text" style={{ padding: 0 }}>Laden...</p>
        ) : !notes || notes.length === 0 ? (
          <p style={{ margin: 0, color: '#6c757d' }}>Nog geen notities zichtbaar voor jouw productielijnen.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedNotes.map((note: any) => (
              <div key={note.id} style={{ border: '1px solid #e9ecef', borderRadius: '8px', padding: '0.75rem' }}>
                {(() => {
                  const priority = getNotePriority(note.priority);
                  const meta = PRIORITY_META[priority];
                  return (
                    <div style={{ marginBottom: '0.45rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          borderRadius: '999px',
                          border: `1px solid ${meta.border}`,
                          backgroundColor: meta.bg,
                          color: meta.color,
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          padding: '0.2rem 0.55rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                        }}
                        title={`Prioriteit: ${meta.label}`}
                      >
                        Prioriteit: {meta.label}
                      </span>
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ color: '#495057', fontSize: '0.85rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <span>
                      Door <strong>{note.created_by_name || 'Onbekend'}</strong> op {format(new Date(note.created_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                    {(note.production_lines || []).map((pl: any) => (
                      <span key={`${note.id}-pl-${pl.id}`} className="task-tag">
                        {pl.code}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {currentProductionLineId && (
                      <button
                        type="button"
                        className="action-btn action-btn--ghost-danger"
                        onClick={() => handleNoteVisibilityForCurrentLine(Number(note.id), false)}
                        disabled={setNoteVisibilityMutation.isPending}
                        title="Verwijder deze nota voor de huidige productielijn"
                      >
                        Verwijderen voor lijn
                      </button>
                    )}
                    {canEditNote(note) && (
                      <>
                        <button
                          type="button"
                          className="action-btn action-btn--ghost"
                          onClick={() => openEditNote(note)}
                          title="Bewerk deze nota"
                        >
                          Bewerken
                        </button>
                      </>
                    )}
                    {Number(note.created_by) === Number(user?.id) && (
                      <>
                        <button
                          type="button"
                          className="action-btn action-btn--ghost-danger"
                          onClick={() => handleDeleteNote(Number(note.id))}
                          disabled={deleteNoteMutation.isPending}
                          title="Verwijder deze nota"
                        >
                          Verwijderen
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div dangerouslySetInnerHTML={{ __html: note.content }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {isCreateNoteOpen && (
        <div
          onClick={() => {
            setIsCreateNoteOpen(false);
            setEditingNoteId(null);
            setNotePriority('gemiddeld');
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(900px, 96vw)',
              maxHeight: '92vh',
              overflow: 'auto',
              backgroundColor: 'white',
              borderRadius: '10px',
              boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#343a40' }}>{editingNoteId ? 'Nota bewerken' : 'Nieuwe nota'}</h3>
              <button
                className="btn-secondary"
                onClick={() => {
                  setIsCreateNoteOpen(false);
                  setEditingNoteId(null);
                  setNotePriority('gemiddeld');
                }}
              >
                Sluiten
              </button>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.45rem' }}>Prioriteit</div>
              <select
                value={notePriority}
                onChange={(e) => setNotePriority(getNotePriority(e.target.value))}
                style={{
                  width: '220px',
                  maxWidth: '100%',
                  padding: '0.5rem 0.6rem',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#343a40',
                }}
              >
                <option value="laag">Laag</option>
                <option value="gemiddeld">Gemiddeld</option>
                <option value="hoog">Hoog</option>
              </select>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.45rem' }}>Leesbaar voor productielijnen</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {allProductionLines.map((line) => (
                  <label
                    key={`line-${line.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.55rem', border: '1px solid #dee2e6', borderRadius: '999px', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLineIds.includes(Number(line.id))}
                      onChange={() => toggleLineSelection(Number(line.id))}
                    />
                    <span>{line.code} - {line.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '0.9rem' }}>
              <SunEditor
                setContents={noteContent}
                onChange={(content) => setNoteContent(content)}
                height="230px"
                setOptions={{
                  buttonList: [
                    ['undo', 'redo'],
                    ['bold', 'underline', 'italic'],
                    ['list', 'align'],
                    ['link', 'table'],
                    ['removeFormat'],
                  ],
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setIsCreateNoteOpen(false);
                  setEditingNoteId(null);
                  setNotePriority('gemiddeld');
                }}
              >
                Annuleren
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateNote}
                disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
              >
                {createNoteMutation.isPending || updateNoteMutation.isPending ? 'Opslaan...' : editingNoteId ? 'Wijzigingen opslaan' : 'Nota opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dashboard-no-line-alert {
          background-color: #fff3cd;
          color: #856404;
          border: 1px solid #ffc107;
          border-radius: var(--radius-md);
          padding: 0.75rem 1rem;
          margin-bottom: 1.5rem;
          font-size: 0.9375rem;
          font-weight: 500;
        }
        .dashboard-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-bottom: 2.5rem;
        }
        .stat-card {
          padding: 1.5rem;
          border-radius: var(--radius-xl);
          cursor: pointer;
          transition: transform 200ms ease, box-shadow 200ms ease;
          color: white;
          position: relative;
          overflow: hidden;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
        .stat-card--primary {
          background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
        }
        .stat-card--accent {
          background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
        }
        .stat-card__label {
          font-size: 0.8125rem;
          font-weight: 500;
          opacity: 0.9;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat-card__value {
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .dashboard-welcome {
          max-width: 640px;
        }
        .dashboard-welcome h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-dark);
          margin-bottom: 0.5rem;
        }
        .dashboard-welcome p {
          line-height: 1.7;
          color: var(--color-text-secondary);
          margin-bottom: 1.5rem;
          font-size: 0.9375rem;
        }
        .quick-links__title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-dark);
          margin-bottom: 0.75rem;
        }
        .quick-links__list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .quick-links__item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5rem 0.625rem;
          border-radius: var(--radius-md);
          color: var(--color-text);
          font-size: 0.875rem;
          font-weight: 500;
          transition: background-color var(--transition-fast);
        }
        .quick-links__item:hover {
          background-color: var(--color-bg);
          color: var(--color-primary);
        }
        .quick-links__icon {
          font-size: 1rem;
        }
      `}</style>
    </div>
  );
}
