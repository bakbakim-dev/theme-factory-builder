export interface ElementorLinkSetting {
  url: string;
  is_external?: string;
  nofollow?: string;
}

export interface ElementorElement {
  id: string;
  elType: 'container' | 'widget';
  isInner: boolean;
  settings: Record<string, any> | any[];
  elements: ElementorElement[];
  widgetType?: string;
}

export interface ElementorDocument {
  title: string;
  type: 'page';
  version: '0.4';
  page_settings: Record<string, any> | any[];
  content: ElementorElement[];
}

export interface ElementorTemplate {
  title: string;
  slug: string;
  type: 'section';
  sourceId: string;
  elementorData: ElementorElement[];
  pageSettings: Record<string, any> | any[];
}

export interface ElementorConversionResult {
  document: ElementorDocument;
  templates: ElementorTemplate[];
  stats: {
    nativeWidgets: number;
    customWidgets: number;
    fallbackHtmlWidgets: number;
    containers: number;
  };
  warnings: string[];
}

export interface ElementorConversionOptions {
  title: string;
  routePath: string;
  slug: string;
  visualFidelityMode?: 'native-balanced' | 'page-shell';
  shellClassName?: string;
}

interface ElementorBuildContext {
  idSeed: string;
  sequence: number;
  stats: ElementorConversionResult['stats'];
  warnings: string[];
}

interface NeighborhoodListItem {
  name: string;
  description: string;
  url: ElementorLinkSetting;
  icon_html: string;
  item_class_name: string;
}

const STRUCTURAL_TAGS = new Set([
  'article',
  'aside',
  'body',
  'div',
  'main',
  'section',
  'header',
  'footer',
  'nav',
]);

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template']);
const OPAQUE_HTML_FALLBACK_MARKUP = /<(canvas|object|embed)\b|data-radix-|data-carousel|data-embla/i;

const COMPLEX_VISUAL_CLASS_PATTERNS = [
  /^(sm|md|lg|xl|2xl):/,
  /^absolute$/,
  /^relative$/,
  /^sticky$/,
  /^fixed$/,
  /^grid$/,
  /^inline-grid$/,
  /^flex$/,
  /^inline-flex$/,
  /^container$/,
  /^mx-auto$/,
  /^max-w-/,
  /^min-h-/,
  /^overflow-/,
  /^rounded/,
  /^shadow/,
  /^backdrop-/,
  /^bg-gradient/,
  /^(from|via|to)-/,
  /^z-/,
  /^gap-/,
  /^space-[xy]-/,
  /^items-/,
  /^justify-/,
  /^text-\[/,
  /^text-(4xl|5xl|6xl|7xl|8xl|9xl)$/,
  /^font-/,
  /^leading-/,
  /^tracking-/,
];

const hashString = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 8);
};

const createId = (ctx: ElementorBuildContext, hint: string): string => {
  ctx.sequence += 1;
  return hashString(`${ctx.idSeed}:${ctx.sequence}:${hint}`);
};

const stripDangerousMarkup = (html: string): string => html
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[\s\S]*?<\/style>/gi, '')
  .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '');

const decodeHtmlEntities = (value: string): string => value
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&#39;/g, "'");

const normalizeWhitespace = (value: string): string => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim();

const stripTags = (html: string): string => normalizeWhitespace(stripDangerousMarkup(html).replace(/<[^>]+>/g, ' '));
const escapeHtmlAttribute = (value: string): string => decodeHtmlEntities(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const dedupeClassName = (className: string): string => Array.from(new Set(
  decodeHtmlEntities(className)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean),
)).join(' ');

