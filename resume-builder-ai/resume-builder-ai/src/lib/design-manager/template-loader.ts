/**
 * Template Loader Module
 * Loads external templates from the synced templates directory
 *
 * Reference: research.md template loading decision
 * Task: T017
 */

import { getExternalTemplate, listExternalTemplates } from '../templates/external';

export interface TemplateComponent {
  (props: any): JSX.Element;
}

/**
 * Loads a template component by ID (slug)
 * @param templateId - Template slug (e.g., 'card-ssr', 'minimal-ssr')
 * @returns Template component function
 * @throws Error if template not found
 */
export async function loadTemplate(templateId: string): Promise<TemplateComponent> {
  const template = await getExternalTemplate(templateId);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return template;
}

/**
 * Lists all available template IDs from the registry
 * @returns Array of template slugs
 */
export function listAvailableTemplates(): string[] {
  return listExternalTemplates();
}

/**
 * Validates that a template exists
 * @param templateId - Template slug to validate
 * @returns true if template exists, false otherwise
 */
export function validateTemplate(templateId: string): boolean {
  return listExternalTemplates().includes(templateId);
}

/**
 * Gets template metadata without loading the component
 * @param templateId - Template slug
 * @returns Template metadata or null if not found
 */
export function getTemplateMetadata(templateId: string): { slug: string; exists: boolean } | null {
  const exists = validateTemplate(templateId);

  if (!exists) {
    return null;
  }

  return {
    slug: templateId,
    exists: true
  };
}
