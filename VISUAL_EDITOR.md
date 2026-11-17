# Edit your website visually

Open **https://varnaresh17.github.io/editor.html** on a computer.

## Edit text and photos

1. Choose a page from the **Page** menu.
2. Click text in the preview and type your change. You can also use the text box on the left.
3. Click an image, then **Choose a photo** to replace it. Add a short image description. Select **Replace matching images on all pages** if you want a shared photo to change everywhere.
4. Use the font size, colour, alignment, and formatting controls as needed.
5. Use **Undo** or **Redo** to correct a change. Switch to **Mobile** to check the smaller layout.

On the homepage, the **Section order** controls move sections up or down. The introduction stays first.

The editor previews the existing design in an isolated frame. Calculator controls are inactive in the editor; open the dedicated XRD, FTIR, Colorimetry, or PLQY tool page to run them. Descriptive text can be edited. Scientific diagram internals and calculator code remain in their original files.

## Keep a draft

Drafts save automatically in this browser. **Save draft** saves immediately. On returning, use **Restore draft**. A draft is local to the device and browser; it does not update the public website.

For a portable copy, click **Download changes**. Send that ZIP to ChatGPT and ask to publish it to your existing website. The ZIP includes only edited pages, updated publication data when relevant, and new images.

Editing existing publication titles or citation paragraphs updates both the publication HTML and the corresponding JSON record, including search text. Adding or deleting publication entries is a source update; ask for help with that so counts and categories remain consistent.

## Publish directly (optional)

The editor runs on GitHub Pages, so it cannot reuse the GitHub connection in ChatGPT. To publish directly:

1. Click **Connect publishing**.
2. Follow the link to create a **fine-grained personal access token** under the **varnaresh17** account.
3. Choose **Only select repositories → varnaresh17.github.io**.
4. Give **Contents: Read and write** permission and choose an expiry date.
5. Generate the token, then paste it into the editor's password field. Do not paste it into chat.
6. Click **Connect securely**, then **Publish**. Review the changed filenames and confirm **Publish changes**.

The token is held in that tab's memory only. It is sent exclusively to `https://api.github.com`, never saved in drafts, exported files, or the repository. Closing the tab or clicking **Disconnect** removes the editor's connection. GitHub remains responsible for checking the token's permissions and repository ownership.

Each publication creates one commit in the existing repository, preserving unrelated files. The editor checks that the pages have not changed on GitHub since you opened them. If another update would conflict, it keeps your draft and stops instead of overwriting it. GitHub Pages normally takes a short time to publish the commit; the status bar reports its progress.

Anyone can open the editor and experiment with a local draft, but only the repository owner's authorized key can publish a change.

GitHub's token documentation: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

## For maintainers

- `editor.html`, `editor.css`, `editor.js`: the editor interface and local draft handling.
- `editor-bridge.js`: the isolated, script-restricted page preview.
- `editor-core.js`: ZIP export, Git baseline checks, and atomic publication.
- Run `node --test tests/editor-core.test.cjs` for the publication and archive checks.

The live scientific calculator files are not modified by the editor implementation.
