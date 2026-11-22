# Calculator comments and suggestions

Four public tool pages contain 14 context-specific feedback sections. Each section is collapsed by default and remains beside its calculator. XRD has two; FTIR has three; Colorimetry & Lighting has five; PLQY/PLQE has four.

Visitors may read public feedback without signing in. **Review & post on GitHub** opens a prefilled issue in the existing `varnaresh17/varnaresh17.github.io` repository. A GitHub account is required to submit it, and the visitor must complete **Submit new issue** on GitHub. Opening the prepared form does not post feedback. There is no anonymous posting service, paid add-on, GitHub App installation, OAuth client or public API key.

The issue contains the calculator's name, a canonical link, a feedback type and only the comment that the visitor deliberately entered. Spectra, uploaded files, calculator field values, analytics credentials, browser drafts and private account data are not read or attached. The form explicitly says feedback will be public. A bound on the composed URL and a 1,000-character limit keep requests manageable; some longer Unicode comments need to be shortened further.

**Load comments** retrieves public GitHub issues on demand, filtered to the calculator's marker and title. It displays up to 20 recent matching conversations. Replies are read on demand, up to 20 per conversation, with a link to the complete GitHub thread. Raw content is rendered as text, with no remote avatars, images or arbitrary HTML. API limits, unavailable conversations and network errors remain visible errors rather than invented zero counts. Search indexing can delay a new submission. Visitors can still use **View all on GitHub** if the read API is unavailable.

The owner can read and reply in the repository's Issues tab, search for `Calculator feedback`, close a conversation when appropriate and use GitHub's normal moderation controls. Closed conversations remain visible with a **Closed** badge; that status does not assert a calculation was fixed. Notification delivery depends on the owner's GitHub notification settings.

No example or test comment was posted to the live repository during setup. Test fixtures remain local. The four numerical calculator scripts and their input/output fields are not changed by the feedback feature.

## General website feedback on Contact

The Contact page includes an expanded **Comments & suggestions** section below the existing contact panel, with a jump link beside the contact options. Its `website-general` scope uses a **Website feedback** title and is kept separate from the 14 calculator discussions. It uses the same review-and-submit process, public GitHub read API and moderation flow. The Contact page remains available in the visual editor’s Page menu; its heading, introductory copy and layout can be edited there. Private inquiries can still use the existing email link.
