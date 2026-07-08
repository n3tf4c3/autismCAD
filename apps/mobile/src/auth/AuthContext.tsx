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
    // Achado 80: revoga o refresh token no servidor (best-effort — offline/erro nao
    // bloqueia o logout local; o token expira ou e revogado num proximo uso).
    const currentRefresh = refreshToken;
    if (currentRefresh) {
      void apiRequest("/api/v1/auth/logout", {
        method: "POST",
        body: { refreshToken: currentRefresh },
      }).catch(() => {});
    }
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  }, [refreshToken]);

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

  // Achado 122: o servidor passou a exigir reconsentimento (403 CONSENT_REQUIRED) — reativa
  // o gate localmente para o AuthGuard redirecionar à tela de consentimento.
  const markConsentRequired = useCallback(async () => {
    setUser((prev) => {
      if (!prev || prev.consentRequired) return prev;
      const next = { ...prev, consentRequired: true };
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
        try {
          return await apiRequest<T>(path, { ...options, token: accessToken });
        } catch (error) {
          if (error instanceof ApiError && error.status === 401 && refreshToken) {
            let refreshed: RefreshResponse;
            try {
              refreshed = await runRefresh(refreshToken);
            } catch (refreshError) {
              // Achado 123: desloga apenas quando o refresh foi de fato rejeitado por auth
              // (401/403). Timeout/offline/5xx sao transitorios: preserva a sessao para retry.
              if (
                refreshError instanceof ApiError &&
                (refreshError.status === 401 || refreshError.status === 403)
              ) {
                await logout();
                throw error;
              }
              throw refreshError;
            }
            return await apiRequest<T>(path, { ...options, token: refreshed.accessToken });
          }
          throw error;
        }
      } catch (error) {
        // Achado 122: o servidor exige (re)consentimento — reativa o gate para o AuthGuard
        // levar a /consentimento, independentemente de a falha ter vindo do retry pos-refresh.
        if (error instanceof ApiError && error.code === "CONSENT_REQUIRED") {
          await markConsentRequired();
        }
        throw error;
      }
    },
    [accessToken, refreshToken, runRefresh, logout, markConsentRequired]
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
