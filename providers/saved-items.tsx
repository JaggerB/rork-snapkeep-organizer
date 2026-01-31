import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";

export type SavedItemCategory =
  | "Events"
  | "Travel"
  | "Date night"
  | "Hikes"
  | "Food"
  | "Shopping"
  | "Movies"
  | "Other"
  | string;

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type SavedItem = {
  id: string;
  createdAt: string;
  title: string;
  dateTimeISO?: string | null;
  location?: string | null;
  coordinates?: Coordinates | null;
  mapsUrl?: string | null;
  category: SavedItemCategory;
  source?: string | null;
  imageUri?: string | null;
  notes?: string | null;
};

const STORAGE_KEY_PREFIX = "saved_items_v1";

function getStorageKey(userId: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : `${STORAGE_KEY_PREFIX}_guest`;
}

export function createId(): string {
  const random = Math.random().toString(16).slice(2);
  return `it_${Date.now().toString(16)}_${random}`;
}

export const [SavedItemsProvider, useSavedItems] = createContextHook(() => {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = getStorageKey(user?.id ?? null);

  useEffect(() => {
    if (authLoading) return;
    
    const load = async () => {
      try {
        console.log("[SavedItems] loading from storage, key:", storageKey);
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setItems(parsed);
            console.log("[SavedItems] loaded", parsed.length, "items");
            parsed.forEach((item: SavedItem, idx: number) => {
              console.log(`[SavedItems] item ${idx}: id=${item.id}, imageUri=${item.imageUri ? item.imageUri.substring(0, 40) + "..." : "null"}`);
            });
          }
        }
      } catch (e) {
        console.error("[SavedItems] load error", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [storageKey, authLoading]);

  const persist = useCallback(async (nextItems: SavedItem[]) => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextItems));
      console.log("[SavedItems] persisted", nextItems.length, "items to", storageKey);
    } catch (e) {
      console.error("[SavedItems] persist error", e);
    }
  }, [storageKey]);

  const addItem = useCallback(
    (item: SavedItem) => {
      console.log("[SavedItems] addItem called with imageUri:", item.imageUri ? item.imageUri.substring(0, 40) + "..." : "null");
      setItems((prev) => {
        const next = [item, ...prev];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<SavedItem>) => {
      setItems((prev) => {
        const next = prev.map((it) =>
          it.id === id ? { ...it, ...patch } : it
        );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((it) => it.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const clearAll = useCallback(() => {
    setItems([]);
    persist([]);
  }, [persist]);

  const byCategory = useMemo(() => {
    const map = new Map<string, SavedItem[]>();
    for (const it of items) {
      const key = String(it.category || "Other");
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return map;
  }, [items]);

  return {
    items,
    byCategory,
    isLoading,
    addItem,
    updateItem,
    removeItem,
    clearAll,
  };
});
