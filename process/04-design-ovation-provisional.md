# 04 — OVATION: design (provisional; kept only if it wins the prototype round)

## The one feeling
Being adored by a crowd, and learning you can't keep it. Elation → power → greed → loss → tenderness.
Share lines: *"this website gives you a standing ovation"* … *"and then it takes it away."*

## Premise (never stated)
You have just finished performing. What you performed is never said; it's yours. The lights hit you.
The hall holds its breath. Then one person claps.

## Arc (discovered, not presented)
1. **Held breath (0–3 s).** Black, room tone, a cough. *Clunk*: the follow-spot hits you. Your long shadow falls across the
   boards toward the house. Faces in the spill light. Silence long enough to be uncomfortable.
2. **First clap (~3 s).** One person in the stalls, then a few, then the cascade (social contagion). Full roar in ~2 s.
   Hands glint across the dark. This alone must work muted and untouched.
3. **You bow (first tap).** The view dips to the floorboards and rises back to a surge. The standing cascade starts in
   the front rows and spreads back and up (Miller–Page visibility), with a rolling rumble of seats flipping up.
4. **The crowd's own life.** Left alone, the roar coalesces into rhythmic sync (Néda: mode II, period doubled).
   Bow into it and the sync shatters back into roar. Greed breaks rhythm.
5. **Walk off, walk back.** Drag sideways and you walk; past the proscenium you're in the wings. The applause is muffled,
   locks into a demanding rhythm (the encore call), and stamping joins it. Walk back into the light: a roar.
6. **Diminishing returns.** Each bow and encore buys less (habituation). Someone starts to leave. A stubborn clapper
   can restart it once.
7. **The house lights.** When it dies, the house lights come up and reveal the gilded hall at last: coats, seats
   thunking, the room emptying row by row.
8. **The last one.** One person stays, high in the gods. They clap alone, slowly, in a hall with a 2-second reverb.
   You can bow to them. They go. Lights down.
9. **Again.** A tap starts the next night: a different house, a different size and mood.

## Verbs (all shown through your body/shadow, never through UI)
- **Tap / click / Space**: bow. **Hold**: a deeper, longer bow (humility pays, up to a point; held too long gets awkward).
- **Drag sideways / ← →**: walk along the stage, and off it into the wings.
- **Where you look** (pointer position, gentle camera drift): the section you face responds more. Eye contact.

## Rules
- No voices. Claps, stamps, whistles, seat thunks, coughs, programme rustle, floorboards, spot hum.
- No UI at all, apart from a title card that fades as the spot comes up and a "sound on" hint in small type.
- Muted must still land: glints, the standing wave, flowers arcing into the light, the house lights, the last figure.
- The model is honest (Mann contagion, Néda sync, Miller–Page standing), and the piece never explains it.

## Tech
- WebGL2: instanced SDF audience (~2,000), 3D hall shell (stalls, 4–5 horseshoe tiers with gilt fronts,
  proscenium, curtain valance), volumetric follow-spot beam, bloom, grain. First-person camera; the bow is a camera move.
- AudioWorklet is the master clock: the model runs in audio time; near-field clappers are rendered individually (with
  distance delay, air absorption and pan), and the far field as a density-modulated bed. Generated hall IR via ConvolverNode.
- iOS: audioSession 'playback' plus the <audio> unlock so the mute switch doesn't silence it.
