import { qrCode, qrPath } from './qr-code';

/** The code as rows of # for dark modules and . for light ones. */
function rows(modules: boolean[][]): string[] {
  return modules.map((row) => row.map((dark) => (dark ? '#' : '.')).join(''));
}

describe('qrCode', () => {
  it('draws the code of an address as a reference encoder does', () => {
    // Made by the QR code encoder of Kazuhiko Arase (MIT) for the level M and mask 5, which this
    // text scores best with.
    expect(rows(qrCode('http://192.168.1.20:9393/'))).toEqual([
      '#######....###..#.#######',
      '#.....#.####.#....#.....#',
      '#.###.#.#..##...#.#.###.#',
      '#.###.#.##..#####.#.###.#',
      '#.###.#...###.#...#.###.#',
      '#.....#..##.#...#.#.....#',
      '#######.#.#.#.#.#.#######',
      '........##..#............',
      '#.....#.###..#.####..###.',
      '#.#..#...#####.###..####.',
      '..#.#.#####..#.#..##.#.##',
      '#....#.#...#...##...##..#',
      '#..####..#..#.#.###.....#',
      '#.#.##.###...###.......#.',
      '#.#.#.#..#.##..#.#.#.#.##',
      '#.#.#..#.#.#....#...#.#.#',
      '#..#.#####.###..#####.#..',
      '........#...#.###...#.#..',
      '#######...##..#.#.#.##..#',
      '#.....#..###..#.#...#..##',
      '#.###.#..#####.########..',
      '#.###.#..#####....##.#.##',
      '#.###.#..#.......#....#.#',
      '#.....#..#.##.###.###...#',
      '#######.##.#..###.#..#..#',
    ]);
  });

  it('takes the smallest version the text fits in, up to version 10', () => {
    // Version 1 holds 14 bytes at the level M, version 2 holds 26 and version 10 holds 213.
    expect(qrCode('x'.repeat(14)).length).toBe(21);
    expect(qrCode('x'.repeat(15)).length).toBe(25);
    expect(qrCode('x'.repeat(213)).length).toBe(57);
    expect(() => qrCode('x'.repeat(214))).toThrowError(/do not fit/);
  });

  it('has the finder patterns in three corners', () => {
    const code = rows(qrCode('http://den-watcher.local:9393/'));
    const finder = ['#######', '#.....#', '#.###.#', '#.###.#', '#.###.#', '#.....#', '#######'];
    const size = code.length;
    expect(code.slice(0, 7).map((row) => row.slice(0, 7))).toEqual(finder);
    expect(code.slice(0, 7).map((row) => row.slice(size - 7))).toEqual(finder);
    expect(code.slice(size - 7).map((row) => row.slice(0, 7))).toEqual(finder);
  });
});

describe('qrPath', () => {
  it('draws a square for every dark module', () => {
    const { size, path } = qrPath('a');
    expect(size).toBe(21);
    const dark = qrCode('a').flat().filter(Boolean).length;
    expect(path.match(/M/g)?.length).toBe(dark);
    expect(path.startsWith('M0 0h1v1h-1z')).toBe(true);
  });
});
