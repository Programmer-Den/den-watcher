/**
 * Draws a QR code, as the phone's app scans the hub's address from: byte mode with the error
 * correction level M (15% of it may be unreadable), version 1 to 10, so up to 213 bytes. The
 * page has no other use for QR codes, so it draws them itself rather than with a package.
 */

/** Per version from 1: the codewords in all, the error correction ones per block, the blocks. */
const VERSIONS: readonly (readonly [total: number, ecPerBlock: number, blocks: number])[] = [
  [26, 10, 1],
  [44, 16, 1],
  [70, 26, 1],
  [100, 18, 2],
  [134, 24, 2],
  [172, 16, 4],
  [196, 18, 4],
  [242, 22, 4],
  [292, 22, 5],
  [346, 26, 5],
];

/** The centres of the alignment patterns, per version from 1. */
const ALIGNMENT: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/** The bits that name the error correction level M in the format information. */
const LEVEL_M = 0b00;

/**
 * The QR code of `text`, in UTF-8, as rows of modules, true for dark ones, without the quiet zone
 * of 4 modules around it. Throws for a text too long for version 10.
 */
export function qrCode(text: string): boolean[][] {
  const data = new TextEncoder().encode(text);
  const version = VERSIONS.findIndex(
    ([total, ec, blocks], i) => 4 + countBits(i + 1) + data.length * 8 <= (total - ec * blocks) * 8,
  );
  if (version < 0) {
    throw new Error(`${data.length} bytes do not fit in a QR code of version 10`);
  }
  const code = new Matrix(version + 1);
  code.placeData(codewords(data, version + 1));
  // The mask whose code is easiest to read, as the standard rates it.
  let best: boolean[][] = [];
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const masked = code.masked(mask);
    const penalty = penaltyOf(masked);
    if (penalty < bestPenalty) {
      best = masked;
      bestPenalty = penalty;
    }
  }
  return best;
}

/** How many bits tell the length of the bytes in a version. */
function countBits(version: number): number {
  return version < 10 ? 8 : 16;
}

/** The data and error correction codewords of a version, interleaved as they are placed. */
export function codewords(data: Uint8Array, version: number): number[] {
  const [total, ecPerBlock, blockCount] = VERSIONS[version - 1];
  const dataCount = total - ecPerBlock * blockCount;
  const bits: number[] = [];
  const put = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  };
  put(0b0100, 4);
  put(data.length, countBits(version));
  data.forEach((byte) => put(byte, 8));
  put(0, Math.min(4, dataCount * 8 - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    bytes.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  for (let pad = 0xec; bytes.length < dataCount; pad ^= 0xec ^ 0x11) {
    bytes.push(pad);
  }

  // The short blocks come first; the long ones have one data codeword more.
  const shortLength = Math.floor(dataCount / blockCount);
  const longBlocks = dataCount % blockCount;
  const divisor = generator(ecPerBlock);
  const blocks: number[][] = [];
  const corrections: number[][] = [];
  for (let b = 0, at = 0; b < blockCount; b++) {
    const length = shortLength + (b >= blockCount - longBlocks ? 1 : 0);
    const block = bytes.slice(at, at + length);
    at += length;
    blocks.push(block);
    corrections.push(remainder(block, divisor));
  }
  const result: number[] = [];
  for (let i = 0; i <= shortLength; i++) {
    for (const block of blocks) {
      if (i < block.length) {
        result.push(block[i]);
      }
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const correction of corrections) {
      result.push(correction[i]);
    }
  }
  return result;
}

/** The product of two numbers in GF(256), with the QR code's polynomial 0x11d. */
function multiply(x: number, y: number): number {
  let product = 0;
  for (let i = 7; i >= 0; i--) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d);
    product ^= ((y >>> i) & 1) * x;
  }
  return product;
}

/** The Reed-Solomon generator polynomial of a degree, highest coefficient first, without the 1. */
function generator(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = multiply(result[j], root) ^ (j + 1 < degree ? result[j + 1] : 0);
    }
    root = multiply(root, 0x02);
  }
  return result;
}

/** The error correction codewords of a block: the remainder of its division by the generator. */
function remainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0);
    result.push(0);
    divisor.forEach((coefficient, i) => (result[i] ^= multiply(coefficient, factor)));
  }
  return result;
}

/** The modules of a code before it is masked, and which of them are not data. */
class Matrix {
  readonly size: number;
  private readonly dark: boolean[][];
  private readonly fixed: boolean[][];

