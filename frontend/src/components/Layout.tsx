import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../services/api';
import './Layout.css';

export default function Layout() {
  const navigate = useNavigate();
  const { user, currentProductionLineId, setCurrentProductionLine, logout } = useAuthStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { data: productionLines } = useQuery({
    queryKey: ['productionLines'],
    queryFn: async () => {
      const response = await api.get('/production-lines');
      return response.data;
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
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
                  {pl.name} ({pl.code})
                </option>
              ))}
            </select>
            {!currentProductionLineId && (
              <span className="production-line-warning">
                Selecteer een productielijn
              </span>
            )}
          </div>

          <div className="user-info">
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
