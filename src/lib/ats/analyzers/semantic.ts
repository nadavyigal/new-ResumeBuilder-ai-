/**
 * Semantic Analyzer
 *
 * Analyzes semantic similarity using OpenAI embeddings.
 * Compares resume sections to job requirements beyond keywords.
 * Weight: 0.16
 */

import { BaseAnalyzer } from './base';
import type { AnalyzerInput, AnalyzerResult } from '../types';
import { getEmbedding, cosineSimilarity } from '../utils/embeddings';
import { SEMANTIC_THRESHOLDS } from '../config/thresholds';
import { extractSectionText } from '../extractors/resume-text-extractor';

export class SemanticAnalyzer extends BaseAnalyzer {
  constructor() {
    super('semantic_relevance');
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    try {
      // If keyword_exact score is too low, cap semantic score to prevent inflation
      const keywordScore = await this.getKeywordScore(input);
      const shouldCap = keywordScore < SEMANTIC_THRESHOLDS.keyword_cap_threshold;

      // Extract key sections from resume
      const sections = this.extractResumeSections(input);

      if (sections.length === 0) {
        return this.createFailedResult('No resume sections to analyze', 30);
      }

      // Get embeddings for job description
      const jdEmbedding = await getEmbedding(input.job_text);

      // Find top-k most similar sections
      const sectionSimilarities = await Promise.all(
        sections.map(async section => {
          const sectionEmbedding = await getEmbedding(section.text);
          const similarity = cosineSimilarity(jdEmbedding.vector, sectionEmbedding.vector);

          return {
            section: section.name,
            text: section.text,
            similarity: (similarity + 1) / 2, // Normalize to 0-1
          };
        })
      );

      // Sort by similarity and take top-k
      sectionSimilarities.sort((a, b) => b.similarity - a.similarity);
      const topK = sectionSimilarities.slice(0, SEMANTIC_THRESHOLDS.top_k_sections);

      // Calculate average similarity of top-k sections
      const avgSimilarity = topK.reduce((sum, s) => sum + s.similarity, 0) / topK.length;
      let score = avgSimilarity * 100;

      // Apply cap if keyword score is too low
      if (shouldCap && score > SEMANTIC_THRESHOLDS.capped_semantic_max) {
        score = SEMANTIC_THRESHOLDS.capped_semantic_max;
      }

      const confidence = this.calculateConfidence({
        hasRequiredData: true,
        dataCompleteness: sections.length >= 3 ? 1.0 : 0.8,
        parsingErrors: 0,
      });

      return this.createResult(
        score,
        {
          topSections: topK.map(s => ({
            section: s.section,
            similarity: Math.round(s.similarity * 100),
          })),
          averageSimilarity: Math.round(avgSimilarity * 100),
          capped: shouldCap && score === SEMANTIC_THRESHOLDS.capped_semantic_max,
        },
        confidence
      );
    } catch (error) {
      return this.createFailedResult(
        `Semantic analysis failed: ${(error as Error).message}`,
        50 // Fallback to neutral score
      );
    }
  }

  /**
   * Extract meaningful sections from resume for semantic comparison
   */
  private extractResumeSections(input: AnalyzerInput): Array<{ name: string; text: string }> {
    const sections: Array<{ name: string; text: string }> = [];

    if (!input.resume_json) {
      // Fallback: split resume text into paragraphs
      const paragraphs = input.resume_text.split('\n\n').filter(p => p.trim().length > 50);
      return paragraphs.map((text, i) => ({ name: `section_${i}`, text }));
    }

    // Extract structured sections
    const summary = extractSectionText(input.resume_json, 'summary');
    if (summary) sections.push({ name: 'summary', text: summary });

    const skills = extractSectionText(input.resume_json, 'skills');
    if (skills) sections.push({ name: 'skills', text: skills });

    const experience = extractSectionText(input.resume_json, 'experience');
    if (experience) sections.push({ name: 'experience', text: experience });

    // Split experience into individual roles if too long
    if (input.resume_json.experience && input.resume_json.experience.length > 0) {
      input.resume_json.experience.slice(0, 3).forEach((exp, i) => {
        const expText = [
          exp.title,
          exp.company,
          ...(exp.achievements || [])
        ].filter(Boolean).join('. ');

        if (expText.length > 30) {
          sections.push({ name: `role_${i}`, text: expText });
        }
      });
    }

    return sections.filter(s => s.text.length > 30); // Filter very short sections
  }

  /**
   * Get keyword score from previous analysis (if available)
   * This is a simplified version - in real implementation, would access shared state
   */
  private async getKeywordScore(input: AnalyzerInput): Promise<number> {
    // Simplified keyword check
    const resumeWords = new Set(this.tokenize(input.resume_text));
    const mustHaveWords = new Set(
      input.job_data.must_have.flatMap(skill => this.tokenize(skill))
    );

    if (mustHaveWords.size === 0) return 50;

    const matchedCount = Array.from(mustHaveWords).filter(word =>
      resumeWords.has(word)
    ).length;

    return (matchedCount / mustHaveWords.size) * 100;
  }
}
