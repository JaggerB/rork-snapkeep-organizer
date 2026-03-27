import { supabase } from "@/lib/supabase";
import createContextHook from "@nkzw/create-context-hook";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

export type User = SupabaseUser;

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hasSupabase = !!(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

    if (!hasSupabase) {
      console.warn("[Auth] Supabase env vars missing - add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Vercel");
      setIsLoading(false);
      return;
    }

    // Timeout: if getSession hangs, stop loading so user sees sign-in
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      console.warn("[Auth] getSession timed out");
      setIsLoading(false);
    }, 10000);

    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      clearTimeout(timeoutId);
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      clearTimeout(timeoutId);
      console.error("[Auth] getSession failed:", err);
      setIsLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // Refresh session when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setError(null);
      if (!email || !password || !name) {
        setError("All fields are required");
        return false;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name, // Stored in user_metadata
          },
        },
      });

      if (error) {
        console.error("[Auth] Sign up error:", error.message);
        setError(error.message);
        return false;
      }

      return true;
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);
      if (!email || !password) {
        setError("Email and password are required");
        return false;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("[Auth] Sign in error:", error.message);
        setError(error.message);
        return false;
      }

      return true;
    },
    []
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[Auth] Sign out error:", error.message);
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: { name?: string }): Promise<boolean> => {
      setError(null);
      if (!updates.name?.trim()) {
        setError("Name is required");
        return false;
      }

      const { error } = await supabase.auth.updateUser({
        data: { name: updates.name.trim() },
      });

      if (error) {
        console.error("[Auth] Update profile error:", error.message);
        setError(error.message);
        return false;
      }

      return true;
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    error,
    signUp,
    signIn,
    signOut,
    updateProfile,
    clearError,
  };
});
