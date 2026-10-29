// Copies manifest/options page into dist and draws the toolbar icons (no image deps).
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

cpSync('public', 'dist', { recursive: true });
mkdirSync('dist/icons', { recursive: true });

for (const size of [16, 32, 48, 128]) writeFileSync(`dist/icons/${size}.png`, icon(size));
console.log('extension: copied public/ and wrote icons → dist/');

/** Purple rounded square with a white four-point sparkle. */
function icon(n) {
  const px = Buffer.alloc(n * n * 4);
  const r = n * 0.22, c = (n - 1) / 2;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const dx = Math.max(Math.abs(x - c) - (c - r), 0), dy = Math.max(Math.abs(y - c) - (c - r), 0);
      const inside = Math.hypot(dx, dy) <= r;
      if (!inside) continue;
      const ax = Math.abs(x - c) / (n * 0.36), ay = Math.abs(y - c) / (n * 0.36);
      const spark = Math.sqrt(ax) + Math.sqrt(ay) <= 1;
      const [R, G, B] = spark ? [255, 255, 255] : [124, 92, 255];
      px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = 255;
    }
  const raw = Buffer.alloc((n * 4 + 1) * n);
  for (let y = 0; y < n; y++) px.copy(raw, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
