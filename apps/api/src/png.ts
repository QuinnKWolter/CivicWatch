import { deflateSync } from 'node:zlib';

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return out;
}

function color(hex: string) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    255
  ];
}

function rect(pixels: Buffer, width: number, x: number, y: number, w: number, h: number, rgba: number[]) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.floor(x + w));
  const y1 = Math.floor(y + h);
  for (let yy = y0; yy < y1; yy += 1) {
    if (yy < 0) continue;
    const rowStart = yy * width * 4;
    for (let xx = x0; xx < x1; xx += 1) {
      const i = rowStart + xx * 4;
      pixels[i] = rgba[0];
      pixels[i + 1] = rgba[1];
      pixels[i + 2] = rgba[2];
      pixels[i + 3] = rgba[3];
    }
  }
}

export type BarDatum = {
  label: string;
  value: number;
  color?: string;
};

export function renderBarPng(rows: BarDatum[], options: { width?: number; height?: number } = {}) {
  const width = options.width ?? 1200;
  const height = options.height ?? 720;
  const pixels = Buffer.alloc(width * height * 4);
  rect(pixels, width, 0, 0, width, height, color('#f5f1e7'));
  rect(pixels, width, 36, 36, width - 72, height - 72, color('#ffffff'));
  rect(pixels, width, 36, 36, width - 72, 1, color('#d9d2c1'));
  rect(pixels, width, 36, height - 36, width - 72, 1, color('#d9d2c1'));
  rect(pixels, width, 36, 36, 1, height - 72, color('#d9d2c1'));
  rect(pixels, width, width - 36, 36, 1, height - 72, color('#d9d2c1'));

  const usable = rows.slice(0, 16);
  const max = Math.max(...usable.map((row) => row.value), 1);
  const left = 96;
  const top = 96;
  const barGap = 14;
  const barH = Math.max(16, Math.floor((height - top - 92) / Math.max(usable.length, 1)) - barGap);
  const maxW = width - left - 150;
  usable.forEach((row, index) => {
    const y = top + index * (barH + barGap);
    const w = Math.max(2, (row.value / max) * maxW);
    rect(pixels, width, left, y, w, barH, color(row.color ?? '#8a5a1a'));
    rect(pixels, width, left, y + barH, maxW, 1, color('#d9d2c1'));
  });

  const rawRows = [];
  for (let y = 0; y < height; y += 1) {
    rawRows.push(Buffer.from([0]), pixels.subarray(y * width * 4, (y + 1) * width * 4));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from('Software\0CivicWatch local renderer', 'latin1')),
    chunk('IDAT', deflateSync(Buffer.concat(rawRows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
