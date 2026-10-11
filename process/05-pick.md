# 05 — Three prototypes, three cold testers, one pick

Each prototype was used cold by a fresh agent that had never seen the brief (headless Chrome, screenshots, audio
recorded as spectrograms, desktop and phone, 10–15 runs each).

| | Best moment the stranger reported | What killed the magic | Would send? |
|---|---|---|---|
| **OVATION** | *"The whole hall locking into rhythmic clapping and flashing together. It gave me a real 'oh!', like a crowd deciding something together. This is the best thing on the page by far."* Also: ragged first standers ("anticipation, almost pride"), the hush that leaves stragglers standing ("funny and human"), a lone holdout. | My bug: the visuals only ran once audio had started, so the hands-off opening showed nothing. Also far too dark, the performer is a blob, the phone framing is poor, and the audio never swells into a roar. | "Only with instructions, because the unison-clap moment is worth it." |
| **FOUNDRY** | The pitch sliding as you drag the rim ("oh, I'm tuning it"); a giant bell droning for a minute ("like standing under a real tower bell"). | A static, silent opening; sculpting found only by accident; one gesture; clicking gets samey. | "Yes, but only with instructions." |
| **WALLFLOWER** | The opening image (the only person without a drink), and walking up to a circle where "nobody budged: accurate and a bit painful". | Frozen after about 20 s; the only real event comes at 90 s and doesn't pay off; a room of mannequins. | "Only to one specific introverted friend." |

## Decision: OVATION

It is the only one that behaves like a living thing. The model produced moments no one scripted (spontaneous sync,
holdouts, awkward stragglers), and those were exactly what the stranger loved. Its failures are all execution. FOUNDRY
is a beautiful instrument with one verb. WALLFLOWER is a beautiful still with a hidden payoff.

## What the cold test taught the build
1. **The opening must play hands-off.** The model and visuals never depend on audio. The first clapper is the lesson:
   it teaches that light means clapping and rising means standing.
2. **Exposure.** A resting average brightness of 16/255 is a brown smudge. The hall must be legible in a lit room.
3. **The performer is you.** First person, a bow is a camera move (you see the boards and your shoes), and your long
   shadow lies on the stage.
4. **The payoff must escalate physically:** louder, brighter, standing, flowers, the house lights.
5. **More input should do more**, with habituation you can feel rather than a flat response.
6. **Locality.** Where you look (and click) should get a local response.
7. **Phone framing:** the house fills the portrait screen.
8. **Audio must roar** at the peak and be intimate in the quiet.
9. **An arc with an end:** encore, waning, house lights, leaving, the last clapper.
