/**
 * Chat Manager Library
 *
 * Public API for AI-powered resume chat iteration.
 * Provides conversational interface for refining optimized resumes.
 *
 * @module chat-manager
 */

export { processMessage } from './processor';
export { createAIClient, streamChatResponse } from './ai-client';
export { createSession, resumeSession, closeSession } from './session';
export { createVersion, getVersion, undoVersion } from './versioning';
export { runCLI } from './cli';

export type {
  ProcessMessageInput,
  ProcessMessageOutput,
  AmendmentRequest,
} from './processor';

export type {
  AIClientConfig,
  ChatCompletionOptions,
} from './ai-client';

export type {
  SessionCreateInput,
  SessionResumeInput,
  SessionData,
} from './session';

export type {
  VersionCreateInput,
  VersionData,
} from './versioning';
