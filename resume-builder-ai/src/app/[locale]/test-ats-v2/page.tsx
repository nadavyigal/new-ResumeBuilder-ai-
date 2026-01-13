/**
 * ATS v2 Test Page
 *
 * Quick test page to verify ATS v2 components and scoring system
 */

import { ATSScoreCard } from '@/components/ats/ATSScoreCard';
import { SubScoreBreakdown } from '@/components/ats/SubScoreBreakdown';
import { SuggestionsList } from '@/components/ats/SuggestionsList';
import type { ATSScoreOutput } from '@/lib/ats/types';

// Sample data for testing
const sampleScoreData: ATSScoreOutput = {
  ats_score_original: 45,
  ats_score_optimized: 78,
  subscores: {
    keyword_exact: 72,
    keyword_phrase: 68,
    semantic_relevance: 85,
    title_alignment: 80,
    metrics_presence: 65,
    section_completeness: 90,
    format_parseability: 95,
    recency_fit: 75,
  },
  subscores_original: {
    keyword_exact: 35,
    keyword_phrase: 40,
    semantic_relevance: 50,
    title_alignment: 45,
    metrics_presence: 30,
    section_completeness: 70,
    format_parseability: 60,
    recency_fit: 55,
  },
  suggestions: [
    {
      id: 'kw_001',
      text: 'Add exact term "TypeScript" to Skills and latest role achievements',
      estimated_gain: 8,
      quick_win: true,
      category: 'keywords',
      targets: ['skills', 'experience'],
    },
    {
      id: 'kw_002',
      text: 'Include 3 missing must-have keywords: React, Node.js, GraphQL',
      estimated_gain: 12,
      quick_win: false,
      category: 'keywords',
      targets: ['skills', 'experience'],
    },
    {
      id: 'fmt_001',
      text: 'Switch to ATS-safe template (single column, no graphics)',
      estimated_gain: 15,
      quick_win: true,
      category: 'formatting',
      targets: ['template'],
    },
    {
      id: 'met_001',
      text: 'Add quantifiable metrics to latest 2 roles (e.g., "Improved performance by 40%")',
      estimated_gain: 10,
      quick_win: false,
      category: 'metrics',
      targets: ['experience'],
    },
    {
      id: 'kp_001',
      text: 'Include phrase "full-stack development" in your summary and experience',
      estimated_gain: 7,
      quick_win: true,
      category: 'keywords',
      targets: ['summary', 'experience'],
    },
  ],
  confidence: 0.85,
  metadata: {
    version: 2,
    scored_at: new Date(),
    processing_time_ms: 2340,
    warnings: [],
    analyzers_used: [
      'keyword_exact',
      'keyword_phrase',
      'semantic_relevance',
      'title_alignment',
      'metrics_presence',
      'section_completeness',
      'format_parseability',
      'recency_fit',
    ],
    cache_stats: {
      embeddings_cached: true,
      cache_key: 'test_cache_key',
    },
  },
};

export default function ATSTestPage() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ATS v2 Test Page</h1>
        <p className="text-gray-600">
          Testing the new multi-dimensional ATS scoring system with sample data
        </p>
      </div>

      <div className="space-y-6">
        {/* Score Card */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Score Comparison</h2>
          <ATSScoreCard scoreData={sampleScoreData} />
        </section>

        {/* Sub-Score Breakdown */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Sub-Score Breakdown</h2>
          <SubScoreBreakdown
            subscores={sampleScoreData.subscores}
            subscores_original={sampleScoreData.subscores_original}
            showComparison={true}
          />
        </section>

        {/* Suggestions */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Improvement Suggestions</h2>
          <SuggestionsList
            suggestions={sampleScoreData.suggestions}
            maxSuggestions={10}
          />
        </section>

        {/* Metadata */}
        <section className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Scoring Metadata</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Scoring Time:</span>{' '}
              {sampleScoreData.metadata.processing_time_ms}ms
            </div>
            <div>
              <span className="font-medium">Confidence:</span>{' '}
              {(sampleScoreData.confidence * 100).toFixed(0)}%
            </div>
            <div>
              <span className="font-medium">Embeddings Cached:</span>{' '}
              {sampleScoreData.metadata.cache_stats?.embeddings_cached ? 'Yes' : 'No'}
            </div>
            <div>
              <span className="font-medium">Analyzers Used:</span>{' '}
              {sampleScoreData.metadata.analyzers_used.length}/8
            </div>
          </div>
        </section>

        {/* API Test Button */}
        <section>
          <h2 className="text-xl font-semibold mb-4">API Endpoint Test</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-sm text-gray-700 mb-4">
              To test the actual scoring API, use the endpoint:
            </p>
            <code className="block bg-white p-4 rounded border text-sm overflow-x-auto">
              POST http://localhost:3007/api/ats/score
            </code>
            <p className="text-sm text-gray-700 mt-4 mb-2">
              Sample request body:
            </p>
            <pre className="bg-white p-4 rounded border text-xs overflow-x-auto">
{`{
  "resume_original": {
    "basics": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "work": [...],
    "skills": [...]
  },
  "resume_optimized": {
    "basics": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "work": [...],
    "skills": [...]
  },
  "job_description": "Looking for a Senior Software Engineer with TypeScript, React, and Node.js experience..."
}`}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
