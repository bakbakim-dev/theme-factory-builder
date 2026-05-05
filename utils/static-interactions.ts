import { escapeHtml } from './static-common.ts';

const parseJson = (value: string): any | null => {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const collectFaqEntriesFromSchema = (node: any, entries: Array<{ question: string; answer: string }>) => {
    if (!node) return;
    if (Array.isArray(node)) {
        node.forEach(item => collectFaqEntriesFromSchema(item, entries));
        return;
    }
    if (typeof node !== 'object') return;

    const type = node['@type'];
    if (type === 'FAQPage' && Array.isArray(node.mainEntity)) {
        node.mainEntity.forEach((item: any) => {
            const question = (item?.name || '').trim();
            const answer = (item?.acceptedAnswer?.text || item?.acceptedAnswer?.['@value'] || '').trim();
            if (question && answer) {
                entries.push({ question, answer });
            }
        });
    }

    if (Array.isArray(node['@graph'])) {
        collectFaqEntriesFromSchema(node['@graph'], entries);
    }

    Object.values(node).forEach(value => {
        if (value && typeof value === 'object') {
            collectFaqEntriesFromSchema(value, entries);
        }
    });
};

const extractFaqMap = (html: string): Map<string, string> => {
    const entries: Array<{ question: string; answer: string }> = [];
    const scriptRegex = /<script\b[^>]*type=(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = scriptRegex.exec(html || ''))) {
        const parsed = parseJson((match[2] || '').trim());
        if (parsed) {
            collectFaqEntriesFromSchema(parsed, entries);
        }
    }
    return new Map(entries.map(entry => [entry.question, entry.answer]));
};

