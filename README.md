# Naresh Varnakavi — independent research website

A portable, custom-coded research portfolio, prepared for free GitHub Pages hosting. No Wix account, website builder, paid template, or server-side application is required.

The website pages and assets are stored at the repository root. Its images are included locally, with scientific references preserved. The design, publication record, CV, and scientific calculators are retained from the latest approved website.

## Publishing this website

The repository is **varnaresh17/varnaresh17.github.io**. The intended public address is **https://varnaresh17.github.io/** after a successful Pages deployment.

GitHub Pages publishes the **main** branch from the **/ (root)** folder. In **Settings → Pages**, the source is **Deploy from a branch**, with **main** and **/ (root)** selected. The `.nojekyll` file keeps the custom HTML, CSS and JavaScript unchanged. Future commits to main publish automatically.

Official setup instructions: https://docs.github.com/en/pages/quickstart

## Visual editing

Open **https://varnaresh17.github.io/editor.html** to edit text and photos in a page preview. Drafts stay on your device; download changes for help publishing, or connect a repository-restricted GitHub token for direct publishing. See [VISUAL_EDITOR.md](VISUAL_EDITOR.md) for the step-by-step guide.

## How to request updates

You can send changes in plain language, for example:

- “Add my new publication and DOI.”
- “Replace my portrait with this photo.”
- “Update the Experience section.”

I can prepare and publish the code changes for you while you learn. You can also edit the files in GitHub's browser editor, preview the change, and commit it. Publishing is automatic after a successful commit to main.

## File map

| What you want to change | File |
| --- | --- |
| Home, research, experience, achievements, contact | index.html |
| Visible publication list and categories | publications.html |
| Publication data used as a reference | publications.json |
| Research stories | stories.html |
| Synthesis guide | synthesis.html |
| Characterization guide and XRD/FTIR tools | characterization.html |
| Tools overview | softwares.html |
| Colorimetry and lighting tools | colorimetry.html |
| PLQY / PLQE tools | plqy.html |
| Public CV | resume.html |
| Main appearance | styles.css |
| Portrait and research photos | assets/images/ |

The visible publication HTML and JSON reference are separate files. Updating JSON alone does not update the visible publication page. When adding a publication, update both together.

## Scientific tools and dependencies

- XRD, FTIR, basic colorimetry, and PLQY calculations run in the visitor's browser.
- The advanced lighting/color-rendering engine downloads a pinned Pyodide release and numerical packages from jsDelivr when first used. That feature needs internet access. It is not a Python server.
- Original uploaded data are processed by the existing browser-side calculator code. Aggregate page visits and named calculator actions are collected by GoatCounter. Input values, files and spectra are not sent to analytics.
- Scientific references remain on the relevant pages. THIRD_PARTY_NOTICES.md records the image inventory and scientific library license for maintenance.

## Preview on your computer (optional)

If Python is installed, open a terminal in this folder and run:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/. On Windows the command may be `py -m http.server 8000`. Using a local server is preferable to opening HTML files directly because some calculators load local data with browser fetch requests.

## Hosting and updates

The existing Wix website remains online during the migration. No paid domain is required. Check the repository Actions tab for the latest GitHub Pages publication status.

## Citations and visitor statistics

See [METRICS_SETUP.md](METRICS_SETUP.md) for the one-time SerpApi secret setup, daily Scholar refresh, and private GoatCounter dashboard. Citation data are stored separately from the editable bibliography.
