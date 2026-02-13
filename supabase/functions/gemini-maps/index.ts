// Supabase Edge Function: Gemini Maps Grounding
// Calls Vertex AI with Google Maps grounding
// Deploy: supabase functions deploy gemini-maps
// Secrets: GCP_PROJECT_ID, GCP_LOCATION, GOOGLE_APPLICATION_CREDENTIALS_JSON

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleAuth } from "npm:google-auth-library@9.4.1";

const PROJECT_ID = Deno.env.get("GCP_PROJECT_ID");
const LOCATION = Deno.env.get("GCP_LOCATION") || "us-central1";
const CREDENTIALS_JSON = Deno.env.get("GOOGLE_APPLICATION_CREDENTIALS_JSON");

async function getAccessToken(): Promise<string> {
  if (!CREDENTIALS_JSON) throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON not set");
  const creds = JSON.parse(CREDENTIALS_JSON);
  const auth = new GoogleAuth({ credentials: creds });
  const tokenResponse = await auth.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error("Failed to get access token");
  return token;
}

async function callVertexAI(
  prompt: string,
  lat?: number,
  lng?: number,
  imageBase64?: string,
  imageMimeType?: string
): Promise<{ text: string; groundingChunks?: unknown[] }> {
  const token = await getAccessToken();
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-2.0-flash:generateContent`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];
  if (imageBase64 && imageMimeType) {
    parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    tools: [{ googleMaps: { enableWidget: false } }],
  };

  if (lat != null && lng != null) {
    body.toolConfig = {
      retrievalConfig: {
        latLng: { latitude: lat, longitude: lng },
        languageCode: "en_US",
      },
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertex AI error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text || "";
  const groundingChunks = candidate?.groundingMetadata?.groundingChunks;

  return { text, groundingChunks };
}

function parseJsonFromText(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  if (!PROJECT_ID || !CREDENTIALS_JSON) {
    return new Response(JSON.stringify({ error: "Maps grounding not configured. Set GCP_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS_JSON." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    const { action, ...body } = await req.json();

    if (action === "verify") {
      const { title, location, coordinates, imageBase64, imageMimeType } = body as {
        title: string;
        location?: string;
        coordinates?: { latitude: number; longitude: number };
        imageBase64?: string;
        imageMimeType?: string;
      };
      const lat = coordinates?.latitude;
      const lng = coordinates?.longitude;

      const context = [title ? `Place name: "${title}"` : "", location ? `Location/address: ${location}` : ""].filter(Boolean).join("\n");
      const prompt = `Identify this place on Google Maps${imageBase64 ? " using the image" : ""}${context ? " and the details below" : ""}. Be precise - return the EXACT place from Google Maps.
${context || (imageBase64 ? "The image shows a place, venue, or establishment." : "")}

If you can identify the place, respond with ONLY valid JSON:
{"placeId":"<place_id from grounding>","placeMapsUri":"<Google Maps URL>","rating":"<e.g. 4.5>","openNow":<true/false>,"openingHours":"<e.g. Open until 10pm>","reviewSnippet":"<one short review excerpt>","websiteUri":"<official website URL if available>","reservationUrl":"<direct reservation/booking URL if available - e.g. OpenTable, Resy, or the place's booking page for restaurants, hotels>"}
If not found, respond: {"placeId":null,"placeMapsUri":null,"rating":null,"openNow":null,"openingHours":null,"reviewSnippet":null,"websiteUri":null,"reservationUrl":null}`;

      const { text, groundingChunks } = await callVertexAI(prompt, lat, lng, imageBase64, imageMimeType);
      const parsed = parseJsonFromText(text);

      let placeMapsUri = parsed.placeMapsUri as string | null;
      if (!placeMapsUri && groundingChunks?.[0]) {
        const chunk = groundingChunks[0] as { maps?: { uri?: string } };
        placeMapsUri = chunk.maps?.uri ?? null;
      }

      return new Response(
        JSON.stringify({
          placeId: parsed.placeId ?? null,
          placeMapsUri: placeMapsUri ?? parsed.placeMapsUri ?? null,
          rating: parsed.rating ?? null,
          openNow: parsed.openNow ?? null,
          openingHours: parsed.openingHours ?? null,
          reviewSnippet: parsed.reviewSnippet ?? null,
          websiteUri: parsed.websiteUri ?? null,
          reservationUrl: parsed.reservationUrl ?? null,
        }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (action === "live-status") {
      const { placeId, title, coordinates } = body as { placeId?: string; title: string; coordinates?: { latitude: number; longitude: number } };
      const lat = coordinates?.latitude;
      const lng = coordinates?.longitude;

      const prompt = `For the place "${title}"${placeId ? ` (place ID: ${placeId})` : ""}, what is the current status? 
Respond with ONLY valid JSON:
{"openNow":<true/false>,"rating":"<e.g. 4.5>","openingHours":"<e.g. Open until 10pm>","reviewSnippet":"<one short recent review excerpt>"}
If unknown: {"openNow":null,"rating":null,"openingHours":null,"reviewSnippet":null}`;

      const { text } = await callVertexAI(prompt, lat, lng);
      const parsed = parseJsonFromText(text);

      return new Response(
        JSON.stringify({
          openNow: parsed.openNow ?? null,
          rating: parsed.rating ?? null,
          openingHours: parsed.openingHours ?? null,
          reviewSnippet: parsed.reviewSnippet ?? null,
        }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (action === "itinerary") {
      const { items, userQuery } = body as {
        items: Array<{ id: string; title: string; location?: string; coordinates?: { latitude: number; longitude: number }; dateTimeISO?: string }>;
        userQuery?: string;
      };

      const itemsDesc = items
        .map((i, idx) => `${idx + 1}. ${i.title}${i.location ? ` (${i.location})` : ""}${i.dateTimeISO ? ` [${i.dateTimeISO}]` : ""}`)
        .join("\n");

      const coords = items.find((i) => i.coordinates)?.coordinates;
      const lat = coords?.latitude;
      const lng = coords?.longitude;

      const prompt = `Given these saved places:
${itemsDesc}

${userQuery || "Suggest the best order to visit these places, considering walking distance and logical flow."}

Respond with ONLY valid JSON:
{"summary":"<2-3 sentence overview>","orderedItems":[{"itemId":"<id>","order":1,"suggestion":"<optional tip>"},...],"walkingNotes":"<optional walking/directions notes>"}`;

      const { text } = await callVertexAI(prompt, lat, lng);
      const parsed = parseJsonFromText(text);

      return new Response(
        JSON.stringify({
          summary: parsed.summary ?? "",
          orderedItems: parsed.orderedItems ?? [],
          walkingNotes: parsed.walkingNotes ?? null,
        }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[gemini-maps]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
