# Off-Page SEO & Launch Kit

On-page SEO is automated in this repo. This file covers everything that needs a
human account or a public post: search engine submission, instant indexing,
GitHub repo optimization, backlinks and the launch plan.

- **Live URL:** https://caption-generator-9ch5.onrender.com
- **Repo:** https://github.com/AnujRor/Caption-Genrate-
- **Primary keywords:** `AI video caption generator`, `free caption generator`,
  `Hindi captions`, `Hinglish captions`, `auto subtitles`, `SRT generator`,
  `Instagram Reels captions`, `YouTube Shorts subtitles`

---

## 1. Pre-flight (before submitting anything)

| Step | Command / check | Expected |
|------|-----------------|----------|
| Deploy the latest build | `git push` → let Render redeploy | Build log ends with `[seo] Injected …` |
| Home page is reachable | open the live URL | Landing page loads |
| Prerendered HTML is served | `Invoke-WebRequest <url> -UseBasicParsing` then search for `hero-title` | Found without JavaScript |
| Sitemap is live | `https://caption-generator-9ch5.onrender.com/sitemap.xml` | Valid XML |
| robots.txt is live | `https://caption-generator-9ch5.onrender.com/robots.txt` | Has `Sitemap:` line |
| IndexNow key is live | `https://caption-generator-9ch5.onrender.com/df40d63cd7a84b7289366e1b16eaba1d.txt` | Contains the key |
| 404 returns real 404 | open `/this-page-does-not-exist` | HTTP 404 + 404 page |

Local verification:

```bash
npm run build
npm run seo:check     # must print "SEO check passed: 20/20 checks"
```

---

## 2. Google Search Console

1. Open <https://search.google.com/search-console> → **Add property**.
2. Prefer **Domain** property (`caption-generator-9ch5.onrender.com`) if you can add a
   DNS TXT record. Otherwise use **URL prefix** with the full `https://` URL.
3. Verify. With the URL-prefix method you can use the HTML tag option:
   - Get the `content="..."` value from Google.
   - Add it to the Render environment as `GOOGLE_SITE_VERIFICATION` (or
     `VITE_GOOGLE_SITE_VERIFICATION`) and redeploy.
   - `scripts/prerender.tsx` injects
     `<meta name="google-site-verification" …>` automatically at build time.
   - Alternatively paste the tag where `<!-- SEO_VERIFICATION -->` sits in
     `index.html`.
4. **Sitemaps** → submit `sitemap.xml`.
5. **URL Inspection** → paste the home page → **Request indexing**.
6. Check **Page indexing** after 3–7 days; fix anything reported as
   "Discovered – currently not indexed" or "Crawled – currently not indexed"
   by improving content, not by resubmitting repeatedly.

> Free Render instances sleep. If Googlebot hits a sleeping instance it gets a
> slow first byte. Once real traffic starts, consider the paid instance or a
> cron ping to keep it warm.

## 3. Bing Webmaster Tools

1. Open <https://www.bing.com/webmasters> → **Add site**.
2. Fastest path: **Import from Google Search Console** (keeps verification and
   sitemap). Manual path uses `BING_SITE_VERIFICATION` /
   `VITE_BING_SITE_VERIFICATION`, injected as `msvalidate.01`.
3. Submit `https://caption-generator-9ch5.onrender.com/sitemap.xml`.
4. Bing also feeds **DuckDuckGo**, **Yahoo** and (partly) **ChatGPT search**, so
   this step matters for AI visibility too.

## 4. IndexNow (instant indexing)

Bing, Yandex, Seznam and Naver accept instant URL notifications through
IndexNow. The key file is already generated at build time.

After **every** production deploy:

```bash
npm run seo:indexnow
# or a specific URL / custom domain
npm run seo:indexnow -- https://your-domain.com/
```

Expected output: `[indexnow] Success (HTTP 200)`.

If it returns 403, the key file is not reachable yet — confirm the deploy
finished, then retry. IndexNow does not cover Google; use Search Console for
Google.

You can also run it from GitHub: **Actions → IndexNow → Run workflow** (no local
setup required).

---

## 5. GitHub repo optimization (free, high-value backlink)

GitHub profile and repo pages rank well and pass real link equity.

```bash
gh auth login          # one time, choose GitHub.com → HTTPS → browser
gh repo edit AnujRor/Caption-Genrate- \
  --description "Free AI video caption generator for Hindi, Hinglish & 25+ languages. Word-by-word animated captions, MP4 burn-in and SRT export." \
  --homepage "https://caption-generator-9ch5.onrender.com" \
  --add-topic ai \
  --add-topic captions \
  --add-topic subtitles \
  --add-topic video-editing \
  --add-topic hindi \
  --add-topic hinglish \
  --add-topic react \
  --add-topic typescript \
  --add-topic gemini \
  --add-topic srt
```

