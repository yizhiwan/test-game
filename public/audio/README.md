# Audio assets

`lib/audio.ts` looks for these files and falls back to short synthesized tones
when they are missing, so the game is playable without them.

| File          | Used for                                  | Notes        |
| ------------- | ----------------------------------------- | ------------ |
| `ambient.mp3` | Synthwave loop, starts with the case       | Loops        |
| `blip.mp3`    | Evidence pickup, button presses            | Very short   |
| `alarm.mp3`   | Alibi broken, suspect lockout              | ~1 second    |
| `glitch.mp3`  | Glitch stings                              | Very short   |

Drop files in with exactly these names and Howler picks them up on next load.
There is no synthesized stand-in for the ambient loop; without `ambient.mp3`
the background is simply silent.
