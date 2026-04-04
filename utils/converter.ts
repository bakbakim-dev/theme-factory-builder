/**
 * Gutenberg Block Converter - Production v10.10 (Tailwind Button Flex-Stretch Fix)
 */

type FaqItem = { q: string; a: string };

export interface AuditLog {
  type: 'error' | 'warn' | 'info';
  message: string;
  suggestion: string;
  snippet: string;
}

export interface ThemeTokenSuggestion {
  type: 'color' | 'spacing' | 'typography';
  tokenName: string;
  value: string;
  occurrences: number;
}

export interface ConversionResult {
  html: string;
  logs: AuditLog[];
  editabilityScore: number;
  confidenceScore: number;
  themeTokens: ThemeTokenSuggestion[];
  validation: {
    isValid: boolean;
    errors: string[];
  };
}

export interface ConversionContext {
  doc: Document;
  sanitizeDiv: HTMLDivElement;
  textDiv: HTMLDivElement;
  patterns?: { headerPattern?: string, footerPattern?: string };
  faqData?: FaqItem[];  // FAQ Q&A pairs for direct embedding
  logs: AuditLog[];     // Array to collect heuristic audit warnings
  _blockCounts: Record<string, number>;  // Track block type usage for scoring
  _colorOccurrences: Record<string, number>;  // Track repeated colors for theme tokens
  _spacingOccurrences: Record<string, number>;  // Track repeated spacing for theme tokens
}

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'meta', 'link', 'head', 'template']);
const STRUCTURAL_TAGS = new Set(['div', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'section']);

export function createPlaceholder(title: string, message: string): string {
    return `<!-- wp:theme-factory/container {"className":"wp-block-theme-factory-container"} -->
<div class="wp-block-theme-factory-container"><!-- wp:heading -->
<h2 class="wp-block-heading">${escapeHtml(title)}</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>${escapeHtml(message)}</p>
<!-- /wp:paragraph --></div>
<!-- /wp:theme-factory/container -->`;
}

export function extractElementHtml(html: string, selector: string): string | null {
    if (!html) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const el = doc.querySelector(selector);
    return el ? el.outerHTML : null;
}

