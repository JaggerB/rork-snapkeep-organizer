import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Use service role key for direct SQL access if available
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearAllItems() {
  console.log('🗑️  Clearing all items from saved_items table...');

  try {
    // Use RPC or direct SQL to delete all rows without fetching them
    const { data, error } = await supabase.rpc('delete_all_saved_items');

    if (error && error.code === '42883') {
      // Function doesn't exist, try direct delete with GT operator (bypass RLS efficiently)
      console.log('📝 Using direct delete method...');
      const { error: deleteError, count } = await supabase
        .from('saved_items')
        .delete({ count: 'exact' })
        .gte('created_at', '1970-01-01'); // Match all records efficiently

      if (deleteError) {
        console.error('❌ Error deleting items:', deleteError);
        return;
      }

      console.log(`✅ Successfully deleted ${count || 'all'} items from the database`);
    } else if (error) {
      console.error('❌ Error:', error);
      return;
    } else {
      console.log(`✅ Successfully deleted all items from the database`);
    }

    console.log('🎉 Database is now clean and ready for new Storage-based screenshots!');
  } catch (e) {
    console.error('❌ Exception:', e);
  }
}

clearAllItems();
