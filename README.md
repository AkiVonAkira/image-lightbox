# GitHub Image Lightbox

A Firefox/Zen extension. Clicking an image in a GitHub README, issue, PR, or comment opens it in an overlay on the same page instead of a new tab.

- Images fill the screen, growing small ones up to 2x.
- Click the image to zoom in at that point, and click again to fit. The mouse wheel zooms around the cursor, and you drag to pan.
- `←` / `→` step through the other images on the page.
- `Esc`, the ✕, or a click on the backdrop closes it.
- Ctrl/Shift/middle-click still open the link as usual. "Open original" opens it in a new tab.
- Linked badges (for example a CI badge that links to Actions) keep their normal link.

## Build

```sh
bun scripts/build.ts   # writes dist/github-image-lightbox.xpi
```

## Install in Zen

Zen is built without mandatory add-on signing, so an unsigned build stays installed after a restart.

1. Set `xpinstall.signatures.required` to `false` in `about:config` (or `user_pref("xpinstall.signatures.required", false);` in the profile's `user.js`).
2. Open `dist/github-image-lightbox.xpi` in Zen (drag it into a window, or use about:addons → gear → Install Add-on From File) and click **Add**.

To update, bump `version` in `src/manifest.json`, rebuild, and install the new `.xpi` over the old one.

For quick iteration, `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `src/manifest.json`.
