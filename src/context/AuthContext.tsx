import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  repo?: string;
  branch: string;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [repo, setRepo] = useState<string | undefined>();
  const [branch, setBranch] = useState("main");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.session();
      setAuthenticated(res.authenticated);
      setRepo(res.repo);
      setBranch(res.branch || "main");
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (password: string) => {
    await api.login(password);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.logout();
    setAuthenticated(false);
  }, []);

  return (
    <Ctx.Provider value={{ loading, authenticated, repo, branch, login, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
