// Build-time dev dependencies without type declarations (src/integrations/cjk-fonts.ts).
declare module 'subset-font' {
  interface Options {
    targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype';
    preserveNameIds?: number[];
    noHinting?: boolean;
  }
  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: Options,
  ): Promise<Buffer>;
}
declare module 'wawoff2' {
  export function compress(sfnt: Uint8Array): Promise<Uint8Array>;
  export function decompress(woff2: Uint8Array): Promise<Uint8Array>;
}