export function convertToGutenbergBlocks(
  html: string, 
  options?: { 
    patterns?: { headerPattern?: string, footerPattern?: string };
    faqData?: FaqItem[];
  }
): ConversionResult {
  const defaultReturn: ConversionResult = { html: '', logs: [], editabilityScore: 0, confidenceScore: 0, themeTokens: [], validation: { isValid: true, errors: [] } };
  
  if (!html || typeof html !== 'string' || html.trim().length < 10) {
    defaultReturn.html = createPlaceholder('Empty Content', 'No content was provided for this page.');
    return defaultReturn;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!doctype html><html><body><div id="root">${html}</div></body></html>`, 'text/html');
    const root = doc.getElementById('root');
    if (!root) {
        defaultReturn.html = createPlaceholder('Parse Error', 'Could not parse the HTML content.');
        return defaultReturn;
    }
    
    const ctx: ConversionContext = { 
        doc, 
        sanitizeDiv: doc.createElement('div'), 
        textDiv: doc.createElement('div'),
        patterns: options?.patterns,
        faqData: options?.faqData,
        logs: [],
        _blockCounts: {},
        _colorOccurrences: {},
        _spacingOccurrences: {}
    };
    
    // PHASE 1.4: Wrapper Reduction — collapse meaningless single-child divs
    reduceWrappers(root);
    const blocks = processChildren(root, ctx);
    const cleaned = cleanupBlocks(blocks);
    
    if (cleaned.length === 0) {
        return { ...defaultReturn, html: createPlaceholder('No Content', 'No editable content was found on this page.'), logs: ctx.logs };
    }
    
    const serialized = cleaned.join('\n\n');
    const validation = validateBlockMarkup(serialized);
    const { editabilityScore, confidenceScore } = computeScores(ctx);
    const themeTokens = extractThemeTokenSuggestions(ctx);
    
    return { html: serialized, logs: ctx.logs, editabilityScore, confidenceScore, themeTokens, validation };
  } catch (e) {
    console.error('Gutenberg Converter Error:', e);
    return { ...defaultReturn, html: createPlaceholder('Conversion Error', `Failed to convert: ${e instanceof Error ? e.message : 'Unknown error'}`), logs: [] };
  }
}

function processChildren(parent: Element, ctx: ConversionContext): string[] {
  const blocks: string[] = [];
  const childNodes = Array.from(parent.childNodes);

  for (const child of childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent || '').trim();
      if (text.length > 0) blocks.push(createParagraph(escapeHtml(text), ctx));
      continue;
    }
    
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (isHiddenElement(el)) continue;
      
      const result = processElement(el, ctx);
      if (result) {
          if (Array.isArray(result)) blocks.push(...result);
          else blocks.push(result);
      }
    }
  }
  
  // POST-PROCESS: Wrap adjacent core/button blocks in core/buttons container
  return groupAdjacentButtons(blocks);
}

/**
 * Group consecutive wp:button blocks into wp:buttons containers.
 * WordPress requires: wp:buttons > wp:button (parent-child relationship).
 */
function groupAdjacentButtons(blocks: string[]): string[] {
    const result: string[] = [];
    let buttonBuffer: string[] = [];
    
    const flushButtons = () => {
        if (buttonBuffer.length === 0) return;
        if (buttonBuffer.length === 1) {
            // Single button still needs a wrapper per WP conventions
            result.push(`<!-- wp:theme-factory/container {"className":"wp-block-buttons"} -->\n<div class="wp-block-theme-factory-container wp-block-buttons">\n${buttonBuffer[0]}\n</div>\n<!-- /wp:theme-factory/container -->`);
        } else {
            result.push(`<!-- wp:theme-factory/container {"className":"wp-block-buttons"} -->\n<div class="wp-block-theme-factory-container wp-block-buttons">\n${buttonBuffer.join('\n')}\n</div>\n<!-- /wp:theme-factory/container -->`);
        }
        buttonBuffer = [];
    };
    
    for (const block of blocks) {
        if (block.trimStart().startsWith('<!-- wp:theme-factory/button ')) {
            buttonBuffer.push(block);
        } else {
            flushButtons();
            result.push(block);
        }
    }
    flushButtons();
    
    return result;
}

function processElement(el: HTMLElement, ctx: ConversionContext): string | string[] | null {
  const tag = el.tagName.toLowerCase();
  const className = el.getAttribute('class') || '';
  const dataState = el.getAttribute('data-state');
  const role = el.getAttribute('role');

  // CRITICAL: Preserve interactive/JS-dependent components as HTML blocks
  // These components rely on JavaScript and cannot be converted to editable blocks
  
  // 1. Accordions (Radix UI, custom implementations)
  // Only detect elements that ARE accordion items by their own attributes
  // GUARD: Exclude Radix Select components — they also have data-state="closed"
  // but are dropdown menus, not accordions.
  const isRadixSelect = role === 'combobox' || 
      el.hasAttribute('data-radix-select-trigger') || 
      el.hasAttribute('data-radix-select-content') ||
      el.hasAttribute('data-radix-select-viewport') ||
      el.closest('[data-radix-select-trigger]') !== null ||
      (tag === 'button' && el.closest('[data-radix-select-trigger]') !== null);
  
  if (!isRadixSelect && (
      dataState === 'open' || dataState === 'closed' || 
      el.hasAttribute('data-accordion') || 
      el.hasAttribute('data-radix-accordion-item') ||
      el.hasAttribute('data-radix-accordion-content') ||
      el.hasAttribute('data-radix-accordion-trigger') ||
      el.hasAttribute('aria-controls') && el.hasAttribute('aria-expanded') ||
      role === 'region' && el.hasAttribute('aria-labelledby') ||
      className.includes('AccordionItem') ||
      className.includes('AccordionTrigger') ||
      className.includes('AccordionContent') ||
      className.includes('collapsible') ||
      className.includes('faq-item'))) {
      return createContainer(el, ctx, true);
  }
  
  // 1b. Tabs (Radix UI Tabs components)
  // Preserve entire tab containers and their content panels
  if (role === 'tablist' || 
      role === 'tabpanel' ||
      el.hasAttribute('data-orientation') && (role === 'tablist' || el.querySelector('[role="tab"]')) ||
      className.includes('TabsList') ||
      className.includes('TabsContent') ||
      className.includes('TabsTrigger')) {
      return createContainer(el, ctx, true);
  }
  
  // 2. Carousels/Sliders - detect by exact class/attribute match only
  // Plus: detect the sliding container by inline translateX style
  const inlineStyle = el.getAttribute('style') || '';
  const isSlideContainer = inlineStyle.includes('translateX') && className.includes('transition');
  
  if (className.includes('carousel') ||
      className.includes('swiper') ||
      className.includes('slick') ||
      className.includes('embla') ||
      el.hasAttribute('data-carousel') ||
      el.hasAttribute('data-embla') ||
      isSlideContainer) {
      return createContainer(el, ctx, true);
  }
  
  // 3. Dropdowns/Popovers
  if (role === 'menu' || role === 'listbox' ||
      el.hasAttribute('data-radix-popper-content-wrapper') ||
      dataState && className.includes('dropdown')) {
      return createContainer(el, ctx, true);
  }

  // Handle Patterns
  if (tag === 'header' && ctx.patterns?.headerPattern) {
      return `<!-- wp:pattern {"slug":"${ctx.patterns.headerPattern}"} /-->`;
  }
  if (tag === 'footer' && ctx.patterns?.footerPattern) {
      return `<!-- wp:pattern {"slug":"${ctx.patterns.footerPattern}"} /-->`;
  }

  // CRITICAL: Skip header/footer entirely when no patterns are set.
  // These elements are ALWAYS provided by header.php/footer.php in WordPress.
  // If they leak into page content blocks, they cause duplicate headers/footers.
  if (tag === 'header' || tag === 'footer') {
      return null;
  }

  if (SKIP_TAGS.has(tag)) return null;

  // Headings
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    return createHeading(el, tag, ctx);
  }

  // Paragraphs
  if (tag === 'p') {
    return createParagraph(el.innerHTML, ctx, el);
  }

  // Lists
  if (tag === 'ul' || tag === 'ol') {
    return createList(el, tag, ctx);
  }

  // Images
  if (tag === 'img') {
    return createImage(el as HTMLImageElement);
  }

  // Links & Buttons
  if (tag === 'a') {
      // Check for complex Tailwind styling that should NOT become a simple button
      const className = el.getAttribute('class') || '';
      const hasComplexStyling = /\b(flex|grid|gap-|px-|py-|rounded|bg-|border|shadow|text-\w+-\d|font-)\b/.test(className);

      // Check if it's a "Link Group" (card with link) or contains block-level children
      const hasBlockChildren = el.querySelector('div, h1, h2, h3, h4, h5, h6, p, ul, ol, img, section, article, header, footer');
      const hasSvg = el.querySelector('svg');
      const innerButton = el.querySelector('button');

      // IMAGE-LINK: If an <a> primarily wraps an <img>, create a linked core/image
      // This prevents overlapping blocks and matches WP's native linked-image pattern
      const directImg = el.querySelector(':scope > img') || 
                        el.querySelector(':scope > picture img') ||
                        el.querySelector(':scope > figure img');
      if (directImg && directImg instanceof HTMLImageElement) {
          // Check that the image is the primary content (not a tiny icon in a card)
          const nonImgBlockChildren = el.querySelector('div, h1, h2, h3, h4, h5, h6, p, ul, ol, section, article');
          if (!nonImgBlockChildren) {
              return createLinkedImage(directImg, el, ctx);
          }
      }

      // CRITICAL FIX: Links with block children are clickable cards
      // Check this FIRST before any other checks - cards may contain buttons with icons
      // This preserves the full card structure from the source React app
      if (hasBlockChildren) {
          // These are rich cards that wrap in a link - preserve full structure as HTML
          return createLinkGroup(el, ctx);
      }

      // Only NOW check for nested <button> which breaks layout (but isn't a card)
      if (innerButton && !hasBlockChildren) {
          // Simple link wrapping a button (no card content) - merge into editable button
          return createButton(el, ctx, innerButton);
      }

      // CRITICAL FIX: Links with SVG icons should be preserved as editable
      // This ensures social media icons (Facebook, LinkedIn, etc.) remain editable
      if (hasSvg) {
          // Check if this is a styled link with icon (like social media buttons)
          const hasTextSpan = el.querySelector('span');
          if (hasComplexStyling || hasTextSpan) {
              return createLinkGroup(el, ctx);
          }
      }

      // Simple text links become buttons (editable)
      const textOnly = el.children.length === 0 && el.textContent?.trim();
      
      // CRITICAL FIX: Detect already-styled Tailwind buttons - preserve as HTML
      // This prevents WP's wp-block-button width:100% rules from taking over
      // Also inject 'self-center w-fit' to break flex-stretch inheritance from parent
      if (textOnly && isTailwindStyledButton(className)) {
          // Add classes to break flex stretch (specificity war fix)
          const currentClass = el.getAttribute('class') || '';
          if (!currentClass.includes('self-center')) {
              el.setAttribute('class', currentClass + ' self-center w-fit');
          }
          return createButton(el, ctx, el, true);
      }
      
      // TEXT-LINK DETECTION: Navigation-style text links (no bg, no border, no padding)
      // should remain as inline links, NOT become buttons which add unwanted styling
      if (textOnly) {
          const isTextLink = !/(\b(bg-|border-|shadow|px-|py-|rounded|inline-flex)\b)/.test(className);
          if (isTextLink) {
              // Create as a paragraph with an inline link — preserves text-link styling
              const href = el.getAttribute('href') || '#';
              const linkClass = className ? ` class="${className}"` : '';
              trackBlock(ctx, 'core/paragraph');
              return `<!-- wp:paragraph -->\n<p><a href="${escapeAttr(href)}"${linkClass}>${escapeHtml(el.textContent?.trim() || '')}</a></p>\n<!-- /wp:paragraph -->`;
          }
          return createButton(el, ctx);
      }

      // Last resort: wrap in wp:group to maintain editability where possible
      if (hasSvg) {
          return createContainer(el, ctx);
      }

      // Final fallback for truly complex cases
      return createHtmlFragment(el, ctx);
  }
  
  if (tag === 'button') {
      // CRITICAL: Preserve interactive buttons that rely on JS behavior
      // Tab triggers, accordion triggers, and other ARIA components must stay as <button>
      if (role === 'tab' || 
          el.hasAttribute('aria-controls') || 
          el.hasAttribute('aria-expanded') ||
          el.hasAttribute('data-radix-collection-item') ||
          el.hasAttribute('data-state') ||
          className.includes('TabsTrigger') ||
          className.includes('AccordionTrigger')) {
          return createContainer(el, ctx, true);
      }
      
      const hasBlockChildren = el.querySelector('div, img');
      if (hasBlockChildren) return createContainer(el, ctx); 
      return createButton(el, ctx);
  }

  // Forms inputs mapping
  if (tag === 'input' || tag === 'textarea') {
      const type = el.getAttribute('type');
      if (type === 'hidden' || type === 'submit' || type === 'button') {
          return createHtmlBlock(el);
      }
      return createFormInput(el as HTMLInputElement | HTMLTextAreaElement, tag);
  }

  // Structural / Container
  const extraContainers = new Set(['li', 'form', 'label', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'figure', 'figcaption', 'address', 'picture', 'fieldset']);
  
  // HEURISTIC: Social links detection
  // Container with 2+ social media links → core/social-links
  // SKIP if the links have custom SVG icons — WordPress replaces them with its own generic icons
  const hasSocialSvgs = el.querySelector('a svg');
  if ((tag === 'div' || tag === 'ul' || tag === 'nav' || tag === 'footer') && !el.hasAttribute('data-state') && !hasSocialSvgs) {
      const socialResult = createSocialLinks(el, ctx);
      if (socialResult) return socialResult;
  }
  
  // HEURISTIC: Form handling
  // Search forms → createSearch, contact/general forms → preserve as HTML block
  if (tag === 'form') {
      const searchResult = createSearch(el, ctx);
      if (searchResult) return searchResult;
      // Non-search forms (contact, signup, etc.) — preserve as raw HTML block
      trackBlock(ctx, 'core/html');
      return `<!-- wp:html -->\n${el.outerHTML}\n<!-- /wp:html -->`;
  }
  
  if (STRUCTURAL_TAGS.has(tag) || tag === 'div' || tag === 'section' || extraContainers.has(tag)) {
      return createContainer(el, ctx, true);
  }
  
  // SVG
  if (tag === 'svg') {
      return createSvgBlock(el);
  }

  // Native Gutenberg Core Blocks
  if (tag === 'blockquote' || tag === 'q') return createQuote(el, ctx);
  if (tag === 'hr') return createSeparator(el);
  if (tag === 'video') return createVideo(el, ctx);
  if (tag === 'audio') return createAudio(el, ctx);
  if (tag === 'details') return createDetails(el, ctx);
  if (tag === 'summary') return null; // Handled deeply by details wrapper
  if (tag === 'pre' || tag === 'code') return createPreformatted(el, ctx, tag);
  if (tag === 'source' || tag === 'track') return null; // Let parent handle

  // Tables - natively mapped to core/table
  if (tag === 'table') {
      return createTable(el, ctx);
  }

  // Ignore deeply nested table children, as createTable handles them
  if (['thead', 'tbody', 'tfoot', 'tr', 'th', 'td'].includes(tag)) {
      return null;
  }

  // Form elements: preserve as HTML when encountered outside a form context
  // (inside a form, they're already captured by the form's core/html block)
  if (['input', 'textarea', 'select', 'option', 'fieldset', 'legend'].includes(tag)) {
      if (tag === 'select' || tag === 'textarea') {
          trackBlock(ctx, 'core/html');
          return `<!-- wp:html -->\n${el.outerHTML}\n<!-- /wp:html -->`;
      }
      return null; // input/option/fieldset handled by parent
  }

  // Iframes: YouTube/Vimeo → core/embed, others → core/html
  if (tag === 'iframe') {
      const src = el.getAttribute('src') || '';
      const embedMatch = detectEmbedProvider(src);
      if (embedMatch) {
          return createEmbed(el, embedMatch.provider, embedMatch.url);
      }
      return createHtmlBlock(el, ctx);
  }



  // Fallback for spans, bold, etc
  if (el.children.length > 0) {
      return processChildren(el, ctx);
  } else if (el.textContent?.trim()) {
      return createParagraph(el.innerHTML, ctx, el);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tailwind to Gutenberg Dictionary (FSE Translation Engine)
// ---------------------------------------------------------------------------
const spacingMap: Record<string, string> = {
    '0': '0', '1': '0.25rem', '2': '0.5rem', '3': '0.75rem', '4': '1rem',
    '5': '1.25rem', '6': '1.5rem', '8': '2rem', '10': '2.5rem', '12': '3rem',
    '16': '4rem', '20': '5rem', '24': '6rem', '32': '8rem', '40': '10rem',
    '48': '12rem', '64': '16rem', 'auto': 'auto', 'px': '1px'
};

const fseColors = new Set(['primary', 'secondary', 'accent', 'background', 'foreground', 'muted', 'white', 'black', 'transparent']);

export function parseTailwindAttributes(className: string): { attributes: any, remainingClasses: string } {
    if (!className) return { attributes: {}, remainingClasses: '' };
    
    // Ignore responsive or state variants for global extraction (Gutenberg doesn't support them natively)
    const classes = className.split(/\s+/).filter(Boolean);
    const remainingClasses: string[] = [];
    const attributes: any = {};
    const style: any = {};
    let spacing: any = null;
    let color: any = null;
    let typography: any = null;
    
    for (const cls of classes) {
        let matched = false;
        
        // Skip hover/focus/md/lg classes
        if (cls.includes(':')) {
            remainingClasses.push(cls);
            continue;
        }
        
        // 1. Spacing - Padding
        if (cls.match(/^p([trblxy]?)-([^:]+)$/)) {
            const [, dir, val] = cls.match(/^p([trblxy]?)-([^:]+)$/)!;
            const remVal = spacingMap[val] || (val.includes('[') ? val.replace(/[\[\]]/g, '') : null);
            if (remVal) {
                if (!spacing) spacing = {};
                if (!spacing.padding) spacing.padding = {};
                if (!dir) { spacing.padding.top = remVal; spacing.padding.bottom = remVal; spacing.padding.left = remVal; spacing.padding.right = remVal; }
                else if (dir === 't') spacing.padding.top = remVal;
                else if (dir === 'b') spacing.padding.bottom = remVal;
                else if (dir === 'l') spacing.padding.left = remVal;
                else if (dir === 'r') spacing.padding.right = remVal;
                else if (dir === 'x') { spacing.padding.left = remVal; spacing.padding.right = remVal; }
                else if (dir === 'y') { spacing.padding.top = remVal; spacing.padding.bottom = remVal; }
                matched = true;
            }
        }
        
        // 2. Spacing - Margin
        // CRITICAL: Preserve mx-auto / my-auto as CSS classes — WordPress core blocks
        // do NOT render Gutenberg JSON style.spacing.margin as inline CSS, so converting
        // auto-margins to JSON attributes silently breaks centering on the frontend.
        else if (cls.match(/^-?m([trblxy]?)-([^:]+)$/)) {
            const isNegative = cls.startsWith('-');
            const [, dir, val] = cls.match(/^-?m([trblxy]?)-([^:]+)$/)!;
            const remValBase = spacingMap[val] || (val.includes('[') ? val.replace(/[\[\]]/g, '') : null);
            if (remValBase) {
                // Keep auto-margin classes as CSS classes (Tailwind handles them perfectly)
                // instead of converting to Gutenberg JSON spacing that WP won't render
                if (remValBase === 'auto') {
                    remainingClasses.push(cls);
                    matched = true;
                } else {
                    const remVal = isNegative && remValBase !== '0' ? `-${remValBase}` : remValBase;
                    if (!spacing) spacing = {};
                    if (!spacing.margin) spacing.margin = {};
                    if (!dir) { spacing.margin.top = remVal; spacing.margin.bottom = remVal; spacing.margin.left = remVal; spacing.margin.right = remVal; }
                    else if (dir === 't') spacing.margin.top = remVal;
                    else if (dir === 'b') spacing.margin.bottom = remVal;
                    else if (dir === 'l') spacing.margin.left = remVal;
                    else if (dir === 'r') spacing.margin.right = remVal;
                    else if (dir === 'x') { spacing.margin.left = remVal; spacing.margin.right = remVal; }
                    else if (dir === 'y') { spacing.margin.top = remVal; spacing.margin.bottom = remVal; }
                    matched = true;
                }
            }
        }
        
        // 3. Colors
        else if (cls.startsWith('bg-')) {
            const colorName = cls.replace('bg-', '');
            if (fseColors.has(colorName)) {
                attributes.backgroundColor = colorName;
                attributes.className = attributes.className ? attributes.className + ` has-${colorName}-background-color has-background` : `has-${colorName}-background-color has-background`;
                matched = true;
            } else if (colorName.includes('[')) { // Hex colors
                const hex = colorName.replace(/[\[\]]/g, '');
                if (!color) color = {};
                color.background = hex;
                attributes.className = attributes.className ? attributes.className + ' has-background' : 'has-background';
                matched = true;
            }
        }
        // Text alignment classes -> Gutenberg align attribute
        else if (cls === 'text-center' || cls === 'text-right' || cls === 'text-left') {
            attributes.align = cls.replace('text-', '');
            matched = true;
        }
        else if (cls.startsWith('text-')) {
            const colorName = cls.replace('text-', '');
            if (fseColors.has(colorName)) {
                attributes.textColor = colorName;
                attributes.className = attributes.className ? attributes.className + ` has-${colorName}-color has-text-color` : `has-${colorName}-color has-text-color`;
                matched = true;
            } else if (colorName.includes('[')) {
                const hex = colorName.replace(/[\[\]]/g, '');
                if (!color) color = {};
                color.text = hex;
                attributes.className = attributes.className ? attributes.className + ' has-text-color' : 'has-text-color';
                matched = true;
            } else if (['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'].includes(colorName)) {
                // Typography maps
                const fontSizeMap: Record<string, string> = {
                    'xs': 'x-small', 'sm': 'small', 'base': 'medium', 'lg': 'large', 'xl': 'x-large', 
                    '2xl': 'xx-large', '3xl': '3xl', '4xl': '4xl', '5xl': '5xl', '6xl': '6xl'
                };
                if (fontSizeMap[colorName]) {
                    attributes.fontSize = fontSizeMap[colorName];
                } else if (!typography) {
                    typography = {};
                    typography.fontSize = colorName === '8xl' ? '6rem' : colorName === '9xl' ? '8rem' : '4rem';
                }
                matched = true;
            }
        }

        // 4. Flexbox Layouts natively support in Gutenberg 6.1+
        else if (cls === 'flex' || cls === 'flex-col' || cls === 'items-center' || cls === 'justify-center' || cls === 'justify-between' || cls === 'gap-4' || cls === 'gap-8') {
             // We keep layout classes for now as mapping deeply into wp:group layout={type:flex} has side effects on width.
             // We'll let `remainingClasses.push(cls)` run.
             matched = false;
        }
        
        // Strip out the matched Tailwind classes so they don't fight Gutenberg's native CSS!
        if (!matched) {
            remainingClasses.push(cls);
        }
    }
    
    if (spacing) style.spacing = spacing;
    if (color) style.color = color;
    if (typography) style.typography = typography;
    
    if (Object.keys(style).length > 0) {
        attributes.style = style;
    }
    
    return {
        attributes,
        remainingClasses: remainingClasses.join(' ')
    };
}

// ---------------------------------------------------------------------------
// Block Generators
// ---------------------------------------------------------------------------

function createHeading(el: HTMLElement, tag: string, ctx: ConversionContext): string {
  const content = cleanInlineHtml(el.innerHTML);
  if (!content) return '';
  
  const level = parseInt(tag.charAt(1));
  const rawClassName = getClassName(el);
  
  const { attributes, remainingClasses } = parseTailwindAttributes(rawClassName);
  attributes.level = level;
  
  // Inherit text alignment from parent containers if not set on the element itself
  if (!attributes.align) {
      let parent = el.parentElement;
      while (parent && parent.id !== 'root') {
          const parentClasses = (parent.getAttribute('class') || '').split(/\s+/);
          if (parentClasses.includes('text-center')) { attributes.textAlign = 'center'; break; }
          if (parentClasses.includes('text-right')) { attributes.textAlign = 'right'; break; }
          if (parentClasses.includes('text-left')) { break; }
          parent = parent.parentElement;
      }
  } else {
      // Headings use textAlign, not align
      attributes.textAlign = attributes.align;
      delete attributes.align;
  }
  
  // Combine custom classes and FSE injected classes (like has-primary-color)
  const fseClasses = attributes.className || '';
  const alignClass = attributes.textAlign === 'center' ? 'has-text-align-center' : attributes.textAlign === 'right' ? 'has-text-align-right' : '';
  const finalClasses = [remainingClasses, fseClasses, alignClass].filter(Boolean).join(' ');
  if (finalClasses) attributes.className = finalClasses;
  
  trackBlock(ctx, 'core/heading');
  
  const attrsStr = Object.keys(attributes).length > 0 ? ` ${JSON.stringify(attributes)}` : '';
  const classAttr = finalClasses ? ` class="wp-block-heading ${finalClasses}"` : ` class="wp-block-heading"`;
  
  return `<!-- wp:heading${attrsStr} -->\n<${tag}${classAttr}>${content}</${tag}>\n<!-- /wp:heading -->`;
}

function createParagraph(content: string, ctx: ConversionContext, el?: HTMLElement): string {
    const cleaned = cleanInlineHtml(content);
    if (!cleaned) return '';
    const rawClassName = el ? getClassName(el) : '';
    
    const { attributes, remainingClasses } = parseTailwindAttributes(rawClassName);
    
    // Inherit text alignment from parent containers if not set on the element itself
    if (!attributes.align && el) {
        let parent = el.parentElement;
        while (parent && parent.id !== 'root') {
            const parentClasses = (parent.getAttribute('class') || '').split(/\s+/);
            if (parentClasses.includes('text-center')) { attributes.align = 'center'; break; }
            if (parentClasses.includes('text-right')) { attributes.align = 'right'; break; }
            if (parentClasses.includes('text-left')) { break; } // Explicit left = default
            parent = parent.parentElement;
        }
    }
    
    const fseClasses = attributes.className || '';
    const finalClasses = [remainingClasses, fseClasses].filter(Boolean).join(' ');
    if (finalClasses) attributes.className = finalClasses;
    
    // Add alignment CSS class for Gutenberg
    const alignClass = attributes.align === 'center' ? ' has-text-align-center' : attributes.align === 'right' ? ' has-text-align-right' : '';
    
    trackBlock(ctx, 'core/paragraph');
    
    const attrsStr = Object.keys(attributes).length > 0 ? ` ${JSON.stringify(attributes)}` : '';
    const classAttr = (finalClasses || alignClass) ? ` class="${[finalClasses, alignClass.trim()].filter(Boolean).join(' ')}"` : '';
    
    return `<!-- wp:paragraph${attrsStr} -->\n<p${classAttr}>${cleaned}</p>\n<!-- /wp:paragraph -->`;
}

function createList(el: HTMLElement, tag: string, ctx: ConversionContext): string {
    // SVG List Handling:
    // If a list has SVGs (like checkmarks in pricing tables), we MUST preserve them.
    // Gutenberg's core/list does not support SVGs inside list items.
    // So we use theme-factory/container to ensure it is editable AND has SVG fidelity.
    const hasSvg = el.querySelector('svg');
    if (hasSvg) {
        return createContainer(el, ctx, true);
    }

    // WordPress 6.1+ requires core/list-item wrapping inside core/list
    const items: string[] = [];
    el.querySelectorAll(':scope > li').forEach(li => {
        const content = cleanInlineHtml(li.innerHTML);
        items.push(`<!-- wp:list-item -->\n<li>${content}</li>\n<!-- /wp:list-item -->`);
    });

    if (items.length === 0) {
        return createContainer(el, ctx, true);
    }

    const ordered = tag === 'ol';
    const className = getClassName(el);
    const attrs = { ordered, className: className || undefined };
    trackBlock(ctx, 'core/list');

    return `<!-- wp:list ${JSON.stringify(attrs)} -->\n<${tag} class="${className}">\n${items.join('\n')}\n</${tag}>\n<!-- /wp:list -->`;
}

function createImage(img: HTMLImageElement, ctx?: ConversionContext): string {
    const src = img.getAttribute('src') || '';
    if (!src) return '';

    const safeSrc = src.replace(/^\/?assets\//, '__THEME_URI__/assets/');
    if (ctx) trackBlock(ctx, 'core/image');
    const alt = img.getAttribute('alt') || '';
    
    // HEURISTIC AUDIT: Missing Alt Tags
    if (!alt && ctx?.logs) {
        ctx.logs.push({
            type: 'warn',
            message: 'Image Missing Alt Text',
            suggestion: 'For SEO and accessibility, add an `alt="..."` attribute to this image in the React source.',
            snippet: `<img src="${src}" />`
        });
    }

    const className = getClassName(img);
    const width = img.getAttribute('width') || img.width || '';
    const height = img.getAttribute('height') || img.height || '';
    const loading = img.getAttribute('loading') || 'lazy'; // Default to lazy loading

    const attrs: any = {};
    if (className) attrs.className = className;
    if (width) attrs.width = parseInt(width.toString());
    if (height) attrs.height = parseInt(height.toString());

    // Build image tag with performance attributes
    let imgTag = `<img src="${safeSrc}" alt="${escapeAttr(alt)}"`;
    if (width && height) {
        imgTag += ` width="${width}" height="${height}"`; // Prevent CLS
    }
    imgTag += ` loading="${loading}"`; // Lazy loading for performance
    imgTag += '/>';

    return `<!-- wp:image ${JSON.stringify(attrs)} -->\n<figure class="wp-block-image${className ? ' ' + className : ''}">${imgTag}</figure>\n<!-- /wp:image -->`;
}

/**
 * Create a core/image block with a link wrapping the image.
 * WordPress pattern: <figure><a href="..."><img.../></a></figure>
 */
function createLinkedImage(img: HTMLImageElement, anchor: HTMLElement, ctx: ConversionContext): string {
    const src = img.getAttribute('src') || '';
    if (!src) return '';

    const safeSrc = src.replace(/^\/?assets\//, '__THEME_URI__/assets/');
    trackBlock(ctx, 'core/image');
    const alt = img.getAttribute('alt') || '';
    const href = anchor.getAttribute('href') || '#';
    const target = anchor.getAttribute('target') || '';
    const rel = anchor.getAttribute('rel') || '';

    const imgClassName = getClassName(img);
    const anchorClassName = getClassName(anchor);
    const combinedClass = (imgClassName + ' ' + anchorClassName).trim();
    
    const width = img.getAttribute('width') || img.width || '';
    const height = img.getAttribute('height') || img.height || '';
    const loading = img.getAttribute('loading') || 'lazy';

    const attrs: any = { linkDestination: 'custom' };
    if (combinedClass) attrs.className = combinedClass;
    if (width) attrs.width = parseInt(width.toString());
    if (height) attrs.height = parseInt(height.toString());

    let imgTag = `<img src="${safeSrc}" alt="${escapeAttr(alt)}"`;
    if (width && height) imgTag += ` width="${width}" height="${height}"`;
    imgTag += ` loading="${loading}"/>`;

    let anchorAttrs = `href="${escapeAttr(href)}"`;
    if (target) anchorAttrs += ` target="${escapeAttr(target)}"`;
    if (rel) anchorAttrs += ` rel="${escapeAttr(rel)}"`;

    return `<!-- wp:image ${JSON.stringify(attrs)} -->\n<figure class="wp-block-image${combinedClass ? ' ' + combinedClass : ''}"><a ${anchorAttrs}>${imgTag}</a></figure>\n<!-- /wp:image -->`;
}

function createLinkGroup(el: HTMLElement, ctx: ConversionContext): string {
    const children = processChildren(el, ctx).join('\n\n');
    let className = getClassName(el);
    const href = el.getAttribute('href') || '#';
    const target = el.getAttribute('target') || '';
    const rel = el.getAttribute('rel') || '';

    // CRITICAL FIX: HTML5 does NOT allow nested <a> tags.
    // If we wrap a card in an <a> tag, and the card contains a "View Services" <button>
    // or <a>, the browser will forcefully close the outer <a> tag early, destroying the DOM layout.
    // To fix this, complex link wrappers MUST become interactive <div> containers.
    if (!className.includes('cursor-pointer')) {
        className = (className + ' cursor-pointer').trim();
    }

    const attrs: any = { 
        className: className,
        // We still store the href contextually but don't output an <a> wrapper
        url: href
    };
    
    // We use a standard container but inject a data-href attribute
    // The Dashboard.tsx will attach a click listener to handle the navigation
    let containerHtml = `<!-- wp:theme-factory/container ${JSON.stringify(attrs)} -->\n<div class="wp-block-theme-factory-container ${className}" data-href="${escapeAttr(href)}"${target ? ` data-target="${escapeAttr(target)}"` : ''}>\n${children}\n</div>\n<!-- /wp:theme-factory/container -->`;
    
    return containerHtml;
}

function createButton(el: HTMLElement, ctx: ConversionContext, innerBtn?: HTMLElement, useThemeFactory: boolean = false): string {
    const href = el.getAttribute('href') || '#';
    const target = el.getAttribute('target');
    const rel = el.getAttribute('rel');
    
    let contentEl = innerBtn || el;
    let text = cleanInlineHtml(contentEl.innerHTML);
    
    let className = getClassName(el);
    if (innerBtn) {
        className = (className + ' ' + getClassName(innerBtn)).trim();
    }
    
    // HEURISTIC AUDIT: Empty Buttons
    if (!text.trim() && !contentEl.querySelector('svg') && ctx?.logs) {
        ctx.logs.push({
            type: 'warn',
            message: 'Empty Button/Link Formed',
            suggestion: 'Found a button or link with no text or icon inside it. This element will be invisible and very difficult to edit in Gutenberg. Consider adding screen-reader text or an icon block.',
            snippet: `<a class="${className}" href="${href}">...</a>`
        });
    }

    // Heuristics: Structural Buttons (Tabs/Accordions/Cards) shouldn't be buttons
    // If a button has layout classes (flex, grid, w-full), it MAY be a complex container.
    // BUT: if it has a real href (not just "#"), it's a styled link that needs to stay as a button
    // to preserve navigation (e.g., "Book Now" → #contact, "See Pricing" → /edmonton/)
    const hasRealHref = href && href !== '#' && !href.startsWith('javascript:');
    if (!hasRealHref && (className.includes('w-full') || className.includes('flex') || className.includes('grid'))) {
        // Map complex button structures to our fully editable container mechanism instead
        return createContainer(el, ctx, true);
    }

    // If button contains SVG or complex content, use core/html
    if (!text.trim() && contentEl.querySelector('svg')) {
        return createHtmlBlock(el, ctx);
    }

    // Use textContent to get decoded text, then escape it once for HTML output
    // This avoids double-encoding (innerHTML already has &amp; which would become &amp;amp;)
    const cleanText = escapeHtml(contentEl.textContent?.trim() || '');

    const attrs: any = {};
    if (className) attrs.className = className;
    if (target === '_blank') attrs.linkTarget = '_blank';
    if (rel) attrs.rel = rel;

    // AUTO-DETECT: If the link has NO background color class (no bg-*), it's a text-style link.
    // WordPress core/button injects a dark background via wp-block-button__link, which destroys
    // the appearance of text links like "Learn More →". Use theme-factory/button to preserve styling.
    const hasBgClass = /\bbg-/.test(className);
    if (!hasBgClass && !useThemeFactory) {
        useThemeFactory = true;
    }
    if (useThemeFactory) {
        // Build as a self-styled theme-factory/button that doesn't conflict with WordPress defaults
        const tfAttrs: any = { text: cleanText, href };
        if (className) tfAttrs.className = className;
        if (target) tfAttrs.target = target;
        if (rel) tfAttrs.rel = rel;
        
        return `<!-- wp:theme-factory/button ${JSON.stringify(tfAttrs)} -->\n<a class="wp-block-theme-factory-button ${className}" href="${escapeAttr(href)}"${target ? ` target="${escapeAttr(target)}"` : ''}${rel ? ` rel="${escapeAttr(rel)}"` : ''}>${cleanText}</a>\n<!-- /wp:theme-factory/button -->`;
    }

    // ALL buttons use theme-factory/button (dynamic block, no validation).
    // Core wp:button injects specific classes that may conflict with Tailwind styling.
    const tfAttrs2: any = { text: cleanText, href };
    if (className) tfAttrs2.className = className;
    if (target) tfAttrs2.target = target;
    if (rel) tfAttrs2.rel = rel;
    
    trackBlock(ctx, 'theme-factory/button');
    return `<!-- wp:theme-factory/button ${JSON.stringify(tfAttrs2)} -->\n<a class="wp-block-theme-factory-button ${className}" href="${escapeAttr(href)}"${target ? ` target="${escapeAttr(target)}"` : ''}${rel ? ` rel="${escapeAttr(rel)}"` : ''}>${cleanText}</a>\n<!-- /wp:theme-factory/button -->`;
}

function createFormInput(el: HTMLInputElement | HTMLTextAreaElement, tag: string): string {
    const isTextarea = tag === 'textarea';
    const type = el.getAttribute('type') || 'text';
    const name = el.getAttribute('name') || '';
    const placeholder = el.getAttribute('placeholder') || '';
    const className = getClassName(el);
    const required = el.hasAttribute('required');
    
    const attrs: any = {};
    if (className) attrs.className = className;
    if (name) attrs.name = name;
    if (placeholder) attrs.placeholder = placeholder;
    if (required) attrs.required = required;
    
    if (isTextarea) {
        const rows = el.getAttribute('rows');
        if (rows) attrs.rows = parseInt(rows);
        return `<!-- wp:theme-factory/textarea ${JSON.stringify(attrs)} /-->`;
    } else {
        if (type) attrs.type = type;
        return `<!-- wp:theme-factory/input ${JSON.stringify(attrs)} /-->`;
    }
}

function createContainer(el: HTMLElement, ctx: ConversionContext, supportInteractivity: boolean = false): string {
    const elClassName = getClassName(el);
    
    // ─── HEURISTIC: Form-containing Card wrapper → preserve as core/html ─────
    // When a Card-like container (with border, rounded, shadow, bg-card) wraps a <form>,
    // preserve the entire container as raw HTML so the form layout stays intact.
    const hasForm = el.querySelector('form');
    if (hasForm) {
        const isCardLike = elClassName.includes('rounded') || elClassName.includes('shadow') || 
            elClassName.includes('border') || elClassName.includes('bg-card') || elClassName.includes('bg-white');
        if (isCardLike) {
            trackBlock(ctx, 'core/html');
            return `<!-- wp:html -->\n${el.outerHTML}\n<!-- /wp:html -->`;
        }
    }
    
    // ─── HEURISTIC: Radix/Headless UI Accordion → core/details ────────
    // Detect accordion containers with data-orientation="vertical" and
    // children that have data-state + role="region" patterns
    const isAccordionContainer = el.getAttribute('data-orientation') === 'vertical' && 
                                  el.querySelector('[data-state][role="region"]');
    if (isAccordionContainer) {
        const detailsBlocks: string[] = [];
        const items = Array.from(el.children).filter(c => c instanceof HTMLElement) as HTMLElement[];
        
        for (const item of items) {
            // Each accordion item: has a trigger (button with question) and panel (div with answer)
            const trigger = item.querySelector('button[data-state], h3 button, [role="heading"] button');
            const panel = item.querySelector('[role="region"], [data-state][id]:not(button):not(h3)');
            
            if (trigger && panel) {
                // Extract question text from trigger (skip SVG chevron icons)
                let questionText = '';
                for (const node of Array.from(trigger.childNodes)) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        questionText += (node.textContent || '').trim() + ' ';
                    } else if (node instanceof HTMLElement && node.tagName.toLowerCase() !== 'svg' && !node.querySelector('svg')) {
                        questionText += (node.textContent || '').trim() + ' ';
                    }
                }
                questionText = questionText.trim();
                if (!questionText) questionText = trigger.textContent?.trim() || 'Question';
                
                // CRITICAL: Remove Radix trigger elements (H3, button) from the DOM
                // BEFORE processing the panel. This prevents them from leaking into
                // the details block output as duplicate question text or broken elements.
                const triggerHeader = item.querySelector('h3, [role="heading"]');
                if (triggerHeader) triggerHeader.remove();
                else if (trigger.parentElement === item) trigger.remove();
                
                // Remove any standalone SVG chevron icons from the item
                const svgIcons = item.querySelectorAll('svg');
                svgIcons.forEach(svg => {
                    // Only remove small chevron icons, not decorative SVGs
                    const w = svg.getAttribute('width');
                    const h = svg.getAttribute('height');
                    if ((w && parseInt(w) <= 24) || (h && parseInt(h) <= 24) || 
                        svg.classList.contains('shrink-0') || svg.classList.contains('lucide')) {
                        svg.remove();
                    }
                });
                
                // Process answer panel content
                // ShadCN wraps content in an inner div (class="pb-4 pt-0") — process its children
                let answerContent = '';
                const innerWrapper = panel.querySelector(':scope > div');
                if (innerWrapper && innerWrapper.textContent?.trim()) {
                    answerContent = processChildren(innerWrapper as HTMLElement, ctx).join('\n\n');
                }
                if (!answerContent) {
                    answerContent = processChildren(panel as HTMLElement, ctx).join('\n\n');
                }
                
                // DUPLICATE DETECTION: Check if the "answer" is just the question repeated
                // (happens when AccordionContent is conditionally rendered and not force-mounted)
                const normalizeText = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
                const questionNorm = normalizeText(questionText);
                const answerPlainText = normalizeText(
                    answerContent
                        .replace(/<!--\s*\/?wp:[a-zA-Z0-9/-]+\s*(?:\{[^}]*\})?\s*\/?-->/g, '')
                        .replace(/<[^>]+>/g, '')
                );
                
                const isDuplicate = !answerPlainText ||
                    answerPlainText === questionNorm ||
                    questionNorm.includes(answerPlainText) ||
                    (answerPlainText.includes(questionNorm) && answerPlainText.length < questionNorm.length * 2.5);
                
                if (isDuplicate) {
                    // Try faqData lookup
                    if (ctx.faqData && ctx.faqData.length > 0) {
                        const match = ctx.faqData.find(faq => {
                            const faqQ = normalizeText(faq.q);
                            return faqQ === questionNorm || faqQ.includes(questionNorm) || questionNorm.includes(faqQ);
                        });
                        if (match && match.a) {
                            answerContent = `<!-- wp:paragraph -->\n<p>${escapeHtml(match.a)}</p>\n<!-- /wp:paragraph -->`;
                        } else {
                            answerContent = `<!-- wp:paragraph -->\n<p>(Answer content not available — please add your answer here)</p>\n<!-- /wp:paragraph -->`;
                        }
                    } else {
                        answerContent = `<!-- wp:paragraph -->\n<p>(Answer content not available — please add your answer here)</p>\n<!-- /wp:paragraph -->`;
                    }
                }
                
                // Strip Radix UI/Tailwind classes that interfere with native <details> behavior
                const itemClass = getClassName(item)
                    .replace(/\boverflow-hidden\b/g, '')
                    .replace(/\btransition-all\b/g, '')
                    .replace(/data-\[[^\]]*\]:[^\s]*/g, '')
                    .replace(/\banimation-[^\s]*/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                const attrs: any = {};
                if (itemClass) attrs.className = itemClass;
                
                trackBlock(ctx, 'core/details');
                detailsBlocks.push(
                    `<!-- wp:details ${JSON.stringify(attrs)} -->\n<details class="wp-block-details${itemClass ? ' ' + itemClass : ''}">\n<summary>${escapeHtml(questionText)}</summary>\n\n${answerContent}\n\n</details>\n<!-- /wp:details -->`
                );
            } else if (trigger) {
                // Panel is missing (Radix didn't force-mount it), but we have a trigger.
                // Extract question and look up the answer from faqData.
                const normalizeText = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
                let qText = '';
                for (const node of Array.from(trigger.childNodes)) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        qText += (node.textContent || '').trim() + ' ';
                    } else if (node instanceof HTMLElement && node.tagName.toLowerCase() !== 'svg' && !node.querySelector('svg')) {
                        qText += (node.textContent || '').trim() + ' ';
                    }
                }
                qText = qText.trim();
                if (!qText) qText = trigger.textContent?.trim() || '';
                
                let answerContent = '';
                if (qText && ctx.faqData && ctx.faqData.length > 0) {
                    const qNorm = normalizeText(qText);
                    const match = ctx.faqData.find(faq => {
                        const faqQ = normalizeText(faq.q);
                        return faqQ === qNorm || faqQ.includes(qNorm) || qNorm.includes(faqQ);
                    });
                    if (match && match.a) {
                        answerContent = `<!-- wp:paragraph -->\n<p>${escapeHtml(match.a)}</p>\n<!-- /wp:paragraph -->`;
                    }
                }
                if (!answerContent) {
                    answerContent = `<!-- wp:paragraph -->\n<p>(Answer content not available — please add your answer here)</p>\n<!-- /wp:paragraph -->`;
                }
                
                const itemClass = getClassName(item)
                    .replace(/\boverflow-hidden\b/g, '')
                    .replace(/\btransition-all\b/g, '')
                    .replace(/data-\[[^\]]*\]:[^\s]*/g, '')
                    .replace(/\banimation-[^\s]*/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                const attrs: any = {};
                if (itemClass) attrs.className = itemClass;
                
                trackBlock(ctx, 'core/details');
                detailsBlocks.push(
                    `<!-- wp:details ${JSON.stringify(attrs)} -->\n<details class="wp-block-details${itemClass ? ' ' + itemClass : ''}">\n<summary>${escapeHtml(qText)}</summary>\n\n${answerContent}\n\n</details>\n<!-- /wp:details -->`
                );
            } else {
                // Not a standard accordion item — process normally
                const itemResult = processElement(item, ctx);
                if (itemResult) {
                    if (Array.isArray(itemResult)) detailsBlocks.push(...itemResult);
                    else detailsBlocks.push(itemResult);
                }
            }
        }
        
        if (detailsBlocks.length > 0) {
            return detailsBlocks.join('\n\n');
        }
    }

    // ─── HEURISTIC: Individual accordion item → core/details ──────────
    // When processElement catches a single data-state="closed" item and
    // routes it here, the parent-level accordion heuristics above won't fire.
    // Detect: this element itself has data-state AND contains a trigger button
    // but is NOT an accordion parent container (no data-orientation).
    const elDataState = el.getAttribute('data-state');
    const elTrigger = el.querySelector('button[data-state]:not([role="combobox"]):not([data-radix-select-trigger]), button[aria-expanded]:not([role="combobox"]), a[aria-expanded]');
    const isIndividualAccordionItem = (elDataState === 'open' || elDataState === 'closed')
        && elTrigger
        && !el.hasAttribute('data-orientation')
        && !el.querySelector('[data-orientation="vertical"]');
    
    if (isIndividualAccordionItem) {
        // Extract question text from trigger (skip SVG chevron icons)
        let questionText = '';
        for (const node of Array.from(elTrigger.childNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
                questionText += (node.textContent || '').trim() + ' ';
            } else if (node instanceof HTMLElement && node.tagName.toLowerCase() !== 'svg' && node.tagName.toLowerCase() !== 'div' && !node.querySelector('svg')) {
                questionText += (node.textContent || '').trim() + ' ';
            }
        }
        questionText = questionText.trim();
        if (!questionText) questionText = elTrigger.textContent?.trim() || '';
        
        if (questionText && questionText.length > 3) {
            // Look for answer content in the DOM first
            let answerHtml = '';
            const normalizeText = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
            const qNorm = normalizeText(questionText);
            
            // Check DOM panels (role="region", content divs)
            const contentPanel = el.querySelector('[role="region"], [data-radix-accordion-content]') as HTMLElement | null;
            if (contentPanel && contentPanel.textContent?.trim()) {
                const panelText = normalizeText(contentPanel.textContent);
                // Verify panel text isn't just the question repeated
                const isDuplicate = !panelText || panelText === qNorm || 
                    qNorm.includes(panelText) ||
                    (panelText.includes(qNorm) && panelText.length < qNorm.length * 2.5);
                if (!isDuplicate) {
                    // Remove trigger elements from DOM before processing panel
                    const triggerClone = el.cloneNode(true) as HTMLElement;
                    const triggerToRemove = triggerClone.querySelector('button[data-state], button[aria-expanded], h3, [role="heading"]');
                    if (triggerToRemove) triggerToRemove.remove();
                    triggerClone.querySelectorAll('svg').forEach(svg => {
                        const w = svg.getAttribute('width');
                        const h = svg.getAttribute('height');
                        if ((w && parseInt(w) <= 24) || (h && parseInt(h) <= 24) || svg.classList.contains('shrink-0') || svg.classList.contains('lucide')) {
                            svg.remove();
                        }
                    });
                    const panelInClone = triggerClone.querySelector('[role="region"], [data-radix-accordion-content]') as HTMLElement | null;
                    if (panelInClone) {
                        const innerWrapper = panelInClone.querySelector(':scope > div');
                        if (innerWrapper && innerWrapper.textContent?.trim()) {
                            answerHtml = processChildren(innerWrapper as HTMLElement, ctx).join('\n\n');
                        }
                        if (!answerHtml) {
                            answerHtml = processChildren(panelInClone, ctx).join('\n\n');
                        }
                    }
                }
            }
            
            // faqData lookup if DOM answer is empty/duplicate
            if (!answerHtml && ctx.faqData && ctx.faqData.length > 0) {
                const match = ctx.faqData.find(faq => {
                    const faqQ = normalizeText(faq.q);
                    return faqQ === qNorm || faqQ.includes(qNorm) || qNorm.includes(faqQ);
                });
                if (match && match.a) {
                    answerHtml = `<!-- wp:paragraph -->\n<p>${escapeHtml(match.a)}</p>\n<!-- /wp:paragraph -->`;
                }
            }
            
            if (!answerHtml) {
                answerHtml = `<!-- wp:paragraph -->\n<p>(Answer content not available — please add your answer here)</p>\n<!-- /wp:paragraph -->`;
            }
            
            const itemClass = getClassName(el)
                .replace(/\boverflow-hidden\b/g, '')
                .replace(/\btransition-\w+\b/g, '')
                .replace(/data-\[[^\]]*\]:[^\s]*/g, '')
                .replace(/\s+/g, ' ').trim();
            const attrs: any = {};
            if (itemClass) attrs.className = itemClass;
            
            trackBlock(ctx, 'core/details');
            return `<!-- wp:details ${JSON.stringify(attrs)} -->\n<details class="wp-block-details${itemClass ? ' ' + itemClass : ''}">\n<summary>${escapeHtml(questionText)}</summary>\n${answerHtml}\n</details>\n<!-- /wp:details -->`;
        }
    }

    // ─── HEURISTIC: Button-based FAQ accordion → core/details ─────────
    // Catches FAQ patterns where each child has a button with data-state
    // but NO data-orientation or role="region" (e.g., custom ShadCN accordions)
    // Answer content is often missing (React conditionally renders it)
    const directKids = Array.from(el.children).filter(c => c instanceof HTMLElement) as HTMLElement[];
    const buttonFaqItems = directKids.filter(kid => kid.querySelector('button[data-state]:not([role="combobox"]):not([data-radix-select-trigger]), a[aria-expanded]'));
    
    // We trigger if it's a group of 2+ items, OR if it's a single item whose text looks like a question
    // Guard: don't treat large wrapper containers as a single FAQ item.
    // A genuine single-question element should NOT contain nested accordion containers
    // or many descendant FAQ buttons (which indicates it wraps multiple accordion groups).
    const singleCandidate = buttonFaqItems.length === 1 ? buttonFaqItems[0] : null;
    const isSingleQuestion = singleCandidate !== null
        && !singleCandidate.querySelector('[data-orientation="vertical"]')
        && (singleCandidate.querySelectorAll('button[data-state]:not([role="combobox"])').length <= 2);
    
    if ((buttonFaqItems.length >= 2 && buttonFaqItems.length >= directKids.length * 0.6) || isSingleQuestion) {
        const detailsBlocks: string[] = [];
        
        for (const item of buttonFaqItems) {
            const trigger = item.querySelector('button[data-state]:not([role="combobox"]):not([data-radix-select-trigger]), a[aria-expanded]');
            if (!trigger) continue;
            
            // Extract question text (skip SVGs)
            let questionText = '';
            for (const node of Array.from(trigger.childNodes)) {
                if (node.nodeType === Node.TEXT_NODE) {
                    questionText += (node.textContent || '').trim() + ' ';
                } else if (node instanceof HTMLElement && node.tagName.toLowerCase() !== 'svg' && node.tagName.toLowerCase() !== 'div' && !node.querySelector('svg')) {
                    questionText += (node.textContent || '').trim() + ' ';
                }
            }
            questionText = questionText.trim();
            if (!questionText) continue;
            
            // Try to find answer from faqData
            let answerHtml = '';
            if (ctx.faqData && ctx.faqData.length > 0) {
                const normalQ = questionText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                const match = ctx.faqData.find(faq => {
                    const faqQ = faq.q.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                    return faqQ === normalQ || faqQ.includes(normalQ) || normalQ.includes(faqQ);
                });
                if (match) {
                    answerHtml = `<!-- wp:paragraph -->\n<p>${escapeHtml(match.a)}</p>\n<!-- /wp:paragraph -->`;
                }
            }
            
            // If no faqData match, check if the item has a sibling/child content panel
            if (!answerHtml) {
                // PRIORITY: Try [role="region"] FIRST — this is the Radix AccordionContent panel.
                // The generic [data-state="closed"] selector can match trigger wrappers before
                // the answer panel in DOM order, causing the question to be extracted as the answer.
                let contentPanel = item.querySelector('[role="region"]') as HTMLElement | null;
                
                // Only fall back to broader selectors if role=region not found
                if (!contentPanel || !contentPanel.textContent?.trim()) {
                    contentPanel = item.querySelector('.accordion-content, [class*="faq-answer"], [id*="content"]') as HTMLElement | null;
                }
                
                if (contentPanel && contentPanel.textContent?.trim()) {
                    // Verify the content is NOT just the question repeated
                    const panelText = contentPanel.textContent.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                    const qText = questionText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                    if (panelText !== qText && !(panelText.includes(qText) && panelText.length < qText.length * 1.5)) {
                        answerHtml = processChildren(contentPanel as HTMLElement, ctx).join('\n\n');
                    }
                }
            }
            
            if (!answerHtml) {
                answerHtml = `<!-- wp:paragraph -->\n<p>(Answer content not available — please add your answer here)</p>\n<!-- /wp:paragraph -->`;
            }
            
            const itemClass = getClassName(item)
                .replace(/\boverflow-hidden\b/g, '')
                .replace(/\btransition-\w+\b/g, '')
                .replace(/data-\[[^\]]*\]:[^\s]*/g, '')
                .replace(/\s+/g, ' ').trim();
            const attrs: any = {};
            if (itemClass) attrs.className = itemClass;
            
            trackBlock(ctx, 'core/details');
            detailsBlocks.push(
                `<!-- wp:details ${JSON.stringify(attrs)} -->\n<details class="wp-block-details${itemClass ? ' ' + itemClass : ''}">\n<summary>${escapeHtml(questionText)}</summary>\n${answerHtml}\n</details>\n<!-- /wp:details -->`
            );
        }
        
        if (detailsBlocks.length > 0) {
            return detailsBlocks.join('\n\n');
        }
    }

    const children = processChildren(el, ctx).join('\n\n');
    let className = getClassName(el);
    const tagName = el.tagName.toLowerCase();
    let styleString = el.getAttribute('style') || '';
    const id = el.id;

    let bgImage = '';
    
    // Check inline styles for background image
    if (styleString.includes('background-image')) {
        const match = styleString.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
        if (match && match[1]) {
            bgImage = match[1];
            styleString = styleString.replace(/background-image:\s*url\(['"]?.*?['"]?\)[^;]*;?/i, '').trim();
        }
    }
    
    // Check Tailwind classes for background image
    if (className.includes('bg-[url(')) {
        const match = className.match(/bg-\[url\(['"]?(.*?)['"]?\)\]/i);
        if (match && match[1]) {
            bgImage = match[1];
            className = className.replace(/bg-\[url\(['"]?.*?['"]?\)\]/i, '').trim();
        }
    }
    
    if (bgImage) {
        bgImage = bgImage.replace(/^\/?assets\//, '__THEME_URI__/assets/');
        supportInteractivity = true; // Force theme-factory/container to support bgImage attribute
    }

    let content = children;
    if (!content.trim() && (className.includes('text-4xl') || className.includes('text-5xl') || className.includes('text-6xl'))) {
        content = `<!-- wp:paragraph --><p>0</p><!-- /wp:paragraph -->`;
    }

    const hasVisuals = className.includes('bg-') || className.includes('border') || className.includes('h-') || className.includes('w-');
    if (!content.trim() && !hasVisuals && !styleString && !id && !bgImage && !supportInteractivity) return '';

    // ─── HEURISTIC: core/spacer ──────────────────────────────────────
    // Empty div/section with only height/padding classes → spacer block
    if (!content.trim() && !bgImage && !supportInteractivity) {
        const heightMatch = className.match(/\b(?:h-(\d+)|py-(\d+)|pt-(\d+)|pb-(\d+)|min-h-\[(\d+)px\])\b/);
        const inlineHeight = styleString.match(/(?:height|min-height):\s*(\d+)px/i);
        if (heightMatch || inlineHeight) {
            const px = inlineHeight ? parseInt(inlineHeight[1]) : ((parseInt(heightMatch?.[1] || heightMatch?.[2] || heightMatch?.[3] || heightMatch?.[4] || heightMatch?.[5] || '0')) * 4);
            if (px > 0) {
                return `<!-- wp:spacer {"height":"${px}px"} -->\n<div style="height:${px}px" aria-hidden="true" class="wp-block-spacer"></div>\n<!-- /wp:spacer -->`;
            }
        }
    }

    // ─── HEURISTIC: core/cover ───────────────────────────────────────
    // Container with a background image → cover block (hero sections, banners)
    if (bgImage && !supportInteractivity) {
        return createCover(el, ctx, bgImage, children, className, styleString);
    }

    // ─── HEURISTIC: core/gallery ─────────────────────────────────────
    // Container whose ONLY children are images → gallery block
    if (!supportInteractivity && !bgImage) {
        const directKids = Array.from(el.children);
        const allImages = directKids.length >= 2 && directKids.every(c => {
            const t = c.tagName.toLowerCase();
            return t === 'img' || (t === 'figure' && c.querySelector('img')) || (t === 'picture' && c.querySelector('img'));
        });
        if (allImages) {
            return createGallery(el, ctx);
        }
    }

    // ─── HEURISTIC: core/media-text ──────────────────────────────────
    // Container with exactly 2 children: one image-like + one text-like → media-text
    if (!supportInteractivity && !bgImage) {
        const directKids = Array.from(el.children).filter(c => c instanceof HTMLElement) as HTMLElement[];
        if (directKids.length === 2 && (className.includes('flex') || className.includes('grid'))) {
            const imgIdx = directKids.findIndex(c => {
                const t = c.tagName.toLowerCase();
                return t === 'img' || (c.querySelector('img') && !c.querySelector('p, h1, h2, h3, h4, h5, h6'));
            });
            const textIdx = directKids.findIndex(c => {
                return c.querySelector('p, h1, h2, h3, h4, h5, h6') != null;
            });
            if (imgIdx !== -1 && textIdx !== -1 && imgIdx !== textIdx) {
                return createMediaText(el, ctx, directKids, imgIdx);
            }
        }
    }

    // ─── HEURISTIC: core/columns ─────────────────────────────────────
    // Flex/grid row with 2-6 direct children → columns block
    if (!supportInteractivity && !bgImage) {
        const isColumnar = (className.includes('grid') && /grid-cols-\d/.test(className)) ||
                           (className.includes('flex') && !className.includes('flex-col'));
        const directKids = Array.from(el.children).filter(c => c instanceof HTMLElement && c.tagName.toLowerCase() !== 'style' && c.tagName.toLowerCase() !== 'script') as HTMLElement[];
        if (isColumnar && directKids.length >= 2 && directKids.length <= 6) {
            return createColumns(el, ctx, directKids);
        }
    }

    // If supportInteractivity is true, we map to theme-factory/container to allow custom data/aria/role attributes
    if (supportInteractivity) {
        const attributes: any = {};
        if (tagName !== 'div') attributes.tagName = tagName;
        if (className) attributes.className = className;
        if (id) attributes.id = id;
        if (bgImage) attributes.bgImage = bgImage;
        
        // Extract all interactive attributes
        const extraAttrs: Record<string, string> = {};
        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            const name = attr.name;
            if (name.startsWith('data-') || name.startsWith('aria-') || name === 'role' || name === 'hidden') {
                extraAttrs[name] = attr.value;
            }
        }
        
        // Save them to extraAttributes
        if (Object.keys(extraAttrs).length > 0) {
            attributes.extraAttributes = JSON.stringify(extraAttrs);
        }

        let styleAttr = '';
        if (styleString) {
            let cleaned = styleString.trim().replace(/\s+/g, ' ');
            // Handle max-height/visibility on tabs and accordions
            if (extraAttrs['role'] === 'tabpanel' || extraAttrs['data-orientation']) {
                 cleaned = cleaned
                    .replace(/max-height:\s*0(px)?;?/gi, '')
                    .replace(/(?<![a-z-])height:\s*0(px)?;?/gi, '')
                    .replace(/overflow:\s*hidden;?/gi, '')
                    .trim();
            }
            if (cleaned) {
                // Inline styles for theme-factory/container are mapped to attributes.style as string
                attributes.style = cleaned;
                styleAttr = ` style="${escapeAttr(cleaned)}"`;
            }
        }

        // Apply them textually for the inner block wrapper
        let extraHtmlAttrs = '';
        for (const [k, v] of Object.entries(extraAttrs)) {
             if (k === 'hidden' && !v) {
                 extraHtmlAttrs += ` hidden`;
             } else {
                 extraHtmlAttrs += ` ${k}="${escapeAttr(v)}"`;
             }
        }
        // Remove hidden from tabpanel initially so it is editable and not display:none forever (will be fixed by frontend JS runtime)
        if (extraAttrs['role'] === 'tabpanel' && extraAttrs['hidden'] !== undefined) {
             extraHtmlAttrs = extraHtmlAttrs.replace(/\\s*hidden(=["']?["']?)?/, '');
        }

        const finalClass = `wp-block-theme-factory-container ${className}`.trim();
        const idAttr = id ? ` id="${escapeAttr(id)}"` : '';
        trackBlock(ctx, 'theme-factory/container');
        
        // HEURISTIC AUDIT: Risky Gutenberg CSS
        if (ctx?.logs) {
            const hasRiskyPositioning = /\b(absolute|fixed|-mt-|z-\[|z-\d+)\b/.test(className) || 
                                        /position:\s*absolute/i.test(styleString) || 
                                        /position:\s*fixed/i.test(styleString);
                                        
            if (hasRiskyPositioning) {
                // Find exactly which ones matched
                const matches: string[] = Array.from(className.match(/\b(absolute|fixed|-mt-\d+|z-\[\d+\]|z-\d+)\b/g) || []);
                if (styleString.match(/position:\s*(absolute|fixed)/i)) matches.push('inline-position');
                
                ctx.logs.push({
                    type: 'warn',
                    message: 'Risky Editor Canvas Positioning',
                    suggestion: `Gutenberg injects div wrappers that often break these styles: [${matches.join(', ')}]. Consider using flex/grid layouts or 'relative' positioning instead.`,
                    snippet: `<${tagName} class="${finalClass}" ...>`
                });
            }
            
            // HEURISTIC AUDIT: Hardcoded or Arbitrary Colors
            if (ctx?.logs) {
                const hardcodedHexOrHsl = (styleString.match(/(#[0-9a-fA-F]{3,6}|hsl\(.*?\)|rgb\(.*?\))/g) || []);
                const arbitraryTailwindColor = (className.match(/(text|bg|border|fill|stroke)-\[[^\]]+\]/g) || []);
                
                const allHardcodedColors = [...new Set([...hardcodedHexOrHsl, ...arbitraryTailwindColor])];

                if (allHardcodedColors.length > 0) {
                     // Track colors for theme token suggestions
                     allHardcodedColors.forEach(c => trackColor(ctx, c));
                     ctx.logs.push({
                        type: 'info',
                        message: 'Hardcoded Color Detected',
                        suggestion: `Found ${allHardcodedColors.join(', ')}. These colors won't sync with the WordPress Theme Customizer palette natively. Use Tailwind theme variables (e.g., 'text-primary' or 'bg-accent') instead if you want user-editable theme colors.`,
                        snippet: `<${tagName} class="${className}" style="${styleString.replace(/"/g, "'")}">`
                     });
                }
            }
        }

        return `<!-- wp:theme-factory/container ${JSON.stringify(attributes)} -->\n<${tagName} class="${finalClass}"${idAttr}${styleAttr}${extraHtmlAttrs}>\n${content}\n</${tagName}>\n<!-- /wp:theme-factory/container -->`;
    }

    // CRITICAL FIX: Detect containers with DIRECT flex/grid layout classes
    // WordPress wp:group adds __inner-container wrappers that BREAK flex/grid layouts
    // These containers MUST be preserved as HTML blocks to maintain correct layout 
    // BUT we use supportInteractivity=true (theme-factory/container) so they are still editable
    // and don't add the broken __inner-container children wrappers.
    const hasDirectLayoutClass = /\b(flex|inline-flex|grid|inline-grid)\b/.test(className);
    
    if (hasDirectLayoutClass) {
        // Re-call with true to map to theme-factory/container
        return createContainer(el, ctx, true);
    }

    // ─── ALL containers use theme-factory/container (dynamic block) ───
    // Previously this fell through to core/group, but core blocks validate
    // their save function output against stored HTML, causing "Block contains
    // unexpected or invalid content" errors whenever the converter HTML
    // doesn't perfectly match WP's internal formatting.
    // theme-factory/container is dynamic (save returns null) → no validation.
    const attributes: any = {};
    if (tagName !== 'div') attributes.tagName = tagName;
    if (className) attributes.className = className;
    if (id) attributes.id = id;

    let styleAttr = '';
    if (styleString) {
        const cleaned = styleString.trim().replace(/\s+/g, ' ');
        attributes.style = cleaned;
        styleAttr = ` style="${escapeAttr(cleaned)}"`;
    }

    const finalClass = `wp-block-theme-factory-container ${className}`.trim();
    const idAttr = id ? ` id="${escapeAttr(id)}"` : '';
    trackBlock(ctx, 'theme-factory/container');

    return `<!-- wp:theme-factory/container ${JSON.stringify(attributes)} -->\n<${tagName} class="${finalClass}"${idAttr}${styleAttr}>\n${content}\n</${tagName}>\n<!-- /wp:theme-factory/container -->`;
}

