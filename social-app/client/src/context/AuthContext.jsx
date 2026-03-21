import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Fetch current user on app load if tokens exist
  useEffect(() => {
    const access = localStorage.getItem("access_token");
    if (!access) {
      setIsLoading(false);
      return;
    }
    authAPI
      .getMe()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem("access_token", data.tokens.access);
    localStorage.setItem("refresh_token", data.tokens.refresh);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (formData) => {
    const { data } = await authAPI.register(formData);
    localStorage.setItem("access_token", data.tokens.access);
    localStorage.setItem("refresh_token", data.tokens.refresh);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem("refresh_token");
    try {
      if (refresh) await authAPI.logout(refresh);
    } catch {
      /* ignore – token may already be invalid */
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }, []);

  const updateTokens = useCallback((tokens) => {
    if (tokens.access) {
      localStorage.setItem("access_token", tokens.access);
    }
    if (tokens.refresh) {
      localStorage.setItem("refresh_token", tokens.refresh);
    }
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated, login, register, logout, updateTokens, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
