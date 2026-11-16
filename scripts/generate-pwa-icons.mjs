import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/icons');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Minimal pure-Node PNG encoder (RGBA)
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function blendPixel(buf, idx, r, g, b, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  const inv = 1 - a;
  buf[idx] = Math.round(buf[idx] * inv + r * a);
  buf[idx + 1] = Math.round(buf[idx + 1] * inv + g * a);
  buf[idx + 2] = Math.round(buf[idx + 2] * inv + b * a);
  buf[idx + 3] = 255;
}

function drawCircle(buf, size, cx, cy, radius, rgb) {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius - 2));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius + 2));
  const minY = Math.max(0, Math.floor(cy - radius - 2));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius + 2));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius + 0.8) {
        const alpha = dist <= radius - 0.8 ? 1 : Math.max(0, (radius + 0.8 - dist) / 1.6);
        const idx = (y * size + x) * 4;
        blendPixel(buf, idx, rgb[0], rgb[1], rgb[2], alpha);
      }
    }
  }
}

function drawRoundedRect(buf, size, x0, y0, w, h, r, rgb) {
  const minX = Math.max(0, Math.floor(x0 - 2));
  const maxX = Math.min(size - 1, Math.ceil(x0 + w + 2));
  const minY = Math.max(0, Math.floor(y0 - 2));
  const maxY = Math.min(size - 1, Math.ceil(y0 + h + 2));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const cx = Math.max(x0 + r, Math.min(px, x0 + w - r));
      const cy = Math.max(y0 + r, Math.min(py, y0 + h - r));
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) - r;
      if (dist <= 0.8) {
        const alpha = dist <= -0.8 ? 1 : Math.max(0, (0.8 - dist) / 1.6);
        const idx = (y * size + x) * 4;
        blendPixel(buf, idx, rgb[0], rgb[1], rgb[2], alpha);
      }
    }
  }
}

function renderIcon(size, variant, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = hexToRgb('#0F4C45');
  const gold = hexToRgb('#F2B632');
  const sage = hexToRgb('#DCE3DE');
  const dark = hexToRgb('#14201E');
  const white = [255, 255, 255];

  // Fill background
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = bg[0];
    buf[i * 4 + 1] = bg[1];
    buf[i * 4 + 2] = bg[2];
    buf[i * 4 + 3] = 255;
  }

  // Safe zone scaling: maskable uses 68% inner scale, any uses 84%
  const scale = maskable ? 0.66 : 0.84;
  const cx = size / 2;
  const cy = size / 2;
  const unit = (size * scale) / 100;

  if (variant === 'client') {
    // Warm gold ring + cup silhouette
    drawCircle(buf, size, cx, cy, 44 * unit, gold);
    drawCircle(buf, size, cx, cy, 36 * unit, bg);
    // Coffee cup body
    drawRoundedRect(buf, size, cx - 18 * unit, cy - 12 * unit, 34 * unit, 28 * unit, 8 * unit, white);
    // Saucer
    drawRoundedRect(buf, size, cx - 23 * unit, cy + 20 * unit, 46 * unit, 6 * unit, 3 * unit, gold);
    // Handle
    drawCircle(buf, size, cx + 19 * unit, cy, 9 * unit, white);
    drawCircle(buf, size, cx + 19 * unit, cy, 4.5 * unit, bg);
  } else if (variant === 'pos') {
    // POS Terminal / Scanner gold badge
    drawRoundedRect(buf, size, cx - 42 * unit, cy - 42 * unit, 84 * unit, 84 * unit, 20 * unit, dark);
    drawRoundedRect(buf, size, cx - 28 * unit, cy - 30 * unit, 56 * unit, 34 * unit, 6 * unit, sage);
    // Gold stamp / scan bar
    drawRoundedRect(buf, size, cx - 22 * unit, cy + 12 * unit, 44 * unit, 16 * unit, 6 * unit, gold);
    drawCircle(buf, size, cx, cy - 13 * unit, 8 * unit, bg);
  } else {
    // Admin / Dashboard bars + gold crown dot
    drawRoundedRect(buf, size, cx - 42 * unit, cy - 42 * unit, 84 * unit, 84 * unit, 20 * unit, dark);
    drawRoundedRect(buf, size, cx - 24 * unit, cy + 2 * unit, 12 * unit, 24 * unit, 4 * unit, sage);
    drawRoundedRect(buf, size, cx - 6 * unit, cy - 12 * unit, 12 * unit, 38 * unit, 4 * unit, gold);
    drawRoundedRect(buf, size, cx + 12 * unit, cy - 26 * unit, 12 * unit, 52 * unit, 4 * unit, white);
  }

  return encodePNG(size, size, buf);
}

function buildSVG(variant) {
  if (variant === 'client') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0F4C45"/>
  <circle cx="64" cy="64" r="44" fill="none" stroke="#F2B632" stroke-width="6"/>
  <rect x="44" y="48" width="36" height="30" rx="8" fill="#FFFFFF"/>
  <path d="M80 54h6a7 7 0 0 1 0 14h-6" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
  <rect x="38" y="84" width="52" height="6" rx="3" fill="#F2B632"/>
</svg>`;
  }
  if (variant === 'pos') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0F4C45"/>
  <rect x="20" y="20" width="88" height="88" rx="18" fill="#14201E"/>
  <rect x="34" y="32" width="60" height="36" rx="7" fill="#DCE3DE"/>
  <circle cx="64" cy="50" r="9" fill="#0F4C45"/>
  <rect x="38" y="76" width="52" height="18" rx="6" fill="#F2B632"/>
</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0F4C45"/>
  <rect x="20" y="20" width="88" height="88" rx="18" fill="#14201E"/>
  <rect x="36" y="66" width="13" height="26" rx="4" fill="#DCE3DE"/>
  <rect x="57" y="50" width="13" height="42" rx="4" fill="#F2B632"/>
  <rect x="78" y="34" width="13" height="58" rx="4" fill="#FFFFFF"/>
</svg>`;
}

const variants = ['client', 'pos', 'admin'];
for (const variant of variants) {
  fs.writeFileSync(path.join(OUTPUT_DIR, `${variant}-icon.svg`), buildSVG(variant));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${variant}-apple-touch-icon.png`), renderIcon(180, variant, false));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${variant}-192x192.png`), renderIcon(192, variant, false));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${variant}-512x512.png`), renderIcon(512, variant, false));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${variant}-maskable-512x512.png`), renderIcon(512, variant, true));
}
console.log('Generated PNG and SVG PWA icons for client, pos, and admin in public/icons/');
