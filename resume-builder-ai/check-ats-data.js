const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('optimizations')
    .select('ats_version, ats_score_original, ats_score_optimized, ats_subscores, ats_suggestions')
    .eq('id', '48d03b2d-6f05-43e4-938f-f1b4b22b1008')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('ATS Version:', data.ats_version);
    console.log('ATS Score Original:', data.ats_score_original);
    console.log('ATS Score Optimized:', data.ats_score_optimized);
    console.log('Has Subscores:', data.ats_subscores ? 'YES' : 'NO');
    console.log('Has Suggestions:', data.ats_suggestions ? 'YES' : 'NO');
    console.log('Number of Suggestions:', data.ats_suggestions?.length || 0);
    if (data.ats_subscores) {
      console.log('Subscores:', JSON.stringify(data.ats_subscores, null, 2));
    }
    if (data.ats_suggestions && data.ats_suggestions.length > 0) {
      console.log('\nFirst 3 suggestions:');
      data.ats_suggestions.slice(0, 3).forEach((s, i) => {
        console.log(`  ${i+1}. ${s.text} (+${s.impact} pts)`);
      });
    }
  }
})();
