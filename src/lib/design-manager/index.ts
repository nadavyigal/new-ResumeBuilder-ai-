// Design Manager Library - Public API
// Library-first implementation for resume design selection and customization

export { loadTemplate, listAvailableTemplates } from './template-loader';
export { renderTemplatePreview } from './template-renderer';
export { recommendTemplate } from './design-recommender';
export { interpretDesignRequest } from './customization-engine';
export { canUndo, performUndo } from './undo-manager';
export { validateCustomization } from './ats-validator';