  constructor(version: number) {
    this.size = version * 4 + 17;
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    for (let i = 0; i < this.size; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(this.size - 4, 3);
    this.finder(3, this.size - 4);
    const centres = ALIGNMENT[version - 1];
    for (const row of centres) {
      for (const column of centres) {
        // None where a finder pattern is.
        const last = centres[centres.length - 1];
        if (
          (row === 6 && column === 6) ||
          (row === 6 && column === last) ||
          (row === last && column === 6)
        ) {
          continue;
        }
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            this.set(row + dy, column + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }
    // Room for the format information, set for each mask, and the dark module beside it.
    this.format(0);
    this.set(this.size - 8, 8, true);
    if (version >= 7) {
      let bits = version;
      for (let i = 0; i < 12; i++) {
        bits = (bits << 1) ^ ((bits >>> 11) * 0x1f25);
      }
      bits = (version << 12) | bits;
      for (let i = 0; i < 18; i++) {
        const bit = ((bits >>> i) & 1) === 1;
        const a = this.size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.set(a, b, bit);
        this.set(b, a, bit);
      }
    }
  }

  private set(row: number, column: number, dark: boolean): void {
    this.dark[row][column] = dark;
    this.fixed[row][column] = true;
  }

  /** A finder pattern around a centre, with its light separator. */
  private finder(row: number, column: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const r = row + dy;
        const c = column + dx;
        if (r < 0 || r >= this.size || c < 0 || c >= this.size) {
          continue;
        }
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        this.set(r, c, distance !== 2 && distance !== 4);
      }
    }
  }

  /** Writes the format information for the level M and a mask. */
  format(mask: number, into: boolean[][] = this.dark): void {
    const value = (LEVEL_M << 3) | mask;
    let bits = value;
    for (let i = 0; i < 10; i++) {
      bits = (bits << 1) ^ ((bits >>> 9) * 0x537);
    }
    bits = ((value << 10) | bits) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    const put = (row: number, column: number, dark: boolean) => {
      into[row][column] = dark;
      this.fixed[row][column] = true;
    };
    for (let i = 0; i <= 5; i++) {
      put(i, 8, bit(i));
    }
    put(7, 8, bit(6));
    put(8, 8, bit(7));
    put(8, 7, bit(8));
    for (let i = 9; i < 15; i++) {
      put(8, 14 - i, bit(i));
    }
    for (let i = 0; i < 8; i++) {
      put(8, this.size - 1 - i, bit(i));
    }
    for (let i = 8; i < 15; i++) {
      put(this.size - 15 + i, 8, bit(i));
    }
  }

  /** Places the codewords in the zigzag of two columns, from the bottom right. */
  placeData(codewords: readonly number[]): void {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) {
        right = 5;
      }
      for (let step = 0; step < this.size; step++) {
        for (let j = 0; j < 2; j++) {
          const column = right - j;
          const upward = ((right + 1) & 2) === 0;
          const row = upward ? this.size - 1 - step : step;
          if (this.fixed[row][column]) {
            continue;
          }
          if (i < codewords.length * 8) {
            this.dark[row][column] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          }
          i++;
        }
      }
    }
  }

  /** The modules with a mask applied to the data and its format information written. */
  masked(mask: number): boolean[][] {
    const result = this.dark.map((row) => [...row]);
    for (let row = 0; row < this.size; row++) {
      for (let column = 0; column < this.size; column++) {
        if (!this.fixed[row][column] && inverts(mask, row, column)) {
          result[row][column] = !result[row][column];
        }
      }
    }
    this.format(mask, result);
    return result;
  }
}

/** Whether a mask inverts the module at a row and column. */
function inverts(mask: number, row: number, column: number): boolean {
  switch (mask) {
    case 0:
      return (row + column) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return column % 3 === 0;
    case 3:
      return (row + column) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5:
      return ((row * column) % 2) + ((row * column) % 3) === 0;
    case 6:
      return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
    default:
      return (((row + column) % 2) + ((row * column) % 3)) % 2 === 0;
  }
}

/** How hard the code is to read, by the standard's four rules; lower is better. */
function penaltyOf(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;
  const lines = [...modules, ...modules.map((_, column) => modules.map((row) => row[column]))];
  for (const line of lines) {
    // Runs of five or more modules of one colour.
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) {
        run++;
        continue;
      }
      if (run >= 5) {
        penalty += run - 2;
      }
      run = 1;
    }
    // Patterns that look like a finder pattern, with four light modules on one side.
    const padded = [false, false, false, false, ...line, false, false, false, false];
    for (let i = 0; i + 11 <= padded.length; i++) {
      const window = padded
        .slice(i, i + 11)
        .map((dark) => (dark ? 1 : 0))
        .join('');
      if (window === '10111010000' || window === '00001011101') {
        penalty += 40;
      }
    }
  }
  // Blocks of 2×2 modules of one colour.
  for (let row = 0; row + 1 < size; row++) {
    for (let column = 0; column + 1 < size; column++) {
      const dark = modules[row][column];
      if (
        modules[row][column + 1] === dark &&
        modules[row + 1][column] === dark &&
        modules[row + 1][column + 1] === dark
      ) {
        penalty += 3;
      }
    }
  }
  // How far the share of dark modules is from half.
  const darkCount = modules.flat().filter(Boolean).length;
  penalty += Math.floor(Math.abs(darkCount * 20 - size * size * 10) / (size * size)) * 10;
  return penalty;
}

/** A QR code as an SVG path of its dark modules, each a square of 1, and its size in modules. */
export function qrPath(text: string): { size: number; path: string } {
  const modules = qrCode(text);
  const path = modules
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
    .join('');
  return { size: modules.length, path };
}
