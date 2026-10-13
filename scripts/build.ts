// Packs src/ into dist/github-image-lightbox.xpi (a zip with manifest.json at the root).
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const src = join(root, "src");
const out = join(root, "dist", "github-image-lightbox.xpi");

mkdirSync(join(root, "dist"), { recursive: true });
rmSync(out, { force: true });

// Windows tar (bsdtar) writes a zip with -a and a .zip name; rename after.
const zip = out.replace(/\.xpi$/, ".zip");
rmSync(zip, { force: true });
const tar = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "bsdtar";
const proc = Bun.spawnSync([tar, "-a", "-cf", zip, "-C", src, ...readdirSync(src)], { stdio: ["inherit", "inherit", "inherit"] });
if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1);
await Bun.write(out, Bun.file(zip));
rmSync(zip);
console.log(`built ${out}`);
