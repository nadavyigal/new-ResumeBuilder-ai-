require('dotenv').config({ path: '.env.local' });

console.log('Environment Check:');
console.log('  Has OpenAI Key:', process.env.OPENAI_API_KEY ? 'YES' : 'NO');
if (process.env.OPENAI_API_KEY) {
  console.log('  Key starts with:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
}
console.log('  Has Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'YES' : 'NO');
console.log('  Has Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'YES' : 'NO');