const injectButtonOnlyFaqAnswers = (html: string): string => {
    const faqMap = extractFaqMap(html);
    if (!faqMap.size) return html;

    const cardRegex = /<div([^>]class=(["'])[^"'<>]*rounded-xl[^"'<>]*overflow-hidden[^"'<>]*\2[^>]*)>\s*<button([^>]*)>([\s\S]*?)(<svg[\s\S]*?<\/svg>)\s*<\/button>\s*<\/div>/gi;
    return html.replace(cardRegex, (match, divAttrs, _quote, buttonAttrs, questionMarkup, svgMarkup) => {
        const question = (questionMarkup || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const answer = faqMap.get(question);
        if (!answer) return match;

        const markedDivAttrs = /\sdata-static-faq-card=/i.test(divAttrs)
            ? divAttrs
            : `${divAttrs} data-static-faq-card="true"`;
        const markedButtonAttrs = buttonAttrs
            .replace(/\saria-expanded=(["']).*?\1/gi, '')
            .replace(/\sdata-state=(["']).*?\1/gi, '');

        return [
            `<div${markedDivAttrs}>`,
            `<button${markedButtonAttrs} data-static-faq-trigger="true" aria-expanded="false" data-state="closed">`,
            questionMarkup,
            svgMarkup,
            '</button>',
            `<div data-static-faq-answer="true" data-state="closed" hidden><div class="px-6 pb-6 pt-0 text-muted-foreground">${escapeHtml(answer)}</div></div>`,
            '</div>',
        ].join('');
    });
};

const collapseOpenDetails = (html: string): string => html.replace(/<details\b([^>]*)\sopen(?:=(["']).*?\2)?([^>]*)>/gi, '<details$1$3>');

const normalizeTabPanels = (html: string): string => html.replace(/<(div|section)([^>]*role=(["'])tabpanel\3[^>]*)>/gi, (match, tagName, attrs) => {
    const normalizedAttrs = attrs.replace(/\shidden(?:=(["']).*?\1)?/gi, '');
    const isActive = /\sdata-state=(["'])active\1/i.test(normalizedAttrs);
    const hiddenAttr = isActive ? '' : ' hidden';
    return `<${tagName}${normalizedAttrs}${hiddenAttr}>`;
});

const normalizeAccordionRegions = (html: string): string => html.replace(/<(div|section)([^>]*role=(["'])region\3[^>]*)>/gi, (match, tagName, attrs) => {
    const normalizedAttrs = attrs.replace(/\shidden(?:=(["']).*?\1)?/gi, '');
    const isOpen = /\sdata-state=(["'])open\1/i.test(normalizedAttrs);
    const hiddenAttr = isOpen ? '' : ' hidden';
    return `<${tagName}${normalizedAttrs}${hiddenAttr}>`;
});

export const enhanceStaticInteractiveHtml = (html: string): string => {
    const withFaqAnswers = injectButtonOnlyFaqAnswers(html);
    const withCollapsedDetails = collapseOpenDetails(withFaqAnswers);
    const withNormalizedTabs = normalizeTabPanels(withCollapsedDetails);
    return normalizeAccordionRegions(withNormalizedTabs);
};

export const STATIC_INTERACTIONS_FILE_PATH = 'assets/static-interactions.js';

export const buildStaticInteractionsStyleTag = (): string => [
    '<style id="static-interactions-safety">',
    '[role="tabpanel"][data-state="inactive"]{display:none !important;}',
    '[role="tabpanel"][data-state="active"]{display:block;}',
    '[role="region"][data-state="closed"]{display:none !important;}',
    '[role="region"][data-state="open"]{display:block;}',
    '[data-static-faq-answer="true"][data-state="closed"]{display:none !important;}',
    '[data-static-faq-answer="true"][data-state="open"]{display:block;}',
    '</style>',
].join('');

export const buildStaticInteractionsScript = (): string => `(() => {
  let syncScheduled = false;
  const scheduleSync = () => {
    if (syncScheduled) return;
    syncScheduled = true;
    window.setTimeout(() => {
      syncScheduled = false;
      syncAll();
    }, 0);
  };

  const syncTabs = () => {
    document.querySelectorAll('[role="tablist"]').forEach((tablist) => {
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      if (!tabs.length) return;
      const activateTab = (nextTab) => {
        tabs.forEach((tab) => {
          const isActive = tab === nextTab;
          tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
          tab.setAttribute('data-state', isActive ? 'active' : 'inactive');
          tab.tabIndex = isActive ? 0 : -1;
          const panelId = tab.getAttribute('aria-controls');
          if (!panelId) return;
          const panel = document.getElementById(panelId);
          if (!panel) return;
          panel.setAttribute('data-state', isActive ? 'active' : 'inactive');
          if (isActive) panel.removeAttribute('hidden');
          else panel.setAttribute('hidden', '');
        });
      };
      let activeTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true' || tab.getAttribute('data-state') === 'active');
      if (!activeTab) {
        activeTab = tabs[0];
      }
      activateTab(activeTab);
      tabs.forEach((tab) => {
        if (tab.dataset.staticTabBound === 'true') return;
        tab.dataset.staticTabBound = 'true';
        tab.addEventListener('click', () => activateTab(tab));
        tab.addEventListener('keydown', (event) => {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
          event.preventDefault();
          const currentIndex = tabs.indexOf(tab);
          const nextIndex = event.key === 'ArrowRight'
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
          const nextTab = tabs[nextIndex];
          activateTab(nextTab);
          nextTab.focus();
        });
      });
    });
  };

  const syncAccordionRegions = () => {
    document.querySelectorAll('button[aria-controls]').forEach((button) => {
      const targetId = button.getAttribute('aria-controls');
      if (!targetId) return;
      const region = document.getElementById(targetId);
      if (!region || region.getAttribute('role') !== 'region') return;
      const applyState = (isOpen) => {
        button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        button.setAttribute('data-state', isOpen ? 'open' : 'closed');
        region.setAttribute('data-state', isOpen ? 'open' : 'closed');
        if (isOpen) region.removeAttribute('hidden');
        else region.setAttribute('hidden', '');
      };
      const isOpen = button.getAttribute('aria-expanded') === 'true' || button.getAttribute('data-state') === 'open';
      applyState(isOpen);
      if (button.dataset.staticAccordionBound === 'true') return;
      button.dataset.staticAccordionBound = 'true';
      button.addEventListener('click', () => {
        const next = button.getAttribute('aria-expanded') !== 'true';
        applyState(next);
      });
    });
  };

  const syncDetails = () => {
    document.querySelectorAll('details').forEach((details) => {
      if (details.hasAttribute('open')) return;
      Array.from(details.children).forEach((child) => {
        if (child.tagName === 'SUMMARY') return;
        child.hidden = true;
      });
      details.addEventListener('toggle', () => {
        Array.from(details.children).forEach((child) => {
          if (child.tagName === 'SUMMARY') return;
          child.hidden = !details.open;
        });
      });
    });
  };

  const setupStaticFaqCards = () => {
    document.querySelectorAll('[data-static-faq-card="true"]').forEach((card) => {
      const button = card.querySelector('[data-static-faq-trigger="true"]');
      const answer = card.querySelector('[data-static-faq-answer="true"]');
      if (!button || !answer || button.dataset.staticFaqBound === 'true') return;
      button.dataset.staticFaqBound = 'true';
      const sync = () => {
        const isOpen = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('data-state', isOpen ? 'open' : 'closed');
        answer.setAttribute('data-state', isOpen ? 'open' : 'closed');
        if (isOpen) answer.removeAttribute('hidden');
        else answer.setAttribute('hidden', '');
      };
      sync();
      button.addEventListener('click', () => {
        const next = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', next ? 'true' : 'false');
        sync();
      });
    });
  };

  const syncAll = () => {
    syncTabs();
    syncAccordionRegions();
    syncDetails();
    setupStaticFaqCards();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAll, { once: true });
  } else {
    syncAll();
  }

  window.addEventListener('load', syncAll, { once: true });
  window.setTimeout(syncAll, 50);
  window.setTimeout(syncAll, 250);
  window.setTimeout(syncAll, 1000);

  const observer = new MutationObserver(() => scheduleSync());
  const startObserving = () => {
    if (!document.body) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'aria-expanded', 'aria-selected', 'hidden'],
    });
  };

  if (document.body) startObserving();
  else document.addEventListener('DOMContentLoaded', startObserving, { once: true });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[role="tab"], button[aria-controls]')) {
      scheduleSync();
    }
  });
})();`;
