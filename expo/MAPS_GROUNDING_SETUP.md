# Google Maps Grounding Setup

This app uses **Gemini + Google Maps** for:
- **A** Verify & enrich places when saving from screenshots (place ID, rating, hours, reviews)
- **C** Plan itineraries from saved places (optimal order, walking tips)
- **D** Live status in item modal (open now, current hours, review snippets)

## Requirements

1. **Google Cloud Project** with Vertex AI API enabled
2. **Service account** with Vertex AI User role
3. **Supabase** project (you already have this)

## Step 1: Run the database migration

```bash
# If using Supabase CLI
supabase db push

# Or run this SQL in Supabase Dashboard > SQL Editor
```

```sql
ALTER TABLE saved_items
ADD COLUMN IF NOT EXISTS place_id TEXT,
ADD COLUMN IF NOT EXISTS place_maps_uri TEXT,
ADD COLUMN IF NOT EXISTS rating TEXT,
ADD COLUMN IF NOT EXISTS open_now BOOLEAN,
ADD COLUMN IF NOT EXISTS opening_hours TEXT,
ADD COLUMN IF NOT EXISTS review_snippet TEXT;
```

## Step 2: Deploy the Edge Function

```bash
# Install Supabase CLI if needed: npm i -g supabase

# Login and link your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets (get these from Google Cloud Console)
supabase secrets set GCP_PROJECT_ID=your-gcp-project-id
supabase secrets set GCP_LOCATION=us-central1
supabase secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'

# Deploy
supabase functions deploy gemini-maps
```

## Step 3: Enable Vertex AI

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Vertex AI API** for your project
3. Create a service account with **Vertex AI User** role
4. Download the JSON key and use it for `GOOGLE_APPLICATION_CREDENTIALS_JSON`

## Without setup

If you skip this setup, the app still works. Maps grounding features will be skipped:
- No verification/enrichment on save
- No live status in modal
- Itinerary planning will fail (shows error message)
