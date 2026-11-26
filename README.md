# Torphel Tony — 3D Portfolio

An accessible, scroll-driven portfolio with a three-step discovery form. The 3D scene is a lightweight procedural canvas, with a reduced-motion fallback. Source lives in `src/`; `npm run build` typechecks strict TypeScript and produces `dist/` plus the hosting copy in `build/`.

## Develop and verify

```sh
npm ci
npm run build
npm run lint:html
```

Serve `build/` with a local static server to inspect the page. The form and WhatsApp redirect require Vercel or Netlify Functions, so a static file server cannot deliver submissions.

The project keeps `.deployment/hosting.json` for the separate Sites deployment. Vercel and Netlify use their root configuration files. Edit `src/index.html`, `src/features/`, and `src/shared/styles/`; generated `dist/` files should be rebuilt, not hand edited.

## Connect Google Sheets, email, and reCAPTCHA

1. Create a Google Sheet for leads. Copy its spreadsheet ID from the URL. **Do not add it to the repository.**
2. Register a [reCAPTCHA v2 checkbox](https://www.google.com/recaptcha/admin/create) for each live domain (including the Vercel or Netlify preview domain if testing there). Keep the secret key private. The site key is public.
3. In that Sheet, open **Extensions → Apps Script**, paste [`google-apps-script/Code.gs`](google-apps-script/Code.gs), and set three **Script Properties** under Project Settings: `SHEET_ID`, `RECAPTCHA_SECRET`, and a long random `WEBHOOK_KEY` (for example, generate one with a password manager). The script creates the column headings on first submission.
4. Deploy the script as a **Web app**, execute as **Me**, with access **Anyone**. Authorize its Sheets, external request, and Mail permissions. Copy the `/exec` web app URL. The webhook key restricts requests; do not publish it.
5. In Vercel or Netlify project environment variables set:

   | Variable | Value |
   | --- | --- |
   | `PUBLIC_SITE_URL` | Canonical HTTPS site origin, without trailing slash |
   | `RECAPTCHA_SITE_KEY` | Public v2 site key |
   | `APPS_SCRIPT_WEB_APP_URL` | Apps Script `/exec` URL |
   | `APPS_SCRIPT_WEBHOOK_KEY` | Same value as Script Property `WEBHOOK_KEY` |
   | `WHATSAPP_NUMBER` | Confirmed number in international digits only (no `+` or spaces) |

6. Redeploy so the public site key is baked into `dist/index.html`. Submit a test lead, then confirm **both** a new Sheet row and an email at `torpheltony06@gmail.com`. Also test the WhatsApp button. A new Apps Script deployment/version may be needed after editing `Code.gs`.

Without the site key, the page explains that the form is being connected and offers direct email. The backend refuses submission without valid reCAPTCHA and Apps Script configuration. Never put the reCAPTCHA secret, webhook key, or WhatsApp number in client HTML or JavaScript. The WhatsApp redirect keeps the number out of page source and DOM; its destination is still visible when a visitor follows the link.

## Deployment and implementation notes

- `vercel.json` and `netlify.toml` publish `build/`. Vercel's root `api/` and Netlify's `netlify/functions/` provide `/api/contact` and `/api/whatsapp`. Those JavaScript functions are bundled from TypeScript in `src/` during the build and committed so Vercel can package them without unresolved imports.
- The server validates fields, timing, honeypot, payload size, and forwards to Apps Script. Apps Script verifies reCAPTCHA, rate limits by email, escapes notification HTML, protects Sheets from formula injection, appends the lead, and emails Torphel Tony with `replyTo` set to the submitter.
- Chapter 3's disappearing scene was caused by the work section's almost opaque background painting over the fixed canvas. The work section now has a translucent gradient, so the canvas remains visible while its scroll animation continues. There is no Three.js camera or GSAP timeline in this implementation.
- Breakpoints: mobile below 640px, tablet 640–1024px, desktop from 1025px. The form stacks on mobile and splits into form/sidebar on desktop. `prefers-reduced-motion` reveals content without animation.
- The canonical URL, social image, robots file, and sitemap derive from `PUBLIC_SITE_URL`. If the final domain differs, set it before production build.
