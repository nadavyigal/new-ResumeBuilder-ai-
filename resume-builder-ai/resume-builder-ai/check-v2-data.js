const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('optimizations')
    .select('id, ats_version, ats_score_original, ats_score_optimized, ats_subscores, ats_suggestions')
    .eq('id', '7945ce67-b7e3-41ed-b98c-14c6cdd30530')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Optimization: 7945ce67-b7e3-41ed-b98c-14c6cdd30530');
    console.log('  ATS Version:', data.ats_version);
    console.log('  Score Original:', data.ats_score_original);
    console.log('  Score Optimized:', data.ats_score_optimized);
    console.log('  Has Subscores:', data.ats_subscores ? 'YES' : 'NO');
    console.log('  Has Suggestions:', data.ats_suggestions ? `YES (${data.ats_suggestions.length})` : 'NO');

    if (!data.ats_subscores) {
      console.log('\n❌ PROBLEM: Missing subscores! This optimization has version 2 but no detailed data.');
    }

    if (!data.ats_suggestions) {
      console.log('❌ PROBLEM: Missing suggestions! No ATS tips available.');
    }

    if (data.ats_subscores) {
      console.log('\n✅ Subscores exist:');
      Object.entries(data.ats_subscores).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
    }

    if (data.ats_suggestions && data.ats_suggestions.length > 0) {
      console.log('\n✅ ATS Tips exist (first 3):');
      data.ats_suggestions.slice(0, 3).forEach((s, i) => {
        console.log(`    ${i+1}. ${s.text} (+${s.impact} pts)`);
      });
    }
  }
})();
