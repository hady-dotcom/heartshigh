import { readFileSync } from 'node:fs'
import path from 'node:path'
import { deflateSync } from 'node:zlib'

/**
 * Just enough TrueType to embed Noto Sans in a PDF: the character map, the widths, and a subset that keeps only
 * the glyphs a document uses. Glyph ids stay as they are (unused glyphs are emptied), so the PDF can use
 * Identity-H with CIDToGIDMap /Identity and no cmap of its own.
 */
export class TrueTypeFont {
  readonly unitsPerEm: number
  readonly numGlyphs: number
  readonly ascent: number
  readonly descent: number
  readonly capHeight: number
  readonly bbox: [number, number, number, number]
  readonly italicAngle: number
  private readonly tables = new Map<string, { offset: number; length: number }>()
  private readonly advances: number[] = []
  private readonly glyphs = new Map<number, number>()
  private readonly loca: number[] = []

  constructor(private readonly data: Buffer, readonly postscriptName: string) {
    const count = data.readUInt16BE(4)
    for (let index = 0; index < count; index++) {
      const at = 12 + index * 16
      this.tables.set(data.toString('latin1', at, at + 4), { offset: data.readUInt32BE(at + 8), length: data.readUInt32BE(at + 12) })
    }
    const head = this.table('head')
    this.unitsPerEm = data.readUInt16BE(head + 18)
    this.bbox = [data.readInt16BE(head + 36), data.readInt16BE(head + 38), data.readInt16BE(head + 40), data.readInt16BE(head + 42)].map((value) => this.scale(value)) as [number, number, number, number]
    const longLoca = data.readInt16BE(head + 50) === 1
    this.numGlyphs = data.readUInt16BE(this.table('maxp') + 4)
    const hhea = this.table('hhea')
    this.ascent = this.scale(data.readInt16BE(hhea + 4))
    this.descent = this.scale(data.readInt16BE(hhea + 6))
    const metrics = data.readUInt16BE(hhea + 34)
    const hmtx = this.table('hmtx')
    for (let gid = 0; gid < this.numGlyphs; gid++) this.advances.push(data.readUInt16BE(hmtx + Math.min(gid, metrics - 1) * 4))
    const os2 = this.tables.get('OS/2')
    this.capHeight = os2 && data.readUInt16BE(os2.offset) >= 2 ? this.scale(data.readInt16BE(os2.offset + 88)) : this.ascent
    const post = this.tables.get('post')
    this.italicAngle = post ? data.readInt32BE(post.offset + 4) / 65536 : 0
    const loca = this.table('loca')
    for (let gid = 0; gid <= this.numGlyphs; gid++) this.loca.push(longLoca ? data.readUInt32BE(loca + gid * 4) : data.readUInt16BE(loca + gid * 2) * 2)
    this.readCmap()
  }

  private table(tag: string) {
    const found = this.tables.get(tag)
    if (!found) throw new Error(`The font has no ${tag} table.`)
    return found.offset
  }

  private scale(value: number) {
    return Math.round((value * 1000) / this.unitsPerEm)
  }

  private readCmap() {
    const cmap = this.table('cmap')
    const count = this.data.readUInt16BE(cmap + 2)
    const subtables: { platform: number; encoding: number; offset: number }[] = []
    for (let index = 0; index < count; index++) {
      const at = cmap + 4 + index * 8
      subtables.push({ platform: this.data.readUInt16BE(at), encoding: this.data.readUInt16BE(at + 2), offset: cmap + this.data.readUInt32BE(at + 4) })
    }
    const pick = (platform: number, encoding: number) => subtables.find((row) => row.platform === platform && row.encoding === encoding)
    const chosen = pick(3, 10) || pick(0, 4) || pick(3, 1) || pick(0, 3) || subtables[0]
    if (!chosen) return
    const at = chosen.offset
    const format = this.data.readUInt16BE(at)
    if (format === 12) {
      const groups = this.data.readUInt32BE(at + 12)
      for (let index = 0; index < groups; index++) {
        const row = at + 16 + index * 12
        const start = this.data.readUInt32BE(row)
        const end = this.data.readUInt32BE(row + 4)
        const first = this.data.readUInt32BE(row + 8)
        for (let code = start; code <= end; code++) this.glyphs.set(code, first + code - start)
      }
    } else if (format === 4) {
      const segments = this.data.readUInt16BE(at + 6) / 2
      const ends = at + 14
      const starts = ends + segments * 2 + 2
      const deltas = starts + segments * 2
      const ranges = deltas + segments * 2
      for (let segment = 0; segment < segments; segment++) {
        const end = this.data.readUInt16BE(ends + segment * 2)
        const start = this.data.readUInt16BE(starts + segment * 2)
        const delta = this.data.readInt16BE(deltas + segment * 2)
        const rangeAt = ranges + segment * 2
        const range = this.data.readUInt16BE(rangeAt)
        for (let code = start; code <= end && code !== 0xffff; code++) {
          let gid: number
          if (!range) gid = (code + delta) & 0xffff
          else {
            const raw = this.data.readUInt16BE(rangeAt + range + (code - start) * 2)
            gid = raw ? (raw + delta) & 0xffff : 0
          }
          if (gid) this.glyphs.set(code, gid)
        }
      }
    }
  }

