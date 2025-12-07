#!/usr/bin/env node
/**
 * Template Sync Script
 *
 * Copies React templates from external library (resume-style-bank) to project
 * and generates auto-registry for dynamic imports
 *
 * Source: C:\Users\nadav\OneDrive\מסמכים\AI\cursor\cursor playground\AI Travel Club\resume-style-bank\react
 * Target: resume-builder-ai/src/lib/templates/external/
 *
 * Reference: research.md Step 1 implementation
 */

import * as fs from 'fs-extra';
import * as path from 'path';

// Configuration
const EXTERNAL_TEMPLATES_SOURCE = path.resolve(
  'C:\\Users\\nadav\\OneDrive\\מסמכים\\AI\\cursor\\cursor playground\\AI Travel Club\\resume-style-bank\\react'
);

const TARGET_DIR = path.resolve(__dirname, '../src/lib/templates/external');

const TEMPLATE_SLUGS = ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'];

// Files to include in sync (exclude package.json, render.js)
const INCLUDE_EXTENSIONS = ['.jsx', '.tsx', '.ts', '.js'];
const EXCLUDE_FILES = ['package.json', 'render.js', 'node_modules'];

interface TemplateInfo {
  slug: string;
  name: string;
  sourcePath: string;
  targetPath: string;
  files: string[];
}

/**
 * Main sync function
 */
