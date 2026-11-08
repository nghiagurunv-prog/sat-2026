'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
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
  session?: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function clearUserLocalCaches() {
  if (typeof window === 'undefined') return;
  try {
    const prefixes = [
      'sat_',
      'gamification_',
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
      if (
        key &&
        (key.toLowerCase().startsWith('sat_') ||
          key.toLowerCase().startsWith('gamification_') ||
          prefixes.some((p) => key.toLowerCase().startsWith(p.toLowerCase())))
      ) {
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
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    // Đồng bộ đăng xuất đa tab (#048) qua BroadcastChannel
    let authChannel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        authChannel = new BroadcastChannel('sat_auth_channel');
        authChannel.onmessage = (event) => {
          if (event?.data?.type === 'SIGN_OUT') {
            clearUserLocalCaches();
            setUser(null);
            setSession(null);
          }
        };
      }
    } catch {
      // BroadcastChannel có thể không hỗ trợ hoặc bị chặn trong một số môi trường
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.session?.user ?? null);
      setSession(data.session ?? null);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT') {
        clearUserLocalCaches();
      }
      setUser(session?.user ?? null);
      setSession(session ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
      try {
        authChannel?.close();
      } catch {
        // Bỏ qua lỗi khi đóng channel
      }
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } finally {
      clearUserLocalCaches();
      setUser(null);
      setSession(null);
      // Đồng bộ đăng xuất đa tab (#048)
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const channel = new BroadcastChannel('sat_auth_channel');
          channel.postMessage({ type: 'SIGN_OUT' });
          channel.close();
        }
      } catch {
        // Bỏ qua lỗi BroadcastChannel
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated: !!user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
  return ctx;
}
