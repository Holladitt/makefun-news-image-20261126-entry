// news-image-20261126 — "Thursday 26 November 2026: the world in one image"
// One-page newspaper front page, drawn purely in code (no assets, no network).
// Node 22+ stdlib only. Deterministic: two runs produce byte-identical PNG.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// 5x7 bitmap font (uppercase + digits + punctuation). Rows are 5-bit strings.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "00100", "00000", "00000", "00000", "00100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "•": ["00000", "00000", "01100", "01100", "00000", "00000", "00000"],
  ";": ["00000", "00100", "00000", "00000", "01100", "00100", "01000"],
};

// ---------------------------------------------------------------------------
// Canvas: RGB buffer + drawing primitives
// ---------------------------------------------------------------------------
type RGB = [number, number, number];

const buf = Buffer.alloc(W * H * 3, 255); // paper white

function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) px(i, j, c);
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++)
      if (i * i + j * j <= r * r) px(cx + i, cy + j, c);
}

function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) {
      const d = Math.sqrt(i * i + j * j);
      if (d <= r && d >= r - t) px(cx + i, cy + j, c);
    }
}

// Filled triangle via scanline interpolation.
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if (ay === by) continue;
      if ((y >= Math.min(ay, by) && y < Math.max(ay, by)) || y === maxY) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const a = Math.min(...xs);
      const b = Math.max(...xs);
      for (let x = Math.ceil(a); x <= Math.floor(b); x++) px(x, y, c);
    }
  }
}

// Bresenham line with square brush of given thickness.
function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (let n = 0; n < 10000; n++) {
    rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

// Horizontal gradient band: interpolate between two colours across y range.
function vgrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
  for (let j = 0; j < h; j++) {
    const f = h <= 1 ? 0 : j / (h - 1);
    const c: RGB = [
      Math.round(top[0] + (bot[0] - top[0]) * f),
      Math.round(top[1] + (bot[1] - top[1]) * f),
      Math.round(top[2] + (bot[2] - top[2]) * f),
    ];
    rect(x, y + j, w, 1, c);
  }
}

// ---------------------------------------------------------------------------
// Text: draw string at scale; bold = draw twice with 1px x-offset.
// ---------------------------------------------------------------------------
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB, bold = false): void {
  const up = s.toUpperCase();
  for (let k = 0; k < up.length; k++) {
    const g = FONT[up[k]] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          rect(x + k * 6 * scale + col * scale, y + r * scale, scale, scale, c);
          if (bold) rect(x + k * 6 * scale + col * scale + 1, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGB, bold = false): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c, bold);
}

