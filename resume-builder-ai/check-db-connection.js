const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Has Anon Key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Try with service role key to bypass RLS
  const { data, error, count } = await supabase
    .from('optimizations')
    .select('id, created_at, ats_version', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nQuery Result:');
  console.log('  Error:', error);
  console.log('  Count:', count);
  console.log('  Rows:', data?.length || 0);

  if (data && data.length > 0) {
    console.log('\n  Recent optimizations:');
    data.forEach((opt, i) => {
      console.log(`    ${i+1}. ${opt.id} (v${opt.ats_version || '?'}) - ${opt.created_at}`);
    });
  }
})();
