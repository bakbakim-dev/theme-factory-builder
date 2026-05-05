import assert from 'node:assert/strict';
import {
  buildWordPressChromeContextPlan,
  buildWordPressChromeSelectorPhp,
  buildWordPressTemplateChromeBootstrap,
  localizeWordPressChromePaths,
} from '../utils/wordpress-chrome-context.ts';

const routes = [
  { path: '/', slug: 'home', title: 'Home' },
  { path: '/edmonton/', slug: 'edmonton', title: 'Edmonton' },
  { path: '/edmonton/pricing/', slug: 'edmonton-pricing', title: 'Edmonton Pricing' },
  { path: '/edmonton/services/', slug: 'edmonton-services', title: 'Edmonton Services' },
  { path: '/edmonton/move-in-move-out-cleaning/', slug: 'edmonton-move-in-move-out-cleaning', title: 'Edmonton Move In Move Out Cleaning' },
  { path: '/calgary/', slug: 'calgary', title: 'Calgary' },
  { path: '/calgary/pricing/', slug: 'calgary-pricing', title: 'Calgary Pricing' },
  { path: '/calgary/services/', slug: 'calgary-services', title: 'Calgary Services' },
  { path: '/faq/', slug: 'faq', title: 'FAQ' },
];

const plan = buildWordPressChromeContextPlan(routes);

assert.deepEqual(plan.contexts, ['global', 'calgary', 'edmonton']);
assert.equal(plan.routeContextByPath['/'], 'global');
assert.equal(plan.routeContextByPath['/faq/'], 'global');
assert.equal(plan.routeContextByPath['/calgary/'], 'calgary');
assert.equal(plan.routeContextByPath['/calgary/pricing/'], 'calgary');
assert.equal(plan.routeContextByPath['/edmonton/move-in-move-out-cleaning/'], 'edmonton');
assert.equal(plan.representativeRouteByContext.global.path, '/');
assert.equal(plan.representativeRouteByContext.calgary.path, '/calgary/');
assert.equal(plan.representativeRouteByContext.edmonton.path, '/edmonton/');

const headerSelector = buildWordPressChromeSelectorPhp('header');
assert.match(headerSelector, /get_query_var\( 'tf_chrome_context'/);
assert.match(headerSelector, /partials\/header-/);
assert.match(headerSelector, /header-global\.php/);

const footerSelector = buildWordPressChromeSelectorPhp('footer');
assert.match(footerSelector, /partials\/footer-/);
assert.match(footerSelector, /footer-global\.php/);

const bootstrap = buildWordPressTemplateChromeBootstrap('calgary');
assert.equal(bootstrap, "set_query_var( 'tf_chrome_context', 'calgary' );\n");

const localizedHtml = localizeWordPressChromePaths(
  '<a href="/edmonton/pricing/">Pricing</a><a href="/edmonton/services/">Services</a><a href="/faq/">FAQ</a>',
  'calgary',
  routes,
  plan.routeContextByPath,
);
assert.match(localizedHtml, /href="\/calgary\/pricing\/"/);
assert.match(localizedHtml, /href="\/calgary\/services\/"/);
assert.match(localizedHtml, /href="\/faq\/"/);

console.log('WordPress chrome context regression');
console.log('[PASS] Route contexts, representative routes, and selector PHP are stable');
