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

For a personal site, add the resulting Vercel project domain under a path such
as `/cesium` in the site's navigation, or point a subdomain such as
`cesium.example.com` at the Vercel project.
