import QRCode from 'qrcode'

const PAGE_W = 595
const PAGE_H = 842

function pdfSafe(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrap(value: string, size: number, width: number) {
  const max = Math.max(8, Math.floor(width / (size * 0.52)))
  const words = pdfSafe(value).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > max && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines.slice(0, 4)
}

/** One A4 sheet for the door: title, when, place, and a check-in QR. The web address stays inside the code. */
export function qrPosterPdf(input: { title: string; when: string; place: string; url: string; audience?: string; host?: string; masjid?: string; entryCode?: string }) {
  const qr = QRCode.create(input.url, { errorCorrectionLevel: 'M' })
  const modules = qr.modules
  const count = modules.size
  const quiet = 4
  const cell = Math.max(6, Math.min(9, Math.floor(320 / (count + quiet * 2))))
  const grid = (count + quiet * 2) * cell
  const left = Math.round((PAGE_W - grid) / 2)
  const qrBottom = 168
  const bits: string[] = []
  bits.push('0.059 0.231 0.227 rg')
  bits.push(`0 0 ${PAGE_W} ${PAGE_H} re f`)
  bits.push('0.969 0.933 0.859 rg')
  bits.push(`28 28 ${PAGE_W - 56} ${PAGE_H - 56} re f`)
  bits.push('0.831 0.659 0.294 rg')
  bits.push(`28 ${PAGE_H - 28 - 10} ${PAGE_W - 56} 10 re f`)

  let y = 760
  const write = (text: string, size: number, color: string, gap: number) => {
    const lines = wrap(text, size, 460)
    bits.push(color)
    for (const line of lines) {
      bits.push('BT')
      bits.push(`/F1 ${size} Tf 64 ${y} Td`)
      bits.push(`(${line}) Tj`)
      bits.push('ET')
      y -= gap
    }
  }
  write('GATHER', 13, '0.831 0.659 0.294 rg', 28)
  write(input.title || 'Gather', 26, '0.059 0.231 0.227 rg', 32)
  if (input.masjid) write(input.masjid, 14, '0.114 0.247 0.227 rg', 22)
  write(input.when || '', 16, '0.059 0.231 0.227 rg', 22)
  if (input.place) write(input.place, 14, '0.114 0.247 0.227 rg', 20)
  const who = [input.audience, input.host ? `Host: ${input.host}` : ''].filter(Boolean).join('  ·  ')
  if (who) write(who, 13, '0.114 0.247 0.227 rg', 20)

  bits.push('1 1 1 rg')
  const pad = 14
  bits.push(`${left - pad} ${qrBottom - pad} ${grid + pad * 2} ${grid + pad * 2} re f`)
  bits.push('0 0 0 rg')
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!modules.get(row, col)) continue
      const px = left + (col + quiet) * cell
      const py = qrBottom + grid - (row + quiet + 1) * cell
      bits.push(`${px} ${py} ${cell} ${cell} re f`)
    }
  }
  bits.push('0.059 0.231 0.227 rg')
  bits.push('BT /F1 16 Tf 64 132 Td (Scan this to check in.) Tj ET')
  if (input.entryCode) {
    bits.push('BT /F1 12 Tf 64 110 Td (Or type the door code) Tj ET')
    bits.push(`BT /F1 28 Tf 64 78 Td (${pdfSafe(input.entryCode)}) Tj ET`)
  } else {
    bits.push('BT /F1 12 Tf 64 106 Td (The code is only for this gathering.) Tj ET')
  }

  const stream = bits.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}
