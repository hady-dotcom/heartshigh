/** Geometry of the labelled local proof film at /framing/placeholder.mp4. */

export const PLACEHOLDER_VIDEO = { width: 1280, height: 720 }

/** Cream FACE card drawn by scripts/framing/make-placeholder.sh, in source pixels. */
export const PLACEHOLDER_FACE_PX = { x: 70, y: 160, w: 260, h: 360 }

export const PLACEHOLDER_FACE = {
  x: PLACEHOLDER_FACE_PX.x / PLACEHOLDER_VIDEO.width,
  y: PLACEHOLDER_FACE_PX.y / PLACEHOLDER_VIDEO.height,
  w: PLACEHOLDER_FACE_PX.w / PLACEHOLDER_VIDEO.width,
  h: PLACEHOLDER_FACE_PX.h / PLACEHOLDER_VIDEO.height,
}

export const PLACEHOLDER_FACE_FOCUS = {
  x: (PLACEHOLDER_FACE_PX.x + PLACEHOLDER_FACE_PX.w / 2) / PLACEHOLDER_VIDEO.width,
  y: (PLACEHOLDER_FACE_PX.y + PLACEHOLDER_FACE_PX.h / 2) / PLACEHOLDER_VIDEO.height,
}