const normalizeClassName = (className: string): string => Array.from(new Set(
  decodeHtmlEntities(className)
    .replace(/\b(min-)?h-screen\b/g, '')
    .replace(/\bopacity-0\b/g, '')
    .replace(/\binvisible\b/g, '')
    .replace(/\banimate-[\w-]+\b/g, '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean),
)).join(' ');

const cleanPreservedHtmlClasses = (html: string): string => html.replace(
  /\sclass=(["'])([\s\S]*?)\1/gi,
  (match, quote, className) => {
    const normalized = normalizeClassName(className);
    return normalized ? ` class=${quote}${escapeHtmlAttribute(normalized)}${quote}` : '';
  },
);

const normalizeRichText = (html: string): string => {
  const cleaned = stripDangerousMarkup(html)
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
  return decodeHtmlEntities(cleaned);
};

const normalizeHeadingTitle = (html: string): string => {
  const cleaned = decodeHtmlEntities(cleanPreservedHtmlClasses(stripDangerousMarkup(html)))
    .replace(/\son\w+=(["'])[\s\S]*?\1/gi, '')
    .replace(/\sstyle=(["'])[\s\S]*?\1/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const hasVisualInlineMarkup = /<(strong|em|b|i|br)\b/i.test(cleaned)
    || /<span\b[^>]*\bclass=(["'])[^"']+\1[^>]*>/i.test(cleaned);

  if (!hasVisualInlineMarkup) {
    return stripTags(cleaned);
  }

  return cleaned
    .replace(/<\/?(?!span\b|strong\b|em\b|b\b|i\b|br\b)[a-z][^>]*>/gi, '')
    .replace(/<span\b(?![^>]*\bclass=)[^>]*>/gi, '')
    .replace(/<span\b([^>]*)>/gi, (_match, attrs) => {
      const className = getAttributeFromString(attrs || '', 'class');
      return className ? `<span class="${escapeHtmlAttribute(normalizeClassName(className))}">` : '';
    })
    .replace(/<(strong|em|b|i)\b[^>]*>/gi, '<$1>')
    .replace(/<br\b[^>]*>/gi, '<br>');
};

const getAttributeFromString = (attributes: string, name: string): string => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = attributes.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeHtmlEntities(match[1]) : '';
};

const getElementAttribute = (element: Element, name: string): string => element.getAttribute(name) || '';

const createContainer = (
  ctx: ElementorBuildContext,
  hint: string,
  elements: ElementorElement[],
  settings: Record<string, any> = {},
): ElementorElement => {
  ctx.stats.containers += 1;
  const containerSpecificSettings = { ...settings };
  if (containerSpecificSettings._padding && !containerSpecificSettings.padding) {
    containerSpecificSettings.padding = containerSpecificSettings._padding;
  }
  if (containerSpecificSettings._margin && !containerSpecificSettings.margin) {
    containerSpecificSettings.margin = containerSpecificSettings._margin;
  }
  if (containerSpecificSettings._css_classes && !containerSpecificSettings.css_classes) {
    containerSpecificSettings.css_classes = containerSpecificSettings._css_classes;
  }
  delete containerSpecificSettings._padding;
  delete containerSpecificSettings._margin;
  delete containerSpecificSettings._css_classes;
  const containerSettings = {
    content_width: 'full',
    padding: zeroBox(),
    ...containerSpecificSettings,
  };

  return {
    id: createId(ctx, `container:${hint}`),
    elType: 'container',
    isInner: false,
    settings: containerSettings,
    elements,
  };
};

const createWidget = (
  ctx: ElementorBuildContext,
  widgetType: string,
  settings: Record<string, any>,
  hint: string,
  fallback = false,
  custom = false,
): ElementorElement => {
  if (fallback) {
    ctx.stats.fallbackHtmlWidgets += 1;
  } else if (custom) {
    ctx.stats.customWidgets += 1;
  } else {
    ctx.stats.nativeWidgets += 1;
  }

  return {
    id: createId(ctx, `widget:${widgetType}:${hint}`),
    elType: 'widget',
    widgetType,
    isInner: false,
    settings,
    elements: [],
  };
};

const createCustomWidget = (
  ctx: ElementorBuildContext,
  widgetType: string,
  settings: Record<string, any>,
  hint: string,
): ElementorElement => createWidget(ctx, widgetType, settings, hint, false, true);

const buildHeadingWidget = (
  ctx: ElementorBuildContext,
  tagName: string,
  content: string,
  sourceSettings: Record<string, any> = {},
): ElementorElement | null => {
  const title = normalizeHeadingTitle(content);
  if (!title) return null;
  return createWidget(ctx, 'heading', {
    ...sourceSettings,
    title,
    header_size: tagName.toLowerCase(),
  }, title);
};

const buildTextWidget = (
  ctx: ElementorBuildContext,
  content: string,
  sourceSettings: Record<string, any> = {},
): ElementorElement | null => {
  const editor = normalizeRichText(content);
  if (!stripTags(editor)) return null;
  return createWidget(ctx, 'text-editor', { ...sourceSettings, editor }, editor);
};

const buildButtonWidget = (
  ctx: ElementorBuildContext,
  content: string,
  href: string,
  hint: string,
  sourceSettings: Record<string, any> = {},
): ElementorElement | null => {
  const text = stripTags(content);
  if (!text) return null;
  const link: ElementorLinkSetting = { url: href };
  if (/^https?:\/\//i.test(href)) {
    link.is_external = href.includes(globalThis.location?.host || '') ? '' : 'on';
  }
  return createWidget(ctx, 'button', {
    ...sourceSettings,
    text,
    link,
    button_type: 'default',
  }, hint || text);
};

const buildImageWidget = (
  ctx: ElementorBuildContext,
  src: string,
  alt: string,
  caption = '',
  sourceSettings: Record<string, any> = {},
): ElementorElement | null => {
  if (!src) return null;
  const settings: Record<string, any> = {
    ...sourceSettings,
    image: {
      url: src,
      alt,
      id: '',
    },
  };

  if (caption) {
    settings.caption_source = 'custom';
    settings.caption = caption;
  }

  return createWidget(ctx, 'image', settings, src);
};

const buildToggleWidget = (ctx: ElementorBuildContext, summary: string, content: string): ElementorElement | null => {
  const tabTitle = stripTags(summary);
  const tabContent = normalizeRichText(content);
  if (!tabTitle && !stripTags(tabContent)) return null;
  return createWidget(ctx, 'toggle', {
    tabs: [
      {
        _id: createId(ctx, `toggle-tab:${tabTitle}`),
        tab_title: tabTitle || 'Details',
        tab_content: tabContent,
      },
    ],
  }, tabTitle || tabContent);
};

const listItemsFromHtml = (html: string): Array<{ text: string; href: string }> => {
  const items: Array<{ text: string; href: string }> = [];
  const itemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(html)) !== null) {
    const innerHtml = match[1] || '';
    const linkMatch = innerHtml.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    const text = stripTags(linkMatch?.[2] || innerHtml);
    if (!text) continue;

    items.push({
      text,
      href: linkMatch ? getAttributeFromString(linkMatch[1] || '', 'href') : '',
    });
  }

  return items;
};

const shouldPreserveComplexListHtml = (html: string): boolean => {
  const listItemCount = (html.match(/<li\b/gi) || []).length;
  if (listItemCount === 0) return false;

  const hasNestedDescription =
    /<span\b[^>]*class=["'][^"']*\bblock\b[^"']*\btext-xs\b[^"']*["'][^>]*>/i.test(html) ||
    /<li\b[^>]*>[\s\S]*<div\b[^>]*>[\s\S]*<a\b[\s\S]*<\/a>[\s\S]*(?:<span\b|<p\b|<small\b)/i.test(html);
  const hasInlineSvg = /<svg\b/i.test(html);
  const hasStructuredSourceList = /class=["'][^"']*(?:space-y-|items-start|text-muted-foreground|flex-shrink-0)[^"']*["']/i.test(html);

  return hasNestedDescription || (hasInlineSvg && hasStructuredSourceList);
};

const buildIconListWidget = (ctx: ElementorBuildContext, html: string, hint: string): ElementorElement | null => {
  const items = listItemsFromHtml(html);
  if (items.length === 0) return null;

  return createWidget(ctx, 'icon-list', {
    icon_list: items.map((item) => ({
      _id: createId(ctx, `icon-list-item:${item.text}`),
      text: item.text,
      link: { url: item.href },
    })),
  }, hint || items.map((item) => item.text).join(', '));
};

const buildDividerWidget = (ctx: ElementorBuildContext): ElementorElement => createWidget(ctx, 'divider', {
  style: 'solid',
}, 'divider');

const normalizeYouTubeUrl = (src: string): string => {
  const embedMatch = src.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&#/]+)/i);
  if (embedMatch) {
    return `https://www.youtube.com/watch?v=${embedMatch[1]}`;
  }

  return src;
};

const buildVideoWidget = (ctx: ElementorBuildContext, src: string, title: string): ElementorElement | null => {
  if (!src) return null;

  if (/youtu\.be|youtube(?:-nocookie)?\.com/i.test(src)) {
    return createWidget(ctx, 'video', {
      video_type: 'youtube',
      youtube_url: normalizeYouTubeUrl(src),
    }, title || src);
  }

  if (/vimeo\.com/i.test(src)) {
    return createWidget(ctx, 'video', {
      video_type: 'vimeo',
      vimeo_url: src,
    }, title || src);
  }

  return createWidget(ctx, 'video', {
    video_type: 'hosted',
    hosted_url: { url: src },
  }, title || src);
};

const buildFigureWidget = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const imageMatch = html.match(/<img\b([^>]*)\/?>/i);
  if (!imageMatch) return null;

  const captionMatch = html.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
  return buildImageWidget(
    ctx,
    getAttributeFromString(imageMatch[1] || '', 'src'),
    getAttributeFromString(imageMatch[1] || '', 'alt'),
    stripTags(captionMatch?.[1] || ''),
  );
};

const buildHtmlWidget = (ctx: ElementorBuildContext, html: string, hint: string, cleanClasses = true): ElementorElement | null => {
  const cleaned = normalizeRichText(cleanClasses ? cleanPreservedHtmlClasses(html) : html);
  if (!stripTags(cleaned) && !/<(img|picture|svg|video|iframe|canvas|form|input|select|textarea|button|a)\b/i.test(cleaned)) return null;
  return createWidget(ctx, 'html', { html: cleaned }, hint, true);
};

const buildSvgIconWidget = (ctx: ElementorBuildContext, svgHtml: string, hint = 'svg:inline-icon'): ElementorElement | null => {
  const cleaned = normalizeRichText(cleanPreservedHtmlClasses(stripDangerousMarkup(svgHtml)));
  if (!/<svg\b/i.test(cleaned)) return null;

  return createCustomWidget(ctx, 'whipify_svg_icon', {
    svg_html: cleaned,
    source_class_name: normalizeClassName(getAttributeFromString(cleaned.match(/<svg\b([^>]*)>/i)?.[1] || '', 'class')),
    aria_label: getAttributeFromString(cleaned.match(/<svg\b([^>]*)>/i)?.[1] || '', 'aria-label'),
  }, hint);
};

const textOnlyElementText = (html: string): string => {
  const cleaned = stripDangerousMarkup(html).trim();
  if (!cleaned || /<(?!br\b)[a-z][^>]*>/i.test(cleaned)) return '';
  return stripTags(cleaned);
};

const buildTextFragmentWidget = (
  ctx: ElementorBuildContext,
  tagName: string,
  innerHtml: string,
  sourceClassName: string,
  hint = 'text-fragment',
): ElementorElement | null => {
  const text = textOnlyElementText(innerHtml);
  if (!text) return null;

  return createCustomWidget(ctx, 'whipify_text_fragment', {
    text,
    html_tag: ['div', 'span'].includes(tagName) ? tagName : 'div',
    source_class_name: normalizeClassName(sourceClassName),
  }, hint || text);
};

const listDescriptionFromElement = (element: Element, name: string): string => {
  const candidates = Array.from(element.querySelectorAll('span,p,small'))
    .map((candidate) => stripTags(candidate.innerHTML))
    .filter(Boolean)
    .filter((text) => text !== name);
  if (candidates.length > 0) return candidates[0];

  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('svg,a,button').forEach((child) => child.remove());
  const text = stripTags(clone.innerHTML);
  return text.replace(name, '').trim();
};

const buildNeighborhoodListWidgetFromItems = (
  ctx: ElementorBuildContext,
  items: NeighborhoodListItem[],
  sourceClassName: string,
  hint = 'neighborhood-list',
): ElementorElement | null => {
  const cleanedItems = items
    .filter((item) => item.name && item.description)
    .map((item) => ({
      ...item,
      source_class_name: normalizeClassName(item.item_class_name),
      item_class_name: normalizeClassName(item.item_class_name),
    }));
  if (cleanedItems.length < 2) return null;

  return createCustomWidget(ctx, 'whipify_neighborhood_list', {
    items: cleanedItems,
    source_class_name: normalizeClassName(sourceClassName),
  }, hint);
};

const buildNeighborhoodListWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const tagName = element.tagName.toLowerCase();
  if (tagName !== 'ul' && tagName !== 'ol') return null;

  const items: NeighborhoodListItem[] = Array.from(element.children)
    .filter((child) => child.tagName.toLowerCase() === 'li')
    .map((item) => {
      const link = item.querySelector('a[href]');
      const name = link ? stripTags(link.innerHTML) : firstElementText(item, 'strong,b,h3,h4');
      const icon = item.querySelector('svg');
      return {
        name,
        description: listDescriptionFromElement(item, name),
        url: { url: link ? getElementAttribute(link, 'href') : '' },
        icon_html: icon ? normalizeRichText(cleanPreservedHtmlClasses(icon.outerHTML)) : '',
        item_class_name: getElementAttribute(item, 'class'),
      };
    });

  return buildNeighborhoodListWidgetFromItems(ctx, items, getElementAttribute(element, 'class'), stripTags(element.innerHTML));
};

const buildNeighborhoodListWidgetFromHtml = (ctx: ElementorBuildContext, html: string, attributes = ''): ElementorElement | null => {
  const items: NeighborhoodListItem[] = Array.from(html.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi))
    .map((match) => {
      const itemAttributes = match[1] || '';
      const itemHtml = match[2] || '';
      const linkMatch = itemHtml.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
      const descriptionMatch = itemHtml.match(/<(?:span|p|small)\b[^>]*>([\s\S]*?)<\/(?:span|p|small)>/i);
      const iconMatch = itemHtml.match(/<svg\b[\s\S]*?<\/svg>/i);
      const name = linkMatch ? stripTags(linkMatch[2] || '') : stripTags(itemHtml.match(/<(?:strong|b|h3|h4)\b[^>]*>([\s\S]*?)<\/(?:strong|b|h3|h4)>/i)?.[1] || '');
      const description = descriptionMatch ? stripTags(descriptionMatch[1] || '') : stripTags(itemHtml.replace(/<svg\b[\s\S]*?<\/svg>/gi, '').replace(/<a\b[\s\S]*?<\/a>/gi, ''));
      return {
        name,
        description,
        url: { url: getAttributeFromString(linkMatch?.[1] || '', 'href') },
        icon_html: iconMatch ? normalizeRichText(cleanPreservedHtmlClasses(iconMatch[0])) : '',
        item_class_name: getAttributeFromString(itemAttributes, 'class'),
      };
    });

  return buildNeighborhoodListWidgetFromItems(ctx, items, getAttributeFromString(attributes, 'class'), stripTags(html));
};

const buildTrustLogoRowWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  if (!/<img\b/i.test(html) || !/<a\b/i.test(html)) return null;

  const rowMatch = html.match(/<div\b([^>]*)>([\s\S]*?<img\b[\s\S]*?)<\/div>/i);
  const rowAttributes = rowMatch?.[1] || '';
  const rowHtml = rowMatch?.[2] || html;
  if (!/\bflex\b/i.test(getAttributeFromString(rowAttributes, 'class')) && !/flex-wrap|gap-/i.test(rowHtml)) return null;

  const logos = Array.from(rowHtml.matchAll(/<a\b([^>]*)>([\s\S]*?<img\b[^>]*>[\s\S]*?)<\/a>/gi))
    .map((match) => {
      const imgAttrs = (match[2] || '').match(/<img\b([^>]*)>/i)?.[1] || '';
      return {
        link_url: { url: getAttributeFromString(match[1] || '', 'href') },
        image_url: getAttributeFromString(imgAttrs, 'src'),
        image_alt: getAttributeFromString(imgAttrs, 'alt'),
        link_class_name: normalizeClassName(getAttributeFromString(match[1] || '', 'class')),
        image_class_name: normalizeClassName(getAttributeFromString(imgAttrs, 'class')),
      };
    })
    .filter((logo) => logo.image_url);

  if (logos.length < 1) return null;

  return createCustomWidget(ctx, 'whipify_trust_logo_row', {
    logos,
    source_class_name: normalizeClassName(getAttributeFromString(rowAttributes, 'class')),
  }, logos.map((logo) => logo.image_alt || logo.image_url).join(', '));
};

const buildCarouselDotsWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const rowMatch = html.match(/<div\b([^>]*)>([\s\S]*?)<\/div>/i);
  if (!rowMatch || !/<button\b/i.test(rowMatch[2] || '')) return null;

  const sourceClassName = getAttributeFromString(rowMatch[1] || '', 'class');
  if (!/justify-center|gap-/.test(sourceClassName)) return null;

  const buttons = Array.from((rowMatch[2] || '').matchAll(/<button\b([^>]*)>/gi));
  if (buttons.length < 2) return null;

  const activeIndex = Math.max(0, buttons.findIndex((button) => /\bbg-primary\b/.test(getAttributeFromString(button[1] || '', 'class'))));
  return createCustomWidget(ctx, 'whipify_carousel_dots', {
    dot_count: buttons.length,
    active_index: activeIndex + 1,
    source_class_name: normalizeClassName(sourceClassName),
  }, `carousel-dots:${buttons.length}`);
};

const buildMapEmbedWidget = (
  ctx: ElementorBuildContext,
  src: string,
  title: string,
  attributes = '',
): ElementorElement | null => {
  if (!/google\.com\/maps\/embed/i.test(src)) return null;

  return createCustomWidget(ctx, 'whipify_map_embed', {
    iframe_src: src,
    title: title || 'Map',
    height: getAttributeFromString(attributes, 'height') || '400',
    source_class_name: normalizeClassName(getAttributeFromString(attributes, 'class')),
  }, title || src);
};

const buildIframeWidget = (ctx: ElementorBuildContext, outerHtml: string, src: string, title: string): ElementorElement | null => {
  if (/youtu\.be|youtube(?:-nocookie)?\.com|vimeo\.com/i.test(src)) {
    return buildVideoWidget(ctx, src, title);
  }

  const mapEmbed = buildMapEmbedWidget(ctx, src, title, outerHtml.match(/<iframe\b([^>]*)>/i)?.[1] || '');
  if (mapEmbed) return mapEmbed;

  return buildHtmlWidget(ctx, outerHtml, title || src || 'iframe', false);
};

const BREADCRUMB_NAV_REJECT_PATTERN = /\b(?:about us|locations|careers|services|pricing|reviews|faq|contact|get instant quote|call now|get quote)\b/i;

const normalizeBreadcrumbLabels = (labels: string[]): string[] => {
  const normalized = labels
    .flatMap((label) => normalizeWhitespace(label).split(/\s*(?:›|»|\/|>)\s*/))
    .map((label) => label.replace(/^[+✓✔\s]+/, '').trim())
    .filter(Boolean)
    .filter((label) => !/^(?:›|»|\/|>)$/.test(label));

  return normalized.filter((label, index) => index === 0 || label !== normalized[index - 1]);
};

const breadcrumbLabelsFromHtml = (html: string): string[] => {
  const candidates = Array.from(html.matchAll(/<(?:a|span|li)\b[^>]*>([\s\S]*?)<\/(?:a|span|li)>/gi))
    .map((match) => stripTags(match[1] || ''))
    .filter(Boolean);

  return normalizeBreadcrumbLabels(candidates.length > 0 ? candidates : [stripTags(html)]);
};

const breadcrumbLabelsFromElement = (element: Element): string[] => {
  const candidates = Array.from(element.querySelectorAll('a,span,li'))
    .map((candidate) => stripTags(candidate.innerHTML))
    .filter(Boolean);

  return normalizeBreadcrumbLabels(candidates.length > 0 ? candidates : [element.textContent || '']);
};

const isBreadcrumbLabelSet = (labels: string[], sourceText: string): boolean => (
  labels.some((label) => /^home$/i.test(label))
  && labels.length >= 2
  && labels.length <= 5
  && !BREADCRUMB_NAV_REJECT_PATTERN.test(sourceText)
);

const buildBreadcrumbHtmlFromLabels = (labels: string[]): string => {
  const homeLabel = labels.find((label) => /^home$/i.test(label)) || 'Home';
  const nonHomeLabels = labels.filter((label) => !/^home$/i.test(label));
  const currentLabel = nonHomeLabels[nonHomeLabels.length - 1] || labels[labels.length - 1] || '';
  if (!currentLabel || /^home$/i.test(currentLabel)) return '';

  return [
    '<nav class="tf-elementor-breadcrumbs" aria-label="Breadcrumb">',
    `<a href="/">${escapeHtmlAttribute(homeLabel)}</a>`,
    '<span class="tf-elementor-breadcrumbs__separator" aria-hidden="true">&rsaquo;</span>',
    `<span class="tf-elementor-breadcrumbs__current">${escapeHtmlAttribute(currentLabel)}</span>`,
    '</nav>',
  ].join('');
};

const buildBreadcrumbWidgetFromLabels = (ctx: ElementorBuildContext, labels: string[], sourceText: string): ElementorElement | null => {
  if (!isBreadcrumbLabelSet(labels, sourceText)) return null;

  const homeLabel = labels.find((label) => /^home$/i.test(label)) || 'Home';
  const nonHomeLabels = labels.filter((label) => !/^home$/i.test(label));
  const currentLabel = nonHomeLabels[nonHomeLabels.length - 1] || labels[labels.length - 1] || '';
  if (!currentLabel || /^home$/i.test(currentLabel)) return null;

  return createCustomWidget(ctx, 'whipify_breadcrumbs', {
    home_label: homeLabel,
    home_url: { url: '/' },
    current_label: currentLabel,
  }, labels.join(' > '));
};

const buildBreadcrumbWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const tagName = element.tagName.toLowerCase();
  const className = getElementAttribute(element, 'class');
  const ariaLabel = getElementAttribute(element, 'aria-label');
  const sourceText = normalizeWhitespace(element.textContent || '');
  const breadcrumbLikely = tagName === 'nav' || /\bbreadcrumbs?\b/i.test(className) || /\bbreadcrumbs?\b/i.test(ariaLabel);
  if (!breadcrumbLikely) return null;

  return buildBreadcrumbWidgetFromLabels(ctx, breadcrumbLabelsFromElement(element), sourceText);
};

const buildBreadcrumbWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => (
  buildBreadcrumbWidgetFromLabels(ctx, breadcrumbLabelsFromHtml(html), stripTags(html))
);

interface FeatureGridCard {
  card_title: string;
  card_text: string;
  card_body_html: string;
  card_link_text: string;
  card_url: ElementorLinkSetting;
  card_class_name: string;
  card_icon_html: string;
  card_icon_class_name: string;
  card_image: {
    url: string;
    alt: string;
    id: string;
  };
}

interface FeatureGridSectionData {
  sectionTitle: string;
  sectionIntro: string;
  sectionBodyHtml: string;
  sectionFooterHtml: string;
  cards: FeatureGridCard[];
  sourceClassName: string;
}

interface LocationCard {
  city_name: string;
  rating_text: string;
  region_text: string;
  phone_text: string;
  reviews_text: string;
  experience_text: string;
  button_text: string;
  card_url: ElementorLinkSetting;
  variant: string;
  source_class_name: string;
  card_class_name: string;
}

interface PricingPlan {
  plan_name: string;
  plan_description: string;
  plan_price: string;
  plan_interval: string;
  plan_price_position: 'before_features' | 'after_features';
  plan_features: string;
  cta_text: string;
  cta_url: ElementorLinkSetting;
  is_highlighted: string;
  plan_class_name: string;
}

interface PricingMatrixRow {
  service_type: string;
  service_badge: string;
  prices: string;
  cta_text: string;
  cta_url: ElementorLinkSetting;
}

interface FeatureGridHtmlMatch {
  index: number;
  gridAttributes: string;
  innerHtml: string;
  outerHtml: string;
  cards: StringMatch[];
}

interface TestimonialItem {
  quote_text: string;
  person_name: string;
  person_title: string;
  rating: string;
  image: {
    url: string;
    alt: string;
    id: string;
  };
  testimonial_class_name: string;
}

interface CtaSectionData {
  eyebrow_text: string;
  heading_text: string;
  body_text: string;
  primary_button_text: string;
  primary_button_url: ElementorLinkSetting;
  secondary_button_text: string;
  secondary_button_url: ElementorLinkSetting;
  image: {
    url: string;
    alt: string;
    id: string;
  };
  source_class_name: string;
}

interface StatItem {
  stat_value: string;
  stat_label: string;
  stat_description: string;
  stat_class_name: string;
}

interface TeamMember {
  member_name: string;
  member_role: string;
  member_bio: string;
  image: {
    url: string;
    alt: string;
    id: string;
  };
  member_class_name: string;
}

interface LogoItem {
  logo_name: string;
  logo_image: {
    url: string;
    alt: string;
    id: string;
  };
  logo_class_name: string;
}

interface FaqItem {
  question_text: string;
  answer_text: string;
  item_class_name: string;
}

interface LeadFormField {
  field_label: string;
  field_type: string;
  field_name: string;
  field_placeholder: string;
  field_required: string;
  field_options: string;
  field_class_name: string;
}

const firstElementText = (root: Element, selector: string, exclude?: Element): string => {
  const match = Array.from(root.querySelectorAll(selector))
    .find((element) => !exclude || !exclude.contains(element));
  return match ? stripTags(match.innerHTML) : '';
};

const firstElementHeadingTitle = (root: Element, selector: string, exclude?: Element): string => {
  const match = Array.from(root.querySelectorAll(selector))
    .find((element) => !exclude || !exclude.contains(element));
  return match ? normalizeHeadingTitle(match.innerHTML) : '';
};

const firstElementHtml = (root: Element, selector: string): string => {
  const match = root.querySelector(selector);
  return match ? match.outerHTML : '';
};

const iconFrameClassSignal = (className: string): boolean => (
  /\b(?:inline-)?flex\b/.test(className)
  || /\bitems-center\b/.test(className)
  || /\bjustify-center\b/.test(className)
  || /\bbg-[\w/:-]+\b/.test(className)
  || /\brounded(?:-[\w/:-]+)?\b/.test(className)
  || /\bw-(?:\d+|\[[^\]]+\])\b/.test(className)
  || /\bh-(?:\d+|\[[^\]]+\])\b/.test(className)
);

const firstIconFrameClassFromElement = (root: Element): string => {
  const icon = root.querySelector('svg');
  let current = icon?.parentElement || null;

  while (current && current !== root) {
    const className = normalizeClassName(getElementAttribute(current, 'class'));
    if (className && iconFrameClassSignal(className)) return className;
    current = current.parentElement;
  }

  return '';
};

const firstIconFrameClassFromHtml = (html: string): string => {
  const svgMatch = html.match(/<svg\b/i);
  if (!svgMatch || typeof svgMatch.index !== 'number') return '';

  const beforeSvg = html.slice(0, svgMatch.index);
  const divMatches = Array.from(beforeSvg.matchAll(/<div\b([^>]*)>/gi));
  for (let index = divMatches.length - 1; index >= 0; index -= 1) {
    const className = normalizeClassName(getAttributeFromString(divMatches[index]?.[1] || '', 'class'));
    if (className && iconFrameClassSignal(className)) return className;
  }

  return '';
};

const firstElementAttribute = (root: Element, selector: string, attribute: string): string => {
  const match = root.querySelector(selector);
  return match ? getElementAttribute(match, attribute) : '';
};

const richFeatureCardBodyFromElement = (card: Element, cardText: string): string => {
  const clone = card.cloneNode(true) as Element;
  clone.querySelectorAll('svg,img,h2,h3,h4,button').forEach((node) => node.remove());
  clone.querySelectorAll('a[href]').forEach((node) => {
    if (!node.closest('p,li,span,strong,em,b,i')) {
      node.remove();
    }
  });
  const bodyHtml = normalizeRichText(cleanPreservedHtmlClasses(clone.innerHTML));
  if (!stripTags(bodyHtml)) return '';
  return stripTags(bodyHtml) === cardText && !/<(a|strong|em|b|i|span|br)\b/i.test(bodyHtml) ? '' : bodyHtml;
};

const stripDanglingStructuralWrappers = (html: string): string => {
  let next = html.trim();
  let previous = '';

  while (next !== previous) {
    previous = next;
    next = next
      .replace(/^\s*<\/(?:section|article|div|main|aside|header|footer)>\s*/i, '')
      .replace(/^\s*<(?:section|article|div|main|aside|header|footer)\b[^>]*>\s*/i, '')
      .replace(/\s*<\/(?:section|article|div|main|aside|header|footer)>\s*$/i, '')
      .replace(/\s*<(?:section|article|div|main|aside|header|footer)\b[^>]*>\s*$/i, '')
      .trim();
  }

  return next;
};

const removeFirstMatchingBlockFromHtml = (html: string, tagPattern: string): string => html.replace(
  new RegExp(`<(${tagPattern})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, 'i'),
  '',
);

const normalizeSectionSlotHtml = (html: string): string => {
  const normalized = normalizeRichText(cleanPreservedHtmlClasses(stripDanglingStructuralWrappers(html)));
  if (!stripTags(normalized) && !/<(img|picture|svg|video|iframe|canvas|form|input|button|a|table)\b/i.test(normalized)) {
    return '';
  }
  return normalized;
};

const sectionBodyHtmlBeforeChild = (html: string, sectionTitle: string, sectionIntro: string): string => {
  let bodyHtml = stripDanglingStructuralWrappers(html);
  if (sectionTitle) bodyHtml = removeFirstMatchingBlockFromHtml(bodyHtml, 'h1|h2');
  if (sectionIntro) bodyHtml = removeFirstMatchingBlockFromHtml(bodyHtml, 'p');
  return normalizeSectionSlotHtml(bodyHtml);
};

const sectionFooterHtmlAfterChild = (html: string): string => normalizeSectionSlotHtml(html);

const PRICE_PATTERN = /(?:[$€£]\s*\d[\d,.]*|\d[\d,.]*\s*(?:\/\s*)?(?:mo|month|clean|visit|hour|hr|week|year))/i;
const CUSTOM_PRICE_PATTERN = /\bcustom\s+pricing\b/i;
const INTERVAL_PATTERN = /^(?:\/\s*|per\s+)?(?:mo|month|clean|visit|hour|hr|week|year|day|service)s?$/i;

const hasPricingSignal = (text: string): boolean => PRICE_PATTERN.test(text) || CUSTOM_PRICE_PATTERN.test(text);

const normalizePriceText = (text: string): string => (
  CUSTOM_PRICE_PATTERN.test(text) ? 'Custom Pricing' : text
);

const findPriceTextFromElement = (root: Element): string => {
  const candidates = Array.from(root.querySelectorAll('div,span,strong,b,p'))
    .map((element) => stripTags(element.innerHTML))
    .filter(Boolean);
  const priceText = candidates.find(hasPricingSignal) || '';
  return priceText ? normalizePriceText(priceText) : '';
};

const findIntervalTextFromElement = (root: Element, priceText: string): string => {
  const candidates = Array.from(root.querySelectorAll('span,small,em,p'))
    .map((element) => stripTags(element.innerHTML))
    .filter(Boolean)
    .filter((text) => text !== priceText);
  return candidates.find((text) => INTERVAL_PATTERN.test(text)) || '';
};

const findPlanPricePositionFromHtml = (html: string, priceText: string): 'before_features' | 'after_features' => {
  const listIndex = html.search(/<(?:ul|ol|li)\b/i);
  if (listIndex < 0 || !priceText) return 'before_features';
  const priceIndex = html.indexOf(priceText);
  return priceIndex > listIndex ? 'after_features' : 'before_features';
};

const elementListText = (root: Element, selector: string): string => Array.from(root.querySelectorAll(selector))
  .map((element) => stripTags(element.innerHTML))
  .filter(Boolean)
  .join('\n');

const isHighlightedPlanClass = (className: string): string => (
  /\b(border-primary|ring-|featured|popular|highlight|scale-|bg-primary|accent)\b/i.test(className)
    ? 'yes'
    : ''
);

const isPricingCardElement = (element: Element): boolean => (
  !!element.querySelector('h2,h3,h4')
  && !!findPriceTextFromElement(element)
  && (!!element.querySelector('a[href],button') || !!element.querySelector('ul,ol'))
);

const firstCellTextWithoutBadge = (cell: Element): { serviceType: string; badge: string } => {
  const clone = cell.cloneNode(true) as Element;
  const badgeElement = clone.querySelector('span,b,strong');
  const badge = badgeElement ? stripTags(badgeElement.innerHTML) : '';
  if (badgeElement) badgeElement.remove();
  return {
    serviceType: stripTags(clone.innerHTML),
    badge,
  };
};

const pricingCellTextFromElement = (cell: Element): string => {
  const clone = cell.cloneNode(true) as Element;
  clone.querySelectorAll('a,button,[role="button"]').forEach((element) => element.remove());
  return stripTags(clone.innerHTML);
};

const buildPricingMatrixWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const table = element.querySelector('table');
  if (!table || !hasPricingSignal(stripTags(table.innerHTML))) return null;

  const headerCells = Array.from(table.querySelectorAll('thead th, thead td'));
  if (headerCells.length < 2) return null;

  const columns = headerCells.slice(1).map((cell) => stripTags(cell.innerHTML)).filter(Boolean);
  const rowElements = Array.from(table.querySelectorAll('tbody tr'));
  const pricingRows: PricingMatrixRow[] = rowElements.map((row) => {
    const cells = Array.from(row.children).filter((child) => /^(td|th)$/i.test(child.tagName));
    if (cells.length < 2) return null;
    const { serviceType, badge } = firstCellTextWithoutBadge(cells[0]);
    const link = row.querySelector('a[href]');
    return {
      service_type: serviceType,
      service_badge: badge,
      prices: cells.slice(1).map(pricingCellTextFromElement).filter(Boolean).join('\n'),
      cta_text: link ? stripTags(link.innerHTML) : '',
      cta_url: { url: link ? getElementAttribute(link, 'href') : '' },
    };
  }).filter((row): row is PricingMatrixRow => !!row && !!row.service_type && !!row.prices);

  if (columns.length < 2 || pricingRows.length < 2) return null;

  const sectionTitle = firstElementHeadingTitle(element, 'h1,h2', table);
  const sectionIntro = firstElementText(element, 'p', table);
  const tableOuterHtml = table.outerHTML;
  const tableIndex = element.innerHTML.indexOf(tableOuterHtml);
  const sectionFooterHtml = tableIndex >= 0
    ? sectionFooterHtmlAfterChild(element.innerHTML.slice(tableIndex + tableOuterHtml.length))
    : '';
  return createCustomWidget(ctx, 'whipify_pricing_table', {
    section_title: sectionTitle,
    section_intro: sectionIntro,
    section_footer_html: sectionFooterHtml,
    pricing_columns: columns.join('\n'),
    pricing_rows: pricingRows,
    plans: [],
    source_class_name: getElementAttribute(element, 'class'),
  }, sectionTitle || pricingRows.map((row) => row.service_type).join(', '));
};

const findPricingGridElement = (root: Element): Element | null => {
  const candidates = Array.from(root.querySelectorAll('div,section,article'));
  return candidates.find((candidate) => {
    const className = getElementAttribute(candidate, 'class');
    if (!/\bgrid\b/.test(className) && !/\bpricing\b/i.test(className)) return false;
    const pricingCards = Array.from(candidate.children).filter(isPricingCardElement);
    return pricingCards.length >= 2;
  }) || null;
};

const buildPricingTableWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const matrix = buildPricingMatrixWidgetFromDom(ctx, element);
  if (matrix) return matrix;

  const grid = findPricingGridElement(element);
  if (!grid) return null;

  const plans: PricingPlan[] = Array.from(grid.children)
    .filter(isPricingCardElement)
    .map((plan) => {
      const link = plan.querySelector('a[href]');
      const price = findPriceTextFromElement(plan);
      return {
        plan_name: firstElementText(plan, 'h2,h3,h4'),
        plan_description: firstElementText(plan, 'p'),
        plan_price: price,
        plan_interval: findIntervalTextFromElement(plan, price),
        plan_price_position: findPlanPricePositionFromHtml(plan.innerHTML, price),
        plan_features: elementListText(plan, 'li'),
        cta_text: link ? stripTags(link.innerHTML) : firstElementText(plan, 'button'),
        cta_url: { url: link ? getElementAttribute(link, 'href') : '' },
        is_highlighted: isHighlightedPlanClass(getElementAttribute(plan, 'class')),
        plan_class_name: getElementAttribute(plan, 'class'),
      };
    })
    .filter((plan) => plan.plan_name && plan.plan_price);

  if (plans.length < 2) return null;

  const sectionTitle = firstElementHeadingTitle(element, 'h1,h2', grid);
  const sectionIntro = firstElementText(element, 'p', grid);
  const gridOuterHtml = grid.outerHTML;
  const gridIndex = element.innerHTML.indexOf(gridOuterHtml);
  const sectionFooterHtml = gridIndex >= 0
    ? sectionFooterHtmlAfterChild(element.innerHTML.slice(gridIndex + gridOuterHtml.length))
    : '';
  return createCustomWidget(ctx, 'whipify_pricing_table', {
    section_title: sectionTitle,
    section_intro: sectionIntro,
    section_footer_html: sectionFooterHtml,
    plans,
    source_class_name: dedupeClassName([
      getElementAttribute(element, 'class'),
      getElementAttribute(grid, 'class'),
    ].filter(Boolean).join(' ')),
  }, sectionTitle || plans.map((plan) => plan.plan_name).join(', '));
};

const textCandidates = (root: Element, selector: string): string[] => Array.from(root.querySelectorAll(selector))
  .map((element) => stripTags(element.innerHTML))
  .filter(Boolean);

const findRatingTextFromElement = (root: Element): string => textCandidates(root, 'p,span,div')
  .find((text) => /\bstars?\b|★|rating/i.test(text)) || '';

const findPersonTitleFromElement = (root: Element, quoteText: string, rating: string): string => textCandidates(root, 'p,span,small')
  .find((text) => text !== quoteText && text !== rating && !PRICE_PATTERN.test(text)) || '';

const isTestimonialCardElement = (element: Element): boolean => {
  const className = getElementAttribute(element, 'class');
  const hasQuote = !!element.querySelector('blockquote') || /\btestimonial|review\b/i.test(className);
  const hasPerson = !!element.querySelector('h3,h4,strong,b');
  return hasQuote && hasPerson;
};

const findTestimonialGridElement = (root: Element): Element | null => {
  const candidates = Array.from(root.querySelectorAll('div,section,article'));
  return candidates.find((candidate) => {
    const className = getElementAttribute(candidate, 'class');
    if (!/\bgrid\b/.test(className) && !/\btestimonials?|reviews?\b/i.test(className)) return false;
    const testimonials = Array.from(candidate.children).filter(isTestimonialCardElement);
    return testimonials.length >= 2;
  }) || null;
};

const buildTestimonialGridWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const testimonialSignal = [
    getElementAttribute(element, 'class'),
    firstElementText(element, 'h1,h2'),
  ].join(' ');
  if (!/\b(testimonials?|reviews?|customers?\s+say|google\s+reviews?)\b/i.test(testimonialSignal)) return null;

  const grid = findTestimonialGridElement(element);
  if (!grid) return null;

  const testimonials: TestimonialItem[] = Array.from(grid.children)
    .filter(isTestimonialCardElement)
    .map((testimonial) => {
      const quote = firstElementText(testimonial, 'blockquote') || textCandidates(testimonial, 'p')
        .find((text) => !/\bstars?\b|★|rating/i.test(text)) || '';
      const rating = findRatingTextFromElement(testimonial);
      const image = testimonial.querySelector('img');
      return {
        quote_text: quote,
        person_name: firstElementText(testimonial, 'h3,h4,strong,b'),
        person_title: findPersonTitleFromElement(testimonial, quote, rating),
        rating,
        image: {
          url: image ? getElementAttribute(image, 'src') : '',
          alt: image ? getElementAttribute(image, 'alt') : '',
          id: '',
        },
        testimonial_class_name: getElementAttribute(testimonial, 'class'),
      };
    })
    .filter((testimonial) => testimonial.quote_text && testimonial.person_name);

  if (testimonials.length < 2) return null;

  const sectionTitle = firstElementText(element, 'h1,h2', grid);
  const sectionIntro = firstElementText(element, 'p', grid);
  return createCustomWidget(ctx, 'whipify_testimonial_grid', {
    section_title: sectionTitle,
    section_intro: sectionIntro,
    testimonials,
    source_class_name: dedupeClassName([
      getElementAttribute(element, 'class'),
      getElementAttribute(grid, 'class'),
    ].filter(Boolean).join(' ')),
  }, sectionTitle || testimonials.map((testimonial) => testimonial.person_name).join(', '));
};

const CTA_CLASS_PATTERN = /\b(?:cta|call-to-action|final-cta|booking-cta)\b/i;
const HERO_CLASS_PATTERN = /\b(?:hero|banner|masthead|showcase)\b/i;

const isHeroSectionElement = (element: Element): boolean => {
  const className = getElementAttribute(element, 'class');
  const hasStructuredLayout = !!element.querySelector('[class*="grid"],[class*="flex"],[class*="items-center"],[class*="grid-cols"]');
  return HERO_CLASS_PATTERN.test(className)
    && hasStructuredLayout
    && !!element.querySelector('h1,h2')
    && !!element.querySelector('a[href],button')
    && !!element.querySelector('img');
};

const isCtaSectionElement = (element: Element): boolean => {
  const className = getElementAttribute(element, 'class');
  return CTA_CLASS_PATTERN.test(className)
    && !!element.querySelector('h1,h2,h3')
    && !!element.querySelector('a[href],button');
};

const firstLinkData = (element: Element, index: number): { text: string; url: string } => {
  const links = Array.from(element.querySelectorAll('a[href]'));
  const link = links[index];
  if (link) {
    return { text: stripTags(link.innerHTML), url: getElementAttribute(link, 'href') };
  }

  const buttons = Array.from(element.querySelectorAll('button'));
  const button = buttons[index - links.length];
  return button ? { text: stripTags(button.innerHTML), url: getElementAttribute(button, 'data-href') } : { text: '', url: '' };
};

const buildCtaSectionWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  if (!isCtaSectionElement(element)) return null;

  const primary = firstLinkData(element, 0);
  const secondary = firstLinkData(element, 1);
  const image = element.querySelector('img');
  const heading = firstElementText(element, 'h1,h2,h3');
  if (!heading || !primary.text) return null;

  const settings: CtaSectionData = {
    eyebrow_text: firstElementText(element, '.eyebrow,.badge,[class*="eyebrow"],[class*="badge"]'),
    heading_text: heading,
    body_text: firstElementText(element, 'p'),
    primary_button_text: primary.text,
    primary_button_url: { url: primary.url },
    secondary_button_text: secondary.text,
    secondary_button_url: { url: secondary.url },
    image: {
      url: image ? getElementAttribute(image, 'src') : '',
      alt: image ? getElementAttribute(image, 'alt') : '',
      id: '',
    },
    source_class_name: getElementAttribute(element, 'class'),
  };

  return createCustomWidget(ctx, 'whipify_cta_section', settings, heading);
};

const buildHeroSectionWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  if (!isHeroSectionElement(element)) return null;

  const primary = firstLinkData(element, 0);
  const secondary = firstLinkData(element, 1);
  const image = element.querySelector('img');
  const heading = firstElementText(element, 'h1,h2');
  if (!heading || !primary.text || !image) return null;

  const settings: CtaSectionData = {
    eyebrow_text: firstElementText(element, '.eyebrow,.badge,[class*="eyebrow"],[class*="badge"]'),
    heading_text: heading,
    body_text: firstElementText(element, 'p'),
    primary_button_text: primary.text,
    primary_button_url: { url: primary.url },
    secondary_button_text: secondary.text,
    secondary_button_url: { url: secondary.url },
    image: {
      url: getElementAttribute(image, 'src'),
      alt: getElementAttribute(image, 'alt'),
      id: '',
    },
    source_class_name: getElementAttribute(element, 'class'),
  };

  return createCustomWidget(ctx, 'whipify_hero_section', settings, heading);
};

const STATS_CLASS_PATTERN = /\b(?:stats|statistics)\b/i;
const STAT_VALUE_PATTERN = /^(?:\d[\d,.]*\+?|\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:hr|hrs|x|k|m)\+?)$/i;

const findStatValueFromElement = (root: Element): string => {
  const candidates = textCandidates(root, 'div,span,strong,b');
  return candidates.find((text) => STAT_VALUE_PATTERN.test(text)) || '';
};

const isStatsCardElement = (element: Element): boolean => (
  !!element.querySelector('h3,h4')
  && !!findStatValueFromElement(element)
);

const findStatsGridElement = (root: Element): Element | null => {
  const rootClassName = getElementAttribute(root, 'class');
  if (!STATS_CLASS_PATTERN.test(rootClassName)) return null;

  const candidates = Array.from(root.querySelectorAll('div,section'));
  return candidates.find((candidate) => {
    const className = getElementAttribute(candidate, 'class');
    if (!/\bgrid\b/.test(className)) return false;
    const stats = Array.from(candidate.children).filter(isStatsCardElement);
    return stats.length >= 2;
  }) || null;
};

const buildStatsSectionWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const grid = findStatsGridElement(element);
  if (!grid) return null;

  const stats: StatItem[] = Array.from(grid.children)
    .filter(isStatsCardElement)
    .map((stat) => {
      const value = findStatValueFromElement(stat);
      return {
        stat_value: value,
        stat_label: firstElementText(stat, 'h3,h4'),
        stat_description: firstElementText(stat, 'p'),
        stat_class_name: getElementAttribute(stat, 'class'),
      };
    })
    .filter((stat) => stat.stat_value && stat.stat_label);

  if (stats.length < 2) return null;

  const sectionTitle = firstElementText(element, 'h1,h2', grid);
  const sectionIntro = firstElementText(element, 'p', grid);
  return createCustomWidget(ctx, 'whipify_stats_section', {
    section_title: sectionTitle,
    section_intro: sectionIntro,
    stats,
    source_class_name: dedupeClassName([
      getElementAttribute(element, 'class'),
      getElementAttribute(grid, 'class'),
    ].filter(Boolean).join(' ')),
  }, sectionTitle || stats.map((stat) => stat.stat_label).join(', '));
};

const TEAM_CLASS_PATTERN = /\b(?:team|members?|staff|crew)\b/i;

const isTeamCardElement = (element: Element): boolean => (
  !!element.querySelector('img')
  && !!element.querySelector('h3,h4')
);

const findTeamGridElement = (root: Element): Element | null => {
  const rootClassName = getElementAttribute(root, 'class');
  if (!TEAM_CLASS_PATTERN.test(rootClassName)) return null;

  const candidates = Array.from(root.querySelectorAll('div,section'));
  return candidates.find((candidate) => {
    const className = getElementAttribute(candidate, 'class');
    if (!/\bgrid\b/.test(className)) return false;
    const members = Array.from(candidate.children).filter(isTeamCardElement);
    return members.length >= 2;
  }) || null;
};

const buildTeamGridWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const grid = findTeamGridElement(element);
  if (!grid) return null;

  const members: TeamMember[] = Array.from(grid.children)
    .filter(isTeamCardElement)
    .map((member) => {
      const image = member.querySelector('img');
      const paragraphs = textCandidates(member, 'p');
      return {
        member_name: firstElementText(member, 'h3,h4'),
        member_role: paragraphs[0] || '',
        member_bio: paragraphs[1] || '',
        image: {
          url: image ? getElementAttribute(image, 'src') : '',
          alt: image ? getElementAttribute(image, 'alt') : '',
          id: '',
        },
        member_class_name: getElementAttribute(member, 'class'),
      };
    })
    .filter((member) => member.member_name && member.member_role);

  if (members.length < 2) return null;

  const sectionTitle = firstElementText(element, 'h1,h2', grid);
  const sectionIntro = firstElementText(element, 'p', grid);
  return createCustomWidget(ctx, 'whipify_team_grid', {
    section_title: sectionTitle,
    section_intro: sectionIntro,
    members,
    source_class_name: dedupeClassName([
      getElementAttribute(element, 'class'),
      getElementAttribute(grid, 'class'),
    ].filter(Boolean).join(' ')),
  }, sectionTitle || members.map((member) => member.member_name).join(', '));
};

const LOGO_CLOUD_CLASS_PATTERN = /\b(?:logo-cloud|logos|partners?|clients?)\b/i;

const isLogoCardElement = (element: Element): boolean => !!element.querySelector('img');

const findLogoCloudGridElement = (root: Element): Element | null => {
  const rootClassName = getElementAttribute(root, 'class');
  if (!LOGO_CLOUD_CLASS_PATTERN.test(rootClassName)) return null;

  const candidates = Array.from(root.querySelectorAll('div,section'));
  return candidates.find((candidate) => {
    const className = getElementAttribute(candidate, 'class');
    if (!/\bgrid\b/.test(className)) return false;
    const logos = Array.from(candidate.children).filter(isLogoCardElement);
    return logos.length >= 3;
  }) || null;
};

const buildLogoCloudWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const grid = findLogoCloudGridElement(element);
  if (!grid) return null;

  const logos: LogoItem[] = Array.from(grid.children)
    .filter(isLogoCardElement)
    .map((logo) => {
      const image = logo.querySelector('img');
      return {
        logo_name: firstElementText(logo, 'h3,h4') || (image ? getElementAttribute(image, 'alt') : ''),
        logo_image: {
          url: image ? getElementAttribute(image, 'src') : '',
          alt: image ? getElementAttribute(image, 'alt') : '',
          id: '',
        },
        logo_class_name: getElementAttribute(logo, 'class'),
      };
    })
    .filter((logo) => logo.logo_name && logo.logo_image.url);

  if (logos.length < 3) return null;

  const sectionTitle = firstElementText(element, 'h1,h2', grid);
  const sectionIntro = firstElementText(element, 'p', grid);
  return createCustomWidget(ctx, 'whipify_logo_cloud', {
    section_title: sectionTitle,
    section_intro: sectionIntro,
    logos,
    source_class_name: dedupeClassName([
      getElementAttribute(element, 'class'),
      getElementAttribute(grid, 'class'),
    ].filter(Boolean).join(' ')),
  }, sectionTitle || logos.map((logo) => logo.logo_name).join(', '));
};

const FAQ_CLASS_PATTERN = /\b(?:faq|faqs|accordion|questions?)\b/i;

const isFaqSectionElement = (element: Element): boolean => FAQ_CLASS_PATTERN.test(getElementAttribute(element, 'class'));

const buildFaqSectionWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  if (!isFaqSectionElement(element)) return null;

  const detailsItems = Array.from(element.querySelectorAll('details'))
    .map((item) => {
      const summary = item.querySelector('summary');
      const answerHtml = item.innerHTML.replace(/<summary\b[\s\S]*?<\/summary>/i, '').trim();
      return {
        question_text: summary ? stripTags(summary.innerHTML) : '',
        answer_text: normalizeRichText(answerHtml),
        item_class_name: getElementAttribute(item, 'class'),
      };
    })
    .filter((item) => item.question_text && stripTags(item.answer_text));

  if (detailsItems.length < 2) return null;

  return createCustomWidget(ctx, 'whipify_faq_section', {
    section_title: firstElementText(element, 'h1,h2'),
    section_intro: firstElementText(element, 'p'),
    items: detailsItems,
    source_class_name: getElementAttribute(element, 'class'),
  }, detailsItems.map((item) => item.question_text).join(', '));
};

const FORM_CLASS_PATTERN = /\b(?:contact-form|lead-form|quote-form|newsletter|signup|booking-form|inquiry-form)\b/i;

const extractFieldType = (field: Element): string => {
  if (field.tagName.toLowerCase() === 'textarea') return 'textarea';
  if (field.tagName.toLowerCase() === 'select') return 'select';
  const inputType = getElementAttribute(field, 'type').toLowerCase();
  return inputType || 'text';
};

const extractFieldLabelFromDom = (field: Element): string => {
  const parentLabel = field.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as Element;
    clone.querySelectorAll('input,textarea,select,button').forEach((child) => child.remove());
    return stripTags(clone.innerHTML);
  }

  const labelledBy = getElementAttribute(field, 'id');
  if (labelledBy) {
    const explicitLabel = field.ownerDocument.querySelector(`label[for="${labelledBy}"]`);
    if (explicitLabel) return stripTags(explicitLabel.innerHTML);
  }

  const previous = field.previousElementSibling;
  if (previous && /^(label|span|p)$/i.test(previous.tagName)) {
    return stripTags(previous.innerHTML);
  }

  return getElementAttribute(field, 'name');
};

const extractLeadFormFieldsFromDom = (form: Element): LeadFormField[] => Array.from(form.querySelectorAll('input,textarea,select'))
  .filter((field) => {
    const type = extractFieldType(field);
    return !['submit', 'button', 'hidden', 'checkbox', 'radio'].includes(type);
  })
  .map((field) => ({
    field_label: extractFieldLabelFromDom(field),
    field_type: extractFieldType(field),
    field_name: getElementAttribute(field, 'name'),
    field_placeholder: getElementAttribute(field, 'placeholder'),
    field_required: field.hasAttribute('required') ? 'yes' : '',
    field_options: field.tagName.toLowerCase() === 'select'
      ? Array.from(field.querySelectorAll('option')).map((option) => stripTags(option.innerHTML)).filter(Boolean).join('\n')
      : '',
    field_class_name: getElementAttribute(field, 'class'),
  }))
  .filter((field) => field.field_label || field.field_name);

const leadFormSubmitTextFromDom = (form: Element): string => {
  const submitButton = form.querySelector('button[type="submit"],button:not([type]),input[type="submit"]');
  if (!submitButton) return '';
  if (submitButton.tagName.toLowerCase() === 'input') return getElementAttribute(submitButton, 'value');
  return stripTags(submitButton.innerHTML);
};

const findLeadFormElement = (element: Element): Element | null => {
  const source = element.tagName.toLowerCase() === 'form' ? element : element.querySelector('form');
  if (!source) return null;

  const rootClassName = getElementAttribute(element, 'class');
  const formClassName = getElementAttribute(source, 'class');
  const formId = getElementAttribute(source, 'data-whipify-form-id');
  const fields = extractLeadFormFieldsFromDom(source);
  const submitText = leadFormSubmitTextFromDom(source);
  const isCandidate = !!formId || FORM_CLASS_PATTERN.test(rootClassName) || FORM_CLASS_PATTERN.test(formClassName);

  if (!isCandidate) return null;
  if (fields.length < 2 || !submitText) return null;
  return source;
};

const buildLeadFormWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const form = findLeadFormElement(element);
  if (!form) return null;

  const root = element.tagName.toLowerCase() === 'form' ? form : element;
  const settings = {
    section_title: firstElementText(root, 'h1,h2,h3'),
    section_intro: firstElementText(root, 'p'),
    form_id: getElementAttribute(form, 'data-whipify-form-id'),
    submit_text: leadFormSubmitTextFromDom(form),
    fields: extractLeadFormFieldsFromDom(form),
    form_class_name: getElementAttribute(form, 'class'),
    source_class_name: dedupeClassName([
      getElementAttribute(root, 'class'),
      getElementAttribute(form, 'class'),
    ].filter(Boolean).join(' ')),
  };

  return createCustomWidget(ctx, 'whipify_lead_form', settings, settings.section_title || settings.form_id || settings.submit_text);
};

const findFeatureGridElement = (root: Element): Element | null => {
  const candidates = Array.from(root.querySelectorAll('div,section,article'));
  return candidates.find((candidate) => {
    const className = getElementAttribute(candidate, 'class');
    if (!/\bgrid\b/.test(className) || !/\bgap-\d+\b/.test(className)) return false;
    const cardCount = Array.from(candidate.children).filter((child) => (
      /^(article|div|li)$/i.test(child.tagName)
      && !!child.querySelector('h2,h3,h4')
      && !!child.querySelector('p')
    )).length;
    return cardCount >= 3;
  }) || null;
};

const buildRichTextWidget = (
  ctx: ElementorBuildContext,
  html: string,
  className: string,
  hint: string,
): ElementorElement | null => {
  const editor = normalizeRichText(html);
  if (!stripTags(editor)) return null;

  return createWidget(ctx, 'text-editor', {
    _css_classes: className,
    editor,
  }, hint);
};

const buildStandaloneFeatureGridSection = (
  ctx: ElementorBuildContext,
  data: FeatureGridSectionData,
): ElementorElement | null => {
  if (data.cards.length < 3) return null;

  const sectionChildren: ElementorElement[] = [];
  const titleWidget = data.sectionTitle
    ? buildHeadingWidget(ctx, 'h2', data.sectionTitle, { _css_classes: 'whipify-feature-grid__title' })
    : null;
  const introWidget = data.sectionIntro
    ? buildTextWidget(ctx, data.sectionIntro, { _css_classes: 'whipify-feature-grid__intro' })
    : null;
  const bodyWidget = data.sectionBodyHtml
    ? buildRichTextWidget(ctx, data.sectionBodyHtml, 'whipify-feature-grid__body-main', `feature-grid-body:${data.sectionTitle}`)
    : null;
  const footerWidget = data.sectionFooterHtml
    ? buildRichTextWidget(ctx, data.sectionFooterHtml, 'whipify-feature-grid__footer', `feature-grid-footer:${data.sectionTitle}`)
    : null;

  [titleWidget, introWidget, bodyWidget].forEach((widget) => {
    if (widget) sectionChildren.push(widget);
  });

  const cardWidgets = data.cards.map((card) => createCustomWidget(
    ctx,
    'whipify_feature_card',
    card,
    card.card_title || card.card_text || 'feature-card',
  ));

  sectionChildren.push(createContainer(ctx, 'feature-grid:cards', cardWidgets, {
    css_classes: dedupeClassName(['whipify-feature-grid__cards', data.sourceClassName].filter(Boolean).join(' ')),
  }));

  if (footerWidget) {
    sectionChildren.push(footerWidget);
  }

  return createContainer(ctx, 'feature-grid:section', [
    createContainer(ctx, 'feature-grid:inner', sectionChildren, {
      css_classes: 'whipify-feature-grid__inner',
    }),
  ], {
    html_tag: 'section',
    css_classes: 'whipify-feature-grid',
  });
};

const buildFeatureGridWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const grid = findFeatureGridElement(element);
  if (!grid) return null;

  const cards: FeatureGridCard[] = Array.from(grid.children)
    .filter((child) => !!child.querySelector('h2,h3,h4') && !!child.querySelector('p'))
    .map((card) => {
      const link = Array.from(card.querySelectorAll('a[href]')).find((candidate) => (
        !candidate.closest('p,li,span,strong,em,b,i,h2,h3,h4')
      )) || null;
      const image = card.querySelector('img');
      const cardText = firstElementText(card, 'p');
      return {
        card_title: firstElementText(card, 'h2,h3,h4'),
        card_text: cardText,
        card_body_html: richFeatureCardBodyFromElement(card, cardText),
        card_link_text: link ? stripTags(link.innerHTML) : '',
        card_url: { url: link ? getElementAttribute(link, 'href') : '' },
        card_class_name: getElementAttribute(card, 'class'),
        card_icon_html: firstElementHtml(card, 'svg'),
        card_icon_class_name: firstIconFrameClassFromElement(card),
        card_image: {
          url: image ? getElementAttribute(image, 'src') : '',
          alt: image ? getElementAttribute(image, 'alt') : '',
          id: '',
        },
      };
    })
    .filter((card) => card.card_title && card.card_text);

  if (cards.length < 3) return null;

  const sectionTitle = firstElementText(element, 'h1,h2', grid);
  const sectionIntro = firstElementText(element, 'p', grid);
  const gridOuterHtml = grid.outerHTML;
  const gridIndex = element.innerHTML.indexOf(gridOuterHtml);
  const sectionBodyHtml = gridIndex >= 0
    ? sectionBodyHtmlBeforeChild(element.innerHTML.slice(0, gridIndex), sectionTitle, sectionIntro)
    : '';
  const sectionFooterHtml = gridIndex >= 0
    ? sectionFooterHtmlAfterChild(element.innerHTML.slice(gridIndex + gridOuterHtml.length))
    : '';
  return buildStandaloneFeatureGridSection(ctx, {
    sectionTitle,
    sectionIntro,
    sectionBodyHtml,
    sectionFooterHtml,
    cards,
    sourceClassName: dedupeClassName([
      getElementAttribute(element, 'class'),
      getElementAttribute(grid, 'class'),
    ].filter(Boolean).join(' ')),
  });
};

const firstTagTextFromHtml = (html: string, tagNames: string): string => {
  const match = html.match(new RegExp(`<(${tagNames})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'));
  return match ? stripTags(match[2] || '') : '';
};

const firstTagHeadingTitleFromHtml = (html: string, tagNames: string): string => {
  const match = html.match(new RegExp(`<(${tagNames})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'));
  return match ? normalizeHeadingTitle(match[2] || '') : '';
};

const firstTagAttributeFromHtml = (html: string, tagName: string, attribute: string): string => {
  const match = html.match(new RegExp(`<${tagName}\\b([^>]*)>`, 'i'));
  return match ? getAttributeFromString(match[1] || '', attribute) : '';
};

const allTagTextFromHtml = (html: string, tagName: string): string[] => Array.from(
  html.matchAll(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi')),
).map((match) => stripTags(match[1] || '')).filter(Boolean);

const locationCardDataFromText = (
  text: string,
  cityName: string,
): Pick<LocationCard, 'rating_text' | 'region_text' | 'phone_text' | 'reviews_text' | 'experience_text' | 'variant'> => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const rating = normalized.match(/\b\d(?:\.\d)?\b/)?.[0] || '';
  const phone = normalized.match(/\(?\d{3}\)?[\s-]?\d{3}-\d{4}/)?.[0] || '';
  const reviews = normalized.match(/\d+\+\s*Reviews/i)?.[0] || '';
  const experience = normalized.match(/\d+\+\s*Years\s*Experience/i)?.[0] || '';
  const region = normalized.match(/\b[A-Z]{2}\b/)?.[0] || '';
  const city = cityName.toLowerCase();

  return {
    rating_text: rating,
    region_text: region,
    phone_text: phone,
    reviews_text: reviews,
    experience_text: experience,
    variant: city.includes('calgary') ? 'calgary' : city.includes('edmonton') ? 'edmonton' : 'default',
  };
};

const buildLocationCardWidget = (
  ctx: ElementorBuildContext,
  card: LocationCard,
): ElementorElement => createCustomWidget(ctx, 'whipify_location_card', card, `location-card:${card.city_name}`);

const collectDirectAnchorMatchesFromHtml = (html: string): StringMatch[] => {
  const anchors: StringMatch[] = [];
  const anchorPattern = /<a\b([^>]*)>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    if (match.index < cursor) continue;
    const end = findMatchingTagEnd(html, match.index, 'a');
    if (end < 0) continue;

    const outerHtml = html.slice(match.index, end);
    const openTagEnd = outerHtml.indexOf('>');
    anchors.push({
      index: match.index,
      tagName: 'a',
      attributes: match[1] || '',
      innerHtml: openTagEnd >= 0 ? outerHtml.slice(openTagEnd + 1, outerHtml.length - '</a>'.length) : '',
      outerHtml,
    });
    cursor = end;
    anchorPattern.lastIndex = end;
  }

  return anchors;
};

const locationCardFromHtmlMatch = (match: StringMatch): LocationCard | null => {
  const cityName = firstTagTextFromHtml(match.innerHtml, 'h2|h3|h4');
  const buttonText = firstTagTextFromHtml(match.innerHtml, 'button') || 'View Services';
  const text = stripTags(match.innerHtml);
  const details = locationCardDataFromText(text, cityName);
  const href = getAttributeFromString(match.attributes || '', 'href');
  const cardClassName = firstTagAttributeFromHtml(match.innerHtml, 'div', 'class');

  if (!cityName || !href || !details.phone_text || !details.reviews_text || !details.experience_text) {
    return null;
  }

  return {
    city_name: cityName,
    ...details,
    button_text: buttonText,
    card_url: { url: href },
    source_class_name: normalizeClassName(getAttributeFromString(match.attributes || '', 'class')),
    card_class_name: normalizeClassName(cardClassName),
  };
};

const buildLocationGridSection = (
  ctx: ElementorBuildContext,
  data: {
    sectionTitle: string;
    cards: LocationCard[];
    sourceClassName: string;
  },
): ElementorElement | null => {
  if (data.cards.length < 2) return null;

  const sectionChildren: ElementorElement[] = [];
  const titleWidget = data.sectionTitle
    ? buildHeadingWidget(ctx, 'h2', data.sectionTitle, {
      _css_classes: 'whipify-location-grid__title text-3xl md:text-4xl font-bold text-center mb-12 text-foreground',
      align: 'center',
    })
    : null;

  if (titleWidget) sectionChildren.push(titleWidget);

  sectionChildren.push(createContainer(ctx, 'location-grid:cards', data.cards.map((card) => buildLocationCardWidget(ctx, card)), {
    css_classes: dedupeClassName(['whipify-location-grid__cards', data.sourceClassName].filter(Boolean).join(' ')),
  }));

  return createContainer(ctx, 'location-grid:section', [
    createContainer(ctx, 'location-grid:inner', sectionChildren, {
      css_classes: 'whipify-location-grid__inner container mx-auto px-4',
    }),
  ], {
    html_tag: 'section',
    css_classes: 'whipify-location-grid py-16 bg-white',
  });
};

const buildLocationGridWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  if (!/\bgrid\b/i.test(html) || !/\bgap-\d+\b/i.test(html) || !/<a\b/i.test(html)) return null;

  const gridPattern = /<div\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = gridPattern.exec(html)) !== null) {
    const gridClassName = normalizeClassName(getAttributeFromString(match[1] || '', 'class'));
    if (!/\bgrid\b/.test(gridClassName) || !/\bgap-\d+\b/.test(gridClassName)) continue;

    const end = findMatchingTagEnd(html, match.index, 'div');
    if (end < 0) continue;

    const outerHtml = html.slice(match.index, end);
    const openTagEnd = outerHtml.indexOf('>');
    const innerHtml = openTagEnd >= 0 ? outerHtml.slice(openTagEnd + 1, outerHtml.length - '</div>'.length) : '';
    const cards = collectDirectAnchorMatchesFromHtml(innerHtml)
      .map(locationCardFromHtmlMatch)
      .filter((card): card is LocationCard => Boolean(card));

    if (cards.length < 2) continue;

    return buildLocationGridSection(ctx, {
      sectionTitle: firstTagTextFromHtml(html.slice(0, match.index), 'h1|h2'),
      cards,
      sourceClassName: gridClassName,
    });
  }

  return null;
};

const locationCardFromElement = (anchor: Element): LocationCard | null => {
  const cityName = firstElementText(anchor, 'h2,h3,h4');
  const text = stripTags(anchor.innerHTML);
  const details = locationCardDataFromText(text, cityName);
  const href = getElementAttribute(anchor, 'href');
  const cardClassName = firstElementAttribute(anchor, 'div', 'class');
  const buttonText = firstElementText(anchor, 'button') || 'View Services';

  if (!cityName || !href || !details.phone_text || !details.reviews_text || !details.experience_text) {
    return null;
  }

  return {
    city_name: cityName,
    ...details,
    button_text: buttonText,
    card_url: { url: href },
    source_class_name: getElementAttribute(anchor, 'class'),
    card_class_name: cardClassName,
  };
};

const findLocationGridElement = (element: Element): Element | null => {
  const candidates = Array.from(element.querySelectorAll('div'));
  return candidates.find((candidate) => {
    const className = getElementAttribute(candidate, 'class');
    if (!/\bgrid\b/.test(className) || !/\bgap-\d+\b/.test(className)) return false;
    const cards = Array.from(candidate.children)
      .filter((child) => child.tagName.toLowerCase() === 'a')
      .map(locationCardFromElement)
      .filter(Boolean);
    return cards.length >= 2;
  }) || null;
};

const buildLocationGridWidgetFromDom = (ctx: ElementorBuildContext, element: Element): ElementorElement | null => {
  const grid = findLocationGridElement(element);
  if (!grid) return null;

  const cards = Array.from(grid.children)
    .filter((child) => child.tagName.toLowerCase() === 'a')
    .map(locationCardFromElement)
    .filter((card): card is LocationCard => Boolean(card));

  if (cards.length < 2) return null;

  return buildLocationGridSection(ctx, {
    sectionTitle: firstElementText(element, 'h1,h2', grid),
    cards,
    sourceClassName: getElementAttribute(grid, 'class'),
  });
};

const isHtmlIndexInsideAnyTag = (html: string, index: number, tags: string[]): boolean => {
  const before = html.slice(0, index).toLowerCase();

  return tags.some((tag) => {
    const openPattern = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    const closePattern = new RegExp(`<\\/${tag}\\s*>`, 'gi');
    let lastOpen = -1;
    let lastClose = -1;
    let match: RegExpExecArray | null;

    while ((match = openPattern.exec(before)) !== null) {
      lastOpen = match.index;
    }

    while ((match = closePattern.exec(before)) !== null) {
      lastClose = match.index;
    }

    return lastOpen > lastClose;
  });
};

const isInlineTextAnchorFromHtml = (html: string, index: number): boolean => (
  isHtmlIndexInsideAnyTag(html, index, ['p', 'li', 'span', 'strong', 'em', 'b', 'i', 'h2', 'h3', 'h4'])
);

const removeNonInlineAnchorsFromHtml = (html: string): string => html.replace(
  /<a\b[^>]*>[\s\S]*?<\/a>/gi,
  (anchor, offset) => (isInlineTextAnchorFromHtml(html, offset) ? anchor : ''),
);

const findNonInlineAnchorMatchFromHtml = (html: string): RegExpExecArray | null => {
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    if (!isInlineTextAnchorFromHtml(html, match.index)) {
      return match;
    }
  }

  return null;
};

const richFeatureCardBodyFromHtml = (html: string, cardText: string): string => {
  const withoutDecorativeAtoms = removeNonInlineAnchorsFromHtml(html
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<img\b[^>]*\/?>/gi, '')
    .replace(/<h[2-4]\b[\s\S]*?<\/h[2-4]>/i, '')
    .replace(/<button\b[\s\S]*?<\/button>/gi, ''));
  const bodyHtml = normalizeRichText(cleanPreservedHtmlClasses(withoutDecorativeAtoms));
  if (!stripTags(bodyHtml)) return '';
  return stripTags(bodyHtml) === cardText && !/<(a|strong|em|b|i|span|br)\b/i.test(bodyHtml) ? '' : bodyHtml;
};

const findMatchingTagEnd = (html: string, openTagStart: number, tagName: string): number => {
  const openTagEnd = html.indexOf('>', openTagStart);
  if (openTagEnd < 0) return -1;

  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = openTagStart;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    const fullTag = match[0];
    if (/^<\//.test(fullTag)) {
      depth -= 1;
      if (depth === 0) return tagPattern.lastIndex;
    } else if (!/\/>$/.test(fullTag)) {
      depth += 1;
    }
  }

  return -1;
};

const collectDirectChildElementMatchesFromHtml = (html: string): StringMatch[] => {
  const children: StringMatch[] = [];
  const childPattern = /<(article|div|li)\b([^>]*)>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = childPattern.exec(html)) !== null) {
    if (match.index < cursor) continue;
    const tagName = match[1].toLowerCase();
    const end = findMatchingTagEnd(html, match.index, tagName);
    if (end < 0) continue;

    const outerHtml = html.slice(match.index, end);
    const openTagEnd = outerHtml.indexOf('>');
    children.push({
      index: match.index,
      tagName,
      attributes: match[2] || '',
      innerHtml: openTagEnd >= 0 ? outerHtml.slice(openTagEnd + 1, outerHtml.length - `</${tagName}>`.length) : '',
      outerHtml,
    });
    cursor = end;
    childPattern.lastIndex = end;
  }

  return children;
};

const findFeatureGridMatchesFromHtml = (html: string): FeatureGridHtmlMatch | null => {
  const gridPattern = /<div\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = gridPattern.exec(html)) !== null) {
    const className = normalizeClassName(getAttributeFromString(match[1] || '', 'class'));
    if (!/\bgrid\b/.test(className) || !/\bgap-\d+\b/.test(className)) continue;

    const end = findMatchingTagEnd(html, match.index, 'div');
    if (end < 0) continue;

    const outerHtml = html.slice(match.index, end);
    const openTagEnd = outerHtml.indexOf('>');
    const innerHtml = openTagEnd >= 0 ? outerHtml.slice(openTagEnd + 1, outerHtml.length - '</div>'.length) : '';
    const cards = collectDirectChildElementMatchesFromHtml(innerHtml).filter((child) => (
      /<h[2-4]\b/i.test(child.innerHtml) && /<p\b/i.test(child.innerHtml)
    ));

    const hasRichCardBody = cards.some((child) => (
      /<(dl|blockquote|ul|ol|table|span)\b/i.test(child.innerHtml)
      || (child.innerHtml.match(/<p\b/gi) || []).length > 1
      || /\b(Property Type|Challenge|Result|Local Expertise|Key moments)\b/i.test(stripTags(child.innerHtml))
    ));
    const hasSemanticCardTags = cards.some((child) => /^(article|li)$/i.test(child.tagName));
    if (cards.length >= 3 && (hasRichCardBody || hasSemanticCardTags)) {
      return {
        index: match.index,
        gridAttributes: match[1] || '',
        innerHtml,
        outerHtml,
        cards,
      };
    }
  }

  return null;
};

const findPriceTextFromHtml = (html: string): string => {
  const candidates = Array.from(html.matchAll(/<(div|span|strong|b|p)\b[^>]*>([\s\S]*?)<\/\1>/gi))
    .map((match) => stripTags(match[2] || ''))
    .filter(Boolean);
  const priceText = candidates.find(hasPricingSignal) || '';
  return priceText ? normalizePriceText(priceText) : '';
};

const findIntervalTextFromHtml = (html: string, priceText: string): string => {
  const candidates = Array.from(html.matchAll(/<(span|small|em|p)\b[^>]*>([\s\S]*?)<\/\1>/gi))
    .map((match) => stripTags(match[2] || ''))
    .filter(Boolean)
    .filter((text) => text !== priceText);
  return candidates.find((text) => INTERVAL_PATTERN.test(text)) || '';
};

const cellTextsFromRowHtml = (rowHtml: string): string[] => Array.from(
  rowHtml.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi),
).map((match) => match[1] || '');

const pricingCellTextFromHtml = (cellHtml: string): string => stripTags(cellHtml
  .replace(/<a\b[\s\S]*?<\/a>/gi, '')
  .replace(/<button\b[\s\S]*?<\/button>/gi, ''));

const buildPricingMatrixWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const tableMatch = html.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch || !hasPricingSignal(stripTags(tableMatch[1] || ''))) return null;

  const tableHtml = tableMatch[1] || '';
  const rowMatches = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  if (rowMatches.length < 3) return null;

  const headerCells = cellTextsFromRowHtml(rowMatches[0]?.[1] || '').map(stripTags).filter(Boolean);
  const columns = headerCells.slice(1);
  const pricingRows: PricingMatrixRow[] = rowMatches.slice(1).map((match) => {
    const cells = cellTextsFromRowHtml(match[1] || '');
    if (cells.length < 2) return null;
    const badgeMatch = cells[0].match(/<span\b[^>]*>([\s\S]*?)<\/span>/i);
    const serviceType = stripTags(cells[0].replace(/<span\b[\s\S]*?<\/span>/gi, ''));
    const linkMatch = (match[1] || '').match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    return {
      service_type: serviceType,
      service_badge: badgeMatch ? stripTags(badgeMatch[1] || '') : '',
      prices: cells.slice(1).map(pricingCellTextFromHtml).filter(Boolean).join('\n'),
      cta_text: linkMatch ? stripTags(linkMatch[2] || '') : '',
      cta_url: { url: linkMatch ? getAttributeFromString(linkMatch[1] || '', 'href') : '' },
    };
  }).filter((row): row is PricingMatrixRow => !!row && !!row.service_type && !!row.prices);

  if (columns.length < 2 || pricingRows.length < 2) return null;

  const tableIndex = tableMatch.index || html.length;
  const sectionIntroHtml = html.slice(0, tableIndex);
  const sectionFooterHtml = sectionFooterHtmlAfterChild(html.slice(tableIndex + tableMatch[0].length));
  return createCustomWidget(ctx, 'whipify_pricing_table', {
    section_title: firstTagHeadingTitleFromHtml(sectionIntroHtml, 'h1|h2'),
    section_intro: firstTagTextFromHtml(sectionIntroHtml, 'p'),
    section_footer_html: sectionFooterHtml,
    pricing_columns: columns.join('\n'),
    pricing_rows: pricingRows,
    plans: [],
    source_class_name: firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class'),
  }, pricingRows.map((row) => row.service_type).join(', '));
};

const buildPricingTableWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const matrix = buildPricingMatrixWidgetFromHtml(ctx, html);
  if (matrix) return matrix;

  if (!hasPricingSignal(html) || !/\b(grid|pricing)\b/i.test(html)) return null;

  const planMatches = Array.from(html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi));
  if (planMatches.length < 2) return null;

  const plans: PricingPlan[] = planMatches.map((match) => {
    const planHtml = match[2] || '';
    const linkMatch = planHtml.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    const price = findPriceTextFromHtml(planHtml);
    const className = normalizeClassName(getAttributeFromString(match[1] || '', 'class'));
    return {
      plan_name: firstTagTextFromHtml(planHtml, 'h2|h3|h4'),
      plan_description: firstTagTextFromHtml(planHtml, 'p'),
      plan_price: price,
      plan_interval: findIntervalTextFromHtml(planHtml, price),
      plan_price_position: findPlanPricePositionFromHtml(planHtml, price),
      plan_features: allTagTextFromHtml(planHtml, 'li').join('\n'),
      cta_text: linkMatch ? stripTags(linkMatch[2] || '') : firstTagTextFromHtml(planHtml, 'button'),
      cta_url: { url: linkMatch ? getAttributeFromString(linkMatch[1] || '', 'href') : '' },
      is_highlighted: isHighlightedPlanClass(className),
      plan_class_name: className,
    };
  }).filter((plan) => plan.plan_name && plan.plan_price);

  if (plans.length < 2) return null;

  const firstPlanIndex = planMatches[0]?.index || html.length;
  const sectionIntroHtml = html.slice(0, firstPlanIndex);
  const lastPlan = planMatches[planMatches.length - 1];
  const lastPlanEnd = (lastPlan?.index || 0) + (lastPlan?.[0]?.length || 0);
  const sectionFooterHtml = lastPlanEnd > 0 ? sectionFooterHtmlAfterChild(html.slice(lastPlanEnd)) : '';
  const gridClass = firstTagAttributeFromHtml(html.match(/<div\b[^>]*\bgrid\b[\s\S]*$/i)?.[0] || '', 'div', 'class');
  const sourceClassName = dedupeClassName([
    firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class'),
    gridClass,
  ].filter(Boolean).join(' '));

  return createCustomWidget(ctx, 'whipify_pricing_table', {
    section_title: firstTagHeadingTitleFromHtml(sectionIntroHtml, 'h1|h2'),
    section_intro: firstTagTextFromHtml(sectionIntroHtml, 'p'),
    section_footer_html: sectionFooterHtml,
    plans,
    source_class_name: sourceClassName,
  }, plans.map((plan) => plan.plan_name).join(', '));
};

const findRatingTextFromHtml = (html: string): string => {
  const candidates = Array.from(html.matchAll(/<(p|span|div)\b[^>]*>([\s\S]*?)<\/\1>/gi))
    .map((match) => stripTags(match[2] || ''))
    .filter(Boolean);
  return candidates.find((text) => /\bstars?\b|★|rating/i.test(text)) || '';
};

const buildTestimonialGridWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const testimonialSignal = html.slice(0, 1200);
  if (
    !/\b(testimonials?|reviews?)\b/i.test(testimonialSignal)
    && !/\b(customers?\s+say|google\s+reviews?)\b/i.test(stripTags(testimonialSignal))
  ) return null;
  if (!/<blockquote\b/i.test(html) && !/class\s*=\s*["'][^"']*\b(testimonials?|reviews?)\b/i.test(html)) return null;

  const testimonialMatches = Array.from(html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi));
  if (testimonialMatches.length < 2) return null;

  const testimonials: TestimonialItem[] = testimonialMatches.map((match) => {
    const testimonialHtml = match[2] || '';
    const rating = findRatingTextFromHtml(testimonialHtml);
    const quote = firstTagTextFromHtml(testimonialHtml, 'blockquote') || allTagTextFromHtml(testimonialHtml, 'p')
      .find((text) => !/\bstars?\b|★|rating/i.test(text)) || '';
    const imageMatch = testimonialHtml.match(/<img\b([^>]*)\/?>/i);
    const personTitle = allTagTextFromHtml(testimonialHtml, 'p')
      .find((text) => text !== quote && text !== rating && !PRICE_PATTERN.test(text)) || '';
    return {
      quote_text: quote,
      person_name: firstTagTextFromHtml(testimonialHtml, 'h3|h4|strong|b'),
      person_title: personTitle,
      rating,
      image: {
        url: imageMatch ? getAttributeFromString(imageMatch[1] || '', 'src') : '',
        alt: imageMatch ? getAttributeFromString(imageMatch[1] || '', 'alt') : '',
        id: '',
      },
      testimonial_class_name: normalizeClassName(getAttributeFromString(match[1] || '', 'class')),
    };
  }).filter((testimonial) => testimonial.quote_text && testimonial.person_name);

  if (testimonials.length < 2) return null;

  const firstTestimonialIndex = testimonialMatches[0]?.index || html.length;
  const sectionIntroHtml = html.slice(0, firstTestimonialIndex);
  const gridClass = firstTagAttributeFromHtml(html.match(/<div\b[^>]*\bgrid\b[\s\S]*$/i)?.[0] || '', 'div', 'class');
  const sourceClassName = dedupeClassName([
    firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class'),
    gridClass,
  ].filter(Boolean).join(' '));

  return createCustomWidget(ctx, 'whipify_testimonial_grid', {
    section_title: firstTagTextFromHtml(sectionIntroHtml, 'h1|h2'),
    section_intro: firstTagTextFromHtml(sectionIntroHtml, 'p'),
    testimonials,
    source_class_name: sourceClassName,
  }, testimonials.map((testimonial) => testimonial.person_name).join(', '));
};

const firstClassTextFromHtml = (html: string, classPattern: RegExp): string => {
  if (classPattern.test('eyebrow') || classPattern.test('badge')) {
    const eyebrowMatch = html.match(/<([a-z][\w:-]*)\b[^>]*class\s*=\s*["'][^"']*\b(?:eyebrow|badge)\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i);
    if (eyebrowMatch) return stripTags(eyebrowMatch[2] || '');
  }

  const classMatches = Array.from(html.matchAll(/<([a-z][\w:-]*)\b([^>]*class\s*=\s*["'][^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi));
  const direct = classMatches.find((candidate) => classPattern.test(getAttributeFromString(candidate[2] || '', 'class')));
  if (direct) return stripTags(direct[3] || '');

  const matches = Array.from(html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>([\s\S]*?)<\/\1>/gi));
  const match = matches.find((candidate) => classPattern.test(getAttributeFromString(candidate[2] || '', 'class')));
  return match ? stripTags(match[3] || '') : '';
};

const linkDataFromHtml = (html: string, index: number): { text: string; url: string } => {
  const linkMatches = Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi));
  const link = linkMatches[index];
  if (link) {
    return {
      text: stripTags(link[2] || ''),
      url: getAttributeFromString(link[1] || '', 'href'),
    };
  }

  const buttonMatches = Array.from(html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi));
  const button = buttonMatches[index - linkMatches.length];
  return button ? {
    text: stripTags(button[2] || ''),
    url: getAttributeFromString(button[1] || '', 'data-href'),
  } : { text: '', url: '' };
};

const buildCtaSectionWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const sourceClassName = firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class');
  if (!CTA_CLASS_PATTERN.test(sourceClassName) || !/<(?:a|button)\b/i.test(html)) return null;

  const primary = linkDataFromHtml(html, 0);
  const secondary = linkDataFromHtml(html, 1);
  const imageMatch = html.match(/<img\b([^>]*)\/?>/i);
  const heading = firstTagTextFromHtml(html, 'h1|h2|h3');
  if (!heading || !primary.text) return null;

  const settings: CtaSectionData = {
    eyebrow_text: firstClassTextFromHtml(html, /\b(?:eyebrow|badge)\b/i),
    heading_text: heading,
    body_text: firstTagTextFromHtml(html, 'p'),
    primary_button_text: primary.text,
    primary_button_url: { url: primary.url },
    secondary_button_text: secondary.text,
    secondary_button_url: { url: secondary.url },
    image: {
      url: imageMatch ? getAttributeFromString(imageMatch[1] || '', 'src') : '',
      alt: imageMatch ? getAttributeFromString(imageMatch[1] || '', 'alt') : '',
      id: '',
    },
    source_class_name: sourceClassName,
  };

  return createCustomWidget(ctx, 'whipify_cta_section', settings, heading);
};

const buildHeroSectionWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const sourceClassName = firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class');
  if (
    !HERO_CLASS_PATTERN.test(sourceClassName)
    || !/\b(grid|flex|items-center|grid-cols)\b/i.test(html)
    || !/<(?:a|button)\b/i.test(html)
    || !/<img\b/i.test(html)
  ) return null;

  const primary = linkDataFromHtml(html, 0);
  const secondary = linkDataFromHtml(html, 1);
  const imageMatch = html.match(/<img\b([^>]*)\/?>/i);
  const heading = firstTagTextFromHtml(html, 'h1|h2');
  if (!heading || !primary.text || !imageMatch) return null;

  const settings: CtaSectionData = {
    eyebrow_text: firstClassTextFromHtml(html, /\b(?:eyebrow|badge)\b/i),
    heading_text: heading,
    body_text: firstTagTextFromHtml(html, 'p'),
    primary_button_text: primary.text,
    primary_button_url: { url: primary.url },
    secondary_button_text: secondary.text,
    secondary_button_url: { url: secondary.url },
    image: {
      url: getAttributeFromString(imageMatch[1] || '', 'src'),
      alt: getAttributeFromString(imageMatch[1] || '', 'alt'),
      id: '',
    },
    source_class_name: sourceClassName,
  };

  return createCustomWidget(ctx, 'whipify_hero_section', settings, heading);
};

const findStatValueFromHtml = (html: string): string => {
  const candidates = Array.from(html.matchAll(/<(div|span|strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi))
    .map((match) => stripTags(match[2] || ''))
    .filter(Boolean);
  return candidates.find((text) => STAT_VALUE_PATTERN.test(text)) || '';
};

const buildStatsSectionWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const sourceClassName = firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class');
  if (!STATS_CLASS_PATTERN.test(sourceClassName)) return null;

  const statMatches = Array.from(html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi));
  if (statMatches.length < 2) return null;

  const stats: StatItem[] = statMatches.map((match) => {
    const statHtml = match[2] || '';
    return {
      stat_value: findStatValueFromHtml(statHtml),
      stat_label: firstTagTextFromHtml(statHtml, 'h3|h4'),
      stat_description: firstTagTextFromHtml(statHtml, 'p'),
      stat_class_name: normalizeClassName(getAttributeFromString(match[1] || '', 'class')),
    };
  }).filter((stat) => stat.stat_value && stat.stat_label);

  if (stats.length < 2) return null;

  const firstStatIndex = statMatches[0]?.index || html.length;
  const sectionIntroHtml = html.slice(0, firstStatIndex);
  const gridClass = firstTagAttributeFromHtml(html.match(/<div\b[^>]*\bgrid\b[\s\S]*$/i)?.[0] || '', 'div', 'class');

  return createCustomWidget(ctx, 'whipify_stats_section', {
    section_title: firstTagTextFromHtml(sectionIntroHtml, 'h1|h2'),
    section_intro: firstTagTextFromHtml(sectionIntroHtml, 'p'),
    stats,
    source_class_name: dedupeClassName([sourceClassName, gridClass].filter(Boolean).join(' ')),
  }, stats.map((stat) => stat.stat_label).join(', '));
};

const buildTeamGridWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const sourceClassName = firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class');
  if (!TEAM_CLASS_PATTERN.test(sourceClassName)) return null;

  const memberMatches = Array.from(html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi));
  if (memberMatches.length < 2) return null;

  const members: TeamMember[] = memberMatches.map((match) => {
    const memberHtml = match[2] || '';
    const imageMatch = memberHtml.match(/<img\b([^>]*)\/?>/i);
    const paragraphs = allTagTextFromHtml(memberHtml, 'p');
    return {
      member_name: firstTagTextFromHtml(memberHtml, 'h3|h4'),
      member_role: paragraphs[0] || '',
      member_bio: paragraphs[1] || '',
      image: {
        url: imageMatch ? getAttributeFromString(imageMatch[1] || '', 'src') : '',
        alt: imageMatch ? getAttributeFromString(imageMatch[1] || '', 'alt') : '',
        id: '',
      },
      member_class_name: normalizeClassName(getAttributeFromString(match[1] || '', 'class')),
    };
  }).filter((member) => member.member_name && member.member_role);

  if (members.length < 2) return null;

  const firstMemberIndex = memberMatches[0]?.index || html.length;
  const sectionIntroHtml = html.slice(0, firstMemberIndex);
  const gridClass = firstTagAttributeFromHtml(html.match(/<div\b[^>]*\bgrid\b[\s\S]*$/i)?.[0] || '', 'div', 'class');

  return createCustomWidget(ctx, 'whipify_team_grid', {
    section_title: firstTagTextFromHtml(sectionIntroHtml, 'h1|h2'),
    section_intro: firstTagTextFromHtml(sectionIntroHtml, 'p'),
    members,
    source_class_name: dedupeClassName([sourceClassName, gridClass].filter(Boolean).join(' ')),
  }, members.map((member) => member.member_name).join(', '));
};

const buildLogoCloudWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const sourceClassName = firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class');
  if (!LOGO_CLOUD_CLASS_PATTERN.test(sourceClassName)) return null;

  const logoMatches = Array.from(html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi));
  if (logoMatches.length < 3) return null;

  const logos: LogoItem[] = logoMatches.map((match) => {
    const logoHtml = match[2] || '';
    const imageMatch = logoHtml.match(/<img\b([^>]*)\/?>/i);
    const alt = imageMatch ? getAttributeFromString(imageMatch[1] || '', 'alt') : '';
    return {
      logo_name: firstTagTextFromHtml(logoHtml, 'h3|h4') || alt,
      logo_image: {
        url: imageMatch ? getAttributeFromString(imageMatch[1] || '', 'src') : '',
        alt,
        id: '',
      },
      logo_class_name: normalizeClassName(getAttributeFromString(match[1] || '', 'class')),
    };
  }).filter((logo) => logo.logo_name && logo.logo_image.url);

  if (logos.length < 3) return null;

  const firstLogoIndex = logoMatches[0]?.index || html.length;
  const sectionIntroHtml = html.slice(0, firstLogoIndex);
  const gridClass = firstTagAttributeFromHtml(html.match(/<div\b[^>]*\bgrid\b[\s\S]*$/i)?.[0] || '', 'div', 'class');

  return createCustomWidget(ctx, 'whipify_logo_cloud', {
    section_title: firstTagTextFromHtml(sectionIntroHtml, 'h1|h2'),
    section_intro: firstTagTextFromHtml(sectionIntroHtml, 'p'),
    logos,
    source_class_name: dedupeClassName([sourceClassName, gridClass].filter(Boolean).join(' ')),
  }, logos.map((logo) => logo.logo_name).join(', '));
};

const buildFaqSectionWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const sourceClassName = firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class');
  if (!FAQ_CLASS_PATTERN.test(sourceClassName)) return null;

  const itemMatches = Array.from(html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/gi));
  if (itemMatches.length < 2) return null;

  const items: FaqItem[] = itemMatches.map((match) => {
    const itemHtml = match[2] || '';
    const summaryMatch = itemHtml.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    const answerHtml = itemHtml.replace(/<summary\b[\s\S]*?<\/summary>/i, '').trim();
    return {
      question_text: stripTags(summaryMatch?.[1] || ''),
      answer_text: normalizeRichText(answerHtml),
      item_class_name: normalizeClassName(getAttributeFromString(match[1] || '', 'class')),
    };
  }).filter((item) => item.question_text && stripTags(item.answer_text));

  if (items.length < 2) return null;

  const firstItemIndex = itemMatches[0]?.index || html.length;
  const sectionIntroHtml = html.slice(0, firstItemIndex);

  return createCustomWidget(ctx, 'whipify_faq_section', {
    section_title: firstTagTextFromHtml(sectionIntroHtml, 'h1|h2'),
    section_intro: firstTagTextFromHtml(sectionIntroHtml, 'p'),
    items,
    source_class_name: sourceClassName,
  }, items.map((item) => item.question_text).join(', '));
};

const extractLeadFormFieldsFromHtml = (formHtml: string): LeadFormField[] => {
  const fields: LeadFormField[] = [];
  const labelMatches = Array.from(formHtml.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi));

  labelMatches.forEach((match) => {
    const labelHtml = match[1] || '';
    const controlMatch = labelHtml.match(/<(input|textarea|select)\b([^>]*)>([\s\S]*?<\/select>)?/i);
    if (!controlMatch) return;
    const fieldTag = controlMatch[1].toLowerCase();
    const controlAttributes = controlMatch[2] || '';
    const fullControlHtml = controlMatch[0] || '';
    const fieldType = fieldTag === 'input'
      ? (getAttributeFromString(controlAttributes, 'type').toLowerCase() || 'text')
      : fieldTag;
    if (['submit', 'button', 'hidden', 'checkbox', 'radio'].includes(fieldType)) return;

    fields.push({
      field_label: stripTags(labelHtml.replace(fullControlHtml, '')),
      field_type: fieldType,
      field_name: getAttributeFromString(controlAttributes, 'name'),
      field_placeholder: getAttributeFromString(controlAttributes, 'placeholder'),
      field_required: /\brequired\b/i.test(controlAttributes) ? 'yes' : '',
      field_options: fieldTag === 'select'
        ? Array.from(fullControlHtml.matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)).map((option) => stripTags(option[1] || '')).filter(Boolean).join('\n')
        : '',
      field_class_name: normalizeClassName(getAttributeFromString(controlAttributes, 'class')),
    });
  });

  return fields.filter((field) => field.field_label || field.field_name);
};

const leadFormSubmitTextFromHtml = (formHtml: string): string => {
  const buttonMatch = formHtml.match(/<button\b([^>]*)>([\s\S]*?)<\/button>/i);
  if (buttonMatch && (!getAttributeFromString(buttonMatch[1] || '', 'type') || getAttributeFromString(buttonMatch[1] || '', 'type').toLowerCase() === 'submit')) {
    return stripTags(buttonMatch[2] || '');
  }

  const inputMatch = formHtml.match(/<input\b([^>]*)\/?>/i);
  if (inputMatch && getAttributeFromString(inputMatch[1] || '', 'type').toLowerCase() === 'submit') {
    return getAttributeFromString(inputMatch[1] || '', 'value');
  }

  return '';
};

const buildLeadFormWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  const formMatch = html.match(/<form\b([^>]*)>([\s\S]*?)<\/form>/i);
  if (!formMatch) return null;

  const sourceClassName = firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class') || '';
  const formClassName = normalizeClassName(getAttributeFromString(formMatch[1] || '', 'class'));
  const formId = getAttributeFromString(formMatch[1] || '', 'data-whipify-form-id');
  const isCandidate = !!formId || FORM_CLASS_PATTERN.test(sourceClassName) || FORM_CLASS_PATTERN.test(formClassName);
  if (!isCandidate) return null;

  const formHtml = formMatch[2] || '';
  const fields = extractLeadFormFieldsFromHtml(formHtml);
  const submitText = leadFormSubmitTextFromHtml(formHtml);
  if (fields.length < 2 || !submitText) return null;

  const formIndex = formMatch.index || html.length;
  const sectionIntroHtml = html.slice(0, formIndex);

  return createCustomWidget(ctx, 'whipify_lead_form', {
    section_title: firstTagTextFromHtml(sectionIntroHtml, 'h1|h2|h3'),
    section_intro: firstTagTextFromHtml(sectionIntroHtml, 'p'),
    form_id: formId,
    submit_text: submitText,
    fields,
    form_class_name: formClassName,
    source_class_name: dedupeClassName([sourceClassName, formClassName].filter(Boolean).join(' ')),
  }, formId || submitText);
};

const buildFeatureGridWidgetFromHtml = (ctx: ElementorBuildContext, html: string): ElementorElement | null => {
  if (!/\bgrid\b/i.test(html) || !/\bgap-\d+\b/i.test(html)) return null;

  const featureGrid = findFeatureGridMatchesFromHtml(html);
  const cardMatches = featureGrid?.cards || Array.from(html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)).map((match) => ({
    index: match.index || 0,
    tagName: 'article',
    attributes: match[1] || '',
    innerHtml: match[2] || '',
    outerHtml: match[0],
  }));
  if (cardMatches.length < 3) return null;

  const cards: FeatureGridCard[] = cardMatches.map((match) => {
    const cardHtml = match.innerHtml || '';
    const linkMatch = findNonInlineAnchorMatchFromHtml(cardHtml);
    const imageMatch = cardHtml.match(/<img\b([^>]*)\/?>/i);
    const svgMatch = cardHtml.match(/<svg\b[\s\S]*?<\/svg>/i);
    const cardText = firstTagTextFromHtml(cardHtml, 'p');
    return {
      card_title: firstTagTextFromHtml(cardHtml, 'h2|h3|h4'),
      card_text: cardText,
      card_body_html: richFeatureCardBodyFromHtml(cardHtml, cardText),
      card_link_text: linkMatch ? stripTags(linkMatch[2] || '') : '',
      card_url: { url: linkMatch ? getAttributeFromString(linkMatch[1] || '', 'href') : '' },
      card_class_name: normalizeClassName(getAttributeFromString(match.attributes || '', 'class')),
      card_icon_html: svgMatch ? svgMatch[0] : '',
      card_icon_class_name: firstIconFrameClassFromHtml(cardHtml),
      card_image: {
        url: imageMatch ? getAttributeFromString(imageMatch[1] || '', 'src') : '',
        alt: imageMatch ? getAttributeFromString(imageMatch[1] || '', 'alt') : '',
        id: '',
      },
    };
  }).filter((card) => card.card_title && card.card_text);

  if (cards.length < 3) return null;

  const firstCardIndex = featureGrid ? featureGrid.index : (cardMatches[0]?.index || html.length);
  const sectionIntroHtml = html.slice(0, firstCardIndex);
  const lastCard = cardMatches[cardMatches.length - 1];
  const lastCardEnd = (lastCard?.index || 0) + (lastCard?.outerHtml?.length || 0);
  const footerStart = featureGrid
    ? featureGrid.index + featureGrid.outerHtml.length
    : lastCardEnd;
  const sectionTitle = firstTagTextFromHtml(sectionIntroHtml, 'h1|h2');
  const sectionIntro = firstTagTextFromHtml(sectionIntroHtml, 'p');
  const sectionBodyHtml = sectionBodyHtmlBeforeChild(sectionIntroHtml, sectionTitle, sectionIntro);
  const sectionFooterHtml = footerStart > 0 ? sectionFooterHtmlAfterChild(html.slice(footerStart)) : '';
  const gridClass = normalizeClassName(getAttributeFromString(featureGrid?.gridAttributes || '', 'class'))
    || firstTagAttributeFromHtml(html.match(/<div\b[^>]*\bgrid\b[\s\S]*$/i)?.[0] || '', 'div', 'class');
  const sourceClassName = dedupeClassName([
    firstTagAttributeFromHtml(html, 'section', 'class') || firstTagAttributeFromHtml(html, 'div', 'class'),
    gridClass,
  ].filter(Boolean).join(' '));

  return buildStandaloneFeatureGridSection(ctx, {
    sectionTitle,
    sectionIntro,
    sectionBodyHtml,
    sectionFooterHtml,
    cards,
    sourceClassName,
  });
};

const tailwindSpacingScale: Record<string, number> = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
  '24': 96,
};

const parseInlineStyle = (style: string): Record<string, string> => style
  .split(';')
  .map((part) => part.trim())
  .filter(Boolean)
  .reduce<Record<string, string>>((acc, declaration) => {
    const separator = declaration.indexOf(':');
    if (separator === -1) return acc;
    acc[declaration.slice(0, separator).trim().toLowerCase()] = declaration.slice(separator + 1).trim();
    return acc;
  }, {});

const numericPixelValue = (value: string): number | null => {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px)?$/i);
  return match ? Number(match[1]) : null;
};

const elementorBox = (top: number, right: number, bottom: number, left: number): Record<string, any> => ({
  unit: 'px',
  top: String(top),
  right: String(right),
  bottom: String(bottom),
  left: String(left),
  isLinked: top === right && right === bottom && bottom === left,
});

const zeroBox = (): Record<string, any> => elementorBox(0, 0, 0, 0);

const elementorUnitValue = (size: number, unit: string): Record<string, any> => ({
  unit,
  size,
  sizes: [],
});

const applyBoxSetting = (settings: Record<string, any>, key: '_padding' | '_margin', value: string): void => {
  const parts = value.split(/\s+/).map(numericPixelValue);
  if (parts.some((part) => part === null)) return;

  const [first, second = first, third = first, fourth = second] = parts as number[];
  settings[key] = elementorBox(first, second, third, fourth);
};

const applyTailwindSpacing = (settings: Record<string, any>, classList: string[]): void => {
  classList.forEach((className) => {
    const match = className.match(/^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap)-(\d+)$/);
    if (!match) return;

    const value = tailwindSpacingScale[match[2]];
    if (typeof value !== 'number') return;

    const [, prefix] = match;
    if (prefix === 'gap') {
      settings.flex_gap = { unit: 'px', size: value, sizes: [] };
      return;
    }

    const key = prefix.startsWith('p') ? '_padding' : '_margin';
    const current = settings[key] || elementorBox(0, 0, 0, 0);
    const next = { ...current, isLinked: false };

    if (prefix.length === 1) {
      settings[key] = elementorBox(value, value, value, value);
      return;
    }

    if (prefix.endsWith('x')) {
      next.left = String(value);
      next.right = String(value);
    } else if (prefix.endsWith('y')) {
      next.top = String(value);
      next.bottom = String(value);
    } else if (prefix.endsWith('t')) {
      next.top = String(value);
    } else if (prefix.endsWith('r')) {
      next.right = String(value);
    } else if (prefix.endsWith('b')) {
      next.bottom = String(value);
    } else if (prefix.endsWith('l')) {
      next.left = String(value);
    }

    settings[key] = next;
  });
};

const tailwindGridBreakpointOrder: Record<string, number> = {
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
  '2xl': 5,
};

const parseTailwindGridColumnSettings = (classList: string[]): {
  desktop?: number;
  tablet?: number;
  mobile?: number;
} => {
  let mobile: number | undefined;
  let tablet: number | undefined;
  let desktop: number | undefined;
  let desktopRank = 0;

  classList.forEach((className) => {
    const match = className.match(/^(?:(sm|md|lg|xl|2xl):)?grid-cols-(\d+)$/);
    if (!match) return;

    const count = Number.parseInt(match[2], 10);
    if (!Number.isFinite(count) || count < 1 || count > 12) return;

    const breakpoint = match[1] || '';
    if (!breakpoint) {
      mobile = count;
      if (tablet === undefined) tablet = count;
      if (desktop === undefined) desktop = count;
      return;
    }

    if (breakpoint === 'sm' || breakpoint === 'md') {
      tablet = count;
      if (desktop === undefined) desktop = count;
      return;
    }

    const rank = tailwindGridBreakpointOrder[breakpoint] || 0;
    if (rank >= desktopRank) {
      desktop = count;
      desktopRank = rank;
    }
  });

  return { desktop, tablet, mobile };
};

const applyLayoutSettings = (settings: Record<string, any>, classList: string[], styleMap: Record<string, string>): void => {
  const hasGridLayout = classList.includes('grid')
    || classList.includes('inline-grid')
    || styleMap.display === 'grid'
    || styleMap.display === 'inline-grid';
  const hasFlexLayout = classList.includes('flex')
    || classList.includes('inline-flex')
    || styleMap.display === 'flex'
    || styleMap.display === 'inline-flex';

  const flexJustifyMap: Record<string, string> = {
    'justify-start': 'flex-start',
    'justify-center': 'center',
    'justify-end': 'flex-end',
    'justify-between': 'space-between',
    'justify-around': 'space-around',
    'justify-evenly': 'space-evenly',
  };
  const flexAlignMap: Record<string, string> = {
    'items-start': 'flex-start',
    'items-center': 'center',
    'items-end': 'flex-end',
    'items-stretch': 'stretch',
  };
  const gridJustifyMap: Record<string, string> = {
    'justify-start': 'start',
    'justify-center': 'center',
    'justify-end': 'end',
    'justify-between': 'space-between',
    'justify-around': 'space-around',
    'justify-evenly': 'space-evenly',
  };
  const gridAlignMap: Record<string, string> = {
    'items-start': 'start',
    'items-center': 'center',
    'items-end': 'end',
    'items-stretch': 'stretch',
  };
  const justifyClass = classList.find((className) => flexJustifyMap[className] || gridJustifyMap[className]);
  const alignClass = classList.find((className) => flexAlignMap[className] || gridAlignMap[className]);

  if (hasGridLayout) {
    settings.container_type = 'grid';
    if (settings.flex_gap && !settings.grid_gaps) {
      settings.grid_gaps = settings.flex_gap;
      delete settings.flex_gap;
    }

    const gridColumns = parseTailwindGridColumnSettings(classList);
    if (gridColumns.desktop !== undefined) {
      settings.grid_columns_grid = elementorUnitValue(gridColumns.desktop, 'fr');
    }
    if (gridColumns.tablet !== undefined) {
      settings.grid_columns_grid_tablet = elementorUnitValue(gridColumns.tablet, 'fr');
    }
    if (gridColumns.mobile !== undefined) {
      settings.grid_columns_grid_mobile = elementorUnitValue(gridColumns.mobile, 'fr');
    }

    if (justifyClass || styleMap['justify-content']) {
      settings.grid_justify_content = justifyClass ? gridJustifyMap[justifyClass] : styleMap['justify-content'];
    }
    if (alignClass || styleMap['align-items']) {
      settings.grid_align_items = alignClass ? gridAlignMap[alignClass] : styleMap['align-items'];
    }
    return;
  }

  if (!hasFlexLayout) {
    return;
  }

  settings.container_type = 'flex';

  if (classList.includes('flex-col') || styleMap['flex-direction'] === 'column') {
    settings.flex_direction = 'column';
  } else if (classList.includes('flex-col-reverse') || styleMap['flex-direction'] === 'column-reverse') {
    settings.flex_direction = 'column-reverse';
  } else if (classList.includes('flex-row-reverse') || styleMap['flex-direction'] === 'row-reverse') {
    settings.flex_direction = 'row-reverse';
  } else {
    settings.flex_direction = 'row';
  }

  if (classList.includes('flex-wrap') || styleMap['flex-wrap'] === 'wrap') {
    settings.flex_wrap = 'wrap';
  } else if (classList.includes('flex-nowrap') || styleMap['flex-wrap'] === 'nowrap') {
    settings.flex_wrap = 'nowrap';
  }

  if (justifyClass || styleMap['justify-content']) {
    settings.flex_justify_content = justifyClass ? flexJustifyMap[justifyClass] : styleMap['justify-content'];
  }

  if (alignClass || styleMap['align-items']) {
    settings.flex_align_items = alignClass ? flexAlignMap[alignClass] : styleMap['align-items'];
  }
};

const applyVisualSettings = (settings: Record<string, any>, classList: string[], styleMap: Record<string, string>): void => {
  if (styleMap.padding) applyBoxSetting(settings, '_padding', styleMap.padding);
  if (styleMap.margin) applyBoxSetting(settings, '_margin', styleMap.margin);

  const gap = styleMap.gap ? numericPixelValue(styleMap.gap) : null;
  if (gap !== null) {
    if (settings.container_type === 'grid') {
      settings.grid_gaps = { unit: 'px', size: gap, sizes: [] };
    } else {
      settings.flex_gap = { unit: 'px', size: gap, sizes: [] };
    }
  }

  if (styleMap['background-color']) {
    settings.background_background = 'classic';
    settings.background_color = styleMap['background-color'];
  }

  if (styleMap['border-radius']) {
    applyBoxSetting(settings, 'border_radius' as '_padding', styleMap['border-radius']);
  }

  if (classList.includes('text-center') || styleMap['text-align'] === 'center') {
    settings.align = 'center';
  } else if (classList.includes('text-right') || styleMap['text-align'] === 'right') {
    settings.align = 'right';
  } else if (classList.includes('text-left') || styleMap['text-align'] === 'left') {
    settings.align = 'left';
  }
};

export const buildElementorSettingsFromClassAndStyle = (className: string, inlineStyle: string): Record<string, any> => {
  const settings: Record<string, any> = {};
  const normalizedClassName = className.trim();
  const normalizedInlineStyle = inlineStyle.trim();
  const classList = normalizedClassName.split(/\s+/).filter(Boolean);
  const styleMap = parseInlineStyle(inlineStyle);

  if (normalizedClassName) {
    settings._css_classes = normalizedClassName;
  }

  applyTailwindSpacing(settings, classList);
  applyLayoutSettings(settings, classList, styleMap);
  applyVisualSettings(settings, classList, styleMap);

  if (normalizedInlineStyle) settings._elementor_converter_inline_style = normalizedInlineStyle;

  return settings;
};

const settingsFromClassAndStyle = buildElementorSettingsFromClassAndStyle;

const elementSettings = (element: Element): Record<string, any> => settingsFromClassAndStyle(
  getElementAttribute(element, 'class'),
  getElementAttribute(element, 'style'),
);

const attributeSettings = (attributes: string): Record<string, any> => settingsFromClassAndStyle(
  getAttributeFromString(attributes, 'class'),
  getAttributeFromString(attributes, 'style'),
);

const classListFromAttributes = (attributes: string): string[] => getAttributeFromString(attributes, 'class')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

const visualComplexityScore = (classList: string[], html: string): number => {
  let score = 0;

  classList.forEach((className) => {
    if (COMPLEX_VISUAL_CLASS_PATTERNS.some((pattern) => pattern.test(className))) {
      score += 1;
    }
  });

  const elementCount = (html.match(/<([a-z][\w:-]*)\b/gi) || []).length;
  if (elementCount >= 6) score += 2;
  if (elementCount >= 12) score += 2;
  if (/<(img|picture|svg|video|iframe)\b/i.test(html)) score += 1;
  if (/<(a|button)\b/i.test(html)) score += 1;
  if (classList.length >= 8) score += 1;

  return score;
};

const shouldPreserveVisualHtml = (tagName: string, classList: string[], html: string): boolean => (
  OPAQUE_HTML_FALLBACK_MARKUP.test(html)
  && visualComplexityScore(classList, html) >= 7
);

export const shouldPreserveElementorVisualHtml = (tagName: string, className: string, html: string): boolean => (
  shouldPreserveVisualHtml(
    tagName.toLowerCase(),
    className.trim().split(/\s+/).filter(Boolean),
    html,
  )
);

const PAGE_WRAPPER_CLASS_PATTERN = /\b(?:entry-content|wp-source-body|wp-site-blocks|site-main|page-shell|app-shell)\b/i;

const isBroadPageWrapperElement = (element: Element): boolean => {
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'body' || tagName === 'main') return true;
  if (getElementAttribute(element, 'id') === 'root') return true;

  const className = getElementAttribute(element, 'class');
  if (PAGE_WRAPPER_CLASS_PATTERN.test(className)) return true;

  if (tagName === 'div') {
    const sectionLikeDescendants = element.querySelectorAll('section,main').length;
    if (sectionLikeDescendants >= 2) return true;
  }

  return false;
};

const shouldTryCustomSectionWidget = (element: Element): boolean => {
  const tagName = element.tagName.toLowerCase();
  if (!['section', 'article', 'div', 'form'].includes(tagName)) return false;
  return !isBroadPageWrapperElement(element);
};

const convertDomElement = (ctx: ElementorBuildContext, element: Element): ElementorElement[] => {
  const tagName = element.tagName.toLowerCase();
  if (SKIP_TAGS.has(tagName)) return [];

  const breadcrumb = buildBreadcrumbWidgetFromDom(ctx, element);
  if (breadcrumb) return [breadcrumb];

  if (shouldTryCustomSectionWidget(element)) {
    const heroSection = buildHeroSectionWidgetFromDom(ctx, element);
    if (heroSection) return [heroSection];

    const leadForm = buildLeadFormWidgetFromDom(ctx, element);
    if (leadForm) return [leadForm];

    const faqSection = buildFaqSectionWidgetFromDom(ctx, element);
    if (faqSection) return [faqSection];

    const ctaSection = buildCtaSectionWidgetFromDom(ctx, element);
    if (ctaSection) return [ctaSection];

    const pricingTable = buildPricingTableWidgetFromDom(ctx, element);
    if (pricingTable) return [pricingTable];

    const testimonialGrid = buildTestimonialGridWidgetFromDom(ctx, element);
    if (testimonialGrid) return [testimonialGrid];

    const statsSection = buildStatsSectionWidgetFromDom(ctx, element);
    if (statsSection) return [statsSection];

    const teamGrid = buildTeamGridWidgetFromDom(ctx, element);
    if (teamGrid) return [teamGrid];

    const logoCloud = buildLogoCloudWidgetFromDom(ctx, element);
    if (logoCloud) return [logoCloud];

    const locationGrid = buildLocationGridWidgetFromDom(ctx, element);
    if (locationGrid) return [locationGrid];

    const featureGrid = buildFeatureGridWidgetFromDom(ctx, element);
    if (featureGrid) return [featureGrid];

  }

  if (tagName === 'div' && stripTags(element.outerHTML) === '') {
    const trustLogoRow = buildTrustLogoRowWidgetFromHtml(ctx, element.outerHTML);
    if (trustLogoRow) return [trustLogoRow];

    const carouselDots = buildCarouselDotsWidgetFromHtml(ctx, element.outerHTML);
    if (carouselDots) return [carouselDots];
  }

  if (shouldPreserveVisualHtml(tagName, getElementAttribute(element, 'class').split(/\s+/).filter(Boolean), element.outerHTML)) {
    const widget = buildHtmlWidget(ctx, element.outerHTML, `${tagName}:visual-preserve`);
    if (widget) {
      ctx.warnings.push(`Preserved complex <${tagName}> as an Elementor HTML widget for visual fidelity.`);
      return [widget];
    }
  }

  if (tagName === 'div' && element.children.length === 0) {
    const widget = buildTextFragmentWidget(ctx, tagName, element.innerHTML, getElementAttribute(element, 'class'), element.textContent || 'text-fragment');
    if (widget) return [widget];
  }

  if (/^h[1-6]$/.test(tagName)) {
    const widget = buildHeadingWidget(ctx, tagName, element.innerHTML, elementSettings(element));
    return widget ? [widget] : [];
  }

  if (tagName === 'p' || tagName === 'li') {
    const widget = buildTextWidget(ctx, element.innerHTML, elementSettings(element));
    return widget ? [widget] : [];
  }

  if (tagName === 'span') {
    const widget = buildTextWidget(ctx, element.innerHTML, elementSettings(element));
    return widget ? [widget] : [];
  }

  if (tagName === 'svg') {
    const widget = buildSvgIconWidget(ctx, element.outerHTML);
    return widget ? [widget] : [];
  }

  if (tagName === 'ul' || tagName === 'ol') {
    if (shouldPreserveComplexListHtml(element.innerHTML)) {
      const neighborhoodList = buildNeighborhoodListWidgetFromDom(ctx, element);
      if (neighborhoodList) return [neighborhoodList];

      const widget = buildHtmlWidget(ctx, element.outerHTML, 'rich-list:source-html', false);
      if (widget) {
        ctx.warnings.push(`Preserved complex <${tagName}> list as an Elementor HTML widget to avoid losing nested descriptions.`);
      }
      return widget ? [widget] : [];
    }

    const widget = buildIconListWidget(ctx, element.innerHTML, element.textContent || tagName);
    return widget ? [widget] : [];
  }

  if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
    const widget = buildHtmlWidget(ctx, element.outerHTML, 'form-control:source-html', false);
    if (widget) {
      ctx.warnings.push(`Preserved source <${tagName}> form control as an Elementor HTML widget to avoid splitting native control markup.`);
    }
    return widget ? [widget] : [];
  }

  if (tagName === 'a') {
    const widget = buildButtonWidget(ctx, element.innerHTML, getElementAttribute(element, 'href'), element.textContent || '', elementSettings(element));
    return widget ? [widget] : [];
  }

  if (tagName === 'button') {
    const widget = buildButtonWidget(ctx, element.innerHTML, getElementAttribute(element, 'data-href'), element.textContent || '', elementSettings(element));
    return widget ? [widget] : [];
  }

  if (tagName === 'img') {
    const widget = buildImageWidget(ctx, getElementAttribute(element, 'src'), getElementAttribute(element, 'alt'), '', elementSettings(element));
    return widget ? [widget] : [];
  }

  if (tagName === 'figure') {
    const widget = buildFigureWidget(ctx, element.innerHTML);
    return widget ? [widget] : [];
  }

  if (tagName === 'hr') {
    return [buildDividerWidget(ctx)];
  }

  if (tagName === 'iframe') {
    const widget = buildIframeWidget(ctx, element.outerHTML, getElementAttribute(element, 'src'), getElementAttribute(element, 'title'));
    return widget ? [widget] : [];
  }

  if (tagName === 'video') {
    const source = getElementAttribute(element, 'src') || element.querySelector('source')?.getAttribute('src') || '';
    const widget = buildVideoWidget(ctx, source, getElementAttribute(element, 'title'));
    return widget ? [widget] : [];
  }

  if (tagName === 'details') {
    const summary = element.querySelector('summary');
    const content = element.innerHTML.replace(/<summary\b[\s\S]*?<\/summary>/i, '').trim();
    const widget = buildToggleWidget(ctx, summary?.innerHTML || '', content);
    return widget ? [widget] : [];
  }

  const children = Array.from(element.childNodes)
    .flatMap((child) => {
      if (child.nodeType === 1) return convertDomElement(ctx, child as Element);
      return [];
    });

  if (children.length > 0) {
    if (STRUCTURAL_TAGS.has(tagName) || tagName === 'ul' || tagName === 'ol') {
      return [createContainer(ctx, tagName, children, elementSettings(element))];
    }
    return children;
  }

  const fallback = buildHtmlWidget(ctx, element.outerHTML, tagName);
  if (fallback) {
    ctx.warnings.push(`Fell back to Elementor HTML widget for <${tagName}>.`);
    return [fallback];
  }

  return [];
};

interface StringMatch {
  index: number;
  tagName: string;
  attributes: string;
  innerHtml: string;
  outerHtml: string;
}

const findTopLevelSectionRanges = (html: string): StringMatch[] => {
  const matches: StringMatch[] = [];
  const tagPattern = /<\/?(section|article)\b[^>]*>/gi;
  let depth = 0;
  let currentStart = -1;
  let currentTag = '';
  let currentAttributes = '';
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const fullTag = match[0] || '';
    const tagName = (match[1] || '').toLowerCase();
    const isClosing = /^<\//.test(fullTag);

    if (!isClosing) {
      if (depth === 0) {
        currentStart = match.index;
        currentTag = tagName;
        currentAttributes = fullTag.replace(/^<\w+\b/i, '').replace(/>$/, '');
      }
      depth += 1;
      continue;
    }

    if (depth === 0) continue;
    depth -= 1;

    if (depth === 0 && currentStart >= 0) {
      const end = match.index + fullTag.length;
      const outerHtml = html.slice(currentStart, end);
      const openTagEnd = outerHtml.indexOf('>');
      matches.push({
        index: currentStart,
        tagName: currentTag,
        attributes: currentAttributes,
        innerHtml: openTagEnd >= 0 ? outerHtml.slice(openTagEnd + 1, outerHtml.length - fullTag.length) : '',
        outerHtml,
      });
      currentStart = -1;
      currentTag = '';
      currentAttributes = '';
    }
  }

  return matches;
};

const collectStringMatches = (html: string): StringMatch[] => {
  const matches: StringMatch[] = [];
  const pairedRanges: Array<{ start: number; end: number }> = [];
  const paired = /<(h[1-6]|p|span|a|button|details|ul|ol|figure|iframe|video|svg|select|textarea)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  const voidElement = /<(img|hr|input)\b([^>]*)\/?>/gi;

  let match: RegExpExecArray | null;
  while ((match = paired.exec(html)) !== null) {
    const isInsidePairedElement = pairedRanges.some((range) => match!.index > range.start && match!.index < range.end);
    if (isInsidePairedElement) continue;

    pairedRanges.push({
      start: match.index,
      end: match.index + match[0].length,
    });
    matches.push({
      index: match.index,
      tagName: match[1].toLowerCase(),
      attributes: match[2] || '',
      innerHtml: match[3] || '',
      outerHtml: match[0],
    });
  }

  while ((match = voidElement.exec(html)) !== null) {
    const isInsidePairedElement = pairedRanges.some((range) => match!.index > range.start && match!.index < range.end);
    if (isInsidePairedElement) continue;

    matches.push({
      index: match.index,
      tagName: match[1].toLowerCase(),
      attributes: match[2] || '',
      innerHtml: '',
      outerHtml: match[0],
    });
  }

  return matches.sort((a, b) => a.index - b.index);
};

const convertStringMatch = (ctx: ElementorBuildContext, match: StringMatch): ElementorElement | null => {
  if (/^h[1-6]$/.test(match.tagName)) {
    return buildHeadingWidget(ctx, match.tagName, match.innerHtml, attributeSettings(match.attributes));
  }
  if (match.tagName === 'p' || match.tagName === 'li') {
    return buildTextWidget(ctx, match.innerHtml, attributeSettings(match.attributes));
  }
  if (match.tagName === 'span') {
    return buildTextWidget(ctx, match.innerHtml, attributeSettings(match.attributes));
  }
  if (match.tagName === 'svg') {
    return buildSvgIconWidget(ctx, match.outerHtml);
  }
  if (match.tagName === 'ul' || match.tagName === 'ol') {
    if (shouldPreserveComplexListHtml(match.innerHtml)) {
      const neighborhoodList = buildNeighborhoodListWidgetFromHtml(ctx, match.outerHtml, match.attributes);
      if (neighborhoodList) return neighborhoodList;

      return buildHtmlWidget(ctx, match.outerHtml, 'rich-list:source-html', false);
    }

    return buildIconListWidget(ctx, match.innerHtml, match.innerHtml);
  }
  if (match.tagName === 'input' || match.tagName === 'select' || match.tagName === 'textarea') {
    return buildHtmlWidget(ctx, match.outerHtml, 'form-control:source-html', false);
  }
  if (match.tagName === 'a') {
    return buildButtonWidget(ctx, match.innerHtml, getAttributeFromString(match.attributes, 'href'), match.innerHtml, attributeSettings(match.attributes));
  }
  if (match.tagName === 'button') {
    return buildButtonWidget(ctx, match.innerHtml, getAttributeFromString(match.attributes, 'data-href'), match.innerHtml, attributeSettings(match.attributes));
  }
  if (match.tagName === 'img') {
    return buildImageWidget(ctx, getAttributeFromString(match.attributes, 'src'), getAttributeFromString(match.attributes, 'alt'), '', attributeSettings(match.attributes));
  }
  if (match.tagName === 'figure') {
    return buildFigureWidget(ctx, match.innerHtml);
  }
  if (match.tagName === 'hr') {
    return buildDividerWidget(ctx);
  }
  if (match.tagName === 'iframe') {
    return buildIframeWidget(ctx, match.outerHtml, getAttributeFromString(match.attributes, 'src'), getAttributeFromString(match.attributes, 'title'));
  }
  if (match.tagName === 'video') {
    const sourceMatch = match.innerHtml.match(/<source\b([^>]*)\/?>/i);
    return buildVideoWidget(
      ctx,
      getAttributeFromString(match.attributes, 'src') || getAttributeFromString(sourceMatch?.[1] || '', 'src'),
      getAttributeFromString(match.attributes, 'title'),
    );
  }
  if (match.tagName === 'details') {
    const summaryMatch = match.innerHtml.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    const content = match.innerHtml.replace(/<summary\b[\s\S]*?<\/summary>/i, '').trim();
    return buildToggleWidget(ctx, summaryMatch?.[1] || '', content);
  }
  return null;
};

const findVisualPreserveRanges = (html: string): StringMatch[] => {
  const matches: StringMatch[] = [];
  const pattern = /<(section|article|aside|header|footer)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const attributes = match[2] || '';
    const innerHtml = match[3] || '';
    const outerHtml = match[0];

    if (!shouldPreserveVisualHtml(tagName, classListFromAttributes(attributes), outerHtml)) {
      continue;
    }

    matches.push({
      index: match.index,
      tagName,
      attributes,
      innerHtml,
      outerHtml,
    });
  }

  return matches;
};

const findBreadcrumbNavRanges = (html: string): StringMatch[] => {
  const matches: StringMatch[] = [];
  const pattern = /<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const outerHtml = match[0];
    if (!isBreadcrumbLabelSet(breadcrumbLabelsFromHtml(outerHtml), stripTags(outerHtml))) continue;

    matches.push({
      index: match.index,
      tagName: 'nav',
      attributes: match[1] || '',
      innerHtml: match[2] || '',
      outerHtml,
    });
  }

  return matches;
};

const findTextFragmentRanges = (html: string): StringMatch[] => {
  const matches: StringMatch[] = [];
  const pattern = /<(div)\b([^>]*)>([^<]*)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    if (!textOnlyElementText(match[3] || '')) continue;

    matches.push({
      index: match.index,
      tagName: (match[1] || 'div').toLowerCase(),
      attributes: match[2] || '',
      innerHtml: match[3] || '',
      outerHtml: match[0],
    });
  }

  return matches;
};

const sortedNonOverlappingRanges = (matches: StringMatch[]): StringMatch[] => {
  const sorted = matches.sort((a, b) => a.index - b.index || b.outerHtml.length - a.outerHtml.length);
  const selected: StringMatch[] = [];

  sorted.forEach((match) => {
    const start = match.index;
    const end = start + match.outerHtml.length;
    const overlaps = selected.some((item) => start < item.index + item.outerHtml.length && end > item.index);
    if (!overlaps) selected.push(match);
  });

  return selected.sort((a, b) => a.index - b.index);
};

const convertStringSegment = (ctx: ElementorBuildContext, html: string): ElementorElement[] => {
  const specialMatches = sortedNonOverlappingRanges([
    ...findBreadcrumbNavRanges(html),
    ...findTextFragmentRanges(html),
  ]);

  if (specialMatches.length === 0) {
    return collectStringMatches(html)
      .map((match) => convertStringMatch(ctx, match))
      .filter((element): element is ElementorElement => Boolean(element));
  }

  const widgets: ElementorElement[] = [];
  let cursor = 0;

  specialMatches.forEach((match) => {
    widgets.push(...convertStringSegment(ctx, html.slice(cursor, match.index)));
    const widget = match.tagName === 'nav'
      ? buildBreadcrumbWidgetFromHtml(ctx, match.outerHtml)
      : buildTextFragmentWidget(ctx, match.tagName, match.innerHtml, getAttributeFromString(match.attributes, 'class'), match.innerHtml);
    if (widget) widgets.push(widget);
    cursor = match.index + match.outerHtml.length;
  });

  widgets.push(...convertStringSegment(ctx, html.slice(cursor)));
  return widgets;
};

const convertHtmlSegmentWithoutDomParser = (ctx: ElementorBuildContext, html: string): ElementorElement[] => {
  const trustLogoRow = buildTrustLogoRowWidgetFromHtml(ctx, html);
  if (trustLogoRow && stripTags(html) === '') {
    return [trustLogoRow];
  }

  const carouselDots = buildCarouselDotsWidgetFromHtml(ctx, html);
  if (carouselDots && stripTags(html) === '') {
    return [carouselDots];
  }

  const heroSection = buildHeroSectionWidgetFromHtml(ctx, html);
  if (heroSection) {
    return [heroSection];
  }

  const leadForm = buildLeadFormWidgetFromHtml(ctx, html);
  if (leadForm) {
    return [leadForm];
  }

  const faqSection = buildFaqSectionWidgetFromHtml(ctx, html);
  if (faqSection) {
    return [faqSection];
  }

  const ctaSection = buildCtaSectionWidgetFromHtml(ctx, html);
  if (ctaSection) {
    return [ctaSection];
  }

  const pricingTable = buildPricingTableWidgetFromHtml(ctx, html);
  if (pricingTable) {
    return [pricingTable];
  }

  const testimonialGrid = buildTestimonialGridWidgetFromHtml(ctx, html);
  if (testimonialGrid) {
    return [testimonialGrid];
  }

  const statsSection = buildStatsSectionWidgetFromHtml(ctx, html);
  if (statsSection) {
    return [statsSection];
  }

  const teamGrid = buildTeamGridWidgetFromHtml(ctx, html);
  if (teamGrid) {
    return [teamGrid];
  }

  const logoCloud = buildLogoCloudWidgetFromHtml(ctx, html);
  if (logoCloud) {
    return [logoCloud];
  }

  const locationGrid = buildLocationGridWidgetFromHtml(ctx, html);
  if (locationGrid) {
    return [locationGrid];
  }

  const featureGrid = buildFeatureGridWidgetFromHtml(ctx, html);
  if (featureGrid) {
    return [featureGrid];
  }

  const visualPreserveMatches = findVisualPreserveRanges(html);
  if (visualPreserveMatches.length === 0) {
    return convertStringSegment(ctx, html);
  }

  const widgets: ElementorElement[] = [];
  let cursor = 0;

  visualPreserveMatches.forEach((match) => {
    const before = html.slice(cursor, match.index);
    widgets.push(...convertStringSegment(ctx, before));

    const widget = buildHtmlWidget(ctx, match.outerHtml, `${match.tagName}:visual-preserve`);
    if (widget) {
      ctx.warnings.push(`Preserved complex <${match.tagName}> as an Elementor HTML widget for visual fidelity.`);
      widgets.push(widget);
    }

    cursor = match.index + match.outerHtml.length;
  });

  widgets.push(...convertStringSegment(ctx, html.slice(cursor)));

  return widgets;
};

const convertWithoutDomParser = (ctx: ElementorBuildContext, html: string): ElementorElement[] => {
  const sectionRanges = findTopLevelSectionRanges(html);

  if (sectionRanges.length >= 2) {
    const widgets: ElementorElement[] = [];
    let cursor = 0;

    sectionRanges.forEach((section) => {
      widgets.push(...convertStringSegment(ctx, html.slice(cursor, section.index)));
      widgets.push(...convertHtmlSegmentWithoutDomParser(ctx, section.outerHtml));
      cursor = section.index + section.outerHtml.length;
    });

    widgets.push(...convertStringSegment(ctx, html.slice(cursor)));
    return widgets.length > 0 ? [createContainer(ctx, 'root', widgets)] : [];
  }

  const widgets = convertHtmlSegmentWithoutDomParser(ctx, html);
  return widgets.length > 0 ? [createContainer(ctx, 'root', widgets)] : [];
};

const convertWithDomParser = (ctx: ElementorBuildContext, html: string): ElementorElement[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!doctype html><html><body>${stripDangerousMarkup(html)}</body></html>`, 'text/html');
  const bodyChildren = Array.from(doc.body.children)
    .flatMap((child) => convertDomElement(ctx, child));

  if (bodyChildren.length === 1 && bodyChildren[0].elType === 'container') {
    return bodyChildren;
  }

  return bodyChildren.length > 0 ? [createContainer(ctx, 'root', bodyChildren)] : [];
};

const buildSectionTemplates = (
  content: ElementorElement[],
  options: ElementorConversionOptions,
): ElementorTemplate[] => content
  .filter((element) => element.elType === 'container' && (element.elements || []).length > 0)
  .map((element, index) => ({
    title: `${options.title} Section ${index + 1}`,
    slug: `${options.slug}-section-${index + 1}`,
    type: 'section',
    sourceId: `${options.routePath}#section-${index + 1}`,
    elementorData: [JSON.parse(JSON.stringify(element))],
    pageSettings: [],
  }));

const buildPageShellHtml = (html: string, shellClassName = ''): string => {
  const className = dedupeClassName(`whipify-elementor-page-shell ${shellClassName}`);
  return `<div class="${escapeHtmlAttribute(className)}">${stripDangerousMarkup(html)}</div>`;
};

const wrapWithShellContainer = (
  ctx: ElementorBuildContext,
  content: ElementorElement[],
  shellClassName = '',
): ElementorElement[] => {
  const className = dedupeClassName(shellClassName);
  if (content.length === 0) return [];
  if (!className) return content;
  if (content.length === 1 && content[0].elType === 'container') {
    const existingClassName = typeof content[0].settings?.css_classes === 'string'
      ? content[0].settings.css_classes
      : '';
    content[0].settings = {
      ...content[0].settings,
      css_classes: dedupeClassName(`${className} ${existingClassName}`),
    };
    return content;
  }
  return [createContainer(ctx, 'page-shell', content, { css_classes: className })];
};

export function convertHtmlToElementorDocument(
  html: string,
  options: ElementorConversionOptions,
): ElementorConversionResult {
  const ctx: ElementorBuildContext = {
    idSeed: `${options.slug}:${options.routePath}`,
    sequence: 0,
    stats: {
      nativeWidgets: 0,
      customWidgets: 0,
      fallbackHtmlWidgets: 0,
      containers: 0,
    },
    warnings: [],
  };

  const usePageShellVisualMode = options.visualFidelityMode === 'page-shell';
  const pageShellWidget = usePageShellVisualMode
    ? buildHtmlWidget(ctx, buildPageShellHtml(html, options.shellClassName), 'page-shell:visual-fidelity', false)
    : null;
  const baseContent = usePageShellVisualMode
    ? (pageShellWidget ? [pageShellWidget] : [])
    : typeof DOMParser !== 'undefined'
      ? convertWithDomParser(ctx, html)
      : convertWithoutDomParser(ctx, stripDangerousMarkup(html));
  const content = usePageShellVisualMode
    ? baseContent
    : wrapWithShellContainer(ctx, baseContent, options.shellClassName);

  if (usePageShellVisualMode) {
    ctx.warnings.push('Preserved page body as a Whipify Elementor page shell for visual fidelity.');
  }

  return {
    document: {
      title: options.title,
      type: 'page',
      version: '0.4',
      page_settings: {
        page_template: 'default',
      },
      content,
    },
    templates: buildSectionTemplates(content, options),
    stats: ctx.stats,
    warnings: ctx.warnings,
  };
}

export function flattenElementorElements(elements: ElementorElement[]): ElementorElement[] {
  return elements.flatMap((element) => [
    element,
    ...flattenElementorElements(element.elements || []),
  ]);
}
