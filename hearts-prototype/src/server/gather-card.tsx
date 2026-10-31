import { ImageResponse } from 'next/og'

export function gatherCardImage(input: { title: string; when: string; place: string; portal: string }) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#F2F2F7', color: '#111827', padding: '64px', fontFamily: 'Georgia, serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', fontSize: 28, letterSpacing: 4, color: '#2563EB' }}>GATHER</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 68, lineHeight: 1.05, maxWidth: 980 }}>{input.title}</div>
            <div style={{ display: 'flex', fontSize: 32, marginTop: 24, color: '#4B5563' }}>{input.when}</div>
            <div style={{ display: 'flex', fontSize: 28, marginTop: 8 }}>{input.place}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#2563EB' }}>{input.portal}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
