import { readAsStringAsync } from 'expo-file-system/legacy';

export interface ExtractedData {
  title: string | null;
  category: string | null;
  location: string | null;
  dateTimeISO: string | null;
  description: string | null;
  notes: string | null;
  source: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  priceRange: string | null;
  rating: string | null;
  tags: string[];
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

function getCurrentDateContext(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString('en-US', { month: 'long' });
  return `Current date context: ${month} ${year}`;
}

export async function extractScreenshotData(imageUri: string): Promise<ExtractedData> {
  if (!GEMINI_API_KEY) {
    console.warn('[extractScreenshotData] No Gemini API key configured');
    return getEmptyResult();
  }

  try {
    const base64Image = await readAsStringAsync(imageUri, {
      encoding: 'base64',
    });
    const imageType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const dateContext = getCurrentDateContext();

    const prompt = `You are an expert assistant that extracts comprehensive information from screenshots of places, events, restaurants, travel destinations, and activities.

${dateContext}

Analyze this screenshot thoroughly and extract ALL available information:

1. **title**: The exact name of the place, event, venue, or activity. Be precise.

2. **category**: Classify as ONE of these (choose the most specific):
   - "restaurant" (sit-down dining)
   - "cafe" (coffee shops, bakeries, casual spots)
   - "bar" (bars, pubs, wine bars, cocktail lounges)
   - "event" (concerts, festivals, shows, sports events, exhibitions, races, conferences)
   - "attraction" (landmarks, tourist spots, viewpoints)
   - "museum" (museums, galleries, cultural centers)
   - "hotel" (hotels, resorts, accommodation)
   - "shop" (retail stores, markets, boutiques)
   - "activity" (classes, tours, experiences, adventures)
   - "hike" (trails, nature walks, outdoor activities)
   - "beach" (beaches, coastal spots)
   - "park" (parks, gardens, nature reserves)
   - "nightlife" (clubs, late-night venues)
   - "wellness" (spas, gyms, yoga studios)
   - "other"

3. **location**: Extract the MOST PRECISE address or location for pin-perfect mapping:
   - Full street address (number + street name) if visible
   - Suburb/neighborhood and city
   - State/country
   - For SPORTS EVENTS: Identify the exact stadium/venue and city
   - For places: Include the full address as shown (e.g. "123 Smith St, Fitzroy, Melbourne, Australia")
   - Prioritize precision - a full address maps to an exact pin; a vague "Fitzroy" does not

4. **dateTimeISO**: CRITICAL - ONLY extract dates for actual EVENTS:
   - IMPORTANT: DO NOT use social media post dates as event dates!
   - For restaurants, cafes, bars, shops - return null
   - Return null if this is a regular place (not a time-bound event)

5. **description**: Write exactly 2-3 sentences as if you've researched this place online.

6. **notes**: Any additional practical details.

7. **source**: The app or platform (Instagram, Google Maps, TikTok, etc.)

8. **website**, **instagram**, **tiktok**: Extract if visible for the place/venue.

9. **priceRange**, **rating**: If visible.

10. **tags**: Array of 2-5 relevant keywords.

Respond ONLY with valid JSON:
{
  "title": "string or null",
  "category": "string",
  "location": "string or null",
  "dateTimeISO": "string or null",
  "description": "string or null",
  "notes": "string or null",
  "source": "string or null",
  "website": "string or null",
  "instagram": "string or null",
  "tiktok": "string or null",
  "priceRange": "string or null",
  "rating": "string or null",
  "tags": ["array", "of", "strings"]
}`;

    const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: imageType, data: base64Image } }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[extractScreenshotData] API error:', response.status, errorText);
      return getEmptyResult();
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return getEmptyResult();

    return parseJsonResponse(content);
  } catch (error) {
    console.error('[extractScreenshotData] Error:', error);
    return getEmptyResult();
  }
}

function parseJsonResponse(content: string): ExtractedData {
  try {
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);
    let dateTimeISO = parsed.dateTimeISO || null;
    if (dateTimeISO) {
      const parsedDate = new Date(dateTimeISO);
      if (isNaN(parsedDate.getTime())) dateTimeISO = null;
      else dateTimeISO = parsedDate.toISOString();
    }
    const instagram = parsed.instagram ? parsed.instagram.replace(/^@/, '').trim() : null;
    const tiktok = parsed.tiktok ? parsed.tiktok.replace(/^@/, '').trim() : null;

    return {
      title: parsed.title || null,
      category: parsed.category || null,
      location: parsed.location || null,
      dateTimeISO,
      description: parsed.description || null,
      notes: parsed.notes || null,
      source: parsed.source || null,
      website: parsed.website || null,
      instagram: instagram || null,
      tiktok: tiktok || null,
      priceRange: parsed.priceRange || null,
      rating: parsed.rating || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch (parseError) {
    console.error('[extractScreenshotData] JSON parse error:', parseError);
    return getEmptyResult();
  }
}

function getEmptyResult(): ExtractedData {
  return {
    title: null,
    category: null,
    location: null,
    dateTimeISO: null,
    description: null,
    notes: null,
    source: null,
    website: null,
    instagram: null,
    tiktok: null,
    priceRange: null,
    rating: null,
    tags: [],
  };
}
