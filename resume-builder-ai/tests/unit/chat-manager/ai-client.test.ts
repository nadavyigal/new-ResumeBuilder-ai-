/**
 * Unit Test: AI Client
 * Library: chat-manager
 *
 * Tests OpenAI integration and streaming
 */

import { describe, it, expect } from '@jest/globals';
import {
  createAIClient,
  buildSystemPrompt,
} from '../../../src/lib/chat-manager/ai-client';

describe('chat-manager/ai-client', () => {
  describe('createAIClient', () => {
    it('should create OpenAI client instance', () => {
      const client = createAIClient({
        apiKey: 'test-key',
      });

      expect(client).toBeDefined();
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build system prompt with resume context', () => {
      const prompt = buildSystemPrompt({
        skills: ['JavaScript', 'React'],
        experience: [],
      });

      expect(prompt).toContain('resume context');
      expect(prompt).toContain('JavaScript');
      expect(prompt).toContain('NEVER fabricate');
    });
  });
});
