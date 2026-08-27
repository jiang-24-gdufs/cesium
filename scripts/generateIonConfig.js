import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(rootDirectory, "packages/sandcastle/public/ion-config.js");
const token = process.env.CESIUM_ION_TOKEN ?? "";

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `// Generated; do not commit.\nwindow.CESIUM_ION_TOKEN = ${JSON.stringify(token)};\n`,
);

console.log(
  token
    ? "Generated Cesium ion runtime configuration."
    : "Generated empty Cesium ion runtime configuration; set CESIUM_ION_TOKEN to enable ion content.",
);
