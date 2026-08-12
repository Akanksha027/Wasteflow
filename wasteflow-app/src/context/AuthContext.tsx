// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getUserRole, getDriverEmployee } from '../api';
import { Employee } from '../types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  employee: Employee | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  employee: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshEmployee: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUserData(u: User) {
    const [r, emp] = await Promise.all([
      getUserRole(u.id),
      getDriverEmployee(u.id),
    ]);
    setRole(r);
    setEmployee(emp);
  }

  async function refreshEmployee() {
    if (user) {
      const emp = await getDriverEmployee(user.id);
      setEmployee(emp);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadUserData(s.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadUserData(s.user);
      } else {
        setRole(null);
        setEmployee(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setEmployee(null);
  }

  return (
    <AuthContext.Provider
      value={{ session, user, employee, role, loading, signOut, refreshEmployee }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
