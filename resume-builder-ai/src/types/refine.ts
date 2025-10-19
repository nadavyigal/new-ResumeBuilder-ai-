// Shared types for section refinement

export type RefineField = 'bullet' | 'summary' | 'title' | 'skills' | 'custom';

export interface RefineSelection {
  sectionId: string; // e.g., experience-3, summary, skills
  field: RefineField;
  text: string; // exact user-selected text
}

export interface RefineConstraints {
  tone?: 'professional' | 'concise';
  maxChars?: number;
}

export interface RefineSectionRequest {
  resumeId: string;
  selection: RefineSelection;
  jobDescription?: string;
  instruction: string;
  constraints?: RefineConstraints;
}

export type RefineFlag = 'too_vague' | 'potential_embellishment';

export interface RefineSectionResponse {
  suggestion: string;
  keywordsApplied: string[];
  rationale?: string;
  flags?: RefineFlag[];
}



