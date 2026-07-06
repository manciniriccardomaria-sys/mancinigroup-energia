import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outDir = join(process.cwd(), "out");

await writeFile(join(outDir, ".nojekyll"), "", "utf8");
await writeFile(join(outDir, "CNAME"), "energia.mancinigroup.org\n", "utf8");
await copyFile(join(outDir, "index.html"), join(outDir, "404.html"));

console.log("GitHub Pages artifact pronto in out/");
