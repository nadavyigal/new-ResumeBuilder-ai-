const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Check the most recent optimization
  const { data, error } = await supabase
    .from('optimizations')
    .select('id, created_at, ats_version, ats_score_original, ats_score_optimized, ats_subscores, ats_suggestions')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Most Recent Optimization:');
    console.log('  ID:', data.id);
    console.log('  Created:', data.created_at);
    console.log('  ATS Version:', data.ats_version);
    console.log('  Score Original:', data.ats_score_original);
    console.log('  Score Optimized:', data.ats_score_optimized);
    console.log('  Has Subscores:', data.ats_subscores ? 'YES' : 'NO');
    console.log('  Has Suggestions:', data.ats_suggestions ? `YES (${data.ats_suggestions.length})` : 'NO');

    if (data.ats_subscores) {
      console.log('\n  Subscores:');
      Object.entries(data.ats_subscores).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
    }

    if (data.ats_suggestions && data.ats_suggestions.length > 0) {
      console.log('\n  First 3 Tips:');
      data.ats_suggestions.slice(0, 3).forEach((s, i) => {
        console.log(`    ${i+1}. ${s.text} (+${s.impact} pts)`);
      });
    }
  }
})();
