/**
 * Post-build SEO step.
 *
 * 1. Renders the landing page to static HTML so crawlers see the real H1/H2/H3
 *    content, FAQ answers and internal links without executing JavaScript.
 * 2. Rewrites the canonical domain in index.html, robots.txt and sitemap.xml
 *    when VITE_SITE_URL (or SITE_URL) is set at build time.
 * 3. Injects Google Search Console / Bing verification meta tags from env vars.
 * 4. Writes the IndexNow key file so Bing, Yandex and other partners can verify
 *    the domain before instant indexing.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';

const DEFAULT_SITE_URL = 'https://caption-generator-9ch5.onrender.com';
const SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
const INDEXNOW_KEY = (process.env.INDEXNOW_KEY || 'df40d63cd7a84b7289366e1b16eaba1d').trim();
const GOOGLE_VERIFICATION = process.env.VITE_GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION || '';
const BING_VERIFICATION = process.env.VITE_BING_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION || '';

const escapeHtmlAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function replaceDomain(file: string, search: string, replacement: string) {
  const contents = await fs.readFile(file, 'utf8');
  if (!contents.includes(search)) return false;
  await fs.writeFile(file, contents.split(search).join(replacement), 'utf8');
  return true;
}

async function main() {
  const distPath = path.join(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');
  const template = await fs.readFile(indexPath, 'utf8');
  const marker = '<div id="root"></div>';

  if (!template.includes(marker)) {
    throw new Error(`Could not find "${marker}" in ${indexPath}`);
  }

  // 1. Static landing-page HTML.
  const appHtml = renderToString(React.createElement(App));
  let output = template.replace(marker, `<div id="root">${appHtml}</div>`);

  // 2. Canonical domain.
  if (SITE_URL !== DEFAULT_SITE_URL) {
    output = output.split(DEFAULT_SITE_URL).join(SITE_URL);
  }

  // 3. Search Console / Bing verification meta tags.
  const verificationTags = [
    GOOGLE_VERIFICATION
      ? `    <meta name="google-site-verification" content="${escapeHtmlAttribute(GOOGLE_VERIFICATION)}" />`
      : '',
    BING_VERIFICATION
      ? `    <meta name="msvalidate.01" content="${escapeHtmlAttribute(BING_VERIFICATION)}" />`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  output = output.replace(
    '<!-- SEO_VERIFICATION -->',
    verificationTags || '<!-- Add Google Search Console / Bing verification meta tags here. -->'
  );

  await fs.writeFile(indexPath, output, 'utf8');

  // 4. Keep the crawler files on the same domain as the canonical URL.
  const domainFiles = ['robots.txt', 'sitemap.xml', 'guides/hindi-video-captions.html', 'guides/hinglish-captions.html'];
  for (const name of domainFiles) {
    await replaceDomain(path.join(distPath, name), DEFAULT_SITE_URL, SITE_URL);
  }

  // 5. IndexNow key file (served at https://your-domain/<key>.txt).
  if (INDEXNOW_KEY) {
    await fs.writeFile(path.join(distPath, `${INDEXNOW_KEY}.txt`), `${INDEXNOW_KEY}\n`, 'utf8');
  }

  console.log(`[seo] Injected ${appHtml.length.toLocaleString()} characters of static HTML into dist/index.html`);
  console.log(`[seo] Canonical domain: ${SITE_URL}`);
  if (GOOGLE_VERIFICATION) console.log('[seo] Google Search Console verification tag injected');
  if (BING_VERIFICATION) console.log('[seo] Bing Webmaster verification tag injected');
  console.log(`[seo] IndexNow key: ${SITE_URL}/${INDEXNOW_KEY}.txt`);
}

main().catch((error) => {
  console.error('[seo] Failed:', error);
  process.exit(1);
});
