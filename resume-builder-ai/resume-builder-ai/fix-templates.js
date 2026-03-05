/**
 * Script to fix CSS scoping issues in all resume templates
 */

const fs = require('fs');
const path = require('path');

const templatesDir = path.join(__dirname, 'src/lib/templates/external');
const templates = ['sidebar-ssr', 'timeline-ssr', 'card-ssr'];

templates.forEach(templateName => {
  const filePath = path.join(templatesDir, templateName, 'Resume.jsx');

  if (!fs.existsSync(filePath)) {
    console.log(`❌ Template not found: ${templateName}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Fix skills keyword display - only show if keywords exist and are non-empty
  content = content.replace(
    /<div className="skill-keywords">\s*\{.*?\.join\(['"],['" ]\)\}\s*<\/div>/gs,
    `{skill.keywords && skill.keywords.length > 0 && (
                          <div className="skill-keywords">
                            {skill.keywords.join(', ')}
                          </div>
                        )}`
  );

  // Fix duplicate nested class selectors like `.template-name .template-name`
  const classPattern = new RegExp(`\\.${templateName}\\s+\\.${templateName}`, 'g');
  content = content.replace(classPattern, `.${templateName}`);

  // Fix unscoped element selectors - add template class prefix
  // aside, main, section, header (but not when already prefixed)
  content = content.replace(/\n\s+(aside|main|section)\s*\{/g, (match, tag) => {
    return `\n    .${templateName} ${tag} {`;
  });

  // Fix malformed selectors like `.job-.template-name header` or `.edu-.template-name header`
  content = content.replace(/\.(job|edu)-\.resume-\w+-ssr\s+header/g, `.${templateName} .$1-header`);

  // Fix unscoped pseudo-selectors like `.highlights li`
  content = content.replace(/\n\s+\.(highlights|job|edu|skill-card)\s+(li|:hover|:before|:after)/g, (match, cls, pseudo) => {
    return `\n    .${templateName} .${cls} ${pseudo}`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Fixed: ${templateName}`);
});

console.log('\n✅ All templates fixed!');
