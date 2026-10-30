"use strict";

// GitHub wraps every image in rendered markdown (READMEs, issues, PRs, comments, gists)
// in <a target="_blank" href="...">. Only those links open in the lightbox.

(() => {
  const IMAGE_HOSTS = new Set([
    "camo.githubusercontent.com",
    "user-images.githubusercontent.com",
    "private-user-images.githubusercontent.com",
    "raw.githubusercontent.com",
    "media.githubusercontent.com",
    "objects.githubusercontent.com",
  ]);
  const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i;
  const MARKDOWN = ".markdown-body";

  // Badges link to CI pages, docs, and so on. Only links that point at the image itself count.
  function linksToImage(a, img) {
    let url;
    try {
      url = new URL(a.href);
    } catch {
      return false;
    }
    if (a.href === img.src || a.href === img.currentSrc) return true;
    if (IMAGE_HOSTS.has(url.hostname)) return true;
    if (url.hostname === "github.com" && url.pathname.startsWith("/user-attachments/assets/")) return true;
    return IMAGE_EXT.test(url.pathname);
  }

  function imageLink(img) {
    if (img.matches(".emoji, .avatar, .avatar-user")) return null;
    const a = img.closest("a[href]");
    if (!a || !a.closest(MARKDOWN)) return null;
    return linksToImage(a, img) ? a : null;
  }

  (globalThis.imageLightboxSites ??= []).push({
    id: "github",
    hosts: ["github.com", "gist.github.com"],
    candidates: `${MARKDOWN} a[href] img`,
    accepts: (img) => imageLink(img) !== null,
    fullSize: (img) => img.currentSrc || img.src,
    original: (img) => imageLink(img)?.href,
    // GitHub navigates with Turbo, so close on soft navigation.
    closeOn: ["turbo:visit"],
  });
})();
