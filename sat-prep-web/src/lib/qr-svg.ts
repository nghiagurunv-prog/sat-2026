/**
 * NATIVE ISO/IEC 18004 QR CODE SVG GENERATOR (Mục #20 — 0 dependency ngoài).
 * - Sinh mã QR Byte-Mode (Error Correction Level L, Version 1–6 tự động theo độ dài URL).
 * - Loại bỏ 100% phụ thuộc `api.qrserver.com` (không rò rỉ share-code ra third-party, hoạt động cả offline).
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(ecLen: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < ecLen; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEc(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const msg = new Uint8Array(data.length + ecLen);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// Bảng cấu hình QR Level L (Single-block EC, Version 1..6: đủ chứa tới 134 bytes URL)
interface QrVersionSpec {
  ver: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  align: number[];
}

const SPECS_L: QrVersionSpec[] = [
  { ver: 1, size: 21, dataCodewords: 19, ecCodewords: 7, align: [] },
  { ver: 2, size: 25, dataCodewords: 34, ecCodewords: 10, align: [6, 18] },
  { ver: 3, size: 29, dataCodewords: 55, ecCodewords: 15, align: [6, 22] },
  { ver: 4, size: 33, dataCodewords: 80, ecCodewords: 20, align: [6, 26] },
  { ver: 5, size: 37, dataCodewords: 108, ecCodewords: 26, align: [6, 30] },
  { ver: 6, size: 41, dataCodewords: 136, ecCodewords: 36, align: [6, 34] },
];

function computeFormatBits(ecLevelBits: number, mask: number): number {
  const data = (ecLevelBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const spec = SPECS_L.find((s) => bytes.length + 2 <= s.dataCodewords) ?? SPECS_L[SPECS_L.length - 1];
  const clampedBytes = bytes.slice(0, spec.dataCodewords - 2);

  // Bit buffer: Mode Byte (0100) + 8-bit length + bytes + terminator + padding
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4);
  pushBits(clampedBytes.length, 8);
  for (const b of clampedBytes) pushBits(b, 8);

  const maxDataBits = spec.dataCodewords * 8;
  const termLen = Math.min(4, maxDataBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCw = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | bits[i * 8 + b];
    dataCw[i] = v;
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  for (let i = bits.length / 8; i < spec.dataCodewords; i++) {
    dataCw[i] = padBytes[padIdx++ % 2];
  }

  // Version 6 (Level L) dùng 2 blocks × 68 data + 18 EC; Version 1..5 dùng 1 block
  let allCodewords: Uint8Array;
  if (spec.ver === 6) {
    const b1 = dataCw.slice(0, 68);
    const b2 = dataCw.slice(68, 136);
    const ec1 = rsComputeEc(b1, 18);
    const ec2 = rsComputeEc(b2, 18);
    allCodewords = new Uint8Array(172);
    let p = 0;
    for (let i = 0; i < 68; i++) {
      allCodewords[p++] = b1[i];
      allCodewords[p++] = b2[i];
    }
    for (let i = 0; i < 18; i++) {
      allCodewords[p++] = ec1[i];
      allCodewords[p++] = ec2[i];
    }
  } else {
    const ec = rsComputeEc(dataCw, spec.ecCodewords);
    allCodewords = new Uint8Array(dataCw.length + ec.length);
    allCodewords.set(dataCw);
    allCodewords.set(ec, dataCw.length);
  }

  const n = spec.size;
  const mod: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  const isFunc: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    mod[r][c] = dark;
    isFunc[r][c] = true;
  };

  // Finder patterns (3 góc)
  const drawFinder = (tr: number, tc: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = tr + dr;
        const c = tc + dc;
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        setFunc(r, c, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, n - 7);
  drawFinder(n - 7, 0);

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  for (const ar of spec.align) {
    for (const ac of spec.align) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === n - 7) || (ar === n - 7 && ac === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(ar + dr, ac + dc, dist !== 1);
        }
      }
    }
  }

  // Reserve format info chuẩn ISO/IEC 18004 (MSB-first: bit 14 -> bit 0) + Dark Module (n-8, 8)
  const mask = 0; // (r + c) % 2 === 0
  const fmtBits = computeFormatBits(0b01, mask); // EC Level L = 01 -> 0x77C4 (15 bits, MSB=bit14, LSB=bit0)
  const fmtBit = (posFromMsb: number) => ((fmtBits >> (14 - posFromMsb)) & 1) === 1;

  // Bản sao 1 (quanh Top-Left Finder): ngang (8,0..5),(8,7),(8,8) = bits 14..7; dọc (7,8),(5..0,8) = bits 6..0
  for (let i = 0; i <= 5; i++) setFunc(8, i, fmtBit(i));
  setFunc(8, 7, fmtBit(6));
  setFunc(8, 8, fmtBit(7));
  setFunc(7, 8, fmtBit(8));
  for (let i = 0; i <= 5; i++) setFunc(5 - i, 8, fmtBit(9 + i));

  // Bản sao 2: dọc dưới trái (n-1..n-7, 8) = bits 14..8; Dark Module (n-8, 8) = true; ngang trên phải (8, n-8..n-1) = bits 7..0
  for (let i = 0; i <= 6; i++) setFunc(n - 1 - i, 8, fmtBit(i));
  setFunc(n - 8, 8, true);
  for (let i = 0; i <= 7; i++) setFunc(8, n - 8 + i, fmtBit(7 + i));

  // Place data bits zig-zag + apply mask 0
  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? n - 1 - vert : vert;
        if (!isFunc[y][x]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((allCodewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          if ((y + x) % 2 === 0) dark = !dark;
          mod[y][x] = dark;
        }
      }
    }
  }

  return mod;
}

export function qrMatrixToSvgPath(matrix: boolean[][], quietZone = 4): { viewBox: number; path: string } {
  const n = matrix.length;
  const parts: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        parts.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`);
      }
    }
  }
  return { viewBox: n + quietZone * 2, path: parts.join('') };
}
