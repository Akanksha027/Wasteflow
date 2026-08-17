// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { getUserRole, getDriverEmployee, ensureMyEmployee, signIn as apiSignIn, resetPassword } from '../api';
import { Employee } from '../types';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  employee: Employee | null;
  role: string | null;
  loading: boolean;
  signingIn: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  employee: null,
  role: null,
  loading: true,
  signingIn: false,
  signIn: async () => false,
  signInWithGoogle: async () => false,
  forgotPassword: async () => false,
  signOut: async () => {},
  refreshEmployee: async () => {},
});

function isDriver(role: string | null, employee: Employee | null) {
  return role === 'driver' || employee?.role === 'driver';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  async function loadUserData(u: User): Promise<{ role: string | null; employee: Employee | null }> {
    let emp = await getDriverEmployee(u.id);
    if (!emp) {
      emp = await ensureMyEmployee();
    }
    const r = await getUserRole(u.id);
    const effectiveRole = isDriver(r, emp) ? 'driver' : r;
    setRole(effectiveRole);
    setEmployee(emp);
    return { role: effectiveRole, employee: emp };
  }

  async function finalizeDriverSession(authedUser: User, nextSession: Session | null): Promise<boolean> {
    const { role: r, employee: emp } = await loadUserData(authedUser);

    if (!isDriver(r, emp)) {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setRole(null);
      setEmployee(null);
      Alert.alert(
        'Access denied',
        'This login is not a Driver. In ERP → Employees, set Role to Driver, save, then sign in again.',
      );
      return false;
    }

    if (!emp) {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setRole(null);
      setEmployee(null);
      Alert.alert(
        'No employee profile',
        'Ask an admin to open ERP → Employees, set your login email and password, and save.',
      );
      return false;
    }

    setSession(nextSession);
    setUser(authedUser);
    return true;
  }

  async function refreshEmployee() {
    if (user) {
      let emp = await getDriverEmployee(user.id);
      if (!emp) emp = await ensureMyEmployee();
      setEmployee(emp);
    }
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const { role: r, employee: emp } = await loadUserData(s.user);
        if (r && !isDriver(r, emp)) {
          await supabase.auth.signOut();
          if (active) {
            setSession(null);
            setUser(null);
            setRole(null);
            setEmployee(null);
          }
        }
      }
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setRole(null);
        setEmployee(null);
        return;
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void loadUserData(s.user);
      } else {
        setRole(null);
        setEmployee(null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<boolean> {
    setSigningIn(true);
    try {
      const { data, error } = await apiSignIn(email.trim().toLowerCase(), password);
      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('email not confirmed')) {
          Alert.alert(
            'Confirm your email',
            'Ask an admin to save your login password again in ERP → Employees so the account is confirmed.',
          );
        } else if (msg.includes('invalid login') || msg.includes('schema') || msg.includes('database error')) {
          Alert.alert('Sign in failed', 'Incorrect email or password.');
        } else {
          Alert.alert('Sign in failed', error.message);
        }
        return false;
      }

      const authedUser = data.user;
      if (!authedUser) {
        Alert.alert('Sign in failed', 'No user returned from authentication.');
        return false;
      }

      return finalizeDriverSession(authedUser, data.session);
    } finally {
      setSigningIn(false);
    }
  }

  async function signInWithGoogle(): Promise<boolean> {
    setSigningIn(true);
    try {
      const redirectTo =
        process.env.EXPO_PUBLIC_AUTH_CALLBACK_URL ?? 'https://wasteflow-drab.vercel.app/auth/callback';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });

      if (error || !data.url) {
        Alert.alert(
          'Google sign-in unavailable',
          'Use the email and password your admin set in ERP → Employees.',
        );
        return false;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        return false;
      }

      const url = result.url;
      const query = url.split('#')[0].split('?')[1] ?? '';
      const hash = url.includes('#') ? url.split('#')[1] : '';
      const params = new URLSearchParams([query, hash].filter(Boolean).join('&'));
      const code = params.get('code');
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      let sessionUser = null;
      let nextSession = null;

      if (code) {
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        if (exchanged.error || !exchanged.data.user) {
          Alert.alert(
            'Google sign-in unavailable',
            'Use the email and password your admin set in ERP → Employees.',
          );
          return false;
        }
        sessionUser = exchanged.data.user;
        nextSession = exchanged.data.session;
      } else if (access_token && refresh_token) {
        const sessionData = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessionData.error || !sessionData.data.user) {
          Alert.alert(
            'Google sign-in unavailable',
            'Use the email and password your admin set in ERP → Employees.',
          );
          return false;
        }
        sessionUser = sessionData.data.user;
        nextSession = sessionData.data.session;
      } else {
        Alert.alert(
          'Google sign-in unavailable',
          'Use the email and password your admin set in ERP → Employees.',
        );
        return false;
      }

      return finalizeDriverSession(sessionUser, nextSession);
    } catch {
      Alert.alert(
        'Google sign-in unavailable',
        'Use the email and password your admin set in ERP → Employees.',
      );
      return false;
    } finally {
      setSigningIn(false);
    }
  }

  async function forgotPassword(email: string): Promise<boolean> {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter your work email to reset your password.');
      return false;
    }
    const { error } = await resetPassword(email.trim().toLowerCase());
    if (error) {
      Alert.alert('Reset failed', error.message);
      return false;
    }
    Alert.alert('Check your email', 'If an account exists, a password reset link has been sent.');
    return true;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setEmployee(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        employee,
        role,
        loading,
        signingIn,
        signIn,
        signInWithGoogle,
        forgotPassword,
        signOut,
        refreshEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