  glyphOf(codePoint: number) {
    return this.glyphs.get(codePoint) || 0
  }

  /** Advance width in PDF text space units (thousandths of the font size). */
  widthOf(gid: number) {
    return this.scale(this.advances[gid] ?? this.advances[0] ?? 0)
  }

  private componentsOf(gid: number) {
    const start = this.table('glyf') + this.loca[gid]
    const end = this.table('glyf') + this.loca[gid + 1]
    if (end - start < 10 || this.data.readInt16BE(start) >= 0) return []
    const out: number[] = []
    let at = start + 10
    for (;;) {
      const flags = this.data.readUInt16BE(at)
      out.push(this.data.readUInt16BE(at + 2))
      at += 4 + (flags & 0x0001 ? 4 : 2)
      if (flags & 0x0008) at += 2
      else if (flags & 0x0040) at += 4
      else if (flags & 0x0080) at += 8
      if (!(flags & 0x0020)) break
    }
    return out
  }

  /** A font file holding only `used` (and the glyphs they are built from), deflated for a FontFile2 stream. */
  subset(used: Iterable<number>) {
    const keep = new Set<number>([0])
    const queue = [...used]
    while (queue.length) {
      const gid = queue.pop()!
      if (keep.has(gid) || gid >= this.numGlyphs) continue
      keep.add(gid)
      queue.push(...this.componentsOf(gid))
    }
    const glyf = this.table('glyf')
    const parts: Buffer[] = []
    const loca = Buffer.alloc((this.numGlyphs + 1) * 4)
    let offset = 0
    for (let gid = 0; gid < this.numGlyphs; gid++) {
      loca.writeUInt32BE(offset, gid * 4)
      if (!keep.has(gid)) continue
      const bytes = this.data.subarray(glyf + this.loca[gid], glyf + this.loca[gid + 1])
      const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4)
      bytes.copy(padded)
      parts.push(padded)
      offset += padded.length
    }
    loca.writeUInt32BE(offset, this.numGlyphs * 4)
    const head = Buffer.from(this.raw('head'))
    head.writeUInt32BE(0, 8)
    head.writeInt16BE(1, 50)
    const tables: [string, Buffer][] = [['head', head], ['hhea', this.raw('hhea')], ['maxp', this.raw('maxp')], ['hmtx', this.raw('hmtx')], ['loca', loca], ['glyf', Buffer.concat(parts)]]
    for (const tag of ['cvt ', 'fpgm', 'prep']) if (this.tables.has(tag)) tables.push([tag, this.raw(tag)])
    const file = writeSfnt(tables)
    const adjust = (0xb1b0afba - checksum(file)) >>> 0
    file.writeUInt32BE(adjust, sfntTableOffset(file, 'head') + 8)
    return { raw: file.length, deflated: deflateSync(file) }
  }

  private raw(tag: string) {
    const found = this.tables.get(tag)!
    return this.data.subarray(found.offset, found.offset + found.length)
  }
}

function checksum(buffer: Buffer) {
  let sum = 0
  const padded = buffer.length % 4 ? Buffer.concat([buffer, Buffer.alloc(4 - (buffer.length % 4))]) : buffer
  for (let at = 0; at < padded.length; at += 4) sum = (sum + padded.readUInt32BE(at)) >>> 0
  return sum
}

function writeSfnt(tables: [string, Buffer][]) {
  const sorted = [...tables].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const power = 2 ** Math.floor(Math.log2(sorted.length))
  const header = Buffer.alloc(12 + sorted.length * 16)
  header.writeUInt32BE(0x00010000, 0)
  header.writeUInt16BE(sorted.length, 4)
  header.writeUInt16BE(power * 16, 6)
  header.writeUInt16BE(Math.log2(power), 8)
  header.writeUInt16BE(sorted.length * 16 - power * 16, 10)
  let offset = header.length
  const bodies: Buffer[] = []
  sorted.forEach(([tag, data], index) => {
    const at = 12 + index * 16
    header.write(tag, at, 4, 'latin1')
    header.writeUInt32BE(checksum(data), at + 4)
    header.writeUInt32BE(offset, at + 8)
    header.writeUInt32BE(data.length, at + 12)
    const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4)
    data.copy(padded)
    bodies.push(padded)
    offset += padded.length
  })
  return Buffer.concat([header, ...bodies])
}

