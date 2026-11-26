import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { seoDocuments } from '../src/shared/seo/files.mjs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('src/assets/favicon.svg', 'dist/favicon.svg');
cpSync('src/assets/og-image.png', 'dist/og-image.png');
const origin = (process.env.PUBLIC_SITE_URL || 'https://torphel-tony-portfolio.vercel.app').replace(
  /\/$/,
  '',
);
const siteKey = process.env.RECAPTCHA_SITE_KEY || '';
let html = readFileSync('src/index.html', 'utf8')
  .replaceAll('__SITE_ORIGIN__', origin)
  .replaceAll('__RECAPTCHA_SITE_KEY__', siteKey);
if (!siteKey)
  html = html
    .replace(
      '<div class="g-recaptcha" data-sitekey=""></div>',
      '<p class="captcha-unconfigured">The form is being connected. Please email me directly for now.</p>',
    )
    .replace(
      '    <script src="https://www.google.com/recaptcha/api.js" async defer></script>\n',
      '',
    );
writeFileSync('dist/index.html', html);
writeFileSync(
  'dist/styles.css',
  [
    'src/shared/styles/base.css',
    'src/shared/styles/responsive.css',
    'src/features/scene-3d/work.css',
    'src/features/contact-form/contact.css',
  ]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n'),
);
for (const [name, contents] of Object.entries(seoDocuments(origin)))
  writeFileSync(`dist/${name}`, contents);
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/script.js',
  bundle: true,
  minify: true,
  target: 'es2022',
  platform: 'browser',
});
for (const [entry, output] of [
  ['src/features/contact-form/vercel-contact.ts', 'api/contact.js'],
  ['src/features/whatsapp/vercel-whatsapp.ts', 'api/whatsapp.js'],
  ['src/features/contact-form/netlify-contact.ts', 'netlify/functions/contact.js'],
  ['src/features/whatsapp/netlify-whatsapp.ts', 'netlify/functions/whatsapp.js'],
]) {
  await build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
  });
}
rmSync('build', { recursive: true, force: true });
mkdirSync('build', { recursive: true });
cpSync('dist', 'build', { recursive: true });
console.log('Built dist/ and deployment build/.');
