import { inflateSync } from 'node:zlib'

/** The text a PDF shows, read back through each font's ToUnicode map, one string per Tj. */
export function pdfText(pdf: Buffer) {
  const body = pdf.toString('latin1')
  const objects = new Map<number, string>()
  for (const match of body.matchAll(/(\d+) 0 obj\n([\s\S]*?)\nendobj/g)) objects.set(Number(match[1]), match[2])
  const streamOf = (id: number) => {
    const object = objects.get(id) || ''
    const data = object.slice(object.indexOf('stream\n') + 7, object.lastIndexOf('\nendstream'))
    return /FlateDecode/.test(object) ? inflateSync(Buffer.from(data, 'latin1')).toString('latin1') : data
  }
  const maps = new Map<string, Map<string, string>>()
  for (const [, object] of objects) {
    const page = object.match(/\/Font << ([^>]*) >>/)
    if (!page) continue
    for (const [, key, id] of page[1].matchAll(/\/(F\d) (\d+) 0 R/g)) {
      if (maps.has(key)) continue
      const unicode = Number((objects.get(Number(id)) || '').match(/\/ToUnicode (\d+) 0 R/)?.[1])
      const map = new Map<string, string>()
      for (const [, gid, hex] of streamOf(unicode).matchAll(/<([0-9a-f]{4})> <([0-9a-f]+)>/g)) {
        map.set(gid, String.fromCharCode(...(hex.match(/.{4}/g) || []).map((unit) => parseInt(unit, 16))))
      }
      maps.set(key, map)
    }
  }
  const out: string[] = []
  for (const [, object] of objects) {
    if (!/^<< \/Length \d+ >>\nstream\n/.test(object) || /begincmap/.test(object)) continue
    for (const [, key, hex] of object.matchAll(/\/(F\d) [\d.]+ Tf [^<]*<([0-9a-f]*)> Tj/g)) {
      out.push((hex.match(/.{4}/g) || []).map((gid) => maps.get(key)?.get(gid) ?? '\uFFFD').join(''))
    }
  }
  return out.join('\n')
}
