import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

const IDLE_TIMEOUT_MS = (Number(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MINUTES) || 20) * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);
  const idleTimer = useRef(null);

  async function login(username, password) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed.' };
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch (_) {
      // proceed with local logout regardless of server response
    }
    localStorage.clear();
    setUser(null);
  }

  function hasPermission(key) {
    if (!user) return false;
    if (user.permissions?.all === true) return true;
    return user.permissions?.[key] === true;
  }

  function hasRole(...roles) {
    return user && roles.includes(user.role);
  }

  // Automatic session timeout after a period of inactivity
  useEffect(() => {
    if (!user) return undefined;

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        logout();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
