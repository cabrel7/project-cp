---
name: cp-ffmpeg
description: FFmpeg pour project-cp — analyser un bug d'interface ou d'animation depuis une vidéo Playwright (extraction de frames, détection de changements, planche contact), vérifier les illustrations animées (rythmes, reduced-motion), produire des démos légères (MP4/WebM/GIF) pour la doc et la Marketplace.
---

# FFmpeg — project-cp

> ffmpeg est installé par `.claude/scripts/setup-cloud.sh` s'il manque (apt). Vérifier : `ffmpeg -version`.

## 1. Débogage d'un échec e2e (vidéo Playwright)
```bash
V=$(ls -t apps/web/test-results/**/video.webm | head -1); mkdir -p /tmp/frames
ffmpeg -i "$V" -vf fps=2 /tmp/frames/f_%03d.png                                   # 2 images/s
ffmpeg -i "$V" -vf "select='gt(scene,0.08)',showinfo" -vsync vfr /tmp/frames/chg_%03d.png   # seulement les changements
ffmpeg -ss 00:00:03.5 -i "$V" -frames:v 1 /tmp/frames/moment.png                  # instant précis
ffmpeg -i "$V" -vf "fps=2,scale=480:-1,tile=4x3" -frames:v 1 /tmp/frames/planche.png # planche contact (vue d'ensemble)
```
Puis **lire les PNG** (outil Read) pour voir l'état exact au moment du bug. Joindre la planche contact au livrable si elle aide.

## 2. Contrôle des illustrations animées (auth, onboarding — D36/D38)
- Enregistrer 6 s de la page (`recordVideo` Playwright), extraire à 10 fps, vérifier : mouvements de quelques pixels, rythmes différents entre
  formes (pas de synchronisation), boucles ≥ 1,2 s, aucune forme derrière un champ.
- Même enregistrement avec `reducedMotion: 'reduce'` : les frames doivent être quasi identiques (fondus seulement).
```bash
ffmpeg -i anim.webm -vf "fps=10,scale=640:-1" /tmp/anim/a_%03d.png
ffmpeg -i anim.webm -vf "select='gt(scene,0.02)',metadata=print" -f null - 2>&1 | grep -c pts_time   # nb de changements perceptibles
```

## 3. Démos pour la doc / Marketplace
```bash
ffmpeg -i demo.webm -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p -movflags +faststart -an demo.mp4   # MP4 web
ffmpeg -i demo.mp4 -c:v libvpx-vp9 -crf 32 -b:v 0 -an demo-vp9.webm                                          # WebM léger
ffmpeg -i demo.mp4 -vf "fps=12,scale=720:-1:flags=lanczos,palettegen" /tmp/pal.png
ffmpeg -i demo.mp4 -i /tmp/pal.png -vf "fps=12,scale=720:-1:flags=lanczos,paletteuse" demo.gif               # GIF
ffprobe -v quiet -print_format json -show_format -show_streams demo.mp4                                       # vérification
```
Pages légères (Afrique d'abord) : vidéos de démo ≤ 2 Mo, 720p max, sans audio sauf besoin, `poster` fourni.

## Règles
`-crf` 18 (qualité) → 28 (compressé), 23 par défaut · `-movflags +faststart` pour le web · vérifier avec `ffprobe` · frames de débogage
dans `/tmp` (jamais commitées).
