# 07 — The five success criteria, checked against the final build (v6)

Evidence comes from fresh agents who had never seen the brief or the code: 5 cold rounds, 16 strangers and 3 expert passes in total.
The final round used two new strangers on v6 (desktop with sound; phone, muted). Audio was measured on v6 recordings.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | **Feeling in 10 s, hands off.** Says they're on a stage and names a feeling | **Pass**, with one caveat | v6 desk at 9 s: *"Oh, I'm the performer and the show just ended… a small jolt of stage fright."* v6 muted phone: *"Warm, expensive and a bit hushed… a silent packed house staring at me felt slightly eerie."* Caveat: since v5 the house deliberately **waits for you** instead of applauding at once, so at 10 s they are about to be applauded, not yet applauded. Every tester in rounds 3–4 asked for this. |
| 2 | **The bow is found unaided** within 3 attempts, and its effect is described | **Pass** | v6 desk: second click, *"I realised I had just bowed."* v6 muted: by the third tap, *"tap = bow"*. v5 desk: third click, *"clicking means bowing."* |
| 3 | **Two or more discoveries after the first minute**, at least one emergent | **Pass** | Every tester found the ending (house lights, people leaving, the one who stays, "Everyone has gone home."). Most found the wings (muffled calling, the return roar, roses). Emergent, not scripted: the house falling into unison clapping by itself (*"like a crowd deciding something together"*); the lone holdout; stragglers standing awkwardly; the rhythm dissolving when it wants to be louder. |
| 4 | **Muted still lands; the sound is true** | **Pass** | Muted testers named feelings: *"the single straggler in an empty house"*, *"'They were kind.' against 'They stood for you.' That contrast stung a little."* v6 audio: the rhythmic section reaches envelope periodicity **0.85 at 1.85 Hz** (target ≥ 0.5); the peak roar is **25.6 dB** above the waiting room tone (target ≥ 12); **0** clipped samples. |
| 5 | **Craft on both screens** | **Partial** | 0 console errors in every run of every round; 60 fps at 1440×900, 54–56 fps at 390×844, 56 fps on a phone with the CPU slowed 4×; no horizontal scroll; the first frame is the title card, instantly; works from `file://` and as the Artifact fragment (tested in headless Chrome, including the no-AudioWorklet fallback). **Fails** the clause "no tester flags a placeholder": testers still flag the front-row faces up close ("mannequins"), the black void of the wings, the smudge of your shadow in a deep bow, and a chandelier that reads as a particle effect. |

## What the strangers and critics still say
- The curtain call (walk off, get called back, return to a roar and roses) is the best thing in the piece, and a cold player
  still mostly finds it by accident: by arrow keys, by a drag, or by following the torch without knowing why.
- The expert's final verdict (v5): *"good, sometimes very good, but not great."* Some of their five fixes are in v6:
  - the ovation is earned (the house waits for your bow; the first wave is polite; standing is earned)
  - a bow surges
  - the torch is hit-tested where its light is
  - a warm half-light instead of a full house-lights reveal
  - an epilogue that leads with a sentence

  The others are not: the hero close-ups, and a stage manager you can see.
