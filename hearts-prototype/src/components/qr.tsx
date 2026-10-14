import QRCode from 'qrcode'

export async function Qr({ value, testId = 'qr' }: { value: string; testId?: string }) {
  const svg = await QRCode.toString(value, {
    type: 'svg',
    margin: 1,
    width: 132,
    color: { dark: '#1f1d36', light: '#ffffff' },
  })
  return <div className="qr" data-testid={testId} data-value={value} dangerouslySetInnerHTML={{ __html: svg }} />
}
