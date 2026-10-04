import QRCode from 'qrcode'

function escapePdf(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

/** A one-page door poster: title, when, place, and a QR the learner's camera can open. */
export function qrPosterPdf(input: { title: string; when: string; place: string; url: string }) {
  const qr = QRCode.create(input.url, { errorCorrectionLevel: 'M' })
  const modules = qr.modules
  const count = modules.size
  const cell = 8
  const quiet = 4
  const grid = (count + quiet * 2) * cell
  const pageW = 595
  const pageH = 842
  const left = Math.round((pageW - grid) / 2)
  const top = 460
  const bits: string[] = []
  bits.push('0.06 0.23 0.23 rg')
  bits.push(`0 0 ${pageW} ${pageH} re f`)
  bits.push('0.96 0.93 0.86 rg')
  bits.push(`36 36 ${pageW - 72} ${pageH - 72} re f`)
  bits.push('0.06 0.23 0.23 rg')
  bits.push('BT /F1 28 Tf 64 760 Td')
  bits.push(`(${escapePdf(input.title.slice(0, 42))}) Tj`)
  bits.push('ET')
  bits.push('BT /F1 14 Tf 64 724 Td')
  bits.push(`(${escapePdf(input.when.slice(0, 64))}) Tj`)
  bits.push('ET')
  bits.push('BT /F1 14 Tf 64 700 Td')
  bits.push(`(${escapePdf(input.place.slice(0, 64))}) Tj`)
  bits.push('ET')
  bits.push('BT /F1 12 Tf 64 160 Td')
  bits.push('(Scan to check in. The code only works for this gathering.) Tj')
  bits.push('ET')
  bits.push('0 0 0 rg')
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (!modules.get(y, x)) continue
      const px = left + (x + quiet) * cell
      const py = top - (y + quiet) * cell
      bits.push(`${px} ${py} ${cell} ${cell} re f`)
    }
  }
  const stream = bits.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}
