import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "@/lib/supabase";

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
  tripId?: string | null;
};


export function createId(): string {
  const random = Math.random().toString(16).slice(2);
  return `it_${Date.now().toString(16)}_${random}`;
}

// Note: Image upload to Supabase Storage is disabled for now.
// Images are saved as base64 data URLs directly in the database.
// This can be re-enabled later if storage connectivity issues are resolved.

export const [SavedItemsProvider, useSavedItems] = createContextHook(() => {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        console.warn(`[SavedItems] ${label} timed out after ${ms}ms`);
        reject(new Error(`${label} timed out`));
      }, ms);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
  }

  // Load items from Supabase
  const loadFromSupabase = useCallback(async () => {
    if (!user) return [];

    try {
      console.log('[SavedItems] Loading from Supabase for user:', user.id);
      const { data, error } = await supabase
        .from('saved_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SavedItems] Supabase load error:', error);
        return [];
      }

      // Transform DB format to app format
      const transformed = (data || []).map(row => ({
        id: row.id,
        createdAt: row.created_at,
        title: row.title,
        notes: row.notes,
        category: row.category,
        imageUri: row.image_uri,
        source: row.source,
        location: row.location,
        coordinates: row.coordinates,
        mapsUrl: row.maps_url,
        dateTimeISO: row.date_time_iso,
        tripId: row.trip_id,
      }));

      console.log('[SavedItems] Loaded', transformed.length, 'items from Supabase');
      return transformed;
    } catch (e) {
      console.error('[SavedItems] Supabase load exception:', e);
      return [];
    }
  }, [user]);


  // Load items on mount
  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        if (user) {
          // Load from Supabase
          let supabaseItems: SavedItem[] = [];
          try {
            supabaseItems = await withTimeout(loadFromSupabase(), 15000, 'loadFromSupabase');
          } catch (e) {
            console.error('[SavedItems] loadFromSupabase failed or timed out:', e);
          }
          setItems(supabaseItems);
        } else {
          // No user logged in: clear items
          console.log('[SavedItems] No user logged in, clearing items');
          setItems([]);
        }
      } catch (e) {
        console.error('[SavedItems] Load error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user, authLoading, loadFromSupabase]);

  const addItem = useCallback(
    async (item: SavedItem) => {
      console.log('[SavedItems] addItem called');

      // Require user to be logged in
      if (!user) {
        console.warn('[SavedItems] Cannot add item: user not logged in');
        return;
      }

      // Optimistic update - add to local state immediately
      setItems((prev) => [item, ...prev]);

      // Keep image as base64 data URL for now (skip Supabase Storage upload)
      let imageUri = item.imageUri;
      console.log('[SavedItems] Saving image directly (base64):', imageUri?.substring(0, 50));

      try {
        // Insert into Supabase
        const { error } = await supabase
          .from('saved_items')
          .insert({
            id: item.id,
            user_id: user.id,
            title: item.title,
            notes: item.notes,
            category: item.category,
            image_uri: imageUri,
            source: item.source,
            location: item.location,
            coordinates: item.coordinates,
            maps_url: item.mapsUrl,
            date_time_iso: item.dateTimeISO,
            trip_id: item.tripId,
          });

        if (error) {
          console.error('[SavedItems] Supabase insert error:', error);
          // Rollback optimistic update
          setItems((prev) => prev.filter(it => it.id !== item.id));
        } else {
          // Update with the uploaded image URL
          if (imageUri !== item.imageUri) {
            setItems((prev) => prev.map(it =>
              it.id === item.id ? { ...it, imageUri } : it
            ));
          }
        }
      } catch (e) {
        console.error('[SavedItems] Supabase insert exception:', e);
        // Rollback optimistic update
        setItems((prev) => prev.filter(it => it.id !== item.id));
      }
    },
    [user, items]
  );

  const updateItem = useCallback(
    async (id: string, patch: Partial<SavedItem>) => {
      // Require user to be logged in
      if (!user) {
        console.warn('[SavedItems] Cannot update item: user not logged in');
        return;
      }

      // Optimistic update
      setItems((prev) => prev.map((it) =>
        it.id === id ? { ...it, ...patch } : it
      ));

      const { error} = await supabase
        .from('saved_items')
        .update({
          title: patch.title,
          notes: patch.notes,
          category: patch.category,
          location: patch.location,
          coordinates: patch.coordinates,
          maps_url: patch.mapsUrl,
          date_time_iso: patch.dateTimeISO,
          trip_id: patch.tripId,
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('[SavedItems] Supabase update error:', error);
        // Rollback
        setItems((prev) => prev.map((it) =>
          it.id === id ? { ...it, ...patch } : it
        ));
      }
    },
    [user, items]
  );

  const removeItem = useCallback(
    async (id: string) => {
      // Require user to be logged in
      if (!user) {
        console.warn('[SavedItems] Cannot remove item: user not logged in');
        return;
      }

      // Optimistic update
      const removedItem = items.find(it => it.id === id);
      setItems((prev) => prev.filter((it) => it.id !== id));

      const { error } = await supabase
        .from('saved_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('[SavedItems] Supabase delete error:', error);
        // Rollback
        if (removedItem) {
          setItems((prev) => [removedItem, ...prev]);
        }
      }
    },
    [user, items]
  );

  const clearAll = useCallback(async () => {
    // Require user to be logged in
    if (!user) {
      console.warn('[SavedItems] Cannot clear items: user not logged in');
      return;
    }

    setItems([]);

    await supabase
      .from('saved_items')
      .delete()
      .eq('user_id', user.id);
  }, [user]);

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