function createSvgBlock(el: HTMLElement, ctx?: ConversionContext): string {
    const rawSvg = el.outerHTML;
    
    // HEURISTIC AUDIT: Raw SVGs are not point-and-click editable
    if (ctx?.logs) {
        ctx.logs.push({
            type: 'info',
            message: 'Raw SVG Embedded',
            suggestion: 'Raw SVGs are supported, but their colors (`fill`, `stroke`) cannot be point-and-click edited in the Gutenberg canvas natively. Advanced users will need to edit this block as HTML to change its color.',
            snippet: rawSvg.substring(0, 100) + '...'
        });
    }

    // Base64 encode the SVG html — attribute name MUST match the deployed plugin's block.json
    // The deployed plugin (whipify 3.0/theme-factory-blocks) uses "content" attribute,
    // and its PHP render_svg() calls base64_decode($attributes['content'])
    const encoded = btoa(unescape(encodeURIComponent(rawSvg)));
    const attrs = { content: encoded }; // MUST be "content" to match deployed plugin
    return `<!-- wp:theme-factory/svg ${JSON.stringify(attrs)} -->\n<div class="wp-block-theme-factory-svg">${rawSvg}</div>\n<!-- /wp:theme-factory/svg -->`;
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'iframe', 'canvas']);

function createHtmlFragment(el: HTMLElement, ctx?: ConversionContext): string {
    // If it's a void tag (input, br, hr, iframe) that cannot have children, it MUST be raw HTML
    // because theme-factory/container block requires closing tags and InnerBlocks
    switch (el.tagName.toLowerCase()) {
        case 'br':
        case 'iframe':
            return createHtmlBlock(el, ctx);
        case 'svg':
            return createSvgBlock(el, ctx);
        default:
            if (VOID_TAGS.has(el.tagName.toLowerCase())) {
                return createHtmlBlock(el);
            }
            // For ALL OTHER fallback tags (like custom elements, spans with children, unknown tags), 
            // map to theme-factory/container so they are fully editable deeply nested in Gutenberg!
            return createContainer(el, ctx as ConversionContext, true);
    }
}