function sfntTableOffset(file: Buffer, tag: string) {
  const count = file.readUInt16BE(4)
  for (let index = 0; index < count; index++) {
    const at = 12 + index * 16
    if (file.toString('latin1', at, at + 4) === tag) return file.readUInt32BE(at + 8)
  }
  throw new Error(`No ${tag} table.`)
}

export type PdfFontFace = 'regular' | 'bold' | 'italic'

const FILES: Record<PdfFontFace, [string, string]> = {
  regular: ['NotoSans-Regular.ttf', 'NotoSans-Regular'],
  bold: ['NotoSans-Bold.ttf', 'NotoSans-Bold'],
  italic: ['NotoSans-Italic.ttf', 'NotoSans-Italic'],
}

const loaded = new Map<PdfFontFace, TrueTypeFont>()

export function notoSans(face: PdfFontFace, root = process.cwd()) {
  let font = loaded.get(face)
  if (!font) {
    const [file, name] = FILES[face]
    font = new TrueTypeFont(readFileSync(path.join(root, 'content', 'fonts', file)), name)
    loaded.set(face, font)
  }
  return font
}

/** Glyphs used by one document in one face, with the text each stands for, for the subset and the ToUnicode map. */
export class FontUse {
  readonly used = new Map<number, string>()
  constructor(readonly font: TrueTypeFont) {}

  /** The string as glyph ids for a Tj operator. A character the font lacks falls back to its base letter. */
  encode(value: string) {
    let hex = ''
    for (const ch of value.normalize('NFC')) {
      let gid = this.font.glyphOf(ch.codePointAt(0) || 32)
      let shown = ch
      if (!gid) {
        const base = ch.normalize('NFD').replace(/\p{M}/gu, '')
        gid = base ? this.font.glyphOf(base.codePointAt(0) || 32) : 0
        shown = base || ch
      }
      if (!gid) continue
      if (!this.used.has(gid)) this.used.set(gid, shown)
      hex += gid.toString(16).padStart(4, '0')
    }
    return `<${hex || '0003'}>`
  }
}

function utf16Hex(text: string) {
  let out = ''
  for (let index = 0; index < text.length; index++) out += text.charCodeAt(index).toString(16).padStart(4, '0')
  return out
}

/** The PDF objects for one embedded face: Type0 font, CIDFont, descriptor, font file and ToUnicode map. */
export function fontObjects(use: FontUse, firstId: number, tag: string) {
  const font = use.font
  const gids = [...use.used.keys()].sort((a, b) => a - b)
  const name = `${tag}+${font.postscriptName}`
  const file = font.subset(gids)
  const widths = gids.map((gid) => `${gid} [${font.widthOf(gid)}]`).join(' ')
  const entries = gids.map((gid) => `<${gid.toString(16).padStart(4, '0')}> <${utf16Hex(use.used.get(gid) || '')}>`)
  const blocks: string[] = []
  for (let at = 0; at < entries.length; at += 100) {
    const chunk = entries.slice(at, at + 100)
    blocks.push(`${chunk.length} beginbfchar\n${chunk.join('\n')}\nendbfchar`)
  }
  const cmap = [
    '/CIDInit /ProcSet findresource begin', '12 dict begin', 'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def', '/CMapName /Adobe-Identity-UCS def', '/CMapType 2 def',
    '1 begincodespacerange', '<0000> <FFFF>', 'endcodespacerange', ...blocks, 'endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end',
  ].join('\n')
  const [type0, cid, descriptor, fontFile, toUnicode] = [firstId, firstId + 1, firstId + 2, firstId + 3, firstId + 4]
  const flags = 32 | (font.italicAngle ? 64 : 0)
  return {
    id: type0,
    objects: [
      Buffer.from(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${toUnicode} 0 R >>`),
      Buffer.from(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /CIDToGIDMap /Identity /DW ${font.widthOf(0)} /W [${widths}] >>`),
      Buffer.from(`<< /Type /FontDescriptor /FontName /${name} /Flags ${flags} /FontBBox [${font.bbox.join(' ')}] /ItalicAngle ${font.italicAngle} /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV 80 /FontFile2 ${fontFile} 0 R >>`),
      Buffer.concat([Buffer.from(`<< /Length ${file.deflated.length} /Length1 ${file.raw} /Filter /FlateDecode >>\nstream\n`), file.deflated, Buffer.from('\nendstream')]),
      Buffer.from(`<< /Length ${Buffer.byteLength(cmap)} >>\nstream\n${cmap}\nendstream`),
    ],
  }
}
