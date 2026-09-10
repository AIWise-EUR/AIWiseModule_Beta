# Guide video assets

The lobby (`lobby.html`) references two files here:

- `ai-wise-guide.mp4` — the guide video that appears between the hero
  and the three landing cards. Required for the video to play.
- `ai-wise-guide-poster.png` — optional poster frame shown before
  the user hits play. If absent, the video player just shows its
  default first-frame thumbnail; the `poster` attribute is
  ignored gracefully.

Drop the files in with those exact names and they will be picked up
automatically. No code changes needed.
