import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setCachedCsrfToken } from '../api/client';

interface UserInfo {
  username: string;
  authenticated: boolean;
  csrf_token: string;
}

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const refresh = async () => {
    try {
      const data = await api.get<UserInfo>('/api/auth/me');
      setUser(data);
      if (data.csrf_token) {
        setCachedCsrfToken(data.csrf_token);
      }
      if (!data.authenticated) {
        setLoginModalOpen(true);
      } else {
        setLoginModalOpen(false);
      }
    } catch (e) {
      console.error('Failed to check auth status', e);
      setLoginModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const handleUnauthorized = () => {
      setLoginModalOpen(true);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post('/api/auth/login', { username, password });
    if (res.csrf_token) {
      setCachedCsrfToken(res.csrf_token);
    }
    setUser({
      username: res.username,
      authenticated: true,
      csrf_token: res.csrf_token,
    });
    setLoginModalOpen(false);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
      setLoginModalOpen(true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginModalOpen,
        setLoginModalOpen,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