// Greedy word wrap into lines of at most maxChars characters.
function wrap(s: string, maxChars: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (filter 0, zlib deflate, CRC32)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const NAVY: RGB = [15, 30, 58];
const INK: RGB = [20, 20, 24];
const PAPER: RGB = [252, 250, 244];
const RED: RGB = [178, 34, 34];
const DARKRED: RGB = [122, 20, 20];
const GOLD: RGB = [198, 142, 26];
const GREY: RGB = [90, 90, 92];
const LIGHTGREY: RGB = [228, 226, 220];
const WHITE: RGB = [255, 255, 255];
const ORANGE: RGB = [232, 96, 20];
const FLAME: RGB = [255, 176, 32];
const SMOKE: RGB = [96, 96, 100];
const SKYBLUE: RGB = [46, 110, 180];
const STEEL: RGB = [120, 130, 145];

// ---------------------------------------------------------------------------
// Masthead
// ---------------------------------------------------------------------------
rect(0, 0, W, 148, NAVY);
rect(0, 148, W, 6, RED);
drawText("THURSDAY", 24, 16, 10, WHITE, true);
drawText("26 NOVEMBER 2026", 24, 96, 5, [255, 214, 120], true);
drawText("THE WORLD IN", 640, 22, 4, WHITE, true);
drawText("ONE IMAGE", 640, 56, 4, WHITE, true);
drawText("20 STORIES - CHECKED", 640, 104, 3, [255, 214, 120], true);

// ---------------------------------------------------------------------------
// Hero panels (y 166..446): illustration + caption bar
// ---------------------------------------------------------------------------
function heroFrame(x: number, label: string, color: RGB): void {
  rect(x, 166, 322, 280, NAVY);
  rect(x, 352, 322, 94, INK);
  rect(x, 166, 322, 26, color);
  drawText(label, x + 10, 173, 2, WHITE, true);
}

function heroCaption(x: number, big: string, small: string): void {
  const b = wrap(big, 16);
  drawText(b[0], x + 10, 360, 3, WHITE, true);
  if (b[1]) drawText(b[1], x + 10, 384, 3, WHITE, true);
  const s = wrap(small, 24);
  drawText(s[0], x + 10, 410, 2, [200, 200, 200]);
  if (s[1]) drawText(s[1], x + 10, 428, 2, [200, 200, 200]);
}

// --- Hero 1: Cairo fuel-tanker fire ---------------------------------------
const HX1 = 16;
heroFrame(HX1, "CAIRO - EGYPT", RED);
// dusk sky
vgrad(HX1, 192, 322, 130, [64, 32, 40], [232, 120, 40]);
rect(HX1, 322, 322, 30, [32, 32, 36]); // road
// smoke clouds
circle(HX1 + 70, 226, 26, SMOKE);
circle(HX1 + 100, 208, 32, [110, 110, 114]);
circle(HX1 + 135, 224, 24, SMOKE);
circle(HX1 + 240, 216, 22, SMOKE);
circle(HX1 + 262, 200, 26, [110, 110, 114]);
// flames
tri(HX1 + 40, 322, HX1 + 80, 232, HX1 + 120, 322, ORANGE);
tri(HX1 + 90, 322, HX1 + 140, 222, HX1 + 190, 322, ORANGE);
tri(HX1 + 170, 322, HX1 + 215, 240, HX1 + 260, 322, ORANGE);
tri(HX1 + 70, 322, HX1 + 95, 268, HX1 + 120, 322, FLAME);
tri(HX1 + 130, 322, HX1 + 155, 258, HX1 + 180, 322, FLAME);
tri(HX1 + 200, 322, HX1 + 222, 272, HX1 + 244, 322, FLAME);
// tanker truck silhouette in front of flames
rect(HX1 + 96, 296, 130, 22, [24, 24, 28]);
circle(HX1 + 116, 318, 9, [16, 16, 18]);
circle(HX1 + 206, 318, 9, [16, 16, 18]);
rect(HX1 + 226, 286, 34, 32, [24, 24, 28]); // cab
rect(HX1 + 232, 292, 20, 10, [150, 190, 220]); // cab window
heroCaption(HX1, "AT LEAST 30 KILLED IN CAIRO", "FUEL TANKER FIRE ON MOTORWAY");

// --- Hero 2: Ras Tanura refinery, Brent tops $94 --------------------------
const HX2 = 351;
heroFrame(HX2, "RAS TANURA - SAUDI ARABIA", GOLD);
// pale sky + sun
vgrad(HX2, 192, 322, 130, [214, 226, 238], [246, 236, 214]);
circle(HX2 + 262, 232, 20, [240, 190, 60]);
// refinery towers
rect(HX2 + 30, 252, 26, 70, STEEL);
rect(HX2 + 64, 232, 22, 90, [90, 100, 115]);
rect(HX2 + 94, 262, 30, 60, STEEL);
rect(HX2 + 132, 222, 18, 100, [90, 100, 115]);
rect(HX2 + 158, 256, 34, 66, STEEL);
tri(HX2 + 64, 232, HX2 + 75, 210, HX2 + 86, 232, [90, 100, 115]);
tri(HX2 + 132, 222, HX2 + 141, 202, HX2 + 150, 222, [90, 100, 115]);
// spherical storage tank
circle(HX2 + 236, 296, 28, [160, 168, 178]);
rect(HX2 + 222, 322, 6, 0, [160, 168, 178]);
// flare flame + pipes
tri(HX2 + 158, 256, HX2 + 172, 224, HX2 + 186, 256, ORANGE);
tri(HX2 + 164, 256, HX2 + 172, 236, HX2 + 180, 256, FLAME);
rect(HX2 + 20, 318, 282, 4, [70, 78, 90]);
rect(HX2, 322, 322, 30, [40, 48, 58]); // ground
heroCaption(HX2, "BRENT TOPS $94", "HOUTHIS CLAIM STRIKES ON SAUDI REFINERY");

// --- Hero 3: Tiangong — first foreign astronaut ---------------------------
const HX3 = 686;
heroFrame(HX3, "TIANGONG - ORBIT", SKYBLUE);
// space
vgrad(HX3, 192, 322, 130, [8, 12, 34], [22, 44, 92]);
// stars
const stars: [number, number][] = [
  [20, 210], [60, 240], [110, 204], [150, 226], [200, 206],
  [250, 236], [290, 212], [40, 270], [180, 262], [300, 260],
  [90, 288], [230, 292], [140, 300], [20, 306], [280, 300],
];
for (const [sx, sy] of stars) rect(HX3 + sx, sy, 3, 3, WHITE);
// Earth horizon band at bottom of the space panel
rect(HX3, 322, 322, 30, [28, 90, 180]);
rect(HX3, 322, 322, 6, [120, 190, 240]);
// station: core module + solar panels
rect(HX3 + 96, 246, 130, 26, [200, 205, 212]);
rect(HX3 + 96, 246, 130, 6, [160, 165, 175]);
circle(HX3 + 232, 259, 13, [180, 185, 192]);
rect(HX3 + 30, 252, 58, 14, [36, 84, 160]);
rect(HX3 + 234, 252, 58, 14, [36, 84, 160]);
line(HX3 + 44, 252, HX3 + 44, 266, 2, [120, 170, 230]);
line(HX3 + 58, 252, HX3 + 58, 266, 2, [120, 170, 230]);
line(HX3 + 72, 252, HX3 + 72, 266, 2, [120, 170, 230]);
line(HX3 + 248, 252, HX3 + 248, 266, 2, [120, 170, 230]);
line(HX3 + 262, 252, HX3 + 262, 266, 2, [120, 170, 230]);
line(HX3 + 276, 252, HX3 + 276, 266, 2, [120, 170, 230]);
// astronaut (white suit, tethered)
circle(HX3 + 161, 296, 8, WHITE);
rect(HX3 + 152, 302, 18, 20, WHITE);
line(HX3 + 161, 304, HX3 + 176, 288, 2, WHITE);
line(HX3 + 161, 304, HX3 + 146, 288, 2, WHITE);
line(HX3 + 156, 320, HX3 + 150, 332, 3, WHITE);
line(HX3 + 166, 320, HX3 + 172, 332, 3, WHITE);
line(HX3 + 161, 306, HX3 + 200, 268, 1, [200, 200, 200]);
heroCaption(HX3, "FIRST FOREIGN ASTRONAUT", "PAKISTAN'S ZEESHAN ALI REACHES TIANGONG");

// ---------------------------------------------------------------------------
// Story grid (y 462..986): two columns, grouped sections
// ---------------------------------------------------------------------------
const GRID_TOP = 462;
const COL_W = 482;

interface Story {
  section: string;
  text: string;
}

const LEFT: Story[] = [
  { section: "CONFLICT", text: "TWO OIL TANKERS HIT SEA MINES IN STRAIT OF HORMUZ" },
  { section: "", text: "ISRAEL STRIKES HAMAS OFFICIAL IN GAZA AS CEASEFIRE WOBBLES" },
  { section: "", text: "UKRAINE HITS RUSSIAN REFINERY; PUTIN VOWS REVENGE" },
  { section: "", text: "RUSSIA'S OWN DATA: NEARLY 500,000 KILLED IN UKRAINE WAR" },
  { section: "SPORT", text: "WORLD CHESS GAME 2: GUKESH-SINDAROV DRAW IN 20 MOVES" },
  { section: "", text: "SOORYAVANSHI, 15, SMASHES FASTEST LIST A DOUBLE CENTURY" },
  { section: "SPACE", text: "BEPICOLOMBO REACHES MERCURY AFTER EIGHT-YEAR VOYAGE" },
];

const RIGHT: Story[] = [
  { section: "MARKETS", text: "NASDAQ FALLS SHARPLY AS AI STOCKS SLIDE; NVIDIA DOWN 5%" },
  { section: "", text: "TRUMP UNVEILS NEW TARIFFS ON JAPAN, CHINA AND EU" },
  { section: "", text: "BANGLADESH RAISES GARMENT WAGE 36%; HASINA TO RETURN 16 DEC" },
  { section: "", text: "IPL 2027 AUCTION: 1,220 PLAYERS REGISTER" },
  { section: "", text: "FLIPKART CEO KALYAN KRISHNAMURTHY TO STEP DOWN IN DECEMBER" },
  { section: "WORLD", text: "NORTH KOREA ORDERS SWITZERLAND TO SHUT PYONGYANG OFFICE" },
  { section: "", text: "INDIA MARKS CONSTITUTION DAY AND 18 YEARS SINCE 26/11" },
  { section: "", text: "DURAN DURAN GUITARIST ANDY TAYLOR DIES AGED 65" },
  { section: "", text: "COLOMBIA POLICE FREE 20 HOSTAGES AFTER 17-HOUR STANDOFF" },
  { section: "", text: "SOLOMON ISLANDS AND AUSTRALIA SIGN LANDMARK SECURITY PACT" },
];

const SECTION_COLORS: Record<string, RGB> = {
  CONFLICT: RED,
  SPORT: [22, 110, 60],
  SPACE: SKYBLUE,
  MARKETS: GOLD,
  WORLD: NAVY,
};

function drawColumn(x: number, stories: Story[]): void {
  let y = GRID_TOP;
  for (const s of stories) {
    if (s.section !== "") {
      rect(x, y, COL_W, 26, SECTION_COLORS[s.section]);
      drawText(s.section, x + 10, y + 6, 2, WHITE, true);
      y += 34;
    }
    const lines = wrap(s.text, 40);
    for (let i = 0; i < lines.length; i++) {
      drawText(lines[i], x + 2, y + i * 18, 2, INK, true);
    }
    y += lines.length * 18 + 10;
    rect(x, y - 4, COL_W, 1, LIGHTGREY);
  }
}

drawColumn(16, LEFT);
drawColumn(526, RIGHT);

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
rect(0, 992, W, 2, RED);
drawText(
  "SOURCES: THE HINDU - INVESTOPEDIA - SIMPLELIFE.NEWS",
  16,
  1002,
  2,
  GREY,
);
drawText("20 STORIES - CHECKED", 700, 1002, 2, GREY, true);

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const png = encodePNG();
writeFileSync("/output/entry.png", png);