function createHtmlBlock(el: HTMLElement, ctx?: ConversionContext): string {
    // Clone and clean artefacts before serialization to remove "white box" issues
    const clone = el.cloneNode(true) as HTMLElement;
    cleanMuiArtifacts(clone);
    
    // CRITICAL FIX: Strip React animation artifacts from ALL descendants
    // React apps use opacity-0 + JS to fade elements in. Without JS they stay invisible.
    // This must run on the clone BEFORE serialization to outerHTML.
    stripReactAnimationArtifacts(clone);
    
    // CRITICAL: Inject FAQ answers into empty accordion content divs at BUILD TIME
    // This ensures answers are in the HTML source (SEO-friendly) and don't require JS
    if (ctx?.faqData && ctx.faqData.length > 0) {
        injectFaqAnswersIntoElement(clone, ctx.faqData);
    }

    const html = clone.outerHTML;
    
    // HEURISTIC AUDIT: Uneditable Raw Blocks
    // wp:html cannot be edited visually. We must alert the developer that they built
    // an overly complex component that failed heuristic mapping.
    if (ctx?.logs) {
        ctx.logs.push({
            type: 'error',
            message: 'Converted to Uneditable Raw HTML',
            suggestion: 'This element was too complex (likely containing heavy nesting, unsupported media tags, or SVGs) and was converted to a Raw HTML block. The user cannot edit this visually.',
            snippet: html.substring(0, 80) + '...'
        });
    }

    // Use core/html block - always available, no plugin needed
    // Note: wp:html blocks are NOT visually editable in Gutenberg
    // They show raw HTML code. Only use for truly complex cases.
    if (ctx) trackBlock(ctx, 'core/html');
    return `<!-- wp:html -->\n${html}\n<!-- /wp:html -->`;
}

