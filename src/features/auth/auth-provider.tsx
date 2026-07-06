import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type User = {
  name: string;
  email: string;
  role: string;
};

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("modern-crm-user");
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("modern-crm-token"));

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(token && user),
      login: (nextToken, nextUser) => {
        localStorage.setItem("modern-crm-token", nextToken);
        localStorage.setItem("modern-crm-user", JSON.stringify(nextUser));
        setToken(nextToken);
        setUser(nextUser);
      },
      logout: () => {
        localStorage.removeItem("modern-crm-token");
        localStorage.removeItem("modern-crm-user");
        setToken(null);
        setUser(null);
      }
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
