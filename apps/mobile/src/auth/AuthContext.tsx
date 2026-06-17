import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { apiRequest, ApiError, type ApiRequest } from "@/api/client";

export type AuthUser = {
  id: number;
  nome: string;
  email: string;
  role: string;
  consentRequired?: boolean;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  // Achado 74: papel/usuario EFETIVO devolvido pelo refresh para manter a role
  // persistida (usada no roteamento) atualizada sem novo login.
  user?: Pick<AuthUser, "id" | "nome" | "email" | "role"> | null;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // marca o consentimento como aceito localmente (após o POST /consentimento dar certo).
  markConsentAccepted: () => Promise<void>;
  // fetch autenticado com refresh automatico em 401 (uma tentativa).
  authFetch: <T>(path: string, options?: ApiRequest) => Promise<T>;
};

const ACCESS_KEY = "autismcad.accessToken";
const REFRESH_KEY = "autismcad.refreshToken";
const USER_KEY = "autismcad.user";

const AuthContext = createContext<AuthState | null>(null);

// Papel canonico (UPPER) a partir do role do usuario, para decidir o fluxo.
export function roleCanon(role: string | null | undefined): string {
  return String(role ?? "").trim().toUpperCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, r, u] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_KEY),
          SecureStore.getItemAsync(REFRESH_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (a && r && u) {
          setAccessToken(a);
          setRefreshToken(r);
          setUser(JSON.parse(u) as AuthUser);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }, nextUser?: AuthUser) => {
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
      if (nextUser) {
        setUser(nextUser);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        body: { email, password },
      });
      await persist(res, res.user);
    },
    [persist]
  );

  const markConsentAccepted = useCallback(async () => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, consentRequired: false };
      void SecureStore.setItemAsync(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Achado 112: serializa a renovacao. Chamadas concorrentes que recebem 401 aguardam
  // a MESMA promise de refresh, em vez de cada uma chamar /auth/refresh — evita
  // renovacoes simultaneas e logout indevido (relevante se houver rotacao de token).
  const refreshInFlight = useRef<Promise<RefreshResponse> | null>(null);

  const runRefresh = useCallback(
    (currentRefreshToken: string): Promise<RefreshResponse> => {
      if (!refreshInFlight.current) {
        refreshInFlight.current = (async () => {
          try {
            const refreshed = await apiRequest<RefreshResponse>("/api/v1/auth/refresh", {
              method: "POST",
              body: { refreshToken: currentRefreshToken },
            });
            await persist(refreshed);
            // Achado 74: atualiza a role persistida com o papel efetivo do refresh,
            // preservando o consentRequired gerido pelo fluxo de consentimento.
            if (refreshed.user) {
              const fresh = refreshed.user;
              setUser((prev) => {
                const next = prev
                  ? { ...prev, ...fresh }
                  : { ...fresh, consentRequired: false };
                void SecureStore.setItemAsync(USER_KEY, JSON.stringify(next));
                return next;
              });
            }
            return refreshed;
          } finally {
            refreshInFlight.current = null;
          }
        })();
      }
      return refreshInFlight.current;
    },
    [persist]
  );

  const authFetch = useCallback(
    async <T,>(path: string, options: ApiRequest = {}): Promise<T> => {
      try {
        return await apiRequest<T>(path, { ...options, token: accessToken });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && refreshToken) {
          let refreshed: RefreshResponse;
          try {
            refreshed = await runRefresh(refreshToken);
          } catch {
            await logout();
            throw error;
          }
          return await apiRequest<T>(path, { ...options, token: refreshed.accessToken });
        }
        throw error;
      }
    },
    [accessToken, refreshToken, runRefresh, logout]
  );

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, markConsentAccepted, authFetch }),
    [user, loading, login, logout, markConsentAccepted, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