/**
 * Strip React/Tailwind animation classes that cause invisible content in WordPress.
 * These classes (opacity-0, invisible, animate-*) are meant to be removed by JS at runtime.
 * Without React JS, elements stay permanently hidden.
 * Also strips animation-delay inline styles which are meaningless without the animation.
 */
function stripReactAnimationArtifacts(root: HTMLElement) {
    const allElements = [root, ...Array.from(root.querySelectorAll('*'))];
    
    for (const el of allElements) {
        const cn = el.getAttribute('class');
        if (cn) {
            let cleaned = cn
                .replace(/\bopacity-0\b/g, '')
                .replace(/\binvisible\b/g, '')
                .replace(/\banimate-[\w-]+\b/g, '')       // animate-tilt, animate-fade-in, etc.
                .replace(/\btransition-opacity\b/g, '')     // transition class without trigger
                .trim()
                .replace(/\s+/g, ' ');
            
            if (cleaned !== cn) {
                el.setAttribute('class', cleaned);
            }
        }
        
        // Strip animation-delay and animation-related inline styles
        const style = el.getAttribute('style');
        if (style) {
            let cleanedStyle = style
                .replace(/animation-delay:\s*[^;]+;?/gi, '')
                .replace(/animation:\s*[^;]+;?/gi, '')
                .trim();
            
            // Also strip transition: opacity which was paired with opacity-0
            cleanedStyle = cleanedStyle
                .replace(/transition:\s*opacity[^;]*;?/gi, '')
                .trim();
            
            // CRITICAL: Strip max-height:0 and height:0 from tab panels
            // Radix uses these to collapse inactive tab content - without JS they stay collapsed forever
            if (el.getAttribute('role') === 'tabpanel' || el.hasAttribute('data-orientation')) {
                cleanedStyle = cleanedStyle
                    .replace(/max-height:\s*0(px)?;?/gi, '')
                    .replace(/(?<![a-z-])height:\s*0(px)?;?/gi, '')
                    .replace(/overflow:\s*hidden;?/gi, '')
                    .trim();
            }
            
            if (cleanedStyle) {
                el.setAttribute('style', cleanedStyle);
            } else {
                el.removeAttribute('style');
            }
        }
        
        // CRITICAL: Remove 'hidden' attribute from Radix tab panels
        // Radix sets hidden="" on inactive panels. Without JS to remove it, content stays invisible.
        // Our initRadixTabs JS handler will manage visibility at runtime.
        if (el.getAttribute('role') === 'tabpanel' && el.hasAttribute('hidden')) {
            el.removeAttribute('hidden');
            // Set inactive panels to display:none instead - JS will toggle this
            if (el.getAttribute('data-state') !== 'active') {
                el.setAttribute('style', (el.getAttribute('style') || '') + ';display:none;');
            }
        }
    }
}

