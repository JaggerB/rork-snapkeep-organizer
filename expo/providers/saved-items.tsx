import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { readAsStringAsync } from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "@/lib/supabase";
import { fetchCoordinatesFromPlaceId, lookupLocationCoordinates } from "@/lib/ai/lookup-location";

const CACHE_KEY_PREFIX = "saved_items_cache_";

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
  // Maps grounding (from Gemini + Google Maps)
  placeId?: string | null;
  placeMapsUri?: string | null;
  rating?: string | null;
  openNow?: boolean | null;
  openingHours?: string | null;
  reviewSnippet?: string | null;
  websiteUri?: string | null;
  reservationUrl?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
};


export function createId(): string {
  const random = Math.random().toString(16).slice(2);
  return `it_${Date.now().toString(16)}_${random}`;
}

// Images are now uploaded to Supabase Storage for better performance
// and reliability. Storage URLs are stored in the database instead of base64.

export const [SavedItemsProvider, useSavedItems] = createContextHook(() => {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // No longer need separate image loading - Storage URLs are fast to query

  // Load items from Supabase
  const persistCache = useCallback(async (itemsToCache: SavedItem[]) => {
    if (!user) return;
    try {
      await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${user.id}`, JSON.stringify(itemsToCache));
    } catch (_) {}
  }, [user]);

  const loadFromSupabase = useCallback(async () => {
    if (!user) return [];

    const minimalColumns = 'id, user_id, title, notes, category, source, location, coordinates, maps_url, date_time_iso, trip_id, image_uri, created_at';
    const extendedColumns = `${minimalColumns}, place_id, place_maps_uri, rating, open_now, opening_hours, review_snippet, website_uri, reservation_url`;

    try {
      console.log('[SavedItems] Loading from Supabase for user:', user.id);
      let data: Record<string, unknown>[] | null = null;

      const { data: fullData, error: fullError } = await supabase
        .from('saved_items')
        .select(extendedColumns)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fullError?.code === '42703') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('saved_items')
          .select(minimalColumns)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (fallbackError) {
          console.error('[SavedItems] Supabase load error:', fallbackError);
          return [];
        }
        data = fallbackData;
      } else if (fullError) {
        console.error('[SavedItems] Supabase load error:', fullError);
        return [];
      } else {
        data = fullData;
      }

      const normalizeCoords = (c: unknown): Coordinates | null => {
        if (!c || typeof c !== "object") return null;
        const o = c as Record<string, unknown>;
        const lat = Number(o.latitude ?? o.lat);
        const lng = Number(o.longitude ?? o.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng))
          return { latitude: lat, longitude: lng };
        return null;
      };

      const transformed = (data || []).map((row: Record<string, unknown>) => ({
        id: row.id,
        createdAt: row.created_at,
        title: row.title,
        notes: row.notes,
        category: row.category,
        imageUri: row.image_uri,
        source: row.source,
        location: row.location,
        coordinates: normalizeCoords(row.coordinates),
        mapsUrl: row.maps_url,
        dateTimeISO: row.date_time_iso,
        tripId: row.trip_id,
        placeId: row.place_id,
        placeMapsUri: row.place_maps_uri,
        rating: row.rating,
        openNow: row.open_now,
        openingHours: row.opening_hours,
        reviewSnippet: row.review_snippet,
        websiteUri: row.website_uri ?? undefined,
        reservationUrl: row.reservation_url ?? undefined,
      }));

      console.log('[SavedItems] Loaded', transformed.length, 'items from Supabase');
      return transformed;
    } catch (e) {
      console.error('[SavedItems] Supabase load exception:', e);
      return [];
    }
  }, [user]);


  // Load items on mount: show cache immediately, then refresh from Supabase
  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    const load = async () => {
      if (!user) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      const cacheKey = `${CACHE_KEY_PREFIX}${user.id}`;

      // 1. Load from cache first for instant display
      let hadCache = false;
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as SavedItem[];
          setItems(parsed);
          hadCache = true;
        }
      } catch (_) {
        // Ignore cache parse errors
      }

      if (!hadCache) setIsLoading(true);
      try {
        const supabaseItems = await loadFromSupabase();
        setItems(supabaseItems);
        await persistCache(supabaseItems);
      } catch (e) {
        console.warn('[SavedItems] Load error, continuing with cached/empty state:', e);
        // Keep cached items if fetch failed
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user, authLoading, loadFromSupabase, persistCache]);

  const addItem = useCallback(
    async (item: SavedItem): Promise<void> => {
      console.log('[SavedItems] addItem called for:', item.title);

      // Require user to be logged in
      if (!user) {
        console.warn('[SavedItems] Cannot add item: user not logged in');
        throw new Error('User not logged in');
      }

      // Optimistic update - add to local state immediately
      setItems((prev) => [item, ...prev]);

      let imageUri = item.imageUri;

      try {
        // Convert file:// to base64 if needed (e.g. when collect couldn't convert)
        if (imageUri && imageUri.startsWith('file://') && !imageUri.startsWith('data:image')) {
          try {
            const base64 = await readAsStringAsync(imageUri, { encoding: 'base64' });
            const ext = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
            imageUri = `data:image/${ext};base64,${base64}`;
          } catch (e) {
            console.warn('[SavedItems] Could not read file as base64:', e);
          }
        }
        // If we have a base64 image, upload to Supabase Storage
        if (imageUri && imageUri.startsWith('data:image')) {
          console.log('[SavedItems] Uploading image to Storage...');

          try {
            // Extract base64 data (React Native compatible approach)
            const base64Data = imageUri.split(',')[1];

            // Decode base64 to binary string, then to Uint8Array
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Upload to storage with user-specific path
            const filePath = `${user.id}/${item.id}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from('screenshots')
              .upload(filePath, bytes, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (uploadError) {
              throw uploadError;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('screenshots')
              .getPublicUrl(filePath);

            imageUri = publicUrl;
            console.log('[SavedItems] Image uploaded successfully, URL:', publicUrl);

            // Update local state with storage URL
            setItems((prev) => prev.map(it =>
              it.id === item.id ? { ...it, imageUri } : it
            ));
          } catch (storageError: any) {
            console.warn('[SavedItems] Storage upload failed (likely iOS simulator):', storageError.message);
            try {
              const base64Data = imageUri.split(',')[1];
              const cacheDir = FileSystem.cacheDirectory;
              if (cacheDir) {
                const dir = `${cacheDir}screenshots`;
                await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
                const filePath = `${dir}/${item.id}.jpg`;
                await FileSystem.writeAsStringAsync(filePath, base64Data, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                imageUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
                setItems((prev) => prev.map(it =>
                  it.id === item.id ? { ...it, imageUri } : it
                ));
              }
            } catch (fileError: any) {
              console.warn('[SavedItems] Could not write image to cache:', fileError?.message);
            }
            if (imageUri.startsWith('data:image')) {
              setItems((prev) => prev.map(it =>
                it.id === item.id ? { ...it, imageUri: null } : it
              ));
            }
          }
        }

        // Insert into Supabase (never store data:image - use null if upload failed)
        const safeImageUri = imageUri && !String(imageUri).startsWith('data:image') ? imageUri : null;
        const insertPayload: Record<string, unknown> = {
          id: item.id,
          user_id: user.id,
          title: item.title,
          notes: item.notes,
          category: item.category,
          image_uri: safeImageUri,
          source: item.source,
          location: item.location,
          coordinates: item.coordinates,
          maps_url: item.mapsUrl ?? item.placeMapsUri,
          date_time_iso: item.dateTimeISO,
          trip_id: item.tripId,
          place_id: item.placeId,
          place_maps_uri: item.placeMapsUri,
          rating: item.rating,
          open_now: item.openNow,
          opening_hours: item.openingHours,
          review_snippet: item.reviewSnippet,
        };
        const fullPayload = { ...insertPayload, website_uri: item.websiteUri, reservation_url: item.reservationUrl };

        let { error } = await supabase.from('saved_items').insert(fullPayload);

        if (error?.code === '42703') {
          ({ error } = await supabase.from('saved_items').insert(insertPayload));
        }
        if (error?.code === '42703') {
          const minimalPayload = {
            id: item.id,
            user_id: user.id,
            title: item.title,
            category: item.category,
            image_uri: safeImageUri,
            source: item.source,
            location: item.location,
            coordinates: item.coordinates,
            maps_url: item.mapsUrl ?? item.placeMapsUri,
            date_time_iso: item.dateTimeISO,
            trip_id: item.tripId,
            notes: item.notes,
          };
          ({ error } = await supabase.from('saved_items').insert(minimalPayload));
        }

        if (error) {
          console.error('[SavedItems] Supabase insert error:', error);
          setItems((prev) => prev.filter(it => it.id !== item.id));
          throw new Error(`Database error: ${error.message}`);
        }

        console.log('[SavedItems] Successfully saved:', item.id);
        setItems((prev) => {
          persistCache(prev);
          return prev;
        });
      } catch (e) {
        console.error('[SavedItems] Supabase insert exception:', e);
        // Rollback optimistic update
        setItems((prev) => prev.filter(it => it.id !== item.id));
        throw e;
      }
    },
    [user, persistCache]
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

      const updatePayload: Record<string, unknown> = {
        title: patch.title,
        notes: patch.notes,
        category: patch.category,
        location: patch.location,
        coordinates: patch.coordinates,
        maps_url: patch.mapsUrl,
        date_time_iso: patch.dateTimeISO,
        trip_id: patch.tripId,
        place_id: patch.placeId,
        place_maps_uri: patch.placeMapsUri,
        rating: patch.rating,
        open_now: patch.openNow,
        opening_hours: patch.openingHours,
        review_snippet: patch.reviewSnippet,
      };
      const fullPayload = { ...updatePayload, website_uri: patch.websiteUri, reservation_url: patch.reservationUrl };

      let { error } = await supabase.from('saved_items').update(fullPayload).eq('id', id).eq('user_id', user.id);

      if (error?.code === '42703') {
        ({ error } = await supabase.from('saved_items').update(updatePayload).eq('id', id).eq('user_id', user.id));
      }

      if (error) {
        console.error('[SavedItems] Supabase update error:', error);
        // Rollback - reload from server to get fresh data
        const fresh = await loadFromSupabase();
        setItems(fresh);
      } else {
        setItems((prev) => {
          persistCache(prev);
          return prev;
        });
      }
    },
    [user, loadFromSupabase, persistCache]
  );

  const removeItem = useCallback(
    async (id: string) => {
      // Require user to be logged in
      if (!user) {
        console.warn('[SavedItems] Cannot remove item: user not logged in');
        return;
      }

      // Optimistic update - capture removed item using functional update
      let removedItem: SavedItem | undefined;
      setItems((prev) => {
        removedItem = prev.find(it => it.id === id);
        return prev.filter((it) => it.id !== id);
      });

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
      } else {
        setItems((prev) => {
          persistCache(prev);
          return prev;
        });
      }
    },
    [user, persistCache]
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

  const refreshItems = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const fresh = await loadFromSupabase();
      setItems(fresh);
    } finally {
      setIsLoading(false);
    }
  }, [user, loadFromSupabase]);

  const backfilledIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || items.length === 0) return;
    const needsCoords = items.filter(
      (it) =>
        (!it.coordinates || it.coordinates.latitude == null || it.coordinates.longitude == null) &&
        (it.placeId || it.location || it.title) &&
        !backfilledIdsRef.current.has(it.id)
    );
    const toProcess = needsCoords.slice(0, 3);
    if (toProcess.length === 0) return;
    toProcess.forEach((it) => backfilledIdsRef.current.add(it.id));
    (async () => {
      for (const it of toProcess) {
        try {
          let coords: { latitude: number; longitude: number } | null = null;
          let mapsUrl: string | null = null;
          if (it.placeId) {
            const res = await fetchCoordinatesFromPlaceId(it.placeId);
            if (res?.latitude && res?.longitude) {
              coords = { latitude: res.latitude, longitude: res.longitude };
              mapsUrl = res.mapsUrl;
            }
          }
          if (!coords && (it.location || it.title)) {
            const query = [it.title, it.location].filter(Boolean).join(", ");
            const res = await lookupLocationCoordinates({ locationName: query, title: it.title || undefined });
            if (res?.latitude && res?.longitude) {
              coords = { latitude: res.latitude, longitude: res.longitude };
              mapsUrl = res.mapsUrl;
            }
          }
          if (coords) {
            await updateItem(it.id, { coordinates: coords, mapsUrl: mapsUrl ?? undefined });
          }
        } catch (e) {
          console.warn("[SavedItems] Backfill coords failed for", it.id, e);
        }
      }
    })();
  }, [items, user, updateItem]);

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
    refreshItems,
  };
});
