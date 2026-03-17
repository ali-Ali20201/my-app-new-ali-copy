import React, { createContext, useContext, useState, useEffect } from "react";
import { useSocket } from "../hooks/useSocket";
import { apiFetch } from '../utils/api';

type User = {
  id: number;
  name: string;
  email: string;
  balance: number;
  role: "admin" | "user";
  a_code?: string;
  preferred_currency: string;
};

type AuthContextType = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  login: (email: string, password: string) => Promise<any>;
  verifyLogin: (email: string, code: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateCurrency: (currency: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed.id === 'number') {
          return parsed;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const socket = useSocket();

  useEffect(() => {
    if (socket && user && typeof user.id === 'number') {
      socket.emit('user_connected', user.id);
      
      const handleForceLogout = (data: any) => {
        if (data.userId === user.id) {
          logout();
        }
      };

      const handleBalanceUpdated = (data: any) => {
        if (data.userId === user.id) {
          setUser(prev => prev ? { ...prev, balance: data.newBalance } : null);
          localStorage.setItem("user", JSON.stringify({ ...user, balance: data.newBalance }));
        }
      };

      socket.on('force_logout', handleForceLogout);
      socket.on('balance_updated', handleBalanceUpdated);
      
      return () => {
        socket.off('force_logout', handleForceLogout);
        socket.off('balance_updated', handleBalanceUpdated);
      };
    }
  }, [socket, user?.id]);

  useEffect(() => {
    if (user && typeof user.id === 'number') {
      console.log('Attempting to restore session for user:', user.id);
      
      const attemptRestore = async (retries = 5, delay = 2000) => {
        try {
          const res = await apiFetch('/api/auth/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: user.id })
          });
          
          console.log('Restore response status:', res.status);
          if (res.status === 404 || res.status === 401) {
            console.log('Restore failed with 404/401, logging out');
            setUser(null);
            localStorage.removeItem("user");
            return;
          }
          
          if (!res.ok) {
            throw new Error(`Restore failed with status ${res.status}`);
          }
          
          const data = await res.json();
          console.log('Restore response data:', data);
          if (data && !data.error) {
            setUser(data);
            localStorage.setItem("user", JSON.stringify(data));
          }
        } catch (err) {
          if (retries > 0) {
            console.warn(`Restore attempt failed, retrying in ${delay}ms... (${retries} retries left)`, err);
            setTimeout(() => attemptRestore(retries - 1, delay * 2), delay);
          } else {
            console.error('Restore network error after retries, keeping local session:', err);
          }
        }
      };

      attemptRestore();
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await res.json().catch(() => ({ error: "فشل تسجيل الدخول" }));
    
    if (!res.ok) {
      throw new Error(data.error || "فشل تسجيل الدخول");
    }
    
    setUser(data);
    localStorage.setItem("user", JSON.stringify(data));
    return data;
  };

  const verifyLogin = async (email: string, code: string) => {
    const res = await apiFetch("/api/auth/verify-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    
    const data = await res.json().catch(() => ({ error: "فشل التحقق من الكود" }));
    
    if (!res.ok) {
      throw new Error(data.error || "فشل التحقق من الكود");
    }
    
    setUser(data);
    localStorage.setItem("user", JSON.stringify(data));
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    
    const data = await res.json().catch(() => ({ error: "فشل التسجيل" }));
    
    if (!res.ok) {
      throw new Error(data.error || "فشل التسجيل");
    }
    
    setUser(data);
    localStorage.setItem("user", JSON.stringify(data));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const refreshUser = async () => {
    if (!user) return;
    const res = await apiFetch(`/api/users/${user.id}`);
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      localStorage.setItem("user", JSON.stringify(data));
    }
  };

  const updateCurrency = async (currency: string) => {
    if (!user) return;
    const res = await apiFetch(`/api/users/${user.id}/currency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency })
    });
    if (res.ok) {
      const data = await res.json();
      const newBalance = data.newBalance !== undefined ? data.newBalance : user.balance;
      const updatedUser = { ...user, preferred_currency: currency, balance: newBalance };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, verifyLogin, register, logout, refreshUser, updateCurrency }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
