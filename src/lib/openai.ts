import OpenAI from "openai";

// Lazy initialization — never call getEnv() at module load time.
// This file is transitively imported by client components via the ats/quick-wins
// import chain. Reading env vars at module level crashes the browser bundle because
// OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY are server-only (not NEXT_PUBLIC_).
let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
}

// Export for use in other files
export { getOpenAI };
