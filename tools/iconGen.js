/**
 * iconGen.js — erzeugt die App-Icons ohne Bildbibliothek.
 * Schreibt echte PNG-Dateien (Header, IDAT via zlib, CRC32).
 * iOS braucht für "Zum Home-Bildschirm" ein PNG; SVG reicht nicht.
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(width, height, pixelFn) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // Bittiefe
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/**
 * Motiv: dunkelgrüner Grund, darauf eine Einkaufsliste als
 * abstrahierte Zeilen mit einem Häkchen in Limette.
 * Bewusst geometrisch statt verspielt -- auf 60 px muss es lesbar sein.
 */
function icon(x, y, w, h) {
  const FOREST = [18, 53, 42, 255];
  const LIME = [201, 241, 105, 255];
  const PALE = [140, 168, 150, 255];

  const u = w / 100;           // Einheit in Prozent der Breite
  const px = x / u, py = y / u; // Koordinaten in Prozent

  // Häkchen (groß, links unten bis rechts oben)
  const onCheck = (() => {
    // Strecke 1: von (26,52) nach (43,68)
    const d1 = distToSegment(px, py, 26, 52, 43, 68);
    // Strecke 2: von (43,68) nach (74,30)
    const d2 = distToSegment(px, py, 43, 68, 74, 30);
    return Math.min(d1, d2) < 6.5;
  })();
  if (onCheck) return LIME;

  // Drei Listenzeilen oben rechts, angedeutet
  const lines = [[52, 26, 78], [52, 36, 72], [52, 46, 66]];
  for (const [x1, yy, x2] of lines) {
    if (py > yy - 2.2 && py < yy + 2.2 && px > x1 && px < x2) {
      if (!onCheck) return PALE;
    }
  }

  return FOREST;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

const OUT = path.join(__dirname, "ios");
fs.mkdirSync(OUT, { recursive: true });

[180, 192, 512].forEach((size) => {
  const buf = png(size, size, icon);
  fs.writeFileSync(path.join(OUT, `icon-${size}.png`), buf);
  console.log(`icon-${size}.png  ${Math.round(buf.length / 1024)} KB`);
});

// Startbild-Hintergrund für den Splash (einfarbig)
const splash = png(64, 64, () => [18, 53, 42, 255]);
fs.writeFileSync(path.join(OUT, "splash.png"), splash);
console.log("splash.png erzeugt");
