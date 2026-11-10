"use strict";

// Cardmarket serves one size of each card image, product-images.s3.cardmarket.com/<game>/<set>/<id>/<id>.jpg
// (255x361 for Magic), so the thumbnail URL is already the full-size image.
//
// What opens:
// - Card images: the product page image, the gallery view of search and singles pages, and any
//   other <img> of a product image, including ones another script adds to the page.
// - The camera icon in list views, wants lists, and the Shopping Wizard. It has no <img>; the
//   image is in its Bootstrap tooltip HTML, so a click opens that.
// Expansion symbols with a tooltip image (product page "Reprints") link to that printing, so
// they keep their normal behavior.

(() => {
  const IMAGE_HOSTS = new Set(["product-images.s3.cardmarket.com"]);
  // Bootstrap moves title to data-bs-original-title when it creates the tooltip.
  const TOOLTIP_ATTRIBUTES = ["data-bs-title", "data-bs-original-title", "data-original-title", "title"];
  const CAMERA = ".thumbnail-icon";

  function productImage(value) {
    if (!value) return null;
    try {
      const url = new URL(value, location.href);
      return url.protocol === "https:" && IMAGE_HOSTS.has(url.hostname) ? url.href : null;
    } catch {
      return null;
    }
  }

  const tooltipCache = new WeakMap();

  // Read the <img> out of the tooltip HTML in a detached document, so none of it runs or loads.
  function tooltipImage(el) {
    const values = TOOLTIP_ATTRIBUTES.map((name) => el.getAttribute(name) ?? "").join("\n");
    const cached = tooltipCache.get(el);
    if (cached?.values === values) return cached.src;
    let src = null;
    if (values.includes("<")) {
      const doc = new DOMParser().parseFromString(values, "text/html");
      for (const img of doc.querySelectorAll("img[src]")) {
        src = productImage(img.getAttribute("src"));
        if (src) break;
      }
    }
    tooltipCache.set(el, { values, src });
    return src;
  }

  // Lazy images keep a transparent placeholder in src until scrolled into view; the real URL is
  // in data-echo.
  function imageSource(img) {
    return productImage(img.currentSrc || img.src) ?? productImage(img.dataset.echo);
  }

  // The product page slideshow holds the previous and next products beside the current one,
  // clipped out of view.
  function isSlideshowNeighbor(img) {
    const slide = img.closest(".card-slideshow .slide");
    return slide !== null && slide !== slide.parentElement.children[1];
  }

  // When an image of the same card sits beside the camera icon (added by another extension or
  // script), that image is the trigger and the icon stays out of the gallery.
  function hasImageBeside(icon, src) {
    for (const img of icon.parentElement?.querySelectorAll("img") ?? []) {
      if (imageSource(img) === src) return true;
    }
    return false;
  }

  function fullSize(el) {
    return el instanceof HTMLImageElement ? imageSource(el) : tooltipImage(el);
  }

  function accepts(el) {
    if (el instanceof HTMLImageElement) {
      // The hover tooltip's own <img> repeats the card the pointer is on.
      return imageSource(el) !== null && !isSlideshowNeighbor(el) && !el.closest(".tooltip, .popover");
    }
    if (!el.matches(CAMERA) || el.closest("a[href]")) return false;
    const src = tooltipImage(el);
    return src !== null && !hasImageBeside(el, src);
  }

  (globalThis.imageLightboxSites ??= []).push({
    id: "cardmarket",
    hosts: ["www.cardmarket.com", "cardmarket.com"],
    candidates: `img, ${CAMERA}`,
    accepts,
    fullSize,
    original: fullSize,
    closeOn: [],
  });
})();
