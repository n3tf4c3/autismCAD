import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { apiRequest, ApiError, type ApiRequest } from "@/api/client";
import { SessionLifecycle } from "./session-lifecycle";

export type AuthUser = {
  id: number; nome: string; email: string; role: string; consentRequired?: boolean;
};
type LoginResponse = { accessToken: string; refreshToken: string; expiresIn: number; user: AuthUser };
type RefreshResponse = Omit<LoginResponse, "user"> & { user?: Pick<AuthUser, "id" | "nome" | "email" | "role"> | null };
type AuthState = {
  user: AuthUser | null; loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  markConsentAccepted: () => Promise<void>;
  authFetch: <T>(path: string, options?: ApiRequest) => Promise<T>;
};
type Snapshot = { user: AuthUser | null; accessToken: string | null; refreshToken: string | null };
const emptySnapshot = (): Snapshot => ({ user: null, accessToken: null, refreshToken: null });
const ACCESS_KEY = "autismcad.accessToken";
const REFRESH_KEY = "autismcad.refreshToken";
const USER_KEY = "autismcad.user";
const AuthContext = createContext<AuthState | null>(null);

export function roleCanon(role: string | null | undefined): string {
  return String(role ?? "").trim().toUpperCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const lifecycle = useRef(new SessionLifecycle());
  const snapshot = useRef<Snapshot>(emptySnapshot());
  const refreshInFlight = useRef<{ generation: number; promise: Promise<RefreshResponse> } | null>(null);

  const publish = useCallback((next: Snapshot) => {
    snapshot.current = next;
    setUser(next.user);
  }, []);
  const assertCurrent = useCallback((generation: number) => {
    if (!lifecycle.current.current(generation)) throw new ApiError("Sessao encerrada.", 0, "ABORTED");
  }, []);

  const clearStorage = useCallback(async (generation: number) => {
    await lifecycle.current.enqueue(generation, async () => {
      await Promise.all([ACCESS_KEY, REFRESH_KEY, USER_KEY].map((key) => SecureStore.deleteItemAsync(key)));
    });
  }, []);

  useEffect(() => {
    const session = lifecycle.current;
    const generation = session.generation;
    void session.enqueue(generation, async () => {
      try {
        const [a, r, u] = await Promise.all([ACCESS_KEY, REFRESH_KEY, USER_KEY].map((key) => SecureStore.getItemAsync(key)));
        if (a && r && u && session.current(generation)) {
          const restored: AuthUser = JSON.parse(u);
          publish({ accessToken: a, refreshToken: r, user: restored });
        }
      } catch {
        await Promise.all([ACCESS_KEY, REFRESH_KEY, USER_KEY].map((key) => SecureStore.deleteItemAsync(key)));
      } finally {
        if (session.current(generation)) setLoading(false);
      }
    });
    return () => { session.invalidate(); };
  }, [publish]);

  const persist = useCallback(async (tokens: { accessToken: string; refreshToken: string }, generation: number, fresh?: AuthUser | null) => {
    await lifecycle.current.enqueue(generation, async () => {
      const nextUser = fresh ? { ...snapshot.current.user, ...fresh } : snapshot.current.user;
      await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
      if (nextUser) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
      if (lifecycle.current.current(generation)) publish({ ...tokens, user: nextUser });
    });
    assertCurrent(generation);
  }, [assertCurrent, publish]);

  const requestForSession = useCallback(async <T,>(path: string, options: ApiRequest, generation: number): Promise<T> => {
    assertCurrent(generation);
    const controller = new AbortController();
    const abort = () => controller.abort();
    const signals = [lifecycle.current.controller.signal, options.signal].filter((signal): signal is AbortSignal => !!signal);
    for (const signal of signals) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
    try {
      const result = await apiRequest<T>(path, { ...options, signal: controller.signal });
      assertCurrent(generation);
      return result;
    } finally {
      for (const signal of signals) signal.removeEventListener("abort", abort);
    }
  }, [assertCurrent]);

  const logout = useCallback(async () => {
    const previousRefresh = snapshot.current.refreshToken;
    const generation = lifecycle.current.invalidate();
    refreshInFlight.current = null;
    publish(emptySnapshot());
    setLoading(false);
    if (previousRefresh) {
      void apiRequest("/api/v1/auth/logout", { method: "POST", body: { refreshToken: previousRefresh } }).catch(() => {});
    }
    await clearStorage(generation);
  }, [clearStorage, publish]);

  const login = useCallback(async (email: string, password: string) => {
    const generation = lifecycle.current.invalidate();
    refreshInFlight.current = null;
    publish(emptySnapshot());
    setLoading(false);
    await clearStorage(generation);
    const result = await requestForSession<LoginResponse>("/api/v1/auth/login", { method: "POST", body: { email, password } }, generation);
    await persist(result, generation, result.user);
  }, [clearStorage, persist, publish, requestForSession]);

  const markConsent = useCallback(async (required: boolean, generation: number) => {
    await lifecycle.current.enqueue(generation, async () => {
      const current = snapshot.current;
      if (!current.user) return;
      const nextUser = { ...current.user, consentRequired: required };
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
      if (lifecycle.current.current(generation)) publish({ ...current, user: nextUser });
    });
  }, [publish]);

  const markConsentAccepted = useCallback(async () => {
    await markConsent(false, lifecycle.current.generation);
  }, [markConsent]);

  const runRefresh = useCallback((token: string, generation: number): Promise<RefreshResponse> => {
    assertCurrent(generation);
    const existing = refreshInFlight.current;
    if (existing?.generation === generation) return existing.promise;
    const pending = {
      generation,
      promise: (async () => {
        const result = await requestForSession<RefreshResponse>("/api/v1/auth/refresh", { method: "POST", body: { refreshToken: token } }, generation);
        await persist(result, generation, result.user);
        return result;
      })(),
    };
    refreshInFlight.current = pending;
    void pending.promise.finally(() => {
      if (refreshInFlight.current === pending) refreshInFlight.current = null;
    }).catch(() => {});
    return pending.promise;
  }, [assertCurrent, persist, requestForSession]);

  const authFetch = useCallback(async <T,>(path: string, options: ApiRequest = {}): Promise<T> => {
    const generation = lifecycle.current.generation;
    const current = snapshot.current;
    try {
      try {
        return await requestForSession<T>(path, { ...options, token: current.accessToken }, generation);
      } catch (error) {
        assertCurrent(generation);
        if (!(error instanceof ApiError) || error.status !== 401 || !current.refreshToken) throw error;
        let refreshed: RefreshResponse;
        try {
          refreshed = await runRefresh(current.refreshToken, generation);
        } catch (refreshError) {
          assertCurrent(generation);
          // Falhas de rede/timeout/5xx preservam a sessao para retry.
          if (refreshError instanceof ApiError && (refreshError.status === 401 || refreshError.status === 403)) await logout();
          throw refreshError;
        }
        return await requestForSession<T>(path, { ...options, token: refreshed.accessToken }, generation);
      }
    } catch (error) {
      assertCurrent(generation);
      if (error instanceof ApiError && error.code === "CONSENT_REQUIRED") await markConsent(true, generation);
      throw error;
    }
  }, [assertCurrent, logout, markConsent, requestForSession, runRefresh]);

  const value = useMemo<AuthState>(() => ({ user, loading, login, logout, markConsentAccepted, authFetch }),
    [user, loading, login, logout, markConsentAccepted, authFetch]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
