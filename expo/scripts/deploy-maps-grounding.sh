#!/bin/bash
# Run this after: npx supabase login
# Usage: ./scripts/deploy-maps-grounding.sh

set -e
cd "$(dirname "$0")/.."

PROJECT_REF="suhbyzyisztclbkcnnqm"
JSON_PATH="$HOME/Downloads/gen-lang-client-099746669-3863ec4a4852.json"

# Get project_id from JSON (fallback: gen-lang-client-099746669)
GCP_PROJECT_ID=$(grep -o '"project_id": *"[^"]*"' "$JSON_PATH" | cut -d'"' -f4 || echo "gen-lang-client-099746669")

echo "Linking Supabase project..."
npx supabase link --project-ref "$PROJECT_REF"

echo "Setting secrets..."
npx supabase secrets set GCP_PROJECT_ID="$GCP_PROJECT_ID"
npx supabase secrets set GCP_LOCATION="us-central1"
npx supabase secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat "$JSON_PATH")"

echo "Deploying gemini-maps function..."
npx supabase functions deploy gemini-maps

echo "Done!"
