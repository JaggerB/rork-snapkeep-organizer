# Clear Old Base64 Images from Database

## Quick Instructions

Since the script can't connect due to network/SSL issues, here's how to clear the old data manually via Supabase Dashboard:

### Method 1: SQL Editor (Fastest)

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Create a new query and paste this SQL:

```sql
-- Delete all items from saved_items table
DELETE FROM saved_items;

-- Verify it's empty
SELECT COUNT(*) FROM saved_items;
```

5. Click **Run** or press Cmd+Enter
6. You should see `DELETE X` where X is the number of rows deleted (should be 15)

### Method 2: Table Editor

1. Go to your Supabase dashboard
2. Select your project
3. Click **Table Editor** in the left sidebar
4. Select the `saved_items` table
5. You'll see all rows (but they might load slowly due to large base64 images)
6. Select all rows and delete them

**Note**: Method 1 (SQL Editor) is much faster and won't timeout like the table editor might.

### After Clearing:

1. The app will automatically reload and show the empty state
2. Add a new screenshot using the + button
3. The new screenshot will automatically upload to Supabase Storage
4. Images will load instantly from CDN URLs instead of timing out

### Why We're Doing This:

- Old items have ~3.7MB base64 images stored directly in the database
- This causes Supabase query timeouts (60 seconds)
- New items will use Supabase Storage with lightweight URLs
- Much faster and more reliable!
