'use client'
import { useEffect, useState } from 'react';
import { auth } from '../lib/api';

export default function useAuth() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      auth.me().then((u) => setUser(u)).catch(() => setUser(null));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await auth.login(email, password);
    localStorage.setItem('token', res.token);
    setUser(res.user);
    return res;
  };

  const register = async (email: string, username: string, password: string) => {
    const res = await auth.register(email, username, password);
    localStorage.setItem('token', res.token);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return { user, login, register, logout };
}
