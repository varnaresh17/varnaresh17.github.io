# Search visibility

The public website is https://varnaresh17.github.io/. An anonymous HTTP 200 response means it is accessible; this is different from being indexed or ranking for a search term.

## Implemented

- Unique titles, descriptions, canonical URLs and social-preview metadata for all 16 public pages.
- Both **Naresh Varnakavi** and **Varnakavi Naresh** in the visible biography and the homepage's Person/WebSite structured data.
- A sitemap at https://varnaresh17.github.io/sitemap.xml, referenced by robots.txt, with public portfolio pages only. The visual editor and retired image-credit redirect are excluded.
- The visual editor retains its noindex directive.
- IndexNow ownership verification file and a submission utility at `scripts/submit_indexnow.py`. Run it after publishing a changed sitemap to notify participating search engines. It first checks that the published verification file matches, then submits the canonical page list. The hosted key is for public domain verification, not a private account password.

## Google ownership verification

1. Open https://search.google.com/search-console/ and sign in to your own Google account.
2. Add a **URL-prefix** property: **https://varnaresh17.github.io/**. Do not choose a DNS-based Domain property for github.io, which you do not own.
3. Choose **HTML tag** under the verification methods. Copy the complete `google-site-verification` meta tag and have it added to `index.html`. Preserve the tag in future edits. Alternatively, supply Google's verification HTML file for publication at the exact requested path.
4. Once the tag or file is live, click **Verify**.
5. In **Sitemaps**, submit `sitemap.xml`.
6. In **URL Inspection**, inspect `https://varnaresh17.github.io/`, run **Test live URL**, then select **Request indexing** when available.

The verification tag or file is designed to be published; do not share your Google password, account cookies or private API credentials.

## Bing

The IndexNow submission helps participating search engines discover the URLs. A successful 200 response means received; 202 means received with ownership validation pending. Neither guarantees indexing. For detailed indexing reports, add the site to https://www.bing.com/webmasters/; a verified Google Search Console property can be imported, or Bing offers separate verification methods.

## Expectations

Crawling and indexing may take days or weeks. Search engines decide whether and where to list a site. The two full-name queries are more specific than **Naresh** or **Varnakavi** alone, which may return many other people. There is no guarantee of a particular position. Link this canonical website from your own LinkedIn, Google Scholar and ORCID profiles when appropriate, so visitors and crawlers have consistent identity information.

References: https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl ; https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ; https://developers.google.com/search/docs/appearance/site-names ; https://www.indexnow.org/documentation

## Calculator searches

The Tools directory and four workspaces now use explicit calculator names in titles, main headings, descriptions and ordinary WebPage/Breadcrumb structured data. The descriptions name the supported inputs and outputs: XRD d-spacing/Bragg law/crystallinity; FTIR candidate functional-group interpretation; CIE 1931/1976 coordinates, CCT, Duv and lighting; and internal/external PLQY/PLQE. No ratings, reviews or unimplemented calculations are advertised. Calculator formulas and JavaScript are unchanged. All four URLs are in the sitemap.

In Search Console, select the verified URL-prefix property, open **Indexing → Sitemaps**, enter `sitemap.xml`, and submit. Then use **URL Inspection** on each of `xrd.html`, `ftir.html`, `colorimetry.html` and `plqy.html` at the production hostname; run **Test live URL** and **Request indexing** when available. Google decides inclusion and rankings; metadata alone does not guarantee traffic or an app rich result.
