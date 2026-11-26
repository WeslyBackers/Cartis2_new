import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  defaultProductionLineId: number | null;
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

function getDefaultProductionLine(user: User) {
  const rights = user.rights ?? [];
  const accessibleLines = rights.filter(
    (right) => right.can_view || right.can_edit || right.can_publish
  );
  const configuredDefault = accessibleLines.find(
    (right) =>
      user.defaultProductionLineId != null &&
      Number(right.id) === Number(user.defaultProductionLineId)
  );
  const standardLine =
    configuredDefault ??
    accessibleLines.find((right) => right.can_edit) ??
    accessibleLines[0] ??
    null;

  return {
    defaultProductionLineId: standardLine?.id ?? null,
    defaultProductionLineName: standardLine?.name ?? null,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      currentProductionLineId: null,
      setAuth: (token, user) => {
        const resolvedUser = { ...user, ...getDefaultProductionLine(user) };

        set({
          token,
          user: resolvedUser,
          currentProductionLineId: resolvedUser.defaultProductionLineId,
        });
      },
      setUser: (user) =>
        set((state) => {
          const resolvedUser = { ...user, ...getDefaultProductionLine(user) };
          const selectedLine = user.rights?.find(
            (right) =>
              (right.can_view || right.can_edit || right.can_publish) &&
              state.currentProductionLineId != null &&
              Number(right.id) === Number(state.currentProductionLineId)
          );

          return {
            user: resolvedUser,
            currentProductionLineId:
              selectedLine?.id ?? resolvedUser.defaultProductionLineId,
          };
        }),
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
