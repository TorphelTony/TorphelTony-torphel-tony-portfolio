# Torphel Tony — Portfolio

A responsive, static portfolio for Torphel Tony, built from the supplied résumé. It uses plain HTML, CSS, and JavaScript, so there are no runtime dependencies.

## Run locally

Open `dist/index.html` in a browser, or serve the `dist` directory with a static server.

## Deploy to Vercel or Netlify

Import this repository in either service. The deployment settings are supplied in `vercel.json` and `netlify.toml`. Both run `npm run build` and publish the generated `build` directory. No environment variables are required.

`deployment/hosting.json` records the separate ChatGPT Sites deployment. Vercel and Netlify use `vercel.json` and `netlify.toml` at the repository root.

## Edit content

Update copy and links in `dist/index.html`, visual styles in `dist/styles.css`, and navigation behavior in `dist/script.js`. The private information from the résumé (date of birth and passport number) is deliberately omitted.