/**
 * Inject FAQ answers directly into accordion content elements
 * This runs at BUILD TIME, embedding answers in the static HTML
 */
function injectFaqAnswersIntoElement(el: HTMLElement, faqData: FaqItem[]) {
    // Find accordion content containers that might be empty or have placeholder text
    const contentDivs = el.querySelectorAll(
        '.accordion-content-injected, [data-radix-accordion-content], [role="region"][data-state]'
    );
    
    contentDivs.forEach(contentDiv => {
        const content = contentDiv.innerHTML.trim();
        
        // Skip if already has meaningful content (not a placeholder)
        // Placeholder patterns to replace: "Please contact us", empty, or very short
        const isPlaceholder = 
            content.length < 10 ||
            content.toLowerCase().includes('please contact us') ||
            content.toLowerCase().includes('contact us for more') ||
            content.toLowerCase().includes('more information');
        
        if (!isPlaceholder) return;
        
        // Find associated question trigger
        const trigger = findTriggerForAccordionContent(contentDiv as HTMLElement, el);
        if (!trigger) return;
        
        const questionText = normalizeForMatching(trigger.textContent || '');
        if (!questionText || questionText.length < 5) return;
        
        // Look up answer by fuzzy matching question text
        const match = faqData.find(item => {
            const itemQ = normalizeForMatching(item.q);
            // Match if question contains FAQ question or vice versa
            return questionText.includes(itemQ) || itemQ.includes(questionText) ||
                   // Also match partial overlap (first 30 chars for longer questions)
                   questionText.substring(0, 30) === itemQ.substring(0, 30);
        });
        
        if (match && match.a) {
            // Inject the answer directly - preserve HTML markup if present
            // Only wrap in <p> if it doesn't already contain block-level HTML
            const hasBlockHtml = /<(p|div|ul|ol|h[1-6]|table)/i.test(match.a);
            contentDiv.innerHTML = hasBlockHtml ? match.a : `<p>${match.a}</p>`;
        }
    });
    
    // Also handle wp-block-button based accordions (the live site pattern)
    const buttonLinks = el.querySelectorAll('.wp-block-button__link, a[href="#"]');
    buttonLinks.forEach(btn => {
        const questionText = normalizeForMatching(btn.textContent || '');
        if (!questionText || questionText.length < 5) return;
        
        // Find the content div that follows this button
        const wrapper = btn.closest('.wp-block-button') || btn.parentElement;
        if (!wrapper) return;
        
        let contentDiv = wrapper.querySelector('.accordion-content-injected') as HTMLElement;
        
        // If no content div exists inside wrapper, check next siblings
        if (!contentDiv) {
            let sibling = wrapper.nextElementSibling;
            while (sibling) {
                if (sibling.classList?.contains('accordion-content-injected')) {
                    contentDiv = sibling as HTMLElement;
                    break;
                }
                // Stop if we hit another button (next FAQ item)
                if (sibling.classList?.contains('wp-block-button') || 
                    sibling.querySelector?.('.wp-block-button__link')) {
                    break;
                }
                sibling = sibling.nextElementSibling;
            }
        }
        
        // If content div exists but is empty or has placeholder, inject answer
        if (contentDiv) {
            const content = contentDiv.innerHTML.trim();
            const isPlaceholder = 
                content.length < 10 ||
                content.toLowerCase().includes('please contact us') ||
                content.toLowerCase().includes('contact us for more') ||
                content.toLowerCase().includes('more information');
            
            if (isPlaceholder) {
                const match = faqData.find(item => {
                    const itemQ = normalizeForMatching(item.q);
                    return questionText.includes(itemQ) || itemQ.includes(questionText) ||
                           questionText.substring(0, 30) === itemQ.substring(0, 30);
                });
                
                if (match && match.a) {
                    // Preserve HTML markup in answer, wrap in styled container
                    const hasBlockHtml = /<(p|div|ul|ol|h[1-6]|table)/i.test(match.a);
                    const innerContent = hasBlockHtml ? match.a : `<p>${match.a}</p>`;
                    contentDiv.innerHTML = `<div style="padding: 1rem 0; color: hsl(var(--muted-foreground)); font-size: 0.875rem; line-height: 1.5;">${innerContent}</div>`;
                }
            }
        }
    });
}

/**
 * Normalize text for FAQ matching: lowercase, strip punctuation, compress whitespace
 */
