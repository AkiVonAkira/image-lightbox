"use strict";

// The lightbox core. It knows nothing about any site: the adapter in src/sites/ that
// matches this hostname says which images open and which URLs to use. A plain left click
// on an accepted image shows it in an overlay instead of following its link.

(() => {
  const site = (globalThis.imageLightboxSites ?? []).find((s) => s.hosts.includes(location.hostname));
  if (!site) return;

  const FIT_GUTTER = 64; // px kept clear on each side for the bar and arrows
  const MAX_UPSCALE = 1; // open at real size, shrunk to fit; click or wheel to zoom past it
  const CLICK_ZOOM = 2.5; // click zooms to this multiple of the fitted size (at least 1:1)
  const WHEEL_STEP = 1.2;
  const DRAG_SLOP = 4;

  const ICON = {
    close: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>',
    prev: '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  let overlay = null;
  let big = null;
  let gallery = [];
  let index = 0;
  let savedOverflow = "";
  let scale = 1;
  let fitScale = 1;
  let drag = null;
  let suppressClick = false;

  function collectGallery() {
    return [...document.querySelectorAll(site.candidates)].filter(
      (img) => site.accepts(img) && img.getClientRects().length > 0,
    );
  }

  function isOpen() {
    return overlay?.classList.contains("gil-open-state");
  }

  function buildOverlay() {
    const root = document.createElement("div");
    root.className = "gil-backdrop";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Image preview");
    root.innerHTML = `
      <img class="gil-image" alt="" draggable="false">
      <div class="gil-bar">
        <span class="gil-pill gil-count"></span>
        <span class="gil-spacer"></span>
        <a class="gil-pill gil-open" target="_blank" rel="noopener noreferrer">Open original</a>
        <button class="gil-btn gil-close" type="button" aria-label="Close">${ICON.close}</button>
      </div>
      <button class="gil-btn gil-nav gil-prev" type="button" aria-label="Previous image">${ICON.prev}</button>
      <button class="gil-btn gil-nav gil-next" type="button" aria-label="Next image">${ICON.next}</button>`;

    root.addEventListener("click", (e) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const t = e.target.closest(".gil-image, .gil-prev, .gil-next, .gil-pill") ?? e.target;
      if (t.classList.contains("gil-image")) return toggleZoom(e.clientX, e.clientY);
      if (t.classList.contains("gil-prev")) return step(-1);
      if (t.classList.contains("gil-next")) return step(1);
      if (t.classList.contains("gil-pill")) return;
      close();
    });
    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("mousedown", onMouseDown);
    document.body.appendChild(root);
    big = root.querySelector(".gil-image");
    big.addEventListener("load", fit);
    return root;
  }

  function computeFit() {
    const w = big.naturalWidth || 1;
    const h = big.naturalHeight || 1;
    const room = (size) => Math.max(size - 2 * FIT_GUTTER, size / 2);
    return Math.min(room(innerWidth) / w, room(innerHeight) / h, MAX_UPSCALE);
  }

  function applyScale() {
    big.style.width = `${big.naturalWidth * scale}px`;
    big.style.height = `${big.naturalHeight * scale}px`;
    big.style.maxWidth = big.style.maxHeight = "none";
    overlay.classList.toggle("gil-zoomed", scale > fitScale * 1.001);
    overlay.classList.toggle("gil-zoomable", maxScale() > fitScale * 1.001);
  }

  function maxScale() {
    return Math.max(fitScale * 8, 4);
  }

  function fit() {
    if (!big.naturalWidth) return;
    fitScale = computeFit();
    scale = fitScale;
    applyScale();
    overlay.scrollTo(0, 0);
  }

  // Change scale while keeping the image point under (x, y) where it is.
  function zoomAt(next, x, y) {
    next = Math.min(Math.max(next, fitScale), maxScale());
    if (next === scale) return;
    const r = big.getBoundingClientRect();
    const fx = (x - r.left) / r.width;
    const fy = (y - r.top) / r.height;
    scale = next;
    applyScale();
    overlay.scrollLeft = big.offsetLeft + fx * big.offsetWidth - x;
    overlay.scrollTop = big.offsetTop + fy * big.offsetHeight - y;
  }

  function toggleZoom(x, y) {
    if (overlay.classList.contains("gil-zoomed")) zoomAt(fitScale, x, y);
    else zoomAt(Math.max(fitScale * CLICK_ZOOM, 1), x, y);
  }

  function onWheel(e) {
    e.preventDefault();
    if (!big.naturalWidth) return;
    zoomAt(scale * (e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP), e.clientX, e.clientY);
  }

  function onMouseDown(e) {
    if (e.button !== 0 || !overlay.classList.contains("gil-zoomed") || e.target !== big) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, left: overlay.scrollLeft, top: overlay.scrollTop, moved: false };
    overlay.classList.add("gil-dragging");
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
  }

  function onMouseMove(e) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    drag.moved = true;
    overlay.scrollLeft = drag.left - dx;
    overlay.scrollTop = drag.top - dy;
  }

  function onMouseUp() {
    // Swallow the click that ends a drag. Reset after it, in case the drag ended outside the window.
    if (drag.moved) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false));
    }
    drag = null;
    overlay.classList.remove("gil-dragging");
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
  }

  function show() {
    const img = gallery[index];
    overlay.classList.remove("gil-zoomed", "gil-zoomable");
    big.removeAttribute("style");
    big.src = site.fullSize(img);
    big.alt = img.alt || "";
    if (big.complete) fit();
    overlay.querySelector(".gil-open").href = site.original(img) || big.src;
    overlay.querySelector(".gil-count").textContent = `${index + 1} / ${gallery.length}`;
    overlay.classList.toggle("gil-single", gallery.length < 2);
  }

  function open(img) {
    gallery = collectGallery();
    index = gallery.indexOf(img);
    if (index < 0) {
      gallery = [img];
      index = 0;
    }
    overlay ??= buildOverlay();
    savedOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    overlay.classList.add("gil-open-state");
    show();
  }

  function close() {
    if (!isOpen()) return;
    overlay.classList.remove("gil-open-state", "gil-zoomed", "gil-zoomable");
    big.removeAttribute("src");
    big.removeAttribute("style");
    document.documentElement.style.overflow = savedOverflow;
  }

  function step(delta) {
    if (gallery.length < 2) return;
    index = (index + delta + gallery.length) % gallery.length;
    show();
  }

  window.addEventListener(
    "click",
    (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const img = e.target instanceof Element ? e.target.closest("img") : null;
      if (!img || img.classList.contains("gil-image") || !site.accepts(img)) return;
      e.preventDefault();
      e.stopPropagation();
      open(img);
    },
    true,
  );

  window.addEventListener(
    "keydown",
    (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  window.addEventListener("resize", () => {
    if (isOpen() && !overlay.classList.contains("gil-zoomed")) fit();
  });

  // Close on soft navigation. Sites with their own router name its events in closeOn.
  window.addEventListener("popstate", close);
  for (const name of site.closeOn ?? []) document.addEventListener(name, close);
})();
