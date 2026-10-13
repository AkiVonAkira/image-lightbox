"use strict";

// GitHub wraps every image in rendered markdown in <a target="_blank" href="...">.
// Intercept a plain left click on those and show the image in an overlay instead.

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

let overlay = null;
let gallery = [];
let index = 0;
let savedOverflow = "";

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
  const a = img.closest("a[href]");
  if (!a || !a.closest(MARKDOWN)) return null;
  return linksToImage(a, img) ? a : null;
}

function collectGallery() {
  return [...document.querySelectorAll(`${MARKDOWN} a[href] img`)].filter(
    (img) => imageLink(img) && img.getClientRects().length > 0,
  );
}

function buildOverlay() {
  const root = document.createElement("div");
  root.className = "gil-backdrop";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Image preview");
  root.innerHTML = `
    <img class="gil-image" alt="">
    <div class="gil-bar">
      <span class="gil-count"></span>
      <a class="gil-open" target="_blank" rel="noopener noreferrer">Open original</a>
      <button class="gil-close" type="button" aria-label="Close">✕</button>
    </div>
    <button class="gil-nav gil-prev" type="button" aria-label="Previous image">‹</button>
    <button class="gil-nav gil-next" type="button" aria-label="Next image">›</button>`;

  root.addEventListener("click", (e) => {
    const t = e.target;
    if (t.classList.contains("gil-image")) return toggleZoom();
    if (t.classList.contains("gil-prev")) return step(-1);
    if (t.classList.contains("gil-next")) return step(1);
    if (t.classList.contains("gil-open")) return;
    close();
  });
  document.body.appendChild(root);
  return root;
}

function show() {
  const img = gallery[index];
  const big = overlay.querySelector(".gil-image");
  overlay.classList.remove("gil-zoomed");
  big.src = img.currentSrc || img.src;
  big.alt = img.alt || "";
  overlay.querySelector(".gil-open").href = imageLink(img)?.href || big.src;
  overlay.querySelector(".gil-count").textContent = gallery.length > 1 ? `${index + 1} / ${gallery.length}` : "";
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
  show();
  savedOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  overlay.classList.add("gil-open-state");
  overlay.scrollTo(0, 0);
}

function close() {
  if (!overlay?.classList.contains("gil-open-state")) return;
  overlay.classList.remove("gil-open-state", "gil-zoomed");
  overlay.querySelector(".gil-image").removeAttribute("src");
  document.documentElement.style.overflow = savedOverflow;
}

function step(delta) {
  if (gallery.length < 2) return;
  index = (index + delta + gallery.length) % gallery.length;
  show();
}

// Zoom to natural size only when the fitted image is scaled down.
function toggleZoom() {
  const big = overlay.querySelector(".gil-image");
  const zoomed = overlay.classList.contains("gil-zoomed");
  if (!zoomed && big.naturalWidth <= big.clientWidth && big.naturalHeight <= big.clientHeight) return;
  overlay.classList.toggle("gil-zoomed");
}

window.addEventListener(
  "click",
  (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const img = e.target instanceof Element ? e.target.closest("img") : null;
    if (!img || img.classList.contains("gil-image") || !imageLink(img)) return;
    e.preventDefault();
    e.stopPropagation();
    open(img);
  },
  true,
);

window.addEventListener(
  "keydown",
  (e) => {
    if (!overlay?.classList.contains("gil-open-state")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  },
  true,
);

// GitHub navigates with Turbo, so close the overlay on soft navigation.
document.addEventListener("turbo:visit", close);
window.addEventListener("popstate", close);