function normalizeForMatching(text: string): string {
    return (text || '')
        .toLowerCase()
        .replace(/[?!.,;:'"()[\]{}]/g, '')  // Strip punctuation
        .replace(/\s+/g, ' ')                // Compress whitespace
        .trim();
}

/**
 * Find the trigger element (button/link) associated with an accordion content region
 * Walks previous siblings and handles wp-block-button wrappers
 */
function findTriggerForAccordionContent(contentDiv: HTMLElement, rootEl: HTMLElement): HTMLElement | null {
    // Method 1: aria-labelledby points to trigger ID
    const labelId = contentDiv.getAttribute('aria-labelledby');
    if (labelId) {
        // Escape special characters in ID for CSS selector (Radix uses IDs like "radix-:r0:")
        // Colons and other special chars must be escaped with backslash
        const escapedId = labelId.replace(/([^\w-])/g, '\\$1');
        try {
            const trigger = rootEl.querySelector(`#${escapedId}`) as HTMLElement;
            if (trigger) return trigger;
        } catch (e) {
            // If selector still fails, try getElementById as fallback
            const trigger = rootEl.ownerDocument?.getElementById(labelId) as HTMLElement;
            if (trigger) return trigger;
        }
    }
    
    // Method 2: Walk previous siblings to find the trigger
    let prev = contentDiv.previousElementSibling as HTMLElement;
    while (prev) {
        // Check if it's a wp-block-button wrapper
        if (prev.classList?.contains('wp-block-button')) {
            const inner = prev.querySelector('.wp-block-button__link, a, button') as HTMLElement;
            if (inner) return inner;
            // If wrapper has no inner link, the wrapper itself might be clickable
            if (prev.textContent?.trim()) return prev;
        }
        
        // Check if it's a direct button or link
        if (prev.tagName === 'BUTTON' || prev.tagName === 'A') {
            return prev;
        }
        
        // Check for button/link inside this sibling
        const btn = prev.querySelector('button[aria-expanded], .wp-block-button__link, a[href="#"]') as HTMLElement;
        if (btn) return btn;
        
        // Stop if we hit a previous content div (we've gone too far)
        if (prev.classList?.contains('accordion-content-injected') ||
            prev.hasAttribute('data-radix-accordion-content') ||
            prev.getAttribute('role') === 'region') {
            break;
        }
        
        prev = prev.previousElementSibling as HTMLElement;
    }
    
    // Method 3: Parent accordion item contains trigger
    const accordionItem = contentDiv.closest('[data-radix-accordion-item], [data-state]');
    if (accordionItem) {
        const trigger = accordionItem.querySelector(
            '[data-radix-accordion-trigger], button[aria-expanded], .wp-block-button__link'
        ) as HTMLElement;
        if (trigger) return trigger;
    }
    
    return null;
}

// ---------------------------------------------------------------------------
// Native Core Block Generators
// ---------------------------------------------------------------------------

function createQuote(el: HTMLElement, ctx: ConversionContext): string {
    const children = processChildren(el, ctx).join('\n\n');
    const className = getClassName(el);
    const attrs = className ? `{"className":"${className}"}` : '{}';
    return `<!-- wp:quote ${attrs} -->\n<blockquote class="wp-block-quote${className ? ' ' + className : ''}">\n${children}\n</blockquote>\n<!-- /wp:quote -->`;
}

function createSeparator(el: HTMLElement): string {
    const className = getClassName(el);
    const attrs = className ? `{"className":"${className}"}` : '{}';
    return `<!-- wp:separator ${attrs} -->\n<hr class="wp-block-separator has-alpha-channel-opacity${className ? ' ' + className : ''}"/>\n<!-- /wp:separator -->`;
}

function createVideo(el: HTMLElement, ctx: ConversionContext): string {
    const src = el.getAttribute('src') || '';
    const safeSrc = src.replace(/^\/?assets\//, '__THEME_URI__/assets/');
    const className = getClassName(el);
    
    const autoplay = el.hasAttribute('autoplay');
    const controls = el.hasAttribute('controls') || true; // Gutenberg assumes controls by default usually
    const loop = el.hasAttribute('loop');
    const muted = el.hasAttribute('muted');
    const playsinline = el.hasAttribute('playsinline');
    const posterAttr = el.getAttribute('poster');
    const poster = posterAttr ? posterAttr.replace(/^\/?assets\//, '__THEME_URI__/assets/') : '';
    
    const sources = Array.from(el.querySelectorAll('source')).map(s => {
        const sSrc = s.getAttribute('src') || '';
        const type = s.getAttribute('type') || '';
        return `<source src="${sSrc.replace(/^\/?assets\//, '__THEME_URI__/assets/')}"${type ? ` type="${type}"` : ''} />`;
    }).join('\n');
    
    const attrs: any = {};
    if (className) attrs.className = className;
    if (autoplay) attrs.autoplay = true;
    if (loop) attrs.loop = true;
    if (muted) attrs.muted = true;
    if (playsinline) attrs.playsInline = true;
    if (poster) attrs.poster = poster;
    
    return `<!-- wp:video ${JSON.stringify(attrs)} -->\n<figure class="wp-block-video${className ? ' ' + className : ''}"><video${autoplay?' autoplay':''}${controls?' controls':''}${loop?' loop':''}${muted?' muted':''}${playsinline?' playsinline':''}${safeSrc?` src="${safeSrc}"`:''}${poster?` poster="${poster}"`:''}>${sources}</video></figure>\n<!-- /wp:video -->`;
}

function createAudio(el: HTMLElement, ctx: ConversionContext): string {
    const src = el.getAttribute('src') || '';
    const safeSrc = src.replace(/^\/?assets\//, '__THEME_URI__/assets/');
    const className = getClassName(el);
    
    const autoplay = el.hasAttribute('autoplay');
    const controls = el.hasAttribute('controls') || true;
    const loop = el.hasAttribute('loop');
    const muted = el.hasAttribute('muted');
    
    const sources = Array.from(el.querySelectorAll('source')).map(s => {
        const sSrc = s.getAttribute('src') || '';
        const type = s.getAttribute('type') || '';
        return `<source src="${sSrc.replace(/^\/?assets\//, '__THEME_URI__/assets/')}"${type ? ` type="${type}"` : ''} />`;
    }).join('\n');
    
    const attrs: any = {};
    if (className) attrs.className = className;
    if (autoplay) attrs.autoplay = true;
    if (loop) attrs.loop = true;
    if (muted) attrs.muted = true;
    
    return `<!-- wp:audio ${JSON.stringify(attrs)} -->\n<figure class="wp-block-audio${className ? ' ' + className : ''}"><audio${autoplay?' autoplay':''}${controls?' controls':''}${loop?' loop':''}${muted?' muted':''}${safeSrc?` src="${safeSrc}"`:''}>` + sources + `</audio></figure>\n<!-- /wp:audio -->`;
}

function createDetails(el: HTMLElement, ctx: ConversionContext): string {
    const summaryEl = el.querySelector('summary');
    let summaryContent = 'Details';
    let summaryTextRaw = '';
    if (summaryEl) {
        // Extract only text from summary, skipping SVG icons
        let summaryParts: string[] = [];
        for (const node of Array.from(summaryEl.childNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
                summaryParts.push((node.textContent || '').trim());
            } else if (node instanceof HTMLElement && node.tagName.toLowerCase() !== 'svg' && !node.querySelector('svg')) {
                summaryParts.push((node.textContent || '').trim());
            }
        }
        summaryTextRaw = summaryParts.join(' ').trim() || summaryEl.textContent?.trim() || 'Details';
        summaryContent = escapeHtml(summaryTextRaw);
        summaryEl.remove(); // Remove so it doesn't get processed into child blocks
    }
    
    // CRITICAL: Strip Radix accordion remnants that may have leaked into the details element.
    const radixHeaders = el.querySelectorAll('h3, [role="heading"]');
    radixHeaders.forEach(h => {
        if (h.querySelector('button[data-state]') || h.querySelector('[aria-expanded]')) {
            h.remove();
        }
    });
    const radixButtons = el.querySelectorAll('button[data-state]');
    radixButtons.forEach(btn => btn.remove());
    el.querySelectorAll('svg').forEach(svg => {
        const w = svg.getAttribute('width');
        const h = svg.getAttribute('height');
        if ((w && parseInt(w) <= 24) || (h && parseInt(h) <= 24) || 
            svg.classList.contains('shrink-0') || svg.classList.contains('lucide')) {
            svg.remove();
        }
    });
    
    // Process remaining children into blocks
    let contentBlocks = processChildren(el, ctx).join('\n\n');
    
    // Detect when the "answer" content is just a repeat of the question.
    const normalizeText = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const questionNorm = normalizeText(summaryTextRaw);
    const contentPlainText = normalizeText(
        contentBlocks
            .replace(/<!--\s*\/?wp:[a-zA-Z0-9/-]+\s*(?:\{[^}]*\})?\s*\/?-->/g, '')
            .replace(/<[^>]+>/g, '')
    );
    
    const isDuplicateContent = !contentPlainText || 
        contentPlainText === questionNorm ||
        contentPlainText.includes(questionNorm) && contentPlainText.length < questionNorm.length * 1.5;
    
    if (isDuplicateContent) {
        if (ctx.faqData && ctx.faqData.length > 0) {
            const match = ctx.faqData.find(faq => {
                const faqQ = normalizeText(faq.q);
                return faqQ === questionNorm || faqQ.includes(questionNorm) || questionNorm.includes(faqQ) ||
                       faqQ.substring(0, 30) === questionNorm.substring(0, 30);
            });
            if (match && match.a) {
                contentBlocks = `<!-- wp:paragraph -->\n<p>${escapeHtml(match.a)}</p>\n<!-- /wp:paragraph -->`;
            } else {
                contentBlocks = `<!-- wp:paragraph -->\n<p>(Answer content not available — please add your answer here)</p>\n<!-- /wp:paragraph -->`;
            }
        } else {
            contentBlocks = `<!-- wp:paragraph -->\n<p>(Answer content not available — please add your answer here)</p>\n<!-- /wp:paragraph -->`;
        }
    }
    
    const className = getClassName(el);
    const attrs = className ? `{"className":"${className}"}` : '{}';
    
    return `<!-- wp:details ${attrs} -->\n<details class="wp-block-details${className ? ' ' + className : ''}">\n<summary>${summaryContent}</summary>\n\n${contentBlocks}\n\n</details>\n<!-- /wp:details -->`;
}

function createTable(el: HTMLElement, ctx: ConversionContext): string {
    const className = getClassName(el);
    const attrs = className ? `{"className":"${className}"}` : '{}';
    
    // HEURISTIC: Detect "rich" tables (pricing tables, tables with buttons/links/images)
    // core/table ONLY supports plain text/inline HTML in cells.
    // If any cell contains block-level content, preserve as a styled container instead.
    const hasRichContent = el.querySelector('td button, td a, td div, td img, td svg, th button, th a[class], th div');
    if (hasRichContent) {
        // Preserve as raw HTML table wrapped in our editable container
        // This keeps prices, CTA buttons, and styled elements intact
        const fullTable = el.outerHTML;
        const finalClass = `wp-block-theme-factory-container ${className}`.trim();
        trackBlock(ctx, 'theme-factory/container');
        
        if (ctx?.logs) {
            ctx.logs.push({
                type: 'info',
                message: 'Rich Table Preserved',
                suggestion: 'This table contains buttons/links/styled elements inside cells. It was preserved as a container block instead of core/table to maintain visual fidelity. Edit the HTML directly if needed.',
                snippet: `<table class="${className}"> (${el.querySelectorAll('td, th').length} cells with rich content)`
            });
        }
        
        return `<!-- wp:theme-factory/container {"className":"${className}"} -->\n<div class="${finalClass}">\n${fullTable}\n</div>\n<!-- /wp:theme-factory/container -->`;
    }

    // Gutenberg core table requires completely flattened innerHTML for table cells,
    // not inner blocks like <!-- wp:paragraph -->.
    let tableHtml = `<table class="${className}">\n`;
    
    ['thead', 'tbody', 'tfoot'].forEach(sectionTag => {
        const section = el.querySelector(`:scope > ${sectionTag}`);
        if (section) {
            tableHtml += `  <${sectionTag}>\n`;
            Array.from(section.querySelectorAll(':scope > tr')).forEach(tr => {
                tableHtml += `    <tr>\n`;
                Array.from(tr.querySelectorAll(':scope > th, :scope > td')).forEach(cell => {
                    const tag = cell.tagName.toLowerCase();
                    const colspan = cell.getAttribute('colspan');
                    const rowspan = cell.getAttribute('rowspan');
                    // We must convert nested content, but then strip wp tags to keep it flat
                    const cellHtml = processChildren(cell as HTMLElement, ctx).join(' ');
                    const inlineHtml = cellHtml.replace(/<!--\s*\/?wp:[a-zA-Z0-9-]+\s*(?:{[^}]*})?\s*\/?-->/g, '').replace(/<p[^>]*>/g, '').replace(/<\/p>/g, '<br />').replace(/<br\s*\/?>\s*$/, '').trim();
                    tableHtml += `      <${tag}${colspan ? ` colspan="${colspan}"` : ''}${rowspan ? ` rowspan="${rowspan}"` : ''}>${inlineHtml}</${tag}>\n`;
                });
                tableHtml += `    </tr>\n`;
            });
            tableHtml += `  </${sectionTag}>\n`;
        }
    });

    // Handle rows directly under table
    const directRows = el.querySelectorAll(':scope > tr');
    if (directRows.length > 0) {
        tableHtml += `  <tbody>\n`;
        Array.from(directRows).forEach(tr => {
            tableHtml += `    <tr>\n`;
            Array.from(tr.querySelectorAll(':scope > th, :scope > td')).forEach(cell => {
                const tag = cell.tagName.toLowerCase();
                const cellHtml = processChildren(cell as HTMLElement, ctx).join(' ');
                const inlineHtml = cellHtml.replace(/<!--\s*\/?wp:[a-zA-Z0-9-]+\s*(?:{[^}]*})?\s*\/?-->/g, '').replace(/<p[^>]*>/g, '').replace(/<\/p>/g, '<br />').replace(/<br\s*\/?>\s*$/, '').trim();
                tableHtml += `      <${tag}>${inlineHtml}</${tag}>\n`;
            });
            tableHtml += `    </tr>\n`;
        });
        tableHtml += `  </tbody>\n`;
    }
    
    tableHtml += `</table>`;
    return `<!-- wp:table ${attrs} -->\n<figure class="wp-block-table${className ? ' ' + className : ''}">${tableHtml}</figure>\n<!-- /wp:table -->`;
}

function createPreformatted(el: HTMLElement, ctx: ConversionContext, tag: string): string {
    const className = getClassName(el);
    const content = escapeHtml(el.textContent || '');
    
    // Gutenberg has core/code and core/preformatted. 
    // They are almost identical structurally, but code is usually inline in text,
    // while a standalone <pre> or <code> is block level.
    const blockName = tag === 'pre' ? 'core/preformatted' : 'core/code';
    const wpClass = tag === 'pre' ? 'wp-block-preformatted' : 'wp-block-code';
    const wrapperTag = tag === 'pre' ? 'pre' : 'code';
    
    const attrs = className ? `{"className":"${className}"}` : '{}';
    return `<!-- wp:${blockName.replace('core/', '')} ${attrs} -->\n<${wrapperTag} class="${wpClass}${className ? ' ' + className : ''}">${content}</${wrapperTag}>\n<!-- /wp:${blockName.replace('core/', '')} -->`;
}

// ---------------------------------------------------------------------------
// Heuristic Core Block Generators (Tier 2)
// ---------------------------------------------------------------------------

/**
 * core/cover — Hero sections with background images
 */
function createCover(el: HTMLElement, ctx: ConversionContext, bgImage: string, innerContent: string, className: string, styleString: string): string {
    const attrs: any = {
        url: bgImage,
        dimRatio: 50,
        isDark: true
    };
    if (className) attrs.className = className;
    
    let styleAttr = '';
    if (styleString) {
        styleAttr = ` style="${escapeAttr(styleString)}"`;
    }
    
    return `<!-- wp:cover ${JSON.stringify(attrs)} -->\n<div class="wp-block-cover${className ? ' ' + className : ''}"${styleAttr}><span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span><img class="wp-block-cover__image-background" alt="" src="${bgImage}" data-object-fit="cover"/><div class="wp-block-cover__inner-container">\n${innerContent}\n</div></div>\n<!-- /wp:cover -->`;
}

/**
 * core/columns + core/column — Flex/grid row layouts
 */
function createColumns(el: HTMLElement, ctx: ConversionContext, kids: HTMLElement[]): string {
    const className = getClassName(el);
    const colAttrs: any = {};
    if (className) colAttrs.className = className;
    
    const columnBlocks = kids.map(kid => {
        const kidClass = getClassName(kid);
        const kidContent = processChildren(kid, ctx).join('\n\n');
        const colInnerAttrs: any = {};
        if (kidClass) colInnerAttrs.className = kidClass;
        return `<!-- wp:column ${JSON.stringify(colInnerAttrs)} -->\n<div class="wp-block-column${kidClass ? ' ' + kidClass : ''}">\n${kidContent}\n</div>\n<!-- /wp:column -->`;
    }).join('\n\n');
    
    return `<!-- wp:columns ${JSON.stringify(colAttrs)} -->\n<div class="wp-block-columns${className ? ' ' + className : ''}">\n${columnBlocks}\n</div>\n<!-- /wp:columns -->`;
}

/**
 * core/gallery — Image-only containers
 */
function createGallery(el: HTMLElement, ctx: ConversionContext): string {
    const className = getClassName(el);
    const imgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
    
    const imageBlocks = imgs.map(img => {
        const src = (img.getAttribute('src') || '').replace(/^\/?assets\//, '__THEME_URI__/assets/');
        const alt = img.getAttribute('alt') || '';
        return `<!-- wp:image -->\n<figure class="wp-block-image"><img src="${src}" alt="${escapeAttr(alt)}"/></figure>\n<!-- /wp:image -->`;
    }).join('\n\n');
    
    const attrs: any = { columns: Math.min(imgs.length, 4) };
    if (className) attrs.className = className;
    
    return `<!-- wp:gallery ${JSON.stringify(attrs)} -->\n<figure class="wp-block-gallery has-nested-images columns-${attrs.columns}${className ? ' ' + className : ''}">\n${imageBlocks}\n</figure>\n<!-- /wp:gallery -->`;
}

/**
 * core/media-text — Image + text side by side
 */
function createMediaText(el: HTMLElement, ctx: ConversionContext, kids: HTMLElement[], imgIdx: number): string {
    const className = getClassName(el);
    const mediaOnLeft = imgIdx === 0;
    const mediaKid = kids[imgIdx];
    const textKid = kids[imgIdx === 0 ? 1 : 0];
    
    // Find the actual <img> in the media side
    const img = mediaKid.tagName.toLowerCase() === 'img' ? mediaKid as HTMLImageElement : mediaKid.querySelector('img') as HTMLImageElement;
    const src = img ? (img.getAttribute('src') || '').replace(/^\/?assets\//, '__THEME_URI__/assets/') : '';
    const alt = img ? (img.getAttribute('alt') || '') : '';
    
    const textContent = processChildren(textKid, ctx).join('\n\n');
    
    const attrs: any = {
        mediaPosition: mediaOnLeft ? 'left' : 'right',
        mediaType: 'image'
    };
    if (className) attrs.className = className;
    
    return `<!-- wp:media-text ${JSON.stringify(attrs)} -->\n<div class="wp-block-media-text${mediaOnLeft ? '' : ' has-media-on-the-right'}${className ? ' ' + className : ''}"><figure class="wp-block-media-text__media"><img src="${src}" alt="${escapeAttr(alt)}"/></figure><div class="wp-block-media-text__content">\n${textContent}\n</div></div>\n<!-- /wp:media-text -->`;
}

/**
 * core/embed — YouTube, Vimeo, and other known oEmbed providers
 */
function createEmbed(el: HTMLElement, provider: string, url: string): string {
    const attrs: any = {
        url,
        type: 'video',
        providerNameSlug: provider
    };
    
    const className = getClassName(el);
    if (className) attrs.className = className;
    
    // Extract width/height for responsive wrapper
    const width = el.getAttribute('width') || '';
    const height = el.getAttribute('height') || '';
    if (width && height) {
        attrs.responsive = true;
    }
    
    return `<!-- wp:embed ${JSON.stringify(attrs)} -->\n<figure class="wp-block-embed is-type-video is-provider-${provider} wp-block-embed-${provider}"><div class="wp-block-embed__wrapper">\n${url}\n</div></figure>\n<!-- /wp:embed -->`;
}

/**
 * Detect known oEmbed provider from an iframe src URL
 */
function detectEmbedProvider(src: string): { provider: string; url: string } | null {
    if (!src) return null;
    
    // YouTube
    const ytMatch = src.match(/(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([\w-]+)/);
    if (ytMatch) return { provider: 'youtube', url: `https://www.youtube.com/watch?v=${ytMatch[1]}` };
    
    // Vimeo
    const vimeoMatch = src.match(/vimeo\.com\/video\/(\d+)/);
    if (vimeoMatch) return { provider: 'vimeo', url: `https://vimeo.com/${vimeoMatch[1]}` };
    
    // Spotify
    const spotifyMatch = src.match(/open\.spotify\.com\/embed\/(track|album|playlist)\/([\w]+)/);
    if (spotifyMatch) return { provider: 'spotify', url: `https://open.spotify.com/${spotifyMatch[1]}/${spotifyMatch[2]}` };
    
    // SoundCloud
    if (src.includes('soundcloud.com')) return { provider: 'soundcloud', url: src };
    
    // TikTok
    if (src.includes('tiktok.com')) return { provider: 'tiktok', url: src };
    
    // Twitter/X
    if (src.includes('twitter.com') || src.includes('x.com')) return { provider: 'twitter', url: src };
    
    return null; // Unknown provider → fallback to core/html
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClassName(el: Element): string {
  let cn = el.getAttribute('class') || '';
  if (!cn) return '';

  // STRIP VIEWPORT HEIGHTS:
  // React apps use 'h-screen' for hero sections - causes huge gaps in WP
  cn = cn.replace(/\b(min-)?h-screen\b/g, '');
  
  // STRIP INVISIBILITY CLASSES:
  // React uses opacity-0/invisible as start state for JS animations.
  // Without JS, content stays invisible forever - causing "white spaces"
  cn = cn.replace(/\bopacity-0\b/g, '');
  cn = cn.replace(/\binvisible\b/g, '');
  
  // STRIP ALL ANIMATION CLASSES that won't work without JS:
  // Blanket regex catches animate-tilt, animate-fade-in, animate-scale-in, etc.
  cn = cn.replace(/\banimate-[\w-]+\b/g, '');

  return cn.trim().replace(/\s+/g, ' ');
}

/**
 * Detect if an anchor is a fully-styled Tailwind button that should NOT be
 * converted to a Gutenberg button block.
 * 
 * Heuristic: inline-flex + at least 2 of: rounded, h-*, px-*, py-*, items-center, justify-center
 * This is tight enough to avoid false positives on navigation links.
 */
function isTailwindStyledButton(className: string): boolean {
    if (!className) return false;
    
    // Must have inline-flex (the signature of a Tailwind button)
    if (!/\binline-flex\b/.test(className)) return false;
    
    // Count matching button styling classes
    let score = 0;
    if (/\brounded(-\w+)?\b/.test(className)) score++;
    if (/\bh-\d+\b/.test(className)) score++;
    if (/\bpx-\d+\b/.test(className)) score++;
    if (/\bpy-\d+\b/.test(className)) score++;
    if (/\bitems-center\b/.test(className)) score++;
    if (/\bjustify-center\b/.test(className)) score++;
    
    // Need inline-flex + at least 2 other button traits
    return score >= 2;
}

function cleanInlineHtml(html: string): string {
   return html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
      // CRITICAL: Strip MUI/iframe-demo artifacts from inline content (e.g. inside paragraphs)
      // These sometimes leak into text nodes or get wrapped in p tags inappropriately
      .replace(/<div[^>]*class=["'](?:[^"']*?\s)?(?:MuiPaper-root|iframe-demo)(?:[^"']*?)?["'][^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<p[^>]*class=["'](?:[^"']*?\s)?(?:MuiTypography-root|iframe-demo)(?:[^"']*?)?["'][^>]*>[\s\S]*?<\/p>/gi, "")
      .trim();
}

function cleanupBlocks(blocks: string[]): string[] {
    return blocks.filter(b => b && b.trim().length > 0);
}

function isHiddenElement(el: HTMLElement): boolean {
    if (el.style.display === 'none' || el.style.visibility === 'hidden') return true;
    if (el.hasAttribute('hidden')) return true;
    
    // Strip MUI/Storybook demo wrappers that come from remote prerender service
    const className = el.getAttribute('class') || '';
    if (className.includes('MuiPaper') || 
        className.includes('Mui') ||
        className.includes('iframe-demo') ||
        className.includes('storybook')) {
        return true;
    }
    
    return false;
}

function cleanMuiArtifacts(el: HTMLElement) {
    if (!el) return;
    
    // Select all artifacts within the element
    // This targets the white box "iframe-demo" and other MUI leftovers
    const artifacts = el.querySelectorAll('[class*="MuiPaper"], [class*="iframe-demo"], [class*="MuiTypography"]');
    artifacts.forEach(artifact => artifact.remove());
    
    // CRITICAL: Strip Lovable IDE tracking attributes from all elements
    // These data-lov-* and data-component-* attributes are dev-only and should not be in WordPress output
    const allElements = el.querySelectorAll('*');
    allElements.forEach(element => {
        // Get all attribute names
        const attrNames = Array.from(element.attributes).map(attr => attr.name);
        // Remove any that start with data-lov or data-component
        for (const attrName of attrNames) {
            if (attrName.startsWith('data-lov') || attrName.startsWith('data-component')) {
                element.removeAttribute(attrName);
            }
        }
    });
    
    // Also clean the root element itself
    const rootAttrNames = Array.from(el.attributes).map(attr => attr.name);
    for (const attrName of rootAttrNames) {
        if (attrName.startsWith('data-lov') || attrName.startsWith('data-component')) {
            el.removeAttribute(attrName);
        }
    }
}

export function escapeHtml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

export function escapeAttr(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe.replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Compiler Quality: Tracking, Scoring, Validation, Theme Tokens
// ---------------------------------------------------------------------------

/**
 * Track block type usage for editability scoring
 */
function trackBlock(ctx: ConversionContext, blockName: string) {
    ctx._blockCounts[blockName] = (ctx._blockCounts[blockName] || 0) + 1;
}

/**
 * Track color occurrences for theme token suggestions
 */
function trackColor(ctx: ConversionContext, color: string) {
    const normalized = color.toLowerCase().trim();
    ctx._colorOccurrences[normalized] = (ctx._colorOccurrences[normalized] || 0) + 1;
}

/**
 * Track spacing occurrences for theme token suggestions
 */
function trackSpacing(ctx: ConversionContext, spacing: string) {
    ctx._spacingOccurrences[spacing] = (ctx._spacingOccurrences[spacing] || 0) + 1;
}

/**
 * Validate serialized block markup for structural correctness.
 * Checks that every opened block comment has a matching close.
 */
function validateBlockMarkup(markup: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stack: string[] = [];
    
    // Match opening and closing block comments
    const blockPattern = /<!--\s*(\/?)wp:([a-zA-Z0-9-]+\/?\w*)\s*(?:\{[^}]*\})?\s*(\/?)\s*-->/g;
    let match;
    
    while ((match = blockPattern.exec(markup)) !== null) {
        const isClosing = match[1] === '/';
        const blockName = match[2];
        const isSelfClosing = match[3] === '/';
        
        if (isSelfClosing) continue; // Self-closing blocks are valid on their own
        
        if (isClosing) {
            const expected = stack.pop();
            if (expected !== blockName) {
                errors.push(`Mismatched block close: expected /${expected || 'none'}, got /${blockName}`);
            }
        } else {
            stack.push(blockName);
        }
    }
    
    // Any remaining open blocks
    for (const unclosed of stack) {
        errors.push(`Unclosed block: wp:${unclosed}`);
    }
    
    return { isValid: errors.length === 0, errors };
}

/**
 * Compute editability and confidence scores based on block composition.
 * 
 * Editability (0-1): How well the output can be edited in Gutenberg
 *   - 0.30 weight: native block ratio (vs core/html fallbacks)
 *   - 0.25 weight: semantic correctness (headings, lists, quotes preserved)
 *   - 0.20 weight: style represented via block attrs (not raw inline)
 *   - 0.15 weight: low fallback HTML usage
 *   - 0.10 weight: proper block hierarchy (buttons in buttons, list-items in lists)
 * 
 * Confidence (0-1): How confident we are that the conversion is correct
 */
function computeScores(ctx: ConversionContext): { editabilityScore: number; confidenceScore: number } {
    const counts = ctx._blockCounts;
    const totalBlocks = Object.values(counts).reduce((s, c) => s + c, 0) || 1;
    
    // Native blocks = everything except core/html and theme-factory blocks
    const htmlFallbacks = counts['core/html'] || 0;
    const themeFactoryBlocks = Object.entries(counts)
        .filter(([k]) => k.startsWith('theme-factory/'))
        .reduce((s, [, c]) => s + c, 0);
    const nativeBlocks = totalBlocks - htmlFallbacks - themeFactoryBlocks;
    
    // Native block ratio (0.30 weight)
    const nativeRatio = nativeBlocks / totalBlocks;
    
    // Semantic correctness: check if we preserved key content blocks (0.25 weight)
    const hasHeadings = (counts['core/heading'] || 0) > 0;
    const hasParas = (counts['core/paragraph'] || 0) > 0;
    const hasCoreContent = hasHeadings && hasParas;
    const semanticScore = hasCoreContent ? 1.0 : hasParas ? 0.7 : 0.3;
    
    // Low fallback usage (0.20 weight)
    const fallbackPenalty = Math.max(0, 1 - (htmlFallbacks / totalBlocks) * 3);
    
    // Style via attrs (0.15 weight) - approximate by checking if we used cover/columns/media-text
    const richNativeBlocks = (counts['core/cover'] || 0) + (counts['core/columns'] || 0) + 
                             (counts['core/media-text'] || 0) + (counts['core/gallery'] || 0);
    const styleScore = Math.min(1, richNativeBlocks / Math.max(1, totalBlocks / 10));
    
    // Hierarchy quality (0.10 weight) - do we have proper button grouping, list items, etc.
    const hasButtons = (counts['core/buttons'] || 0) > 0 || (counts['core/button'] || 0) === 0;
    const hierarchyScore = hasButtons ? 1.0 : 0.5;
    
    const editabilityScore = Math.round((
        nativeRatio * 0.30 +
        semanticScore * 0.25 +
        fallbackPenalty * 0.20 +
        styleScore * 0.15 +
        hierarchyScore * 0.10
    ) * 100) / 100;
    
    // Confidence is based on how many warnings/errors we generated
    const errorCount = ctx.logs.filter(l => l.type === 'error').length;
    const warnCount = ctx.logs.filter(l => l.type === 'warn').length;
    const confidenceScore = Math.round(Math.max(0, Math.min(1, 
        1 - (errorCount * 0.15) - (warnCount * 0.03)
    )) * 100) / 100;
    
    return { editabilityScore, confidenceScore };
}

/**
 * Extract theme token suggestions from tracked color/spacing occurrences.
 * Suggests tokens for any value that appears 3+ times.
 */
function extractThemeTokenSuggestions(ctx: ConversionContext): ThemeTokenSuggestion[] {
    const suggestions: ThemeTokenSuggestion[] = [];
    
    // Color tokens
    let colorIdx = 0;
    for (const [value, count] of Object.entries(ctx._colorOccurrences)) {
        if (count >= 3) {
            colorIdx++;
            suggestions.push({
                type: 'color',
                tokenName: `custom-color-${colorIdx}`,
                value,
                occurrences: count
            });
        }
    }
    
    // Spacing tokens
    let spacingIdx = 0;
    for (const [value, count] of Object.entries(ctx._spacingOccurrences)) {
        if (count >= 3) {
            spacingIdx++;
            suggestions.push({
                type: 'spacing',
                tokenName: `custom-spacing-${spacingIdx}`,
                value,
                occurrences: count
            });
        }
    }
    
    return suggestions;
}

/**
 * Wrapper Reduction: Collapse meaningless wrapper divs.
 * A wrapper is meaningless if it has no classes, no styles, no id, no data/aria attrs, 
 * and exactly one child element.
 */
function reduceWrappers(el: HTMLElement): void {
    // Walk depth-first to collapse from leaves up
    const children = Array.from(el.children);
    for (const child of children) {
        if (child instanceof HTMLElement) {
            reduceWrappers(child);
        }
    }
    
    // Check if this element is a meaningless wrapper
    if (el.tagName.toLowerCase() === 'div' && 
        el.children.length === 1 && 
        !el.getAttribute('class')?.trim() && 
        !el.getAttribute('style')?.trim() &&
        !el.id &&
        !el.getAttribute('role') &&
        !Array.from(el.attributes).some(a => a.name.startsWith('data-') || a.name.startsWith('aria-'))) {
        // Replace this div with its only child
        const child = el.children[0] as HTMLElement;
        el.replaceWith(child);
    }
}

/**
 * Detect social media link containers and map to core/social-links
 */
function createSocialLinks(el: HTMLElement, ctx: ConversionContext): string | null {
    const links = Array.from(el.querySelectorAll('a[href]'));
    if (links.length < 2) return null;
    
    const socialProviders: { provider: string; url: string }[] = [];
    
    for (const link of links) {
        const href = link.getAttribute('href') || '';
        const provider = detectSocialProvider(href);
        if (provider) {
            socialProviders.push({ provider, url: href });
        }
    }
    
    // Only map to social links if majority of links are social
    if (socialProviders.length < links.length * 0.6) return null;
    
    const className = getClassName(el);
    const attrs: any = {};
    if (className) attrs.className = className;
    
    const socialBlocks = socialProviders.map(sp => {
        return `<!-- wp:social-link {"url":"${escapeAttr(sp.url)}","service":"${sp.provider}"} /-->`;
    }).join('\n');
    
    trackBlock(ctx, 'core/social-links');
    return `<!-- wp:social-links ${JSON.stringify(attrs)} -->\n<ul class="wp-block-social-links${className ? ' ' + className : ''}">\n${socialBlocks}\n</ul>\n<!-- /wp:social-links -->`;
}

/**
 * Detect social media provider from URL
 */
function detectSocialProvider(url: string): string | null {
    if (!url) return null;
    const u = url.toLowerCase();
    if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
    if (u.includes('twitter.com') || u.includes('x.com')) return 'x';
    if (u.includes('instagram.com')) return 'instagram';
    if (u.includes('linkedin.com')) return 'linkedin';
    if (u.includes('youtube.com')) return 'youtube';
    if (u.includes('tiktok.com')) return 'tiktok';
    if (u.includes('pinterest.com')) return 'pinterest';
    if (u.includes('github.com')) return 'github';
    if (u.includes('dribbble.com')) return 'dribbble';
    if (u.includes('behance.net')) return 'behance';
    if (u.includes('threads.net')) return 'threads';
    if (u.includes('mastodon')) return 'mastodon';
    if (u.includes('reddit.com')) return 'reddit';
    if (u.includes('whatsapp.com') || u.includes('wa.me')) return 'whatsapp';
    if (u.includes('telegram.org') || u.includes('t.me')) return 'telegram';
    if (u.includes('discord.com') || u.includes('discord.gg')) return 'discord';
    if (u.includes('snapchat.com')) return 'snapchat';
    if (u.includes('yelp.com')) return 'yelp';
    return null;
}

/**
 * Detect and map search forms to core/search
 */
function createSearch(el: HTMLElement, ctx: ConversionContext): string | null {
    const searchInput = el.querySelector('input[type="search"], input[name="q"], input[name="s"], input[name="search"]');
    if (!searchInput) return null;
    
    const placeholder = searchInput.getAttribute('placeholder') || 'Search...';
    const className = getClassName(el);
    const attrs: any = { label: 'Search', placeholder };
    if (className) attrs.className = className;
    
    trackBlock(ctx, 'core/search');
    return `<!-- wp:search ${JSON.stringify(attrs)} /-->`;
}