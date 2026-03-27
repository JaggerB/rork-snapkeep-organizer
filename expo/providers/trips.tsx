import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "@/lib/supabase";

export type Trip = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  coverImageUri?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createTripId(): string {
  const random = Math.random().toString(16).slice(2);
  return `trip_${Date.now().toString(16)}_${random}`;
}

export const [TripsProvider, useTrips] = createContextHook(() => {
  const { user, isLoading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load trips from Supabase
  const loadTrips = useCallback(async () => {
    if (!user) return [];

    try {
      console.log('[Trips] Loading trips from Supabase for user:', user.id);
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Trips] Supabase load error:', error);
        return [];
      }

      const transformed = (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        startDate: row.start_date,
        endDate: row.end_date,
        coverImageUri: row.cover_image_uri,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      console.log('[Trips] Loaded', transformed.length, 'trips from Supabase');
      return transformed;
    } catch (e) {
      console.error('[Trips] Load exception:', e);
      return [];
    }
  }, [user]);

  // Load trips on mount
  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        if (user) {
          const supabaseTrips = await loadTrips();
          setTrips(supabaseTrips);
        } else {
          console.log('[Trips] No user logged in, clearing trips');
          setTrips([]);
        }
      } catch (e) {
        console.error('[Trips] Load error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user, authLoading, loadTrips]);

  const addTrip = useCallback(
    async (trip: Omit<Trip, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!user) {
        console.warn('[Trips] Cannot add trip: user not logged in');
        return null;
      }

      const newTrip: Trip = {
        id: createTripId(),
        userId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...trip,
      };

      // Optimistic update
      setTrips((prev) => [newTrip, ...prev]);

      try {
        const { error } = await supabase
          .from('trips')
          .insert({
            id: newTrip.id,
            user_id: user.id,
            name: newTrip.name,
            description: newTrip.description,
            start_date: newTrip.startDate,
            end_date: newTrip.endDate,
            cover_image_uri: newTrip.coverImageUri,
          });

        if (error) {
          console.error('[Trips] Supabase insert error:', error);
          // Rollback
          setTrips((prev) => prev.filter(t => t.id !== newTrip.id));
          return null;
        }

        return newTrip;
      } catch (e) {
        console.error('[Trips] Insert exception:', e);
        setTrips((prev) => prev.filter(t => t.id !== newTrip.id));
        return null;
      }
    },
    [user]
  );

  const updateTrip = useCallback(
    async (id: string, patch: Partial<Omit<Trip, 'id' | 'userId' | 'createdAt'>>) => {
      if (!user) {
        console.warn('[Trips] Cannot update trip: user not logged in');
        return;
      }

      const updatedAt = new Date().toISOString();

      // Optimistic update
      setTrips((prev) => prev.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt } : t
      ));

      try {
        const { error } = await supabase
          .from('trips')
          .update({
            name: patch.name,
            description: patch.description,
            start_date: patch.startDate,
            end_date: patch.endDate,
            cover_image_uri: patch.coverImageUri,
            updated_at: updatedAt,
          })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          console.error('[Trips] Supabase update error:', error);
          // Rollback - reload from server
          const freshTrips = await loadTrips();
          setTrips(freshTrips);
        }
      } catch (e) {
        console.error('[Trips] Update exception:', e);
        const freshTrips = await loadTrips();
        setTrips(freshTrips);
      }
    },
    [user, loadTrips]
  );

  const removeTrip = useCallback(
    async (id: string) => {
      if (!user) {
        console.warn('[Trips] Cannot remove trip: user not logged in');
        return;
      }

      const removedTrip = trips.find(t => t.id === id);
      // Optimistic update
      setTrips((prev) => prev.filter((t) => t.id !== id));

      try {
        const { error } = await supabase
          .from('trips')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          console.error('[Trips] Supabase delete error:', error);
          // Rollback
          if (removedTrip) {
            setTrips((prev) => [removedTrip, ...prev]);
          }
        }
      } catch (e) {
        console.error('[Trips] Delete exception:', e);
        if (removedTrip) {
          setTrips((prev) => [removedTrip, ...prev]);
        }
      }
    },
    [user, trips]
  );

  const upcomingTrips = useMemo(() => {
    const now = new Date();
    return trips.filter(t => {
      if (!t.startDate) return false;
      return new Date(t.startDate) >= now;
    }).sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  }, [trips]);

  const pastTrips = useMemo(() => {
    const now = new Date();
    return trips.filter(t => {
      if (!t.endDate) return false;
      return new Date(t.endDate) < now;
    }).sort((a, b) => {
      if (!a.endDate || !b.endDate) return 0;
      return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
    });
  }, [trips]);

  return {
    trips,
    upcomingTrips,
    pastTrips,
    isLoading,
    addTrip,
    updateTrip,
    removeTrip,
  };
});
