import assert from 'node:assert/strict';
import { convertHtmlToElementorDocument } from '../utils/elementorConverter.ts';

const options = {
  title: 'Test Page',
  slug: 'test-page',
  routePath: '/test-page',
  visualFidelityMode: 'native-balanced',
};

const getWidgetTexts = (elements) => {
  const texts = [];
  const recurse = (items) => {
    for (const item of items) {
      if (item.widgetType === 'text-editor' && item.settings?.editor) {
        texts.push(item.settings.editor);
      }
      if (item.widgetType === 'heading' && item.settings?.title) {
        texts.push(item.settings.title);
      }
      if (item.widgetType === 'whipify_text_fragment' && item.settings?.text) {
        texts.push(item.settings.text);
      }
      if (item.elements?.length) {
        recurse(item.elements);
      }
    }
  };
  recurse(elements);
  return texts;
};

const getImageWidgetCount = (elements) => {
  let count = 0;
  const recurse = (items) => {
    for (const item of items) {
      if (item.widgetType === 'image') {
        count += 1;
      }
      if (item.elements?.length) {
        recurse(item.elements);
      }
    }
  };
  recurse(elements);
  return count;
};

const lightning = '\u26a1';
const rocket = '\u{1f680}';
const fire = '\u{1f525}';

const cases = [
  {
    label: 'inline unicode emoji remains inline text',
    html: `<p>Supercharge your team ${lightning} with instant updates!</p>`,
    expectedText: `Supercharge your team ${lightning} with instant updates!`,
    expectedImages: 0,
  },
  {
    label: 'WordPress fallback emoji image becomes unicode',
    html: `<p>We are lightning fast <img draggable="false" role="img" class="emoji" alt="${lightning}" src="https://s.w.org/images/core/emoji/17.0.2/svg/26a1.svg"> today!</p>`,
    expectedText: `We are lightning fast ${lightning} today!`,
    expectedImages: 0,
  },
  {
    label: 'single-quoted alternate attribute order is normalized',
    html: `<p>Check out our progress <img src='https://s.w.org/images/core/emoji/17.0.2/svg/1f680.svg' alt='${rocket}' class='emoji' draggable='false' /> now!</p>`,
    expectedText: `Check out our progress ${rocket} now!`,
    expectedImages: 0,
  },
  {
    label: 'standalone emoji image becomes text',
    html: `<div><img class="emoji" alt="${fire}" src="https://s.w.org/images/core/emoji/17.0.2/svg/1f525.svg"></div>`,
    expectedText: fire,
    expectedImages: 0,
  },
  {
    label: 'regular non-emoji image remains image widget',
    html: '<div><img src="https://example.com/assets/hero-banner.jpg" alt="Our Beautiful Banner"></div>',
    expectedText: '',
    expectedImages: 1,
  },
];

for (const testCase of cases) {
  const result = convertHtmlToElementorDocument(testCase.html, options);
  const texts = getWidgetTexts(result.document.content);
  const images = getImageWidgetCount(result.document.content);

  assert.equal(images, testCase.expectedImages, `${testCase.label}: unexpected image widget count.`);
  if (testCase.expectedText) {
    assert.ok(texts.some((text) => text.includes(testCase.expectedText)), `${testCase.label}: expected text "${testCase.expectedText}" in ${JSON.stringify(texts)}`);
  }
}

console.log('emoji normalization regression passed');