Manual alternative: repo → ⚙️ **About** → paste description, website and topics.

Also add the live link + badges near the top of the README (already present) so
forks and mirrors keep a crawlable link.

---

## 6. Launch copy (copy-paste ready)

Replace `{{URL}}` with `https://caption-generator-9ch5.onrender.com` if you fork
or move domains.

### X / Twitter (thread)

> 1/ I built a free AI caption generator for Hindi, Hinglish & 25+ languages.
>
> Upload a video → it transcribes with word-level timestamps → you style the
> captions → export MP4 or SRT. No editing skills, no watermark.
>
> {{URL}}
>
> 2/ Most caption tools are English-first. Hinglish ("aap kaise ho") and
> Devanagari Hindi get butchered.
>
> This one outputs both, plus Punjabi, Bhojpuri, Haryanvi, Tamil, Telugu,
> Bengali, Arabic, Spanish…
>
> 3/ What's inside:
> • Word-by-word timestamps
> • Karaoke / single-word / progressive modes
> • 8 fonts, pop/glow/bounce animations
> • Click-to-edit any caption
> • MP4 burn-in + .SRT download
>
> 4/ It's free and runs in the browser. Feedback welcome — especially which
> language it should support next.
>
> {{URL}}

### LinkedIn

> Captions are no longer optional — 80%+ of social video is watched on mute.
>
> I kept seeing creators manually type subtitles for Hindi and Hinglish reels,
> so I built a free tool that does it automatically: **AutoCaption Studio**.
>
> • Upload MP4/MOV/MP3 → AI transcribes with word-by-word timing
> • Supports Hindi, Hinglish and 25+ languages
> • Style captions (karaoke, single-word, progressive) and export MP4 or SRT
> • Works in the browser, no install, no watermark
>
> Try it: {{URL}}
>
> Curious what other creators want next: better translation, auto-emoji, or
> brand presets?

### Reddit (r/VideoEditing, r/NewTubers, r/InstagramMarketing, r/india)

Read each subreddit's self-promotion rules first. Post as a builder sharing a
free tool, not as an ad.

> **Title:** I made a free caption generator that actually handles Hindi and Hinglish
>
> Every caption tool I tried turned "aap kaise ho" into nonsense or forced me to
> type Devanagari by hand. So I built one that transcribes Hindi, Hinglish and
> 25+ languages with word-level timestamps.
>
> Flow: upload → auto-transcribe → pick a style (karaoke / one-word /
> progressive) → export burned-in MP4 or .srt.
>
> Free, browser-based, no watermark: {{URL}}
>
> Happy to answer questions about how the timing works or add languages people
> ask for.

### Dev.to / Hashnode (technical post)

Title: **Building a Hindi/Hinglish AI caption generator with Gemini and FFmpeg**

Outline:

1. Why English-first caption tools fail on Hinglish
2. Pipeline: upload → FFmpeg 16 kHz WAV → Gemini word-level JSON → phrase builder
3. Getting reliable word timestamps (prompt shape + validation)
4. Rendering styled captions on canvas
5. Burn-in vs SRT export
6. SEO lessons: prerendering a Vite SPA for crawlers that don't run JS
7. What I'd improve next

End with a single contextual link: "The live tool is at {{URL}}."

### Medium

Cross-post the Dev.to article after ~1 week (set the canonical URL to the Dev.to
post to avoid duplicate-content signals).

### Product Hunt

- **Tagline:** Free AI captions for Hindi, Hinglish & 25+ languages
- **Description:** Upload a video, get word-by-word animated captions, export MP4
  or SRT. No watermark, no editing skills.
- **First comment:** the problem, who it's for, what is free, what's next, and a
  request for feedback. Ask 5–10 real users to try it *before* launch day.

### Indie Hackers

Post in **Show IH**: what you built, the Hinglish gap, stack, what you learned
about SEO for SPAs, and current metrics. Ask one specific question.

### Hacker News (Show HN)

Title: `Show HN: Free AI video caption generator for Hindi/Hinglish`

Keep it technical (Gemini word timestamps, FFmpeg pipeline, canvas rendering)
and mention the free tier honestly. Do not ask for upvotes.

### Quora

Answer existing questions like "How do I add subtitles to Hindi videos for free?"
with a genuinely useful step-by-step answer; link only where it adds value.

---

## 7. Directories & backlink targets

