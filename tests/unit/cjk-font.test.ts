// The pixel CJK face (PLAN-EXPERIENCE §5.5): which characters a page's subset holds, the
// @font-face each Chinese page inlines, and the subset itself — a valid font, renamed so no
// modified file carries Fusion Pixel's reserved names (SIL OFL §3).
import { describe, expect, it } from 'vitest';
import { decompress } from 'wawoff2';
import {
  CJK_FONTS,
  CJK_UNICODE_RANGE,
  cjkChars,
  cjkFontFace,
  cjkFontPlaceholder,
} from '../../src/i18n/cjk-font';
import { readNames, renameFont, tableChecksum } from '../../src/i18n/font-names';
import { subsetFor } from '../../src/integrations/cjk-fonts';

describe('the characters a subset holds', () => {
  it('CJK ideographs and full-width punctuation of the page, once each, in code-point order', () => {
    expect(cjkChars('<p lang="zh">你好，世界！你好 Peter ★ → 2027年</p>')).toBe('世你好年界！，');
    expect(cjkChars('English only — “quotes” ★')).toBe('');
  });
  it('each Chinese page declares its own face, for CJK code points only', () => {
    const face = cjkFontFace('zh-hant', '/v2/_astro/cjk/zhic-pixel-tc.1234abcd.woff2');
    expect(face).toContain('font-family:"zhic Pixel TC"');
    expect(face).toContain('url("/v2/_astro/cjk/zhic-pixel-tc.1234abcd.woff2") format("woff2")');
    expect(face).toContain(`unicode-range:${CJK_UNICODE_RANGE}`);
    expect(face).toContain('font-weight:100 900');
    expect(face).toContain('font-display:swap');
    // The system CJK sans as its own family, regular and bold, also limited to CJK code points:
    // named directly in a stack it would also draw symbols such as → (full-width).
    expect(face).toContain('font-family:"zhic Sans HK";src:local("PingFang HK Regular")');
    expect(face).toContain('local("Microsoft JhengHei Bold")');
    expect(face.match(/unicode-range:/g)).toHaveLength(3);
    expect(cjkFontPlaceholder('zh-hans')).not.toBe(cjkFontPlaceholder('zh-hant'));
    // One cut per script, never one for both.
    expect(CJK_FONTS['zh-hans'].source).toMatch(/-sc\//);
    expect(CJK_FONTS['zh-hant'].source).toMatch(/-tc\//);
  });
});

describe('the subset font', () => {
  for (const locale of ['zh-hans', 'zh-hant'] as const) {
    it(`${locale}: a valid WOFF2, renamed, with its copyright and licence kept`, async () => {
      const woff2 = Buffer.from(await subsetFor(locale, '你好，世界。'));
      expect(woff2.subarray(0, 4).toString('latin1')).toBe('wOF2');
      expect(woff2.length).toBeLessThan(160 * 1024);
      const sfnt = Buffer.from(await decompress(woff2));
      // The whole font sums to the magic number once checkSumAdjustment is set.
      expect(tableChecksum(sfnt)).toBe(0xb1b0afba);
      const names = readNames(sfnt);
      const windows = (id: number) => names.get(`3/1/1033/${id}`);
      expect(windows(1)).toBe(CJK_FONTS[locale].family);
      expect(windows(4)).toBe(`${CJK_FONTS[locale].family} Regular`);
      for (const id of [1, 3, 4, 6, 16, 17]) expect(windows(id) ?? '').not.toMatch(/Fusion|Ark/);
      expect(windows(0)).toMatch(/TakWolf/);
      expect(windows(13)).toMatch(/SIL Open Font License/);
      expect(windows(10)).toMatch(/^Subset of Fusion Pixel .*renamed \(SIL OFL 1\.1/);
    });
  }
  it('rejects a name it cannot write to every platform', async () => {
    const sfnt = Buffer.from(await decompress(await subsetFor('zh-hans', '你')));
    expect(() => renameFont(sfnt, { 1: '像素' })).toThrow(/ASCII/);
    // A name the font lacks gets a Windows English record.
    expect(readNames(renameFont(sfnt, { 16: 'zhic Pixel' })).get('3/1/1033/16')).toBe('zhic Pixel');
  });
});

describe('font tables', () => {
  /** A one-table SFNT: `tag` holding `data`. */
  const font = (tag: string, data: Buffer) => {
    const head = Buffer.alloc(28);
    head.writeUInt32BE(0x00010000, 0);
    head.writeUInt16BE(1, 4);
    head.write(tag, 12, 'latin1');
    head.writeUInt32BE(28, 20);
    head.writeUInt32BE(data.length, 24);
    return Buffer.concat([head, data]);
  };
  it('checksums are the sum of 32-bit words, the last one zero-padded', () => {
    expect(tableChecksum(Buffer.from([0, 0, 0, 1, 0, 0, 0, 2]))).toBe(3);
    expect(tableChecksum(Buffer.from([1]))).toBe(0x01000000);
  });
  it('a font without a name table has no names and cannot be renamed', () => {
    const f = font('head', Buffer.alloc(54));
    expect(readNames(f).size).toBe(0);
    expect(() => renameFont(f, { 1: 'x' })).toThrow(/no name table/);
  });
  it('only name table format 0 is read; Macintosh records are bytes', () => {
    const v1 = Buffer.alloc(6);
    v1.writeUInt16BE(1, 0);
    expect(() => readNames(font('name', v1))).toThrow(/format 1/);
    const mac = Buffer.alloc(6 + 12 + 3);
    mac.writeUInt16BE(1, 2); // one record
    mac.writeUInt16BE(18, 4); // strings after it
    mac.writeUInt16BE(1, 6); // Macintosh
    mac.writeUInt16BE(1, 12); // name ID 1
    mac.writeUInt16BE(3, 14); // 3 bytes
    mac.write('Fus', 18, 'latin1');
    const renamed = renameFont(font('name', mac), { 1: 'zhic' });
    expect(readNames(renamed).get('1/0/0/1')).toBe('zhic');
    expect(readNames(renamed).get('3/1/1033/1')).toBe('zhic');
  });
});
