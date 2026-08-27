# Deploying Sandcastle to Vercel

This repository is configured to deploy the static Sandcastle application from
`Build/Sandcastle2`. The Vercel build runs the Cesium release build first and
then bundles Sandcastle, the gallery, sample data, workers, and runtime assets
into the same output directory.

The build generates TypeScript definitions and the API reference documentation
under `/docs/` as part of the clean checkout build, then intentionally skips
semantic embeddings so the deployment stays deterministic and does not download
a machine-learning model during CI. Gallery keyword search remains available;
semantic search is disabled for this build.

From the repository root:

```sh
npx vercel --prod
```

Before deploying, configure the Cesium ion token in the Vercel project. The
build reads `CESIUM_ION_TOKEN` and `TIANDITU_TOKEN` and generates an ignored runtime config file;
the token is not stored in the repository:

```sh
npx vercel env add CESIUM_ION_TOKEN production
npx vercel env add CESIUM_ION_TOKEN preview
npx vercel env add CESIUM_ION_TOKEN development
npx vercel env add TIANDITU_TOKEN production
npx vercel env add TIANDITU_TOKEN preview
npx vercel env add TIANDITU_TOKEN development
```

For local Sandcastle builds, create `.env.local` from `.env.example`, then
export the value before building (or source it with your preferred dotenv
tool):

```sh
export CESIUM_ION_TOKEN="<your Cesium ion token>"
export TIANDITU_TOKEN="<your TianDiTu token>"
node scripts/generateIonConfig.js
npm run build-sandcastle -- --no-embeddings
```

`packages/sandcastle/public/ion-config.js` is generated and ignored. If the
tokens are absent, protected-service examples should show the normal
unauthorized/missing-token behavior rather than embedding fallback tokens.

For a personal site, add the resulting Vercel project domain under a path such
as `/cesium` in the site's navigation, or point a subdomain such as
`cesium.example.com` at the Vercel project.
