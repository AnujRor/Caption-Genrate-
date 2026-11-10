/**
 * Fails the build (or CI) when the on-page SEO essentials are missing from
 * dist/. Run after `npm run build` with `npm run seo:check`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const dist = path.join(process.cwd(), 'dist');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const read = (name) => fs.readFile(path.join(dist, name), 'utf8');
const group = (match) => (Array.isArray(match) ? match[1] ?? '' : '');

try {
  const html = await read('index.html');
  const robots = await read('robots.txt');
  const sitemap = await read('sitemap.xml');

  const title = group(html.match(/<title>([^<]*)<\/title>/i)).trim();
  const description = group(html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i));
  const canonical = group(html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i));
  const ogImage = group(html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i));
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  const h3 = (html.match(/<h3[\s>]/gi) || []).length;
  const jsonLd = (html.match(/application\/ld\+json/gi) || []).length;

  check('Title tag', title.length >= 15 && title.length <= 65, `${title.length} chars`);
  check('Meta description', description.length >= 80 && description.length <= 165, `${description.length} chars`);
  check('Canonical URL', /^https:\/\//i.test(canonical), canonical);
  check('Robots meta', /index,\s*follow/i.test(html) && !/name="robots"[^>]*noindex/i.test(html));
  check('Viewport meta', /name="viewport"/i.test(html));
  check('Language attribute', /<html[^>]*lang="en"/i.test(html));
  check('Open Graph title', /property="og:title"/i.test(html));
  check('Open Graph image', /^https:\/\//i.test(ogImage), ogImage);
  check('Twitter card', /name="twitter:card"[^>]*content="summary_large_image"/i.test(html));
  check('PWA manifest', /rel="manifest"/i.test(html));
  check('Exactly one H1', h1 === 1, `${h1} found`);
  check('H2 sections', h2 >= 6, `${h2} found`);
  check('H3 subsections', h3 >= 10, `${h3} found`);
  check('JSON-LD schemas', jsonLd >= 3, `${jsonLd} blocks`);
  check('Pre-rendered H1', html.includes('id="hero-title"'));
  check(
    'Pre-rendered SEO sections',
    ['features-title', 'how-it-works-title', 'languages-title', 'use-cases-title', 'faq-title'].every((id) =>
      html.includes(`id="${id}"`)
    )
  );
  check('Robots sitemap reference', /Sitemap:\s*https?:\/\//i.test(robots));
  check('Sitemap URL', /<loc>https?:\/\//i.test(sitemap));

  let ogBytes = 0;
  try {
    ogBytes = (await fs.stat(path.join(dist, new URL(ogImage).pathname.replace(/^\//, '')))).size;
  } catch {
    /* reported below */
  }
  check('OG image file', ogBytes > 10_000, `${Math.round(ogBytes / 1024)} KB`);

  let indexNowKey = '';
  const keyFile = (await fs.readdir(dist)).find((name) => /^[a-f0-9]{32}\.txt$/i.test(name));
  if (keyFile) {
    indexNowKey = (await read(keyFile)).trim();
    check('IndexNow key file', indexNowKey === path.basename(keyFile, '.txt'), keyFile);
  } else {
    check('IndexNow key file', false, 'missing');
  }
} catch (error) {
  check('Read build output', false, error.message);
}

const pad = Math.max(...results.map((result) => result.name.length));
for (const { name, ok, detail } of results) {
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(pad)}${detail ? `  ${detail}` : ''}`);
}

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\nSEO check failed: ${failed.length} issue(s). Run "npm run build" first.`);
  process.exit(1);
}

console.log(`\nSEO check passed: ${results.length}/${results.length} checks.`);
