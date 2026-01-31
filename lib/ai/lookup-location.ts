import { z } from "zod";
import { generateObject } from "@rork-ai/toolkit-sdk";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export type LocationLookupResult = {
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  mapsUrl: string | null;
};

const LocationSchema = z.object({
  latitude: z
    .number()
    .describe("Latitude coordinate of the location")
    .nullable(),
  longitude: z
    .number()
    .describe("Longitude coordinate of the location")
    .nullable(),
  formattedAddress: z
    .string()
    .describe("Full formatted address of the location")
    .nullable(),
  city: z
    .string()
    .describe("City name if identifiable")
    .nullable(),
  country: z
    .string()
    .describe("Country name if identifiable")
    .nullable(),
});

const LOCATION_PROMPT = [
  "You are a precise location lookup assistant. Given location details, provide exact geographic coordinates.",
  "",
  "Instructions:",
  "- Use ALL provided address components (street, neighborhood, city, state) to find the EXACT location.",
  "- Many businesses have multiple locations (e.g. Death & Co has NYC, LA, Denver locations). Use city/neighborhood to identify the correct one.",
  "- If a street address is provided, use it for precision - don't just return city center coordinates.",
  "- For well-known restaurants/bars/venues, use your knowledge of their actual street addresses.",
  "- If you cannot determine coordinates with reasonable confidence, return null values.",
  "- Be as precise as possible - accuracy matters for map pins.",
  "",
  "IMPORTANT: Return ONLY valid JSON with these fields: latitude (number or null), longitude (number or null), formattedAddress (string or null), city (string or null), country (string or null).",
].join("\n");

async function lookupWithGemini(
  locationName: string, 
  title?: string, 
  context?: string,
  streetAddress?: string | null,
  neighborhood?: string | null,
  city?: string | null,
  state?: string | null,
  country?: string | null
): Promise<z.infer<typeof LocationSchema>> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  
  console.log('[lookupLocationCoordinates] Using Gemini fallback');
  
  const fullAddressParts = [streetAddress, neighborhood, city, state, country].filter(Boolean);
  const fullAddress = fullAddressParts.length > 0 ? fullAddressParts.join(', ') : null;
  
  const prompt = [
    LOCATION_PROMPT,
    "",
    `Place/Venue Name: ${locationName}`,
    streetAddress ? `Street Address: ${streetAddress}` : "",
    neighborhood ? `Neighborhood: ${neighborhood}` : "",
    city ? `City: ${city}` : "",
    state ? `State: ${state}` : "",
    country ? `Country: ${country}` : "",
    title ? `Context (title): ${title}` : "",
    context ? `Additional context: ${context}` : "",
    "",
    fullAddress ? `Find the exact coordinates for: ${locationName} at ${fullAddress}` : `Find the exact coordinates for: ${locationName}`,
  ].filter(Boolean).join("\n");
  
  const response = await withTimeout(
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
          }
        })
      }
    ),
    30000,
    'Location lookup timed out'
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[lookupLocationCoordinates] Gemini error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }
  
  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textContent) {
    throw new Error('No content in Gemini response');
  }
  
  let jsonStr = textContent.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  
  const parsed = JSON.parse(jsonStr);
  return LocationSchema.parse(parsed);
}

export async function lookupLocationCoordinates(params: {
  locationName: string;
  title?: string;
  context?: string;
  streetAddress?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): Promise<LocationLookupResult> {
  const { locationName, title, context, streetAddress, neighborhood, city, state, country } = params;

  const fullAddressParts = [
    streetAddress,
    neighborhood,
    city,
    state,
    country,
  ].filter(Boolean);
  
  const fullAddress = fullAddressParts.length > 0 ? fullAddressParts.join(', ') : null;
  
  console.log("[lookupLocationCoordinates] starting for:", locationName);
  console.log("[lookupLocationCoordinates] full address context:", fullAddress);

  let lastError: Error | null = null;

  // Try Rork service first
  try {
    console.log('[lookupLocationCoordinates] Trying Rork service...');
    const result = await withTimeout(
      generateObject({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                LOCATION_PROMPT,
                "",
                `Place/Venue Name: ${locationName}`,
                streetAddress ? `Street Address: ${streetAddress}` : "",
                neighborhood ? `Neighborhood: ${neighborhood}` : "",
                city ? `City: ${city}` : "",
                state ? `State: ${state}` : "",
                country ? `Country: ${country}` : "",
                title ? `Context (title): ${title}` : "",
                context ? `Additional context: ${context}` : "",
                "",
                fullAddress ? `Find the exact coordinates for: ${locationName} at ${fullAddress}` : `Find the exact coordinates for: ${locationName}`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
      ],
        schema: LocationSchema,
      }),
      30000,
      'Rork location lookup timed out'
    );

    console.log("[lookupLocationCoordinates] Rork result", result);

    const hasCoords = result.latitude !== null && result.longitude !== null;
    
    let mapsUrl: string | null = null;
    if (hasCoords) {
      const query = encodeURIComponent(
        result.formattedAddress || locationName
      );
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${result.latitude},${result.longitude}`;
    }

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.formattedAddress,
      mapsUrl,
    };
  } catch (err) {
    console.error("[lookupLocationCoordinates] Rork error", err);
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  // Fallback to Gemini
  if (GEMINI_API_KEY) {
    console.log('[lookupLocationCoordinates] Falling back to Gemini...');
    try {
      const result = await lookupWithGemini(locationName, title, context, streetAddress, neighborhood, city, state, country);
      
      console.log("[lookupLocationCoordinates] Gemini result", result);

      const hasCoords = result.latitude !== null && result.longitude !== null;
      
      let mapsUrl: string | null = null;
      if (hasCoords) {
        const query = encodeURIComponent(
          result.formattedAddress || locationName
        );
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${result.latitude},${result.longitude}`;
      }

      return {
        latitude: result.latitude,
        longitude: result.longitude,
        formattedAddress: result.formattedAddress,
        mapsUrl,
      };
    } catch (err) {
      console.error("[lookupLocationCoordinates] Gemini error", err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  console.error("[lookupLocationCoordinates] all attempts failed", lastError);
  return {
    latitude: null,
    longitude: null,
    formattedAddress: null,
    mapsUrl: null,
  };
}

export function generateGoogleMapsUrl(params: {
  latitude?: number | null;
  longitude?: number | null;
  query?: string | null;
}): string | null {
  const { latitude, longitude, query } = params;

  if (latitude != null && longitude != null) {
    const q = query ? encodeURIComponent(query) : `${latitude},${longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  return null;
}
