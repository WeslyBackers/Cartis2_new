import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Notifications from './pages/Notifications';
import NotificationDetail from './pages/NotificationDetail';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import Products from './pages/Products';
import ProductVersions from './pages/ProductVersions';
import PublishedProductVersions from './pages/PublishedProductVersions';
import LeadTimes from './pages/LeadTimes';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="notifications/:id" element={<NotificationDetail />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="lead-times" element={<LeadTimes />} />
          <Route path="products" element={<Products />} />
          <Route path="product-versions" element={<ProductVersions />} />
          <Route path="published-product-versions" element={<PublishedProductVersions />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
