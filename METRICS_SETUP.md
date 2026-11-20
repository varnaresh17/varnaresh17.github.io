# Citation updates and website visitors

## One-time citation setup

1. Copy your API key from your own [SerpApi dashboard](https://serpapi.com/manage-api-key).
2. Open [New GitHub Actions repository secret](https://github.com/varnaresh17/varnaresh17.github.io/settings/secrets/actions/new).
3. Name the secret **SERPAPI_API_KEY**, paste the key into the Secret field, and save.
4. Open [Update Google Scholar citations](https://github.com/varnaresh17/varnaresh17.github.io/actions/workflows/sync-scholar.yml), select **Run workflow**, and choose **main**.
5. When it succeeds and Pages finishes publishing, open [Publications](https://varnaresh17.github.io/publications.html). You should see a timestamp and research metrics.

No Google password is needed. Never paste the SerpApi key into HTML, JSON, JavaScript, a commit, or a chat. GitHub keeps it as an encrypted Actions secret. The public snapshot contains only selected public fields, not the raw API response or credentials.

## Automatic updates

The workflow runs daily at 11:23 UTC (6:23 AM Eastern in winter; 7:23 AM Eastern in summer), or manually. GitHub scheduling can be delayed and may disable scheduled workflows in inactive public repositories after 60 days; check the Actions page if the displayed timestamp becomes old. The website explicitly identifies snapshots older than three days as delayed. Failed requests retain the last successful snapshot and fail the workflow; missing values never become invented zeros.

The updater reads the public profile **GbwKoHsAAAAJ** through SerpApi, with up to 100 records per API page. Additional pages consume extra requests. It retrieves total citations, h-index, i10-index, annual citation counts, article metadata and cited-by links. It does not access private Scholar libraries, emails, alerts, or account activity. Quotas and API availability apply.

Per-publication counts are matched by exact normalized title plus a compatible year; ambiguous matches remain unavailable. If a real indexed title differs, add a verified mapping to `scholar-mappings.json`, for example `{"p01":"GbwKoHsAAAAJ:ARTICLE_ID"}` using the actual ID from `scholar-data.json`. Never guess an ID. Unmatched Scholar records appear in **Additional articles on Google Scholar** and may be alternate versions, rather than newly published papers. The curated 39 articles and 8 proceedings remain independently editable.

The workflow commits only `scholar-data.json` and explicitly requests the existing branch-based Pages build; GITHUB_TOKEN commits alone do not trigger Pages. A failed build request is visible in Actions and should be retried after checking repository Pages permissions. A manual rerun requests a build even if no data changed.

## Visitor dashboard (provider)

Open **https://varnaresh17.goatcounter.com/** and sign in. Keep statistics private in GoatCounter settings. The tracker is installed on all 16 public portfolio pages, only on the production hostname. Preview pages and visual-editor frames do not count.

It records aggregate page visits, publication-link clicks, CV opens, and named calculator actions. A click measures an attempted action, not necessarily a valid calculation or completed download. The tracker does not send files, spectra, calculator inputs, search strings, query parameters, or form text. GoatCounter may also collect coarse location, browser and referrer statistics according to the account's data-collection settings. Counts are estimates and can be reduced by blockers. Earlier visits cannot be reconstructed.

For a simple check, visit the live site, open Publications, and return to the dashboard after about 10 seconds. If nothing appears, check your browser's content blocker and GoatCounter's allowed domains. You can exclude your own browsing in GoatCounter settings.

## Private visitor statistics

The public visit counter has been removed from all 16 portfolio pages. Page-visit and named-action collection continues through `site-analytics.js`, while statistics are viewed privately in the editor or account dashboard.

Open `statistics.html` from the **Visitor statistics** link in the main website sidebar, open the same dashboard in `editor.html`, or sign in at https://varnaresh17.goatcounter.com/. The editor requires a read-only GoatCounter API key to retrieve statistics. Opening the editor alone does not reveal private statistics. Keys are entered at runtime and are never included in public files.

In GoatCounter **Settings**, keep **Public access** set to **Private**, and turn off **Allow adding visitor counts on your website**. Removing a page widget cannot revoke a previously enabled public counter endpoint; the provider setting must be disabled as well. No private API key should be placed in the repository or the public site.

The retired `visitor-counter.js` file cleans old page copies without fetching any counts. New public pages no longer load it. The citation workflow still runs independently.

## Statistics inside the website editor

The **Visitor statistics** sidebar link opens an authenticated dashboard at `statistics.html` on the main website. The editor offers the same dashboard as a modal. It uses GoatCounter's official read-only JSON API directly over HTTPS with Authorization headers. Browser CORS support was checked against the production service. The key is supplied by the owner at runtime. By default it stays in an in-memory closure. An unchecked-by-default **Remember on this device for 30 days** option saves the read-only key and expiry in this browser’s localStorage only after a successful authenticated statistics response. It does not save statistics. Anyone using that browser profile, or scripts running on the same website origin, can access a saved key, so the option is for trusted personal devices only. A blocked storage API falls back to session-only access. Closing the editor modal or leaving the page clears in-memory credentials and data and aborts pending requests; the optional device key remains until expiry, **Forget this device**, or **Forget & lock**. Authentication failures remove remembered keys. Nothing is put in URLs, public JSON files or GitHub.

One-time setup: sign in to GoatCounter, open your username menu → API, and create a token with permission to read statistics only. Enter it in the editor's dashboard, not in a chat or source file. Create the API token only once and reuse it. New sessions reconnect automatically when remembering is enabled; otherwise paste the same token again. Keep the provider's dashboard and visitor counter private.

The dashboard displays period totals, daily activity, the top 100 tracked paths split into pages and actions, and the top 20 locations, referring sites and browsers. Page visits are total activity minus tracked actions; they are not distinct identified people. Daily activity includes both page visits and actions. It makes only five whitelisted GET requests, throttles calls below the documented four-per-second limit, and handles authorization failures without exposing response bodies or keys. Optional breakdown failures do not fabricate data. No names, emails or raw IP addresses are inferred or displayed.

The statistics page is `noindex,nofollow`, excluded from the sitemap, does not run the public tracker, and fetches no statistics until a runtime or remembered key is present. A public navigation link does not expose private counts. It is outside the visual editor publishing allowlist. Its CSP permits scripts only from this site and API connections only to this GoatCounter account. Remembered credentials expire after 30 days and are never enabled automatically.
