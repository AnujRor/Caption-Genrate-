/**
 * Instantly notifies IndexNow partners (Bing, Yandex, Seznam, Naver) that the
 * site changed. Run this after a successful deploy:
 *
 *   npm run seo:indexnow
 *   npm run seo:indexnow -- https://your-domain.com/
 *
 * The key file must already be live at https://your-domain/<key>.txt — the
 * build writes it into dist/ automatically.
 */
const DEFAULT_SITE_URL = 'https://caption-generator-9ch5.onrender.com';
const KEY = (process.env.INDEXNOW_KEY || 'df40d63cd7a84b7289366e1b16eaba1d').trim();
const SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
const endpoint = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';

const urls = process.argv.slice(2).filter((value) => /^https?:\/\//i.test(value));
if (urls.length === 0) urls.push(`${SITE_URL}/`);

const host = new URL(SITE_URL).host;
const payload = {
  host,
  key: KEY,
  keyLocation: `${SITE_URL}/${KEY}.txt`,
  urlList: urls,
};

console.log(`[indexnow] Submitting ${urls.length} URL(s) for ${host}...`);

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout?.(30_000),
});

const body = await response.text().catch(() => '');
if (response.ok) {
  console.log(`[indexnow] Success (HTTP ${response.status}). Search engines will crawl the URL(s) shortly.`);
} else {
  console.error(`[indexnow] Failed (HTTP ${response.status}) ${body.slice(0, 300)}`);
  console.error('[indexnow] Make sure the site is deployed and the key file is reachable:');
  console.error(`           ${payload.keyLocation}`);
  process.exitCode = 1;
}
