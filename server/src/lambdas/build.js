import { build } from "esbuild";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  const options = {
    bundle: true,
    platform: "node",
    target: "node20",
    outdir: resolve(__dirname, "../../dist/lambdas"),
    minify: true,
    sourcemap: true,
    external: ["pg-native", "@aws-sdk/*", "tslib"], // AWS SDK is provided by Lambda environment
  };

  await build({
    ...options,
    entryPoints: [resolve(__dirname, "weekly-summary.ts")],
  });

  await build({
    ...options,
    entryPoints: [resolve(__dirname, "debt-reminders.ts")],
  });

  console.log("Lambdas built successfully.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
