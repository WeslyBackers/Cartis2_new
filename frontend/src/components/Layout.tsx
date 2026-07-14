import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useEffect, useState } from 'react';
import api from '../services/api';
import './Layout.css';

type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'cartis-theme-mode';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Layout() {
  const navigate = useNavigate();
  const { user, currentProductionLineId, setCurrentProductionLine, setUser, logout } = useAuthStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  // Refresh user data on mount so defaultProductionLineName (and rights) are always up to date
  useEffect(() => {
    api.get('/auth/me').then((res) => setUser(res.data)).catch(() => {/* ignore */});
  }, []);

  // Use the production lines the user has rights to (already available from login)
  const productionLines = user?.rights ?? [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <h1 className="logo">CARTIS 2.0</h1>
          
          <div className="production-line-selector">
            <label>Productielijn:</label>
            <select
              value={currentProductionLineId || ''}
              onChange={(e) => {
                const selectedValue = e.target.value;
                setCurrentProductionLine(selectedValue === '' ? null : Number(selectedValue));
              }}
              style={!currentProductionLineId ? {
                borderColor: 'var(--color-warning)',
                backgroundColor: 'var(--color-warning-light)',
              } : undefined}
            >
              <option value="">-- Selecteer --</option>
              {productionLines?.map((pl: any) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.code}){Number(pl.id) === Number(user?.defaultProductionLineId) ? ' — standaard' : ''}
                </option>
              ))}
            </select>
            {user?.defaultProductionLineId && currentProductionLineId !== user.defaultProductionLineId && productionLines.some((pl: any) => Number(pl.id) === Number(user.defaultProductionLineId)) && (
              <button
                type="button"
                className="production-line-default-btn"
                onClick={() => setCurrentProductionLine(user.defaultProductionLineId)}
                title="Terug naar standaard productielijn"
              >
                ↩ Standaard
              </button>
            )}
            {!currentProductionLineId && (
              <span className="production-line-warning">
                Selecteer een productielijn
              </span>
            )}
          </div>

          <div className="user-info">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
              aria-label={theme === 'dark' ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <span>{user?.firstName} {user?.lastName}</span>
            <button onClick={handleLogout}>Uitloggen</button>
          </div>
        </div>
      </header>

      <div className="main-container">
        <nav className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <button 
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Sidebar uitklappen" : "Sidebar inklappen"}
          >
            {isSidebarCollapsed ? '☰' : '✕'}
          </button>
          
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Dashboard">
            <span className="nav-icon">📊</span>
            {!isSidebarCollapsed && <span className="nav-text">Dashboard</span>}
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Meldingen">
            <span className="nav-icon">📋</span>
            {!isSidebarCollapsed && <span className="nav-text">Meldingen</span>}
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Taken">
            <span className="nav-icon">✅</span>
            {!isSidebarCollapsed && <span className="nav-text">Taken</span>}
          </NavLink>
          <NavLink to="/product-versions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Productversies">
            <span className="nav-icon">📑</span>
            {!isSidebarCollapsed && <span className="nav-text">Productversies</span>}
          </NavLink>
          <NavLink to="/published-product-versions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Gepubliceerde versies">
            <span className="nav-icon">📚</span>
            {!isSidebarCollapsed && <span className="nav-text">Gepubliceerde versies</span>}
          </NavLink>
          <div className="nav-divider" />
          <NavLink to="/products" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Producten">
            <span className="nav-icon">📦</span>
            {!isSidebarCollapsed && <span className="nav-text">Producten</span>}
          </NavLink>
          <NavLink to="/lead-times" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Doorlooptijden">
            <span className="nav-icon">⏱️</span>
            {!isSidebarCollapsed && <span className="nav-text">Doorlooptijden</span>}
          </NavLink>
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
