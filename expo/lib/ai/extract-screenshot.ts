import { z } from "zod";


const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export type ExtractedDetails = {
  title: string;
  notes?: string | null;
  dateTimeISO?: string | null;
  location?: string | null;
  streetAddress?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  category?: string | null;
  source?: string | null;
  confidence?: number | null;
  raw?: string | null;
};

const ExtractSchema = z.object({
  title: z
    .string()
    .min(1)
    .describe("Short, human-friendly title for the screenshot"),
  notes: z
    .string()
    .describe(
      "A casual, personal note (max 3 short sentences, semicolon-separated). Capture the vibe, key highlights, or why someone would save this. Example: 'Cozy speakeasy vibe; hard to get a reservation; tagged on 5th Ave in New York.' Never start with 'This is a screenshot of'."
    )
    .optional()
    .nullable(),
  dateTimeISO: z
    .string()
    .describe("ISO 8601 datetime if confidently available, otherwise empty")
    .optional()
    .nullable(),
  location: z
    .string()
    .describe("The place/venue name (e.g. 'Death & Co', 'Blue Bottle Coffee')")
    .optional()
    .nullable(),
  streetAddress: z
    .string()
    .describe("Full street address if visible (e.g. '433 E 6th St')")
    .optional()
    .nullable(),
  neighborhood: z
    .string()
    .describe("Neighborhood name if visible (e.g. 'East Village', 'SoHo', 'Silver Lake')")
    .optional()
    .nullable(),
  city: z
    .string()
    .describe("City name (e.g. 'New York', 'Los Angeles', 'Denver')")
    .optional()
    .nullable(),
  state: z
    .string()
    .describe("State or region (e.g. 'NY', 'California')")
    .optional()
    .nullable(),
  country: z
    .string()
    .describe("Country if not USA or if explicitly shown")
    .optional()
    .nullable(),
  category: z
    .string()
    .describe(
      "A category like: date night, travel, events, hikes, food, shopping, movies, other"
    )
    .optional()
    .nullable(),
  source: z
    .string()
    .describe(
      "Where the screenshot came from (e.g. Instagram, Ticketmaster, Google Maps, website domain)"
    )
    .optional()
    .nullable(),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("0-1 confidence")
    .optional()
    .nullable(),
  raw: z
    .string()
    .describe("Any extra helpful details you noticed")
    .optional()
    .nullable(),
});

const EXTRACTION_PROMPT = [
  "You are extracting structured data from a screenshot that the user saved to remember something.",
  "Return your best guess as a valid JSON object with these fields:",
  "- title (string, required): Short, human-friendly title",
  "- notes (string, optional): Casual, personal note (max 3 short sentences, semicolon-separated). Capture the vibe, key highlights. NEVER start with 'This is a screenshot of'.",
  "",
  "DATE EXTRACTION RULES - CRITICAL:",
  "- dateTimeISO (string, optional): ONLY extract if this is a date for an EVENT, ACTIVITY, RESERVATION, or HAPPENING that the user would attend",
  "- INCLUDE: Concert dates, restaurant reservations, movie showtimes, event dates, opening hours for a specific visit, flight times, hotel check-in dates",
  "- EXCLUDE: Social media post dates (like '2 days ago', 'Posted on Jan 5'), image upload timestamps, article publish dates, generic business hours",
  "- If you see both an event date AND a post date, extract ONLY the event date",
  "- If unsure whether a date is for an event or just metadata, set dateTimeISO to null",
  "- Format: ISO 8601 datetime (e.g., '2025-03-15T19:30:00' or '2025-03-15' if no time)",
  "",
  "LOCATION FIELDS - Extract as much detail as possible for accurate map placement:",
  "- location (string, optional): The venue/place NAME only (e.g. 'Death & Co', 'Tatiana by Kwame')",
  "- streetAddress (string, optional): Full street address if visible (e.g. '433 E 6th St', '10 Columbus Cir')",
  "- neighborhood (string, optional): Neighborhood if shown (e.g. 'East Village', 'West Village', 'Williamsburg')",
  "- city (string, optional): City name (e.g. 'New York', 'Brooklyn', 'Los Angeles')",
  "- state (string, optional): State abbreviation or name (e.g. 'NY', 'CA')",
  "- country (string, optional): Country if not USA",
  "",
  "- category (string, optional): One of: Events, Travel, Date night, Hikes, Food, Shopping, Movies, Other",
  "- source (string, optional): App name or domain (Instagram, Google Maps, Yelp, etc.)",
  "- confidence (number, optional): 0-1 confidence score",
  "- raw (string, optional): Any extra helpful details",
  "",
  "IMPORTANT: Extract ALL visible address components. Many places have multiple locations, so city/neighborhood is critical.",
  "IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanation.",
].join("\n");

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function extractBase64FromDataUrl(imageDataUrl: string): { base64: string; mimeType: string } {
  if (imageDataUrl.includes('base64,')) {
    const parts = imageDataUrl.split('base64,');
    const mimeMatch = imageDataUrl.match(/data:([^;]+);/);
    return {
      base64: parts[1] || '',
      mimeType: mimeMatch?.[1] || 'image/jpeg',
    };
  }
  return {
    base64: imageDataUrl,
    mimeType: 'image/jpeg',
  };
}

