import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { buildStaticInteractionsScript } from '../utils/static-interactions.ts';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.setContent('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: buildStaticInteractionsScript() });

await page.evaluate(() => {
  window.setTimeout(() => {
    document.getElementById('app').innerHTML = `
      <div role="tablist">
        <button type="button" role="tab" aria-selected="true" aria-controls="panel-standard" data-state="active">Standard</button>
        <button type="button" role="tab" aria-selected="false" aria-controls="panel-deep" data-state="inactive">Deep</button>
      </div>
      <div id="panel-standard" role="tabpanel" data-state="active">Standard content</div>
      <div id="panel-deep" role="tabpanel" data-state="inactive">Deep content</div>
      <div data-state="closed" class="border-b">
        <h3 class="flex">
          <button type="button" aria-controls="faq-region" aria-expanded="false" data-state="closed">Question</button>
        </h3>
        <div data-state="closed" id="faq-region" role="region"><div>Answer text</div></div>
      </div>
    `;
  }, 50);
});

await page.waitForTimeout(250);

const initial = await page.evaluate(() => ({
  deepHidden: document.getElementById('panel-deep')?.hasAttribute('hidden') || false,
  faqHidden: document.getElementById('faq-region')?.hasAttribute('hidden') || false,
  tabBound: document.querySelector('[aria-controls="panel-deep"]')?.dataset.staticTabBound || null,
  faqBound: document.querySelector('[aria-controls="faq-region"]')?.dataset.staticAccordionBound || null,
}));

assert.equal(initial.deepHidden, true);
assert.equal(initial.faqHidden, true);
assert.equal(initial.tabBound, 'true');
assert.equal(initial.faqBound, 'true');

await page.getByRole('tab', { name: 'Deep' }).click();
await page.getByRole('button', { name: 'Question' }).click();

const after = await page.evaluate(() => ({
  deepHidden: document.getElementById('panel-deep')?.hasAttribute('hidden') || false,
  standardHidden: document.getElementById('panel-standard')?.hasAttribute('hidden') || false,
  selected: document.querySelector('[aria-controls="panel-deep"]')?.getAttribute('aria-selected'),
  faqHidden: document.getElementById('faq-region')?.hasAttribute('hidden') || false,
  expanded: document.querySelector('[aria-controls="faq-region"]')?.getAttribute('aria-expanded'),
}));

assert.equal(after.deepHidden, false);
assert.equal(after.standardHidden, true);
assert.equal(after.selected, 'true');
assert.equal(after.faqHidden, false);
assert.equal(after.expanded, 'true');

await browser.close();

console.log('Static interactions runtime');
console.log('[PASS] Delayed static tab and accordion DOM is normalized and interactive');
