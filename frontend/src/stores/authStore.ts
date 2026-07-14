import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  defaultProductionLineId: number;
  defaultProductionLineName: string | null;
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
  setUser: (user: User) => void;
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
        // The user's default production line is only usable if they actually
        // have a rights row for it. Onboarding scripts sometimes set
        // default_production_line_id without granting rights for that line,
        // which would silently select an inaccessible line (e.g. note
        // creation failing with "no edit rights" right after login).
        const rights = user.rights ?? [];
        const hasDefaultRight = rights.some((r) => Number(r.id) === Number(user.defaultProductionLineId));
        const fallbackLineId = rights.find((r) => r.can_edit)?.id ?? rights[0]?.id ?? null;

        set({
          token,
          user,
          currentProductionLineId: hasDefaultRight ? user.defaultProductionLineId : fallbackLineId,
        });
      },
      setUser: (user) => set({ user }),
      setCurrentProductionLine: (id) => set({ currentProductionLineId: id }),
      logout: () => {
        set({ token: null, user: null, currentProductionLineId: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