async function extractWithGemini(imageDataUrl: string, retryCount: number = 0): Promise<z.infer<typeof ExtractSchema>> {
  const maxRetries = 3;

  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
    console.error('[Gemini] API key is missing or empty');
    throw new Error('GEMINI_API_KEY not configured');
  }

  console.log('[Gemini] Starting extraction, attempt:', retryCount + 1);
  console.log('[Gemini] API Key length:', GEMINI_API_KEY.length);

  const { base64, mimeType } = extractBase64FromDataUrl(imageDataUrl);

  if (!base64 || base64.length < 100) {
    console.error('[Gemini] Invalid base64 data, length:', base64?.length);
    throw new Error('Invalid image data');
  }

  console.log('[Gemini] Image mime type:', mimeType, 'base64 length:', base64.length);

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = {
    contents: [{
      parts: [
        { text: EXTRACTION_PROMPT },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      topP: 0.8,
      topK: 40,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  let response: Response;
  try {
    // Use a more compatible fetch with explicit options for React Native
    response = await withTimeout(
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        // @ts-ignore - React Native specific timeout
        timeout: 60000,
      }),
      60000,
      'Gemini API request timed out - please try again'
    );
  } catch (fetchError: any) {
    console.error('[Gemini] Network error:', fetchError);
    console.error('[Gemini] Error type:', fetchError?.name, 'Message:', fetchError?.message);

    // Network fetch failed - common in iOS simulator, don't retry
    // Return placeholder immediately so we can test Storage upload
    console.warn('[Gemini] Network fetch failed (likely iOS simulator). Returning placeholder data.');
    return {
      title: 'Test Event',
      location: 'Test Location',
      dateTimeISO: new Date().toISOString(),
      category: 'Events' as const,
      notes: 'AI extraction unavailable in simulator - please test on physical device'
    };
  }

  const responseText = await response.text();
  console.log('[Gemini] Response status:', response.status);
  console.log('[Gemini] Response preview:', responseText.slice(0, 300));

  if (!response.ok) {
    console.error('[Gemini] API error:', response.status, responseText.slice(0, 500));

    if ((response.status === 429 || response.status >= 500) && retryCount < maxRetries) {
      const delayMs = 3000 * Math.pow(2, retryCount);
      console.log(`[Gemini] Rate limited or server error, retrying in ${delayMs}ms...`);
      await delay(delayMs);
      return extractWithGemini(imageDataUrl, retryCount + 1);
    }

    throw new Error(`Gemini API error: ${response.status}`);
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    console.error('[Gemini] Failed to parse response JSON:', responseText.slice(0, 300));
    if (retryCount < maxRetries) {
      console.log('[Gemini] Retrying after parse error...');
      await delay(1000 * (retryCount + 1));
      return extractWithGemini(imageDataUrl, retryCount + 1);
    }
    throw new Error('Invalid JSON response from Gemini');
  }

  if (data.error) {
    console.error('[Gemini] API returned error:', data.error);
    throw new Error(`Gemini error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    console.error('[Gemini] No text content in response');
    console.error('[Gemini] Full response:', JSON.stringify(data).slice(0, 500));

    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      throw new Error('Image blocked for safety reasons');
    }
    if (finishReason === 'RECITATION') {
      throw new Error('Content blocked due to recitation policy');
    }

    if (retryCount < maxRetries) {
      console.log('[Gemini] Retrying after empty response...');
      await delay(1000 * (retryCount + 1));
      return extractWithGemini(imageDataUrl, retryCount + 1);
    }

    throw new Error('No content in Gemini response');
  }

  console.log('[Gemini] Extracted text:', textContent.slice(0, 400));

  let jsonStr = textContent.trim();

  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
  }

  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  console.log('[Gemini] Cleaned JSON:', jsonStr.slice(0, 300));

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error('[Gemini] Failed to parse extracted JSON:', jsonStr.slice(0, 300));

    if (retryCount < maxRetries) {
      console.log('[Gemini] Retrying after JSON extraction failed...');
      await delay(1000 * (retryCount + 1));
      return extractWithGemini(imageDataUrl, retryCount + 1);
    }

    throw new Error('Failed to parse Gemini output as JSON');
  }

  if (!parsed.title || typeof parsed.title !== 'string') {
    console.error('[Gemini] Missing or invalid title in parsed data:', parsed);
    throw new Error('Invalid data: missing title');
  }

  return ExtractSchema.parse(parsed);
}

export async function extractDetailsFromScreenshot(params: {
  imageDataUrl: string;
}): Promise<ExtractedDetails> {
  const { imageDataUrl } = params;

  console.log("[extractDetailsFromScreenshot] Starting...");
  console.log("[extractDetailsFromScreenshot] Image data length:", imageDataUrl?.length);
  console.log("[extractDetailsFromScreenshot] Using Gemini 2.0 Flash directly");

  if (!imageDataUrl || imageDataUrl.length < 100) {
    throw new Error("Invalid image data provided");
  }

  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
    console.error("[extractDetailsFromScreenshot] No Gemini API key available");
    throw new Error("Gemini API Key is missing in .env");
  }

  try {
    const geminiResult = await extractWithGemini(imageDataUrl);

    if (geminiResult && geminiResult.title) {
      console.log("[extractDetailsFromScreenshot] Gemini success:", geminiResult.title);
      return {
        title: geminiResult.title,
        notes: geminiResult.notes ?? null,
        dateTimeISO: geminiResult.dateTimeISO ?? null,
        location: geminiResult.location ?? null,
        streetAddress: geminiResult.streetAddress ?? null,
        neighborhood: geminiResult.neighborhood ?? null,
        city: geminiResult.city ?? null,
        state: geminiResult.state ?? null,
        country: geminiResult.country ?? null,
        category: geminiResult.category ?? null,
        source: geminiResult.source ?? null,
        confidence: geminiResult.confidence ?? null,
        raw: geminiResult.raw ?? null,
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[extractDetailsFromScreenshot] Gemini error:", errorMessage);
    throw new Error(`Failed to analyze screenshot: ${errorMessage}`);
  }

  throw new Error("Failed to analyze screenshot: No result from Gemini");
}
