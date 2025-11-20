/**
 * Check specific optimization data to verify what's in database vs what's displayed
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOptimization() {
  const optimizationId = '4494cbd4-83f5-4df2-8019-3c6d4d08ed24';

  console.log(`\n🔍 Checking optimization: ${optimizationId}\n`);

  try {
    // Fetch optimization data
    const { data: optimization, error } = await supabase
      .from('optimizations')
      .select('*')
      .eq('id', optimizationId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching optimization:', error);
      return;
    }

    if (!optimization) {
      console.error('❌ Optimization not found');
      return;
    }

    console.log('✅ Optimization found\n');

    // Check ATS scores
    console.log('📊 ATS SCORES:');
    console.log(`   Version: ${optimization.ats_version || 'N/A'}`);
    console.log(`   Original: ${optimization.ats_score_original || 'N/A'}%`);
    console.log(`   Optimized: ${optimization.ats_score_optimized || 'N/A'}%`);
    console.log(`   Match Score (legacy): ${optimization.match_score || 'N/A'}%`);
    console.log('');

    // Check suggestions
    console.log('💡 ATS SUGGESTIONS:');
    const suggestions = optimization.ats_suggestions || [];
    console.log(`   Count: ${suggestions.length}`);
    suggestions.forEach((s, i) => {
      console.log(`   ${i + 1}. [${s.category}] ${s.text.substring(0, 60)}...`);
    });
    console.log('');

    // Check resume data structure
    console.log('📄 RESUME DATA:');
    const resumeData = optimization.rewrite_data || {};
    console.log(`   Has contact: ${!!resumeData.contact}`);
    console.log(`   Has summary: ${!!resumeData.summary}`);
    console.log(`   Has skills: ${!!resumeData.skills}`);
    console.log('');

    // Check skills specifically
    if (resumeData.skills) {
      console.log('🔧 SKILLS SECTION:');
      console.log(`   Technical skills count: ${resumeData.skills.technical?.length || 0}`);
      console.log(`   Soft skills count: ${resumeData.skills.soft?.length || 0}`);

      if (resumeData.skills.technical && resumeData.skills.technical.length > 0) {
        console.log(`   Technical skills: ${resumeData.skills.technical.slice(0, 10).join(', ')}${resumeData.skills.technical.length > 10 ? '...' : ''}`);
      }

      if (resumeData.skills.soft && resumeData.skills.soft.length > 0) {
        console.log(`   Soft skills: ${resumeData.skills.soft.slice(0, 5).join(', ')}${resumeData.skills.soft.length > 5 ? '...' : ''}`);
      }
      console.log('');
    }

    // Check experience
    if (resumeData.experience && resumeData.experience.length > 0) {
      console.log('💼 EXPERIENCE SECTION:');
      console.log(`   Total positions: ${resumeData.experience.length}`);
      const firstExp = resumeData.experience[0];
      console.log(`   First position: ${firstExp.title} at ${firstExp.company}`);
      console.log(`   Achievements count: ${firstExp.achievements?.length || 0}`);
      if (firstExp.achievements && firstExp.achievements.length > 0) {
        console.log(`   First achievement: ${firstExp.achievements[0].substring(0, 100)}...`);
      }
      console.log('');
    }

    // Check timestamps
    console.log('⏰ TIMESTAMPS:');
    console.log(`   Created: ${optimization.created_at}`);
    console.log(`   Updated: ${optimization.updated_at}`);
    console.log('');

    // Summary
    console.log('📋 SUMMARY:');
    console.log(`   - ATS v2 data: ${optimization.ats_version === 2 ? '✅' : '❌'}`);
    console.log(`   - Has subscores: ${optimization.ats_subscores ? '✅' : '❌'}`);
    console.log(`   - Has suggestions: ${suggestions.length > 0 ? '✅' : '❌'}`);
    console.log(`   - Resume structure complete: ${resumeData.contact && resumeData.skills && resumeData.experience ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkOptimization();
