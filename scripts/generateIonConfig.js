import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(rootDirectory, "packages/sandcastle/public/ion-config.js");
const token = process.env.CESIUM_ION_TOKEN ?? "";
const tiandituToken = process.env.TIANDITU_TOKEN ?? "";

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `// Generated; do not commit.\nwindow.CESIUM_ION_TOKEN = ${JSON.stringify(token)};\nwindow.TIANDITU_TOKEN = ${JSON.stringify(tiandituToken)};\n`,
);

console.log(
  token || tiandituToken
    ? "Generated Cesium ion and TianDiTu runtime configuration."
    : "Generated empty runtime configuration; set CESIUM_ION_TOKEN and/or TIANDITU_TOKEN to enable protected services.",
);
