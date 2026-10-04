#!/usr/bin/env bash
# 16:9 test pattern: face-like block on the left, burned-in PLACEHOLDER copy, running clock.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$root/public/framing/placeholder.mp4"
mkdir -p "$(dirname "$out")"
font="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf}"
ffmpeg -y -f lavfi -i "color=c=0x14564C:s=1280x720:d=24:r=25" -vf "\
drawbox=x=70:y=160:w=260:h=360:color=0xE8D5B0@1:t=fill,\
drawbox=x=135:y=210:w=130:h=130:color=0x3A2A1A@1:t=fill,\
drawbox=x=160:y=360:w=80:h=20:color=0x3A2A1A@1:t=fill,\
drawtext=fontfile=${font}:text='FACE':x=145:y=470:fontsize=36:fontcolor=0x0F3B3A,\
drawtext=fontfile=${font}:text='PLACEHOLDER':x=420:y=160:fontsize=64:fontcolor=0xF6EEDC,\
drawtext=fontfile=${font}:text='Not YouTube  —  test pattern':x=420:y=240:fontsize=32:fontcolor=0xD4A84B,\
drawtext=fontfile=${font}:text='%{pts\\:hms}':x=420:y=320:fontsize=48:fontcolor=0xF6EEDC,\
drawtext=fontfile=${font}:text='Burned-in text for treatment B':x=420:y=420:fontsize=28:fontcolor=0xF6EEDC" \
  -c:v libx264 -pix_fmt yuv420p -crf 26 -movflags +faststart "$out"
echo "Wrote $out"
