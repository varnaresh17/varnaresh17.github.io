# Naresh Varnakavi — independent research website

A portable, custom-coded research portfolio, prepared for free GitHub Pages hosting. No Wix account, website builder, paid template, or server-side application is required.

The complete public website is in **dist/**. Its images are included locally, with the existing scientific credits preserved. The design, publication record, CV, and scientific calculators are retained from the latest approved website.

## Publishing this website

The repository is **varnaresh17/varnaresh17.github.io**. The intended public address is **https://varnaresh17.github.io/** after a successful Pages deployment.

Open this repository on GitHub, then **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included workflow publishes **dist/** whenever the **main** branch changes. A green workflow run and a working public address confirm publication.

Official setup instructions: https://docs.github.com/en/pages/quickstart

## How to request updates

You can send changes in plain language, for example:

- “Add my new publication and DOI.”
- “Replace my portrait with this photo.”
- “Update the Experience section.”

I can prepare and publish the code changes for you while you learn. You can also edit the files in GitHub's browser editor, preview the change, and commit it. Publishing is automatic after a successful commit to main.

## File map

| What you want to change | File |
| --- | --- |
| Home, research, experience, achievements, contact | dist/index.html |
| Visible publication list and categories | dist/publications.html |
| Publication data used as a reference | dist/publications.json |
| Research stories | dist/stories.html |
| Synthesis guide | dist/synthesis.html |
| Characterization guide and XRD/FTIR tools | dist/characterization.html |
| Tools overview | dist/softwares.html |
| Colorimetry and lighting tools | dist/colorimetry.html |
| PLQY / PLQE tools | dist/plqy.html |
| Public CV | dist/resume.html |
| Main appearance | dist/styles.css |
| Portrait and research photos | dist/assets/images/ |

The visible publication HTML and JSON reference are separate files. Updating JSON alone does not update the visible publication page. When adding a publication, update both together.

## Scientific tools and dependencies

- XRD, FTIR, basic colorimetry, and PLQY calculations run in the visitor's browser.
- The advanced lighting/color-rendering engine downloads a pinned Pyodide release and numerical packages from jsDelivr when first used. That feature needs internet access. It is not a Python server.
- Original uploaded data are processed by the existing browser-side calculator code. No new backend or analytics service has been added.
- Image credits and existing scientific sources are retained. See THIRD_PARTY_NOTICES.md for the locally stored image inventory and scientific library license.

## Preview on your computer (optional)

If Python is installed, open a terminal in this folder and run:

```sh
python3 -m http.server 8000 --directory dist
```

Then open http://localhost:8000/. On Windows the command may be `py -m http.server 8000 --directory dist`. Using a local server is preferable to opening HTML files directly because some calculators load local data with browser fetch requests.

## What has not happened yet

The existing Wix website remains online during the migration. No paid domain is required. Check the repository Actions tab for the latest GitHub Pages publication status.
