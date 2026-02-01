import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "@/lib/supabase";
import * as FileSystem from 'expo-file-system';

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
const MIGRATION_KEY = "supabase_migration_complete";

function getStorageKey(userId: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : `${STORAGE_KEY_PREFIX}_guest`;
}

export function createId(): string {
  const random = Math.random().toString(16).slice(2);
  return `it_${Date.now().toString(16)}_${random}`;
}

async function uploadImageToStorage(localUri: string, itemId: string): Promise<string | null> {
  try {
    console.log('[SavedItems] Uploading image to Supabase Storage:', localUri);

    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    });

    // Determine file extension
    const ext = localUri.split('.').pop() || 'jpg';
    const fileName = `${itemId}.${ext}`;
    const filePath = `${fileName}`;

    // Convert base64 to blob
    const blob = await (await fetch(`data:image/${ext};base64,${base64}`)).blob();

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('screenshots')
      .upload(filePath, blob, {
        contentType: `image/${ext}`,
        upsert: true,
      });

    if (error) {
      console.error('[SavedItems] Storage upload error:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('screenshots')
      .getPublicUrl(filePath);

    console.log('[SavedItems] Image uploaded successfully:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('[SavedItems] Image upload failed:', error);
    return null;
  }
}

export const [SavedItemsProvider, useSavedItems] = createContextHook(() => {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = getStorageKey(user?.id ?? null);

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
      }));

      console.log('[SavedItems] Loaded', transformed.length, 'items from Supabase');
      return transformed;
    } catch (e) {
      console.error('[SavedItems] Supabase load exception:', e);
      return [];
    }
  }, [user]);

  // Migrate local data to Supabase (one-time)
  const migrateLocalData = useCallback(async () => {
    if (!user) return;

    try {
      const migrationComplete = await AsyncStorage.getItem(MIGRATION_KEY);
      if (migrationComplete === 'true') {
        console.log('[SavedItems] Migration already completed');
        return;
      }

      console.log('[SavedItems] Checking for local data to migrate...');
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) {
        await AsyncStorage.setItem(MIGRATION_KEY, 'true');
        return;
      }

      const localItems = JSON.parse(raw);
      if (!Array.isArray(localItems) || localItems.length === 0) {
        await AsyncStorage.setItem(MIGRATION_KEY, 'true');
        return;
      }

      console.log('[SavedItems] Migrating', localItems.length, 'local items to Supabase...');

      for (const item of localItems) {
        // Upload image if it's a local file URI
        let imageUri = item.imageUri;
        if (imageUri && imageUri.startsWith('file://')) {
          const uploadedUrl = await uploadImageToStorage(imageUri, item.id);
          if (uploadedUrl) {
            imageUri = uploadedUrl;
          }
        }

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
            created_at: item.createdAt,
          });

        if (error) {
          console.error('[SavedItems] Migration error for item', item.id, error);
        }
      }

      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
      console.log('[SavedItems] Migration complete!');
    } catch (e) {
      console.error('[SavedItems] Migration exception:', e);
    }
  }, [user, storageKey]);

  // Load items on mount
  useEffect(() => {
    if (authLoading) return;

    const load = async () => {
      try {
        if (user) {
          // Migrate local data first (if needed)
          await migrateLocalData();

          // Load from Supabase
          const supabaseItems = await loadFromSupabase();
          setItems(supabaseItems);
        } else {
          // Guest mode: use AsyncStorage
          console.log('[SavedItems] Guest mode, loading from AsyncStorage');
          const raw = await AsyncStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setItems(parsed);
            }
          }
        }
      } catch (e) {
        console.error('[SavedItems] Load error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user, authLoading, storageKey, loadFromSupabase, migrateLocalData]);

  const addItem = useCallback(
    async (item: SavedItem) => {
      console.log('[SavedItems] addItem called');

      // Optimistic update - add to local state immediately
      setItems((prev) => [item, ...prev]);

      if (user) {
        // Upload image to Supabase Storage
        let imageUri = item.imageUri;
        if (imageUri && imageUri.startsWith('file://')) {
          const uploadedUrl = await uploadImageToStorage(imageUri, item.id);
          if (uploadedUrl) {
            imageUri = uploadedUrl;
          }
        }

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
      } else {
        // Guest mode: persist to AsyncStorage
        const next = [item, ...items];
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      }
    },
    [user, items, storageKey]
  );

  const updateItem = useCallback(
    async (id: string, patch: Partial<SavedItem>) => {
      // Optimistic update
      setItems((prev) => prev.map((it) =>
        it.id === id ? { ...it, ...patch } : it
      ));

      if (user) {
        const { error } = await supabase
          .from('saved_items')
          .update({
            title: patch.title,
            notes: patch.notes,
            category: patch.category,
            location: patch.location,
            coordinates: patch.coordinates,
            maps_url: patch.mapsUrl,
            date_time_iso: patch.dateTimeISO,
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
      } else {
        const next = items.map((it) =>
          it.id === id ? { ...it, ...patch } : it
        );
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      }
    },
    [user, items, storageKey]
  );

  const removeItem = useCallback(
    async (id: string) => {
      // Optimistic update
      const removedItem = items.find(it => it.id === id);
      setItems((prev) => prev.filter((it) => it.id !== id));

      if (user) {
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
      } else {
        const next = items.filter((it) => it.id !== id);
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      }
    },
    [user, items, storageKey]
  );

  const clearAll = useCallback(async () => {
    setItems([]);

    if (user) {
      await supabase
        .from('saved_items')
        .delete()
        .eq('user_id', user.id);
    } else {
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
    }
  }, [user, storageKey]);

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
