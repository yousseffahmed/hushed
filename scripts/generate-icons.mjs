import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const icons = [
  { size: 192, path: "public/icons/icon-192.png" },
  { size: 512, path: "public/icons/icon-512.png" },
  { size: 180, path: "public/apple-touch-icon.png" }
];

mkdirSync("public/icons", { recursive: true });

for (const icon of icons) {
  writeFileSync(icon.path, createIconPng(icon.size));
}

function createIconPng(size) {
  const bytesPerPixel = 4;
  const stride = size * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 0;

    for (let x = 0; x < size; x += 1) {
      const index = row + 1 + x * bytesPerPixel;
      const topMix = y / Math.max(1, size - 1);
      const sideGlow = 1 - distance(x, y, size * 0.2, size * 0.18) / size;
      const base = mixColor([255, 247, 244], [255, 211, 220], topMix * 0.85);
      const glow = mixColor(base, [255, 232, 236], clamp(sideGlow, 0, 0.45));

      raw[index] = glow[0];
      raw[index + 1] = glow[1];
      raw[index + 2] = glow[2];
      raw[index + 3] = 255;
    }
  }

  drawHeart(raw, size);

  return Buffer.concat([
    pngSignature(),
    chunk("IHDR", ihdr(size, size)),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function drawHeart(raw, size) {
  const cx = size / 2;
  const cy = size * 0.5;
  const scale = size / 30;
  const textColor = [111, 29, 59, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const hx = (x - cx) / scale;
      const hy = (cy - y) / scale;
      const value = (hx * hx + hy * hy - 1) ** 3 - hx * hx * hy ** 3;

      if (value <= 0 && y > size * 0.22 && y < size * 0.77) {
        setPixel(raw, size, x, y, textColor);
      }
    }
  }

  drawInitial(raw, size, "y", textColor);
}

function drawInitial(raw, size, letter, color) {
  const font = {
    y: [
      "10001",
      "10001",
      "01010",
      "00100",
      "00100",
      "00100",
      "00100"
    ]
  }[letter];
  const block = Math.floor(size / 28);
  const width = font[0].length * block;
  const height = font.length * block;
  const startX = Math.floor((size - width) / 2);
  const startY = Math.floor(size * 0.42 - height / 2);

  for (let row = 0; row < font.length; row += 1) {
    for (let col = 0; col < font[row].length; col += 1) {
      if (font[row][col] !== "1") {
        continue;
      }

      for (let y = 0; y < block; y += 1) {
        for (let x = 0; x < block; x += 1) {
          setPixel(raw, size, startX + col * block + x, startY + row * block + y, [255, 247, 244, 255]);
        }
      }
    }
  }
}

function setPixel(raw, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }

  const index = y * (size * 4 + 1) + 1 + x * 4;
  raw[index] = color[0];
  raw[index + 1] = color[1];
  raw[index + 2] = color[2];
  raw[index + 3] = color[3];
}

function pngSignature() {
  return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
}

function ihdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc(buffer) {
  let value = 0xffffffff;

  for (const byte of buffer) {
    value ^= byte;

    for (let index = 0; index < 8; index += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
  }

  return (value ^ 0xffffffff) >>> 0;
}

function mixColor(first, second, amount) {
  return first.map((channel, index) =>
    Math.round(channel + (second[index] - channel) * clamp(amount, 0, 1))
  );
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
