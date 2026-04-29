import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  defaultProductionLineId: number;
  rights: Array<{
    id: number;
    code: string;
    name: string;
    can_view: boolean;
    can_edit: boolean;
    can_publish: boolean;
  }>;
}

interface AuthState {
  token: string | null;
  user: User | null;
  currentProductionLineId: number | null;
  setAuth: (token: string, user: User) => void;
  setCurrentProductionLine: (id: number | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      currentProductionLineId: null,
      setAuth: (token, user) => {
        localStorage.setItem('authToken', token);
        set({
          token,
          user,
          currentProductionLineId: null,
        });
      },
      setCurrentProductionLine: (id) => set({ currentProductionLineId: id }),
      logout: () => {
        localStorage.removeItem('authToken');
        set({ token: null, user: null, currentProductionLineId: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