Submit once, with consistent name, URL and a 1–2 sentence description
("Free AI video caption generator for Hindi, Hinglish and 25+ languages").

| Target | URL | Notes |
|--------|-----|-------|
| GitHub repo | github.com/AnujRor/Caption-Genrate- | description + homepage + topics |
| Product Hunt | producthunt.com | real launch, not a drive-by link |
| AlternativeTo | alternativeto.net | list as alternative to CapCut/Submagic/Veed |
| Indie Hackers | indiehackers.com | Show IH post |
| Dev.to | dev.to | technical article |
| Hashnode | hashnode.com | cross-post with canonical |
| Medium | medium.com | cross-post with canonical |
| Reddit | relevant subs | follow each sub's rules |
| Quora | quora.com | answer-first |
| LinkedIn | personal + company post | native text, link in first comment |
| YouTube | demo video description | record a 60–90s demo |
| BetaList | betalist.com | pre-launch only |
| Startups.fyi / Uneed / Microlaunch | — | optional low-effort listings |
| Hacker News | news.ycombinator.com | Show HN |
| Free tool aggregators | e.g. toolify.ai, aitools.fyi | check they allow free tools |
| College/creator communities | Discord/WhatsApp/Telegram | share as a helpful answer |

Avoid: paid link farms, PBNs, mass guest-post networks, comment spam, and
"1000 backlinks for $5" gigs. They can get the domain penalized.

---

## 8. Anchor text guidance

Natural profile beats exact-match repetition.

| Anchor type | Example | Share |
|-------------|---------|-------|
| Branded | AutoCaption Studio | ~40% |
| Naked URL | caption-generator-9ch5.onrender.com | ~25% |
| Partial match | free AI caption generator for Hindi | ~20% |
| Exact match | AI video caption generator | ~10% |
| Generic | this tool, try it here | ~5% |

Rules:

- One link per post/article is enough.
- Link to the page you are actually talking about.
- No sitewide footer links from unrelated sites.
- Never buy links; earn them by being useful in the thread.

---

## 9. 30-day plan

| Days | Action | Done when |
|------|--------|-----------|
| 1 | Deploy, run `npm run seo:check`, verify key file is live | 20/20 + key URL returns the key |
| 1 | `gh auth login`, run the `gh repo edit` command | Repo shows description, site, topics |
| 2 | Google Search Console: verify + submit sitemap + request indexing | Sitemap status "Success" |
| 2 | Bing Webmaster: import from GSC + submit sitemap | Site verified |
| 3 | Run `npm run seo:indexnow` | HTTP 200 |
| 3–4 | Record a 60–90s demo video, upload to YouTube | Video description links to site |
| 4 | Publish the Dev.to technical post | Post live + linked |
| 5 | LinkedIn + X launch posts | Both live |
| 6–7 | Show IH + Reddit (rules permitting) | Posts live |
| 8 | Product Hunt launch | Listing live with first comment |
| 9–14 | Answer 5 Quora/Reddit questions helpfully | 5 answers with at most 2 links |
| 15 | Add canonical URLs to Medium/Hashnode cross-posts | Canonicals set |
| 16–21 | Submit to AlternativeTo + 3 quality directories | Live listings |
| 22–28 | Publish a second article (e.g. "How to add Hindi subtitles to Reels") | Article live |
| 29–30 | Review GSC coverage, queries, CTR; fix thin/missing pages | Report saved |

---

## 10. Tracking

- **Google Search Console** → Performance (queries, CTR, position) and Pages
  (indexed vs excluded).
- **Bing Webmaster** → Search performance + IndexNow status.
- **Analytics** → add UTM tags so you know which channel converts:
  `?utm_source=twitter&utm_medium=social&utm_campaign=launch`
- **Backlink log** — keep a simple table: date, URL, anchor, status, notes.
  Re-check here: `site:your-domain.com` in Google, or
  `https://www.bing.com/search?q=link:your-domain.com`.

---

## 11. After every content change

1. `npm run build` (re-prerenders the HTML)
2. `npm run seo:check`
3. Deploy
4. `npm run seo:indexnow`
5. In GSC, use **URL Inspection → Request indexing** for the changed page only

---

## 12. Guardrails

- Do not add `noindex` anywhere on the landing page.
- Do not block Googlebot/Bingbot in `robots.txt`.
- Do not change the canonical URL while a domain migration is in progress; if you
  must, use 301 redirects from the old domain.
- Keep one `<h1>` per page.
- Do not keyword-stuff headings or the meta description.
- Keep the OG image under ~1 MB and at 1200×630.
