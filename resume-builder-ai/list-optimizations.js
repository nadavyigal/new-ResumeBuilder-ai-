const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('optimizations')
    .select('id, created_at, ats_version, ats_score_optimized, ats_subscores, ats_suggestions')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${data.length} recent optimizations:\n`);
    data.forEach((opt, i) => {
      console.log(`${i+1}. ID: ${opt.id}`);
      console.log(`   Created: ${opt.created_at}`);
      console.log(`   ATS Version: ${opt.ats_version || 'N/A'}`);
      console.log(`   Score: ${opt.ats_score_optimized || 'N/A'}`);
      console.log(`   Has Subscores: ${opt.ats_subscores ? 'YES' : 'NO'}`);
      console.log(`   Has Suggestions: ${opt.ats_suggestions ? 'YES (' + opt.ats_suggestions.length + ')' : 'NO'}`);
      console.log('');
    });
  }
})();
