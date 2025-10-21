import { NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * Health Check API
 *
 * Verifies that:
 * 1. API server is running
 * 2. OpenAI API key is configured
 * 3. OpenAI API is accessible (optional ping)
 */
export async function GET() {
  const checks = {
    server: 'ok',
    openai_key_configured: false,
    openai_accessible: false,
    timestamp: new Date().toISOString(),
  };

  // Check if OpenAI API key is configured
  const apiKey = process.env.OPENAI_API_KEY;
  checks.openai_key_configured = !!apiKey && apiKey !== 'invalid-key-placeholder';

  // Optionally test OpenAI API connectivity
  if (checks.openai_key_configured && apiKey) {
    try {
      const openai = new OpenAI({ apiKey });

      // Simple API call to verify the key works
      await openai.models.list();
      checks.openai_accessible = true;
    } catch (error) {
      console.error('OpenAI API check failed:', error);
      checks.openai_accessible = false;
    }
  }

  const isHealthy = checks.server === 'ok' && checks.openai_key_configured && checks.openai_accessible;

  return NextResponse.json(checks, {
    status: isHealthy ? 200 : 503,
  });
}
