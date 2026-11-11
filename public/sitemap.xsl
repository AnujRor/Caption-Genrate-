<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="sm">

  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>XML Sitemap — AutoCaption Studio</title>
        <style>
          :root { color-scheme: light dark; }
          body {
            margin: 0;
            padding: 32px 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            background: #0f1115;
            color: #e6e8ee;
          }
          main { max-width: 900px; margin: 0 auto; }
          h1 { font-size: 22px; margin: 0 0 8px; }
          p { color: #9aa3b2; line-height: 1.6; margin: 0 0 20px; font-size: 14px; }
          code { background: #1b1f27; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #262b36; }
          th { color: #9aa3b2; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
          a { color: #8ab4ff; word-break: break-all; }
          .badge {
            display: inline-block;
            background: #12351f;
            color: #6ee7a0;
            border-radius: 999px;
            padding: 3px 10px;
            font-size: 12px;
            margin-bottom: 16px;
          }
          @media (prefers-color-scheme: light) {
            body { background: #ffffff; color: #111827; }
            p, th { color: #4b5563; }
            th, td { border-bottom-color: #e5e7eb; }
            code { background: #f3f4f6; }
            a { color: #1d4ed8; }
            .badge { background: #e7f8ee; color: #067647; }
          }
        </style>
      </head>
      <body>
        <main>
          <span class="badge">Valid XML sitemap</span>
          <h1>XML Sitemap</h1>
          <p>
            This page is meant for search engines, not for people — that is why browsers show the
            raw XML by default. The table below is just a readable view of the same data.
            Submit <code>sitemap.xml</code> in Google Search Console or Bing Webmaster Tools.
          </p>
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Last modified</th>
                <th>Change frequency</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sm:urlset/sm:url">
                <tr>
                  <td><a href="{sm:loc}"><xsl:value-of select="sm:loc" /></a></td>
                  <td><xsl:value-of select="sm:lastmod" /></td>
                  <td><xsl:value-of select="sm:changefreq" /></td>
                  <td><xsl:value-of select="sm:priority" /></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
