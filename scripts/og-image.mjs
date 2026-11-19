/**
 * Renders public/og.png, the 1200x630 card shown when the site is shared in WhatsApp,
 * Slack, Teams, Discord or X. Run with the local image tool:
 *   node scripts/og-image.mjs
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('../.tooling/imgtool/node_modules/sharp');

const W = 1200;
const H = 630;

/** A tangled glomerular tuft, drawn the same way as in the app. */
function tuft(cx, cy, r) {
  const loop = (lobes, radius, amp, rotDeg) => {
    const pts = [];
    const rot = (rotDeg * Math.PI) / 180;
    for (let i = 0; i < 84; i++) {
      const th = (i / 84) * Math.PI * 2;
      const rr = radius * (1 + amp * Math.cos(lobes * th));
      pts.push(`${i ? 'L' : 'M'}${(cx + Math.cos(th + rot) * rr).toFixed(1)},${(cy + Math.sin(th + rot) * rr * 0.92).toFixed(1)}`);
    }
    return pts.join(' ') + ' Z';
  };
  const a = loop(3, r * 0.74, 0.34, -18);
  const b = loop(4, r * 0.56, 0.4, 36);
  return `
    <path d="${a}" fill="none" stroke="#aa625c" stroke-width="20" stroke-linejoin="round" />
    <path d="${a}" fill="none" stroke="#df968b" stroke-width="13" stroke-linejoin="round" />
    <path d="${b}" fill="none" stroke="#aa625c" stroke-width="16" stroke-linejoin="round" />
    <path d="${b}" fill="none" stroke="#df968b" stroke-width="10" stroke-linejoin="round" />`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7f9fd"/>
      <stop offset="1" stop-color="#e8edf6"/>
    </linearGradient>
    <linearGradient id="aff" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c74453"/><stop offset="1" stop-color="#92202f"/>
    </linearGradient>
    <linearGradient id="eff" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4a307d"/><stop offset="1" stop-color="#7461b4"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1010" cy="300" r="250" fill="#dbe6f7" opacity="0.5"/>

  <!-- nephron vignette -->
  <g transform="translate(60 0)">
    <circle cx="950" cy="300" r="132" fill="#fdf6e3" stroke="#e8c06a" stroke-width="26"/>
    ${tuft(950, 300, 110)}
    <path d="M 700 232 C 790 196 880 212 916 252" fill="none" stroke="url(#aff)" stroke-width="30" stroke-linecap="round"/>
    <path d="M 984 252 C 1020 206 1100 196 1170 228" fill="none" stroke="url(#eff)" stroke-width="24" stroke-linecap="round"/>
    <path d="M 905 412 C 860 470 960 500 940 560" fill="none" stroke="#e2bf6c" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <text x="80" y="188" font-family="Helvetica, Arial, sans-serif" font-size="78" font-weight="700" fill="#0f172a">Nephron Lab</text>
  <text x="80" y="252" font-family="Helvetica, Arial, sans-serif" font-size="35" fill="#334155">Interactive renal physiology simulator</text>

  <g font-family="Helvetica, Arial, sans-serif" font-size="27" fill="#475569">
    <text x="80" y="330">Adjust pressure, volume, hormones and drugs</text>
    <text x="80" y="378">Watch GFR, eGFR, creatinine, urea and urine respond</text>
    <text x="80" y="426">Prerenal AKI · ACEi in renal artery stenosis · triple whammy</text>
  </g>

  <rect x="80" y="476" width="430" height="46" rx="23" fill="#fde9c8"/>
  <text x="102" y="506" font-family="Helvetica, Arial, sans-serif" font-size="23" fill="#7c4a0a">Teaching model — not for clinical use</text>

  <text x="80" y="580" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#64748b">nephron-lab.vercel.app</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync('public/og.png', png);
const { width, height, size } = await sharp(png).metadata();
console.log(`public/og.png — ${width}x${height}, ${Math.round(size / 1024)} KB`);

/* ---- favicons and app icons, from the same kidney glyph as the in-app logo ---- */
const icon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#2563eb"/>
  </linearGradient></defs>
  <rect width="40" height="40" rx="9" fill="url(#g)"/>
  <path d="M15 10c-5 0-7 5-7 10s2 10 7 10c3 0 4-2.4 3.4-4.6-.5-1.8-2.4-2.6-2.4-5.4s1.9-3.6 2.4-5.4C19 12.4 18 10 15 10z" fill="#fff"/>
  <path d="M25 10c5 0 7 5 7 10s-2 10-7 10c-3 0-4-2.4-3.4-4.6.5-1.8 2.4-2.6 2.4-5.4s-1.9-3.6-2.4-5.4C21 12.4 22 10 25 10z" fill="#fff" opacity=".85"/>
</svg>`;

writeFileSync('public/favicon.svg', icon(40));
for (const [name, size] of [['favicon-32.png', 32], ['favicon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon-512.png', 512]]) {
  writeFileSync(`public/${name}`, await sharp(Buffer.from(icon(size))).png().toBuffer());
}
writeFileSync('public/favicon.ico', await sharp(Buffer.from(icon(32))).resize(32, 32).png().toBuffer());

writeFileSync(
  'public/site.webmanifest',
  JSON.stringify(
    {
      name: 'Nephron Lab — Interactive Renal Physiology Simulator',
      short_name: 'Nephron Lab',
      description: 'Interactive teaching model of kidney filtration for medical students.',
      start_url: '/',
      display: 'standalone',
      background_color: '#eef1f7',
      theme_color: '#eef1f7',
      icons: [
        { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/favicon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    null,
    2,
  ),
);
console.log('icons + manifest written');
