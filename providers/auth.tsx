import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

type StoredUser = User & {
  passwordHash: string;
};

const USERS_KEY = "auth_users_v1";
const SESSION_KEY = "auth_session_v1";

function createUserId(): string {
  const random = Math.random().toString(16).slice(2);
  return `usr_${Date.now().toString(16)}_${random}`;
}

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `h_${Math.abs(hash).toString(16)}_${password.length}`;
}

async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        console.log("[Auth] Loading session...");
        const sessionData = await getSecureItem(SESSION_KEY);
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          setUser(parsed);
          console.log("[Auth] Session restored for:", parsed.email);
        }
      } catch (e) {
        console.error("[Auth] Load session error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const getUsers = useCallback(async (): Promise<StoredUser[]> => {
    try {
      const raw = await AsyncStorage.getItem(USERS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("[Auth] Get users error:", e);
    }
    return [];
  }, []);

  const saveUsers = useCallback(async (users: StoredUser[]) => {
    try {
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error("[Auth] Save users error:", e);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setError(null);
      console.log("[Auth] Sign up attempt for:", email);

      if (!email || !password || !name) {
        setError("All fields are required");
        return false;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return false;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("Please enter a valid email");
        return false;
      }

      try {
        const users = await getUsers();
        const existing = users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );

        if (existing) {
          setError("An account with this email already exists");
          return false;
        }

        const newUser: StoredUser = {
          id: createUserId(),
          email: email.toLowerCase().trim(),
          name: name.trim(),
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
        };

        await saveUsers([...users, newUser]);

        const sessionUser: User = {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          createdAt: newUser.createdAt,
        };

        await setSecureItem(SESSION_KEY, JSON.stringify(sessionUser));
        setUser(sessionUser);
        console.log("[Auth] Sign up successful for:", email);
        return true;
      } catch (e) {
        console.error("[Auth] Sign up error:", e);
        setError("Something went wrong. Please try again.");
        return false;
      }
    },
    [getUsers, saveUsers]
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);
      console.log("[Auth] Sign in attempt for:", email);

      if (!email || !password) {
        setError("Email and password are required");
        return false;
      }

      try {
        const users = await getUsers();
        const foundUser = users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase().trim()
        );

        if (!foundUser) {
          setError("No account found with this email");
          return false;
        }

        if (foundUser.passwordHash !== hashPassword(password)) {
          setError("Incorrect password");
          return false;
        }

        const sessionUser: User = {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
          createdAt: foundUser.createdAt,
        };

        await setSecureItem(SESSION_KEY, JSON.stringify(sessionUser));
        setUser(sessionUser);
        console.log("[Auth] Sign in successful for:", email);
        return true;
      } catch (e) {
        console.error("[Auth] Sign in error:", e);
        setError("Something went wrong. Please try again.");
        return false;
      }
    },
    [getUsers]
  );

  const signOut = useCallback(async () => {
    console.log("[Auth] Signing out...");
    try {
      await deleteSecureItem(SESSION_KEY);
      setUser(null);
      setError(null);
    } catch (e) {
      console.error("[Auth] Sign out error:", e);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    signUp,
    signIn,
    signOut,
    clearError,
  };
});
