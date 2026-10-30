// Builds dist/extension/ (load it unpacked) and dist/image-lightbox.xpi (a zip of it).
// manifest.json gets its content_scripts from the adapters in src/sites/: every adapter
// file loads before lightbox.js, and the matches are each adapter's hosts.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Site = { id: string; hosts: string[] };

const root = resolve(import.meta.dir, "..");
const src = join(root, "src");
const dist = join(root, "dist");
const ext = join(dist, "extension");
const out = join(dist, "image-lightbox.xpi");

const siteFiles = readdirSync(join(src, "sites")).filter((f) => f.endsWith(".js")).sort();
const sites = (globalThis as { imageLightboxSites?: Site[] }).imageLightboxSites = [] as Site[];
for (const f of siteFiles) {
  const before = sites.length;
  await import(join(src, "sites", f));
  if (sites.length !== before + 1) throw new Error(`sites/${f} must register exactly one adapter`);
}
const matches = [...new Set(sites.flatMap((s) => s.hosts.map((h) => `https://${h}/*`)))];

const manifest = await Bun.file(join(src, "manifest.json")).json();
manifest.content_scripts = [
  {
    matches,
    js: [...siteFiles.map((f) => `sites/${f}`), "lightbox.js"],
    css: ["lightbox.css"],
    run_at: "document_start",
  },
];

rmSync(ext, { recursive: true, force: true });
mkdirSync(ext, { recursive: true });
cpSync(src, ext, { recursive: true });
writeFileSync(join(ext, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// Windows tar (bsdtar) writes a zip with -a and a .zip name; rename after.
rmSync(out, { force: true });
const zip = out.replace(/\.xpi$/, ".zip");
rmSync(zip, { force: true });
const tar = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "bsdtar";
const proc = Bun.spawnSync([tar, "-a", "-cf", zip, "-C", ext, ...readdirSync(ext)], { stdio: ["inherit", "inherit", "inherit"] });
if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1);
await Bun.write(out, Bun.file(zip));
rmSync(zip);
console.log(`built ${out} (sites: ${sites.map((s) => s.id).join(", ")})`);
