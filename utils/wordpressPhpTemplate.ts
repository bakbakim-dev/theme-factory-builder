const PHP_STRING_ASSIGNMENT = /\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(["'])((?:\\.|(?!\2)[\s\S])*?)\2\s*;/g;
const PHP_HEREDOC_ASSIGNMENT = /\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*<<<\s*["']?([A-Za-z0-9_]+)["']?\s*\r?\n([\s\S]*?)\r?\n\2\s*;/g;

const unescapePhpString = (value: string): string => value
  .replace(/\\n/g, '\n')
  .replace(/\\r/g, '\r')
  .replace(/\\t/g, '\t')
  .replace(/\\"/g, '"')
  .replace(/\\'/g, "'")
  .replace(/\\\\/g, '\\');

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const collectPhpVariables = (phpTemplate: string): Map<string, string> => {
  const variables = new Map<string, string>();

  for (const match of phpTemplate.matchAll(PHP_HEREDOC_ASSIGNMENT)) {
    variables.set(match[1], match[3]);
  }

  for (const match of phpTemplate.matchAll(PHP_STRING_ASSIGNMENT)) {
    if (!variables.has(match[1])) {
      variables.set(match[1], unescapePhpString(match[3]));
    }
  }

  return variables;
};

const unwrapFunctionCall = (expression: string, functionName: string): string | null => {
  const trimmed = expression.trim();
  const prefix = `${functionName}(`;
  if (!trimmed.startsWith(prefix) || !trimmed.endsWith(')')) return null;
  return trimmed.slice(prefix.length, -1).trim();
};

const readPhpStringLiteral = (token: string): string | null => {
  const trimmed = token.trim();
  const quote = trimmed[0];
  if ((quote !== '"' && quote !== "'") || trimmed[trimmed.length - 1] !== quote) return null;
  return unescapePhpString(trimmed.slice(1, -1));
};

const evaluatePhpConcatExpression = (expression: string, variables: Map<string, string>): string => {
  return expression
    .split('.')
    .map((token) => {
      const trimmed = token.trim();
      if (/^get_(?:template|stylesheet)_directory_uri\(\)$/i.test(trimmed)) {
        return '__THEME_URI__';
      }

      const homeUrlMatch = trimmed.match(/^home_url\(\s*(["'])((?:\\.|(?!\1)[\s\S])*?)\1\s*\)$/i);
      if (homeUrlMatch) {
        return unescapePhpString(homeUrlMatch[2]);
      }

      const variableMatch = trimmed.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
      if (variableMatch) {
        return variables.get(variableMatch[1]) || '';
      }

      const literal = readPhpStringLiteral(trimmed);
      return literal ?? '';
    })
    .join('');
};

const renderPhpExpression = (expression: string, variables: Map<string, string>): string => {
  const trimmed = expression.trim();
  const escapedI18nMatch = trimmed.match(/^esc_html__\(\s*(["'])((?:\\.|(?!\1)[\s\S])*?)\1\s*,[\s\S]*\)$/i);
  if (escapedI18nMatch) {
    return escapeHtml(unescapePhpString(escapedI18nMatch[2]));
  }

  const escHtml = unwrapFunctionCall(trimmed, 'esc_html');
  if (escHtml) {
    const variableMatch = escHtml.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
    return escapeHtml(variableMatch ? variables.get(variableMatch[1]) || '' : evaluatePhpConcatExpression(escHtml, variables));
  }

  const escAttr = unwrapFunctionCall(trimmed, 'esc_attr');
  if (escAttr) {
    const variableMatch = escAttr.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
    return escapeHtml(variableMatch ? variables.get(variableMatch[1]) || '' : evaluatePhpConcatExpression(escAttr, variables));
  }

  const ksesPost = unwrapFunctionCall(trimmed, 'wp_kses_post');
  if (ksesPost) {
    const variableMatch = ksesPost.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
    return variableMatch ? variables.get(variableMatch[1]) || '' : evaluatePhpConcatExpression(ksesPost, variables);
  }

  const escUrl = unwrapFunctionCall(trimmed, 'esc_url');
  if (escUrl) {
    return evaluatePhpConcatExpression(escUrl, variables);
  }

  if (/^get_(?:template|stylesheet)_directory_uri\(\)$/i.test(trimmed)) {
    return '__THEME_URI__';
  }

  const rawVariable = trimmed.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
  if (rawVariable) {
    return variables.get(rawVariable[1]) || '';
  }

  return '';
};

const renderPhpBlock = (code: string, variables: Map<string, string>): string => {
  let output = '';
  const echoPattern = /echo\s+([\s\S]*?);/gi;
  for (const match of code.matchAll(echoPattern)) {
    output += renderPhpExpression(match[1], variables);
  }
  return output;
};

export const stripWordPressPhpTemplateCode = (phpTemplate: string): string => {
  const variables = collectPhpVariables(phpTemplate || '');

  return (phpTemplate || '')
    .replace(/<\?(=|php)?([\s\S]*?)\?>/gi, (_match, marker, code) => {
      const blockCode = marker === '=' ? `echo ${code};` : code;
      return renderPhpBlock(blockCode, variables);
    });
};

