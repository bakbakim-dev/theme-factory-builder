import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const files = {
  converter: path.join(root, 'utils', 'converter.ts'),
  pluginTemplates: path.join(root, 'utils', 'plugintemplates.ts'),
};

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function findLine(content, needle) {
  const index = content.indexOf(needle);
  if (index === -1) return null;
  return content.slice(0, index).split(/\r?\n/).length;
}

function findRegexLine(content, regex) {
  const match = content.match(regex);
  if (!match || match.index == null) return null;
  return content.slice(0, match.index).split(/\r?\n/).length;
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function makeFinding({ id, severity, filePath, line, summary, detail }) {
  return { id, severity, filePath, line, summary, detail };
}

function collectFindings() {
  const converter = readFile(files.converter);
  const pluginTemplates = readFile(files.pluginTemplates);
  const findings = [];

  const push = (finding) => {
    if (finding.line == null) return;
    findings.push(finding);
  };

  push(makeFinding({
    id: 'render-container-passthrough',
    severity: 'critical',
    filePath: files.pluginTemplates,
    line: findRegexLine(pluginTemplates, /public static function render_container\(\s*\$attributes,\s*\$content\s*\)\s*\{\s*return \$content;/),
    summary: 'Container PHP render callback is a passthrough.',
    detail: 'The wrapper should be owned by PHP for dynamic container blocks.'
  }));

  push(makeFinding({
    id: 'render-button-passthrough',
    severity: 'critical',
    filePath: files.pluginTemplates,
    line: findRegexLine(pluginTemplates, /public static function render_button\(\s*\$attributes,\s*\$content\s*\)\s*\{\s*return \$content;/),
    summary: 'Button PHP render callback is a passthrough.',
    detail: 'Custom buttons should render from typed attributes instead of trusting saved HTML.'
  }));

  push(makeFinding({
    id: 'importer-mutates-classes',
    severity: 'critical',
    filePath: files.pluginTemplates,
    line: findLine(pluginTemplates, 'private static function fix_block_classes($blocks) {'),
    summary: 'Importer still rewrites serialized block markup.',
    detail: 'Post-conversion markup surgery is a common source of Gutenberg validation drift.'
  }));

  push(makeFinding({
    id: 'importer-injects-page-shell-html',
    severity: 'critical',
    filePath: files.pluginTemplates,
    line: findLine(pluginTemplates, '<div class="wp-block-theme-factory-page-shell '),
    summary: 'Importer injects wrapper HTML into the page shell block.',
    detail: 'The importer should wrap block comments only and let the dynamic render callback own the shell markup.'
  }));

  if (findLine(pluginTemplates, '"customStyle": { "type": "object", "default": {} }') == null) {
    findings.push(makeFinding({
      id: 'container-modern-style-attribute-missing',
      severity: 'critical',
      filePath: files.pluginTemplates,
      line: 1,
      summary: 'Container block metadata is missing the typed customStyle attribute.',
      detail: 'The modern container contract should store extra wrapper styles in a typed object instead of a raw string.'
    }));
  }

  if (findLine(pluginTemplates, '"htmlAttributes": { "type": "object", "default": {} }') == null) {
    findings.push(makeFinding({
      id: 'container-modern-html-attributes-missing',
      severity: 'critical',
      filePath: files.pluginTemplates,
      line: 1,
      summary: 'Container block metadata is missing the typed htmlAttributes attribute.',
      detail: 'Interactive wrapper props should be represented as a typed, whitelisted object instead of a JSON string blob.'
    }));
  }

  push(makeFinding({
    id: 'container-editor-spread',
    severity: 'critical',
    filePath: files.pluginTemplates,
    line: findLine(pluginTemplates, '...extraProps'),
    summary: 'Container edit() still spreads parsed wrapper props into useBlockProps.',
    detail: 'This keeps the wrapper contract open-ended and difficult to validate.'
  }));

  push(makeFinding({
    id: 'button-group-faked-via-container',
    severity: 'critical',
    filePath: files.converter,
    line: findLine(converter, 'wp-block-theme-factory-container wp-block-buttons'),
    summary: 'Adjacent buttons are still grouped through theme-factory/container.',
    detail: 'Button groups should use core/buttons or the explicit theme-factory/buttons block.'
  }));

  if (findLine(converter, 'function createCoreButtonBlock(') == null) {
    findings.push(makeFinding({
      id: 'native-button-path-missing',
      severity: 'critical',
      filePath: files.converter,
      line: 1,
      summary: 'Converter has no conservative native core/button emission path.',
      detail: 'Safe buttons should map to real core/button blocks for native editing.'
    }));
  }

  push(makeFinding({
    id: 'container-extra-attributes-serialization',
    severity: 'critical',
    filePath: files.converter,
    line: findLine(converter, 'attributes.extraAttributes = JSON.stringify(extraAttrs);'),
    summary: 'Converter still serializes legacy extraAttributes blobs.',
    detail: 'Interactive wrapper props should flow through the typed htmlAttributes object instead.'
  }));

  push(makeFinding({
    id: 'container-style-string-serialization',
    severity: 'critical',
    filePath: files.converter,
    line: findRegexLine(converter, /theme-factory\/container[\s\S]{0,400}attributes\.style\s*=/),
    summary: 'Converter still serializes container style back into a raw string.',
    detail: 'The live contract should keep container wrapper styles in the typed customStyle object.'
  }));

  push(makeFinding({
    id: 'container-save-innerblocks',
    severity: 'warning',
    filePath: files.pluginTemplates,
    line: findRegexLine(pluginTemplates, /registerBlockType\('theme-factory\/container'[\s\S]*?save:\s*function\(\)\s*\{\s*return el\(InnerBlocks\.Content\);\s*\}/),
    summary: 'Container is a dynamic block that still saves InnerBlocks.Content.',
    detail: 'That is allowed, but it raises the bar for keeping the wrapper contract and PHP render path tightly aligned.'
  }));

  push(makeFinding({
    id: 'container-default-custom',
    severity: 'warning',
    filePath: files.converter,
    line: findLine(converter, "trackBlock(ctx, 'theme-factory/container');"),
    summary: 'Converter still relies heavily on theme-factory/container.',
    detail: 'That is more stable than guessing core wrapper markup, but the repo still needs a stronger native-vs-custom classifier over time.'
  }));

  push(makeFinding({
    id: 'core-html-emergency-paths',
    severity: 'warning',
    filePath: files.converter,
    line: findLine(converter, 'return `<!-- wp:html -->\\n${html}\\n<!-- /wp:html -->`;'),
    summary: 'Converter still relies on core/html for complex structures.',
    detail: 'Some of these are acceptable escape hatches, but they should stay exceptional and measurable.'
  }));

  push(makeFinding({
    id: 'validation-needs-roundtrip-harness',
    severity: 'warning',
    filePath: files.converter,
    line: findLine(converter, 'function validateCustomBlockContracts(markup: string): { isValid: boolean; errors: string[] } {'),
    summary: 'Validation still lacks a real reopen/resave harness.',
    detail: 'The generator now checks structural and contract rules, but it still needs editor reopen/resave regression coverage for the highest confidence.'
  }));

  return findings;
}

function printReport(findings) {
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.filePath.localeCompare(b.filePath) || a.line - b.line);

  const critical = findings.filter((f) => f.severity === 'critical').length;
  const warning = findings.filter((f) => f.severity === 'warning').length;

  console.log('Theme Factory block-contract audit');
  console.log(`Critical: ${critical}`);
  console.log(`Warnings: ${warning}`);
  console.log('');

  for (const finding of findings) {
    console.log(`[${finding.severity.toUpperCase()}] ${finding.summary}`);
    console.log(`  File: ${rel(finding.filePath)}:${finding.line}`);
    console.log(`  Why:  ${finding.detail}`);
    console.log('');
  }
}

const findings = collectFindings();
printReport(findings);

if (process.argv.includes('--strict') && findings.some((f) => f.severity === 'critical')) {
  process.exitCode = 1;
}
