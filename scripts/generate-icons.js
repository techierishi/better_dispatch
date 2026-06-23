import { writeFileSync, mkdirSync } from 'fs';
import { deflateRawSync } from 'zlib';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '..', 'icons');
mkdirSync(iconsDir, { recursive: true });

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcB]);
}

function createPNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const cx = size / 2, cy = size / 2, r = size * 0.4;
  const raw = [];

  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        const bolt = (x >= cx - size * 0.06 && x <= cx + size * 0.06 && y >= cy - r * 0.6 && y <= cy + r * 0.6) ||
                     (x >= cx - size * 0.2 && x <= cx + size * 0.06 && y >= cy - r * 0.6 && y <= cy - r * 0.1) ||
                     (x >= cx - size * 0.06 && x <= cx + size * 0.2 && y >= cy + r * 0.1 && y <= cy + r * 0.6);
        if (bolt) {
          raw.push(0xFF, 0xFF, 0xFF);
        } else {
          const shade = 1 - (dist / r) * 0.3;
          raw.push(0x23, Math.round(0x86 * shade), Math.round(0x36 * shade));
        }
      } else {
        raw.push(0x0D, 0x11, 0x17);
      }
    }
  }

  const rawBuf = Buffer.from(raw);
  const compressed = deflateRawSync(rawBuf, { level: 9 });

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

for (const size of [16, 48, 128]) {
  const png = createPNG(size);
  writeFileSync(resolve(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
}
