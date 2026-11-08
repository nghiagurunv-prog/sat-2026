'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * AuthContext — trạng thái đăng nhập ở CLIENT (cho UI: nút Đăng nhập/Đăng xuất).
 *
 * ⚠️ Đây CHỈ phục vụ hiển thị. Enforcement thật (chặn guest vào trang luyện) nằm ở
 * proxy (src/lib/supabase/middleware.ts). Không dựa DEFAULT_USER_ID — dùng session
 * thật của Supabase.
 */

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function clearUserLocalCaches() {
  if (typeof window === 'undefined') return;
  try {
    const prefixes = [
      'sat_progress',
      'sat_mistakes',
      'sat_gamification',
      'sat_exam_session',
      'sat_study_plan',
      'sat_Adaptive',
      'sat_adaptive',
      'sat_leitner',
    ];
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && prefixes.some((p) => key.toLowerCase().startsWith(p.toLowerCase()))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore localStorage access errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT') {
        clearUserLocalCaches();
      }
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } finally {
      clearUserLocalCaches();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
  return ctx;
}
