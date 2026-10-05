'use client'

export function ExtractPlay({ youtubeId, start }: { youtubeId: string; start: number }) {
  return (
    <button
      type="button"
      className="btn ghost small"
      data-testid="extract-play"
      onClick={() => {
        const frame = document.querySelector<HTMLIFrameElement>('[data-testid="course-detail"] .film-preview')
        if (frame) frame.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?start=${Math.floor(start)}&autoplay=1`
      }}
    >
      Play from here
    </button>
  )
}
