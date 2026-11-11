/**
 * Renaming a font (SIL OFL §3): Fusion Pixel's licence reserves the names "Fusion Pixel" and
 * "Ark Pixel", so the subsets this site serves — Modified Versions — must not carry them. This
 * rewrites the `name` table of an SFNT (TrueType) font: the given name IDs get new strings, every
 * other record (copyright, licence text and URL, version) is kept, and the table checksums and
 * `head.checkSumAdjustment` are recomputed. Node only (Buffer); build-time.
 */

/** Name IDs: 1 family, 3 unique ID, 4 full name, 6 PostScript name, 10 description, 16/17 typographic. */
export type NameIds = Partial<Record<1 | 3 | 4 | 6 | 10 | 16 | 17, string>>;

interface TableRecord {
  tag: string;
  data: Buffer;
}

function readTables(font: Buffer): { version: number; tables: TableRecord[] } {
  const version = font.readUInt32BE(0);
  const count = font.readUInt16BE(4);
  const tables: TableRecord[] = [];
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    const tag = font.toString('latin1', at, at + 4);
    const offset = font.readUInt32BE(at + 8);
    const length = font.readUInt32BE(at + 12);
    tables.push({ tag, data: font.subarray(offset, offset + length) });
  }
  return { version, tables };
}

/** The OpenType table checksum: the sum of its big-endian 32-bit words, zero-padded. */
export function tableChecksum(data: Buffer): number {
  let sum = 0;
  const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
}

interface NameRecord {
  platform: number;
  encoding: number;
  language: number;
  id: number;
  bytes: Buffer;
}

const utf16be = (s: string) => Buffer.from(s, 'utf16le').swap16();
const fromUtf16be = (b: Buffer) => Buffer.from(b).swap16().toString('utf16le');

/** The strings of a font's `name` table, keyed `platform/encoding/language/id`. */
export function readNames(font: Buffer): Map<string, string> {
  const name = readTables(font).tables.find((t) => t.tag === 'name');
  const out = new Map<string, string>();
  for (const r of parseName(name?.data ?? Buffer.alloc(6))) {
    const text = r.platform === 1 ? r.bytes.toString('latin1') : fromUtf16be(r.bytes);
    out.set(`${r.platform}/${r.encoding}/${r.language}/${r.id}`, text);
  }
  return out;
}

function parseName(data: Buffer): NameRecord[] {
  const format = data.readUInt16BE(0);
  if (format !== 0) throw new Error(`name table format ${format} is not supported`);
  const count = data.readUInt16BE(2);
  const strings = data.readUInt16BE(4);
  const records: NameRecord[] = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12;
    const length = data.readUInt16BE(at + 8);
    const offset = data.readUInt16BE(at + 10);
    records.push({
      platform: data.readUInt16BE(at),
      encoding: data.readUInt16BE(at + 2),
      language: data.readUInt16BE(at + 4),
      id: data.readUInt16BE(at + 6),
      bytes: data.subarray(strings + offset, strings + offset + length),
    });
  }
  return records;
}

function buildName(records: NameRecord[]): Buffer {
  const sorted = [...records].sort(
    (a, b) =>
      a.platform - b.platform || a.encoding - b.encoding || a.language - b.language || a.id - b.id,
  );
  const head = Buffer.alloc(6 + sorted.length * 12);
  head.writeUInt16BE(0, 0);
  head.writeUInt16BE(sorted.length, 2);
  head.writeUInt16BE(head.length, 4);
  const strings: Buffer[] = [];
  let offset = 0;
  sorted.forEach((r, i) => {
    const at = 6 + i * 12;
    head.writeUInt16BE(r.platform, at);
    head.writeUInt16BE(r.encoding, at + 2);
    head.writeUInt16BE(r.language, at + 4);
    head.writeUInt16BE(r.id, at + 6);
    head.writeUInt16BE(r.bytes.length, at + 8);
    head.writeUInt16BE(offset, at + 10);
    strings.push(r.bytes);
    offset += r.bytes.length;
  });
  return Buffer.concat([head, ...strings]);
}

function buildFont(version: number, tables: TableRecord[]): Buffer {
  const n = tables.length;
  const pow = 2 ** Math.floor(Math.log2(n));
  const header = Buffer.alloc(12 + n * 16);
  header.writeUInt32BE(version, 0);
  header.writeUInt16BE(n, 4);
  header.writeUInt16BE(pow * 16, 6);
  header.writeUInt16BE(Math.log2(pow), 8);
  header.writeUInt16BE(n * 16 - pow * 16, 10);
  const sorted = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const bodies: Buffer[] = [];
  let offset = header.length;
  let headAt = -1;
  sorted.forEach((t, i) => {
    const data = t.tag === 'head' ? Buffer.from(t.data) : t.data;
    if (t.tag === 'head') {
      data.writeUInt32BE(0, 8); // checkSumAdjustment is computed over the font with it zeroed
      headAt = offset;
    }
    const at = 12 + i * 16;
    header.write(t.tag, at, 'latin1');
    header.writeUInt32BE(tableChecksum(data), at + 4);
    header.writeUInt32BE(offset, at + 8);
    header.writeUInt32BE(data.length, at + 12);
    const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
    bodies.push(padded);
    offset += padded.length;
  });
  const font = Buffer.concat([header, ...bodies]);
  if (headAt >= 0) font.writeUInt32BE((0xb1b0afba - tableChecksum(font)) >>> 0, headAt + 8);
  return font;
}

/**
 * The font with `names` written into its `name` table, for every platform record of those IDs
 * (and a Windows English record for an ID it lacks). Strings must be ASCII (Macintosh records).
 */
export function renameFont(font: Buffer, names: NameIds): Buffer {
  const { version, tables } = readTables(font);
  const nameTable = tables.find((t) => t.tag === 'name');
  if (!nameTable) throw new Error('the font has no name table');
  let records = parseName(nameTable.data);
  for (const [key, text] of Object.entries(names)) {
    if (!/^[\x20-\x7e]*$/.test(text)) throw new Error(`name ${key} must be printable ASCII`);
    const id = Number(key);
    const encode = (platform: number) =>
      platform === 1 ? Buffer.from(text, 'latin1') : utf16be(text);
    records = records.map((r) => (r.id === id ? { ...r, bytes: encode(r.platform) } : r));
    if (!records.some((r) => r.id === id && r.platform === 3))
      records.push({ platform: 3, encoding: 1, language: 0x409, id, bytes: encode(3) });
  }
  const renamed = tables.map((t) => (t.tag === 'name' ? { ...t, data: buildName(records) } : t));
  return buildFont(version, renamed);
}
