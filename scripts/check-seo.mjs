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
  let canonicalOrigin = '';
  try {
    canonicalOrigin = new URL(canonical).origin;
  } catch {
    // Report the malformed URL with the canonical check below.
  }
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  const h3 = (html.match(/<h3[\s>]/gi) || []).length;
  const jsonLd = (html.match(/application\/ld\+json/gi) || []).length;
  const jsonLdBlocks = Array.from(html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi));
  const faqSchema = jsonLdBlocks
    .map(([, block]) => {
      try {
        return JSON.parse(block);
      } catch {
        return null;
      }
    })
    .find((schema) => schema?.['@type'] === 'FAQPage');
  const faqEntities = Array.isArray(faqSchema?.mainEntity) ? faqSchema.mainEntity : [];
  const faqSection = group(html.match(/<section id="faq"[\s\S]*?<\/section>/i));

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
  check(
    'FAQ structured data matches visible content',
    faqEntities.length > 0 &&
      faqEntities.every(
        ({ name, acceptedAnswer }) =>
          typeof name === 'string' &&
          typeof acceptedAnswer?.text === 'string' &&
          faqSection.includes(name) &&
          faqSection.includes(acceptedAnswer.text)
      ),
    `${faqEntities.length} questions`
  );

  const robotsSitemap = group(robots.match(/^Sitemap:\s*(\S+)/im));
  check('Robots sitemap matches canonical host', robotsSitemap === `${canonicalOrigin}/sitemap.xml`, robotsSitemap);

  const sitemapLocs = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi), ([, loc]) => loc.trim());
  const sitemapLastmods = Array.from(sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi), ([, date]) => date.trim());
  check(
    'Sitemap XML structure',
    /<urlset\b[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/i.test(sitemap) &&
      /<\/urlset>\s*$/i.test(sitemap) &&
      sitemapLocs.length > 0,
    `${sitemapLocs.length} URLs`
  );
  check(
    'Sitemap URLs use canonical host',
    sitemapLocs.length > 0 &&
      sitemapLocs.every((loc) => {
        try {
          const url = new URL(loc);
          return url.protocol === 'https:' && url.origin === canonicalOrigin;
        } catch {
          return false;
        }
      })
  );
  check(
    'Sitemap lastmod values',
    sitemapLastmods.length === sitemapLocs.length &&
      sitemapLastmods.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)))
  );

  let sitemapTargetsExist = sitemapLocs.length > 0;
  for (const loc of sitemapLocs) {
    try {
      const url = new URL(loc);
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      await fs.access(path.join(dist, relativePath || 'index.html'));
    } catch {
      sitemapTargetsExist = false;
      break;
    }
  }
  check('Sitemap URLs exist in build output', sitemapTargetsExist);

  let sitemapPagesHaveMetadata = sitemapLocs.length > 0;
  let guideCount = 0;
  let guideSchemasAreValid = true;
  let guideFaqsMatchVisibleCopy = true;
  for (const loc of sitemapLocs) {
    try {
      const url = new URL(loc);
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const pageHtml = await fs.readFile(path.join(dist, relativePath || 'index.html'), 'utf8');
      const pageCanonical = group(pageHtml.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i));
      const pageTitle = group(pageHtml.match(/<title>([^<]*)<\/title>/i)).trim();
      const pageDescription = group(pageHtml.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i));
      const pageH1 = (pageHtml.match(/<h1[\s>]/gi) || []).length;

      if (
        pageCanonical !== loc ||
        pageTitle.length < 15 ||
        pageTitle.length > 70 ||
        pageDescription.length < 80 ||
        pageDescription.length > 165 ||
        pageH1 !== 1 ||
        !/index,\s*follow/i.test(pageHtml)
      ) {
        sitemapPagesHaveMetadata = false;
      }

      if (url.pathname !== '/') {
        guideCount++;
        const blocks = Array.from(
          pageHtml.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi),
          ([, block]) => block
        );
        const schemas = [];
        for (const block of blocks) {
          try {
            schemas.push(JSON.parse(block));
          } catch {
            guideSchemasAreValid = false;
          }
        }
        if (!blocks.length) guideSchemasAreValid = false;

        const graph = schemas.flatMap((schema) => (Array.isArray(schema['@graph']) ? schema['@graph'] : [schema]));
        const guideFaq = graph.find((schema) => schema?.['@type'] === 'FAQPage');
        const faqHeading = /<h2\b[^>]*>\s*Frequently asked questions\s*<\/h2>/i.exec(pageHtml);
        const nextHeading = faqHeading
          ? pageHtml.indexOf('<h2', faqHeading.index + faqHeading[0].length)
          : -1;
        const faqHtml = faqHeading
          ? pageHtml.slice(faqHeading.index, nextHeading < 0 ? pageHtml.length : nextHeading)
          : '';
        const faqText = faqHtml
          .replace(/<[^<>]*>/g, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;|&apos;/gi, "'")
          .replace(/\s+/g, ' ')
          .trim();
        const entities = Array.isArray(guideFaq?.mainEntity) ? guideFaq.mainEntity : [];
        if (
          !entities.length ||
          !entities.every(
            ({ name, acceptedAnswer }) =>
              typeof name === 'string' &&
              typeof acceptedAnswer?.text === 'string' &&
              faqText.includes(name) &&
              faqText.includes(acceptedAnswer.text)
          )
        ) {
          guideFaqsMatchVisibleCopy = false;
        }
      }
    } catch {
      sitemapPagesHaveMetadata = false;
      guideSchemasAreValid = false;
      guideFaqsMatchVisibleCopy = false;
    }
  }
  check('Sitemap pages have matching metadata', sitemapPagesHaveMetadata);
  check('Guide structured data is valid', guideCount > 0 && guideSchemasAreValid, `${guideCount} guides`);
  check('Guide FAQ data matches visible content', guideCount > 0 && guideFaqsMatchVisibleCopy);

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
