/**
 * Maps Grounding - Gemini + Google Maps integration
 *
 * Requires a backend (Supabase Edge Function) that calls Vertex AI.
 * Set EXPO_PUBLIC_SUPABASE_URL and deploy supabase/functions/gemini-maps
 * Configure: GCP_PROJECT_ID, GCP_LOCATION, GOOGLE_APPLICATION_CREDENTIALS_JSON
 */

import { supabase } from "@/lib/supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1` : "";

export type PlaceEnrichment = {
  placeId: string | null;
  placeMapsUri: string | null;
  rating: string | null;
  openNow: boolean | null;
  openingHours: string | null;
  reviewSnippet: string | null;
  websiteUri: string | null;
  reservationUrl: string | null;
};

export type PlaceLiveStatus = {
  openNow: boolean | null;
  rating: string | null;
  openingHours: string | null;
  reviewSnippet: string | null;
};

export type ItineraryPlan = {
  summary: string;
  orderedItems: Array<{ itemId: string; order: number; suggestion?: string }>;
  walkingNotes?: string;
};

async function callMapsBackend(
  action: "verify" | "live-status" | "itinerary",
  body: Record<string, unknown>
): Promise<unknown> {
  if (!FUNCTIONS_URL) {
    console.warn("[maps-grounding] No Supabase URL - Maps grounding disabled");
    return null;
  }

  const url = `${FUNCTIONS_URL}/gemini-maps`;
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...body }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn("[maps-grounding] Backend error:", res.status, err);
    return null;
  }

  return res.json();
}

/**
 * A: Verify & enrich a place when saving from screenshot
 * Pass imageBase64 for image-based place identification (pin-perfect accuracy)
 */
export async function verifyAndEnrichPlace(
  title: string,
  location: string | null,
  coordinates: { latitude: number; longitude: number } | null,
  imageBase64?: string | null,
  imageMimeType?: string
): Promise<PlaceEnrichment> {
  const body: Record<string, unknown> = { title: title || "Place", location, coordinates };
  if (imageBase64 && imageMimeType) {
    body.imageBase64 = imageBase64;
    body.imageMimeType = imageMimeType;
  }
  const result = await callMapsBackend("verify", body) as { placeId?: string; placeMapsUri?: string; rating?: string; openNow?: boolean; openingHours?: string; reviewSnippet?: string; websiteUri?: string; reservationUrl?: string } | null;

  if (!result) {
    return {
      placeId: null,
      placeMapsUri: null,
      rating: null,
      openNow: null,
      openingHours: null,
      reviewSnippet: null,
      websiteUri: null,
      reservationUrl: null,
    };
  }

  return {
    placeId: result.placeId ?? null,
    placeMapsUri: result.placeMapsUri ?? null,
    rating: result.rating ?? null,
    openNow: result.openNow ?? null,
    openingHours: result.openingHours ?? null,
    reviewSnippet: result.reviewSnippet ?? null,
    websiteUri: result.websiteUri ?? null,
    reservationUrl: result.reservationUrl ?? null,
  };
}

/**
 * D: Fetch live status when viewing a saved item
 */
export async function getPlaceLiveStatus(
  placeId: string | null,
  title: string,
  coordinates: { latitude: number; longitude: number } | null
): Promise<PlaceLiveStatus> {
  if (!placeId && !coordinates) return { openNow: null, rating: null, openingHours: null, reviewSnippet: null };

  const result = await callMapsBackend("live-status", {
    placeId,
    title,
    coordinates,
  }) as { openNow?: boolean; rating?: string; openingHours?: string; reviewSnippet?: string } | null;

  if (!result) {
    return { openNow: null, rating: null, openingHours: null, reviewSnippet: null };
  }

  return {
    openNow: result.openNow ?? null,
    rating: result.rating ?? null,
    openingHours: result.openingHours ?? null,
    reviewSnippet: result.reviewSnippet ?? null,
  };
}

/**
 * C: Plan itinerary from saved places
 */
export async function planItinerary(
  items: Array<{ id: string; title: string; location?: string | null; coordinates?: { latitude: number; longitude: number } | null; dateTimeISO?: string | null }>,
  userQuery?: string
): Promise<ItineraryPlan | null> {
  if (items.length === 0) return null;

  const result = await callMapsBackend("itinerary", {
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      location: i.location,
      coordinates: i.coordinates,
      dateTimeISO: i.dateTimeISO,
    })),
    userQuery: userQuery || "Suggest the best order to visit these places, considering walking distance and logical flow.",
  }) as { summary?: string; orderedItems?: Array<{ itemId: string; order: number; suggestion?: string }>; walkingNotes?: string } | null;

  if (!result || !result.orderedItems?.length) return null;

  return {
    summary: result.summary || "",
    orderedItems: result.orderedItems,
    walkingNotes: result.walkingNotes,
  };
}