async function syncTemplates(): Promise<void> {
  console.log('🔄 Starting template sync...\n');

  // Step 1: Validate source directory exists
  if (!fs.existsSync(EXTERNAL_TEMPLATES_SOURCE)) {
    // Check if templates are already synced in target (for production builds)
    const targetExists = fs.existsSync(TARGET_DIR);
    const hasTemplates = targetExists && fs.readdirSync(TARGET_DIR).length > 0;

    if (hasTemplates) {
      console.log('✅ Templates already synced (skipping external source sync for production build)');
      console.log(`📁 Target: ${TARGET_DIR}\n`);
      return;
    }

    throw new Error(`Source directory not found: ${EXTERNAL_TEMPLATES_SOURCE}`);
  }

  console.log(`📂 Source: ${EXTERNAL_TEMPLATES_SOURCE}`);
  console.log(`📁 Target: ${TARGET_DIR}\n`);

  // Step 2: Create target directory
  await fs.ensureDir(TARGET_DIR);

  // Step 3: Sync each template
  const templates: TemplateInfo[] = [];

  for (const slug of TEMPLATE_SLUGS) {
    console.log(`📋 Processing template: ${slug}`);

    const sourcePath = path.join(EXTERNAL_TEMPLATES_SOURCE, slug);
    const targetPath = path.join(TARGET_DIR, slug);

    // Validate template exists
    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️  Template not found: ${sourcePath}. Skipping.`);
      continue;
    }

    // Create target subdirectory
    await fs.ensureDir(targetPath);

    // Copy template files
    const files = await copyTemplateFiles(sourcePath, targetPath, slug);

    templates.push({
      slug,
      name: slugToName(slug),
      sourcePath,
      targetPath,
      files
    });

    console.log(`✅ Synced ${files.length} files for ${slug}\n`);
  }

  // Step 4: Generate auto-registry
  await generateRegistry(templates);

  console.log(`\n✨ Template sync complete! ${templates.length} templates synced.`);
}

/**
 * Copy template files from source to target
 * Also transforms full HTML documents to React components with customization support
 */
async function copyTemplateFiles(
  sourcePath: string,
  targetPath: string,
  slug: string
): Promise<string[]> {
  const files = await fs.readdir(sourcePath);
  const copiedFiles: string[] = [];

  for (const file of files) {
    // Skip excluded files
    if (EXCLUDE_FILES.includes(file)) {
      continue;
    }

    const sourceFile = path.join(sourcePath, file);
    const targetFile = path.join(targetPath, file);

    // Only copy files with allowed extensions
    const ext = path.extname(file);
    if (INCLUDE_EXTENSIONS.includes(ext)) {
      // Transform Resume.jsx files to add customization support
      if (file === 'Resume.jsx') {
        await transformAndCopyTemplate(sourceFile, targetFile, slug);
      } else {
        await fs.copy(sourceFile, targetFile, { overwrite: true });
      }
      copiedFiles.push(file);
      console.log(`  📄 Copied: ${file}`);
    }
  }

  return copiedFiles;
}

/**
 * Transform full HTML template to React component with customization support
 * Removes <html>, <head>, <body> wrappers and adds customization prop
 */
async function transformAndCopyTemplate(
  sourceFile: string,
  targetFile: string,
  slug: string
): Promise<void> {
  const content = await fs.readFile(sourceFile, 'utf-8');

  // Check if already transformed (has customization prop)
  if (content.includes('customization')) {
    // Already transformed, copy as-is
    await fs.writeFile(targetFile, content, 'utf-8');
    return;
  }

  // Transform full HTML document to component
  const className = `resume-${slug}`;

  // Extract styles from <style> tag
  const styleMatch = content.match(/<style>\{`([\s\S]*?)`\}<\/style>/);
  const styles = styleMatch ? styleMatch[1] : '';

  // Extract body content (everything between <body> and </body>)
  const bodyMatch = content.match(/<body>([\s\S]*?)<\/body>/);
  const bodyContent = bodyMatch ? bodyMatch[1].trim() : '';

  // Build transformed component
  const transformed = `
import React from 'react';

export default function Resume({ data, customization }) {
  const b = data.basics || {};
  const work = data.work || [];
  const education = data.education || [];
  const skills = data.skills || [];

  // Apply customization if provided
  const colors = customization?.color_scheme || {
    primary: '#111827',
    secondary: '#6b7280',
    accent: '#3b82f6'
  };

  const fonts = customization?.font_family || {
    headings: 'Georgia, "Times New Roman", serif',
    body: 'Georgia, "Times New Roman", serif'
  };

  // Generate unique class name for this instance to avoid style conflicts
  const instanceId = '${className}';

  // Build CSS as a string for inline style tag (SSR-compatible)
  // CRITICAL: Transform CSS selectors carefully to avoid duplicated class names
  // Problem: "body {" → ".resume-X {" then ".resume-X {" → ".resume-X .resume-X {"
  // Solution: Do class selector replacement FIRST, then body replacement
  const cssStyles = \`
    .\${instanceId} * { margin: 0; padding: 0; box-sizing: border-box; }

${styles
  // STEP 1: Transform class selectors first (before body transformation)
  .replace(/\n\s+\.([a-z-]+) \{/g, `\n          .${className} .$1 {`)
  // STEP 2: Transform element selectors (these won't be matched by class regex)
  .replace(/\n\s+header \{/g, `\n          .${className} header {`)
  .replace(/\n\s+h1 \{/g, `\n          .${className} h1 {`)
  .replace(/\n\s+h2 \{/g, `\n          .${className} h2 {`)
  .replace(/\n\s+h3 \{/g, `\n          .${className} h3 {`)
  .replace(/\n\s+aside \{/g, `\n          aside {`)
  .replace(/\n\s+main \{/g, `\n          main {`)
  .replace(/\n\s+section \{/g, `\n          section {`)
  .replace(/\n\s+ul \{/g, `\n          ul {`)
  .replace(/\n\s+li \{/g, `\n          li {`)
  // STEP 3: Transform body LAST (creates .className which won't match the class regex above)
  .replace(/body \{/g, `.${className} {`)
  // STEP 4: Apply color/font customization
  .replace(/#000/g, '\${colors.primary}')
  .replace(/#333/g, '\${colors.secondary}')
  .replace(/#555/g, '\${colors.secondary}')
  .replace(/Georgia, 'Times New Roman', serif/g, '\${fonts.body}')
  .split('\n')
  .map(line => '    ' + line)
  .join('\n')}
  \`;

  return (
    <div className={instanceId} style={{
      fontFamily: fonts.body,
      maxWidth: '850px',
      margin: '0 auto',
      padding: '60px 40px',
      color: colors.primary,
      background: '#fff',
      lineHeight: '1.6'
    }}>
      {/* Use regular style tag instead of styled-jsx for SSR compatibility */}
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />

${bodyContent.split('\n').map(line => '      ' + line).join('\n')}
    </div>
  );
}
`;

  await fs.writeFile(targetFile, transformed, 'utf-8');
}

/**
 * Generate auto-registry file with template imports
 */
async function generateRegistry(templates: TemplateInfo[]): Promise<void> {
  console.log('\n📝 Generating template registry...');

  const registryPath = path.join(TARGET_DIR, 'index.ts');

  const imports = templates
    .map((t) => `import ${slugToPascalCase(t.slug)} from './${t.slug}/Resume';`)
    .join('\n');

  const registry = templates
    .map((t) => `  '${t.slug}': ${slugToPascalCase(t.slug)}`)
    .join(',\n');

  const content = `/**
 * Auto-generated Template Registry
 * Generated by: scripts/sync-external-templates.ts
 * Last Updated: ${new Date().toISOString()}
 *
 * DO NOT EDIT MANUALLY - Changes will be overwritten on next sync
 */

${imports}

export interface TemplateComponent {
  (props: any): JSX.Element;
}

export const TEMPLATE_REGISTRY: Record<string, TemplateComponent> = {
${registry}
};

export function getExternalTemplate(templateId: string): TemplateComponent | null {
  return TEMPLATE_REGISTRY[templateId] || null;
}

export function listExternalTemplates(): string[] {
  return Object.keys(TEMPLATE_REGISTRY);
}

export default TEMPLATE_REGISTRY;
`;

  await fs.writeFile(registryPath, content, 'utf-8');
  console.log(`✅ Registry generated: ${registryPath}`);
}

/**
 * Convert slug to human-readable name
 */
function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Convert slug to PascalCase for component name
 */
function slugToPascalCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

// Execute sync
if (require.main === module) {
  syncTemplates()
    .then(() => {
      console.log('\n✅ Template sync completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Template sync failed:', error);
      process.exit(1);
    });
}

export { syncTemplates };
