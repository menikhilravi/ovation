# WALLFLOWER: prototype notes

Throwaway prototype, about 75 minutes of work. It is one `index.html` with Canvas 2D, no libraries, and it runs from file://.
Add `?debug` to see a one-line readout of the social model. `window.__proto` exposes `state`, `simulate({...})` and `screen(x,z)`.

## What I built
- **The room.** A lamp-lit 14 x 9.5 m room seen through a pinhole camera pitched about 54 deg, like a dollhouse cutaway.
  It has a warm back wall with a bright doorway, windows, a rug, 4 floor lamps and a drinks table. Lighting is a low-res
  darkness layer with lamp pools cut out of it. Figures are lit analytically by their distance to the lamps. Each person
  has a contact shadow and one soft shadow from the nearest lamp.
- **The figures.** Each is built from extruded-ellipse hulls: skirt or legs, then torso, then a lighter shoulder cap
  with a skin-coloured neckline at the front. Arms are 2-segment strokes with hands, and most people hold a wine glass.
  The head is a skin disc with a hair disc offset toward the back of the head. You see a crescent of face on the side the
  person is looking, plus two eye dots when the face points toward the camera. Head yaw is separate from body yaw, so
  glances show up as head turns. Walking figures show feet with a stride.
- **The idle life.** There are 8 F-formations (2 to 6 people), 1 lone drinker at the table and the player: 31 people in
  all. The speaker rotates every 2.4 to 6.5 s and gestures with one or both hands. Listeners turn their heads toward the
  speaker and nod now and then. The speaker's gaze moves from listener to listener. Each group has its own shared
  laughter: heads tip back, shoulders bounce and a hand goes to the chest. People sway slightly and breathe.
- **You.** You start in the doorway and walk in on your own (about 1.5 s). A few heads near the door glance at you.
  You wear the only cool colour, a steel blue, which drifts toward warm while you are in a circle and cools again when
  you are alone.
  - Hold = walk toward the pointer. Pace scales with how far ahead the pointer is: about 0.5 m/s at 1 m, up to 1.6 m/s.
  - Tap = stroll to that spot at 0.85 m/s.
  - Tap *on* a circle = stroll to its edge on your side. This is deliberate: a tap should mean the considerate default.
  - The camera slowly pushes in (1.5x on desktop) when you are within about 2.3 m of a circle, and pulls back when you
    leave. On a phone (390x844) it shows about 6.5 m of floor width and follows you, with a 1.25x push-in near a circle.
- **The social model** (`evalApplicant`). This is the part being tested. For each circle and each lone agent:
  - *Noticing zone* (within 2.7 m of the ring). Members who have you in their roughly 105 deg field of view glance at you.
    Glances get more frequent when you are close or moving fast.
  - *Acceptance A* rises only while you are at the edge (0.05 to 1.55 m outside the ring), paused (slow walking counts
    about 1/3), and seen. The rate is openness x (fraction of members who can see you)^0.7. At A > 0.3, one member
    holds a longer look and nods ("I see you"). At A >= 1 the circle **opens**:
    - you join the ring and the slots are re-spaced around your angle, so the two neighbours step apart;
    - the centre shifts toward you and the radius grows;
    - the best-placed member turns to you and extends an open hand, and the others glance over in a staggered ripple;
    - the group laughs about 3.4 s later;
    - you are then eased into your slot, facing the centre, and sometimes the "floor" passes to you: every head turns
      to you and you gesture.
  - *Rudeness I* comes from rushing inward (inward speed > 1 m/s within 2 m of the ring) or from stepping into the
    o-space. At I >= 1 the circle **closes**:
    - the two nearest members turn their shoulder to you (a body-yaw offset of 0.7 and 0.38 rad away from you);
    - the ring tightens to 86%;
    - the group drifts about 0.4 m away (more if you are inside);
    - glances stop, and a closed circle is a physical barrier;
    - 4.5 to 7 s later, one person looks back at you once;
    - after 15 s the circle relaxes, but its openness is permanently x0.75.
  - *Lurking*: standing within about 1 m behind someone's back (outside their view) and moving slowly builds a separate
    meter that leads to a *soft* close (a smaller turn, no drift).
  - *Deep conversations*: pairs and some groups, at a chance of `deep`, cap A at 0.55. After 4.5 s of polite waiting
    they close gently anyway. Politeness is necessary but not sufficient.
  - Walking away past R + 1.25 removes you from the circle, and it re-closes behind you, drifting back home.
- **The role reversal.** After 16 s inside a circle (or at 85 s), a second lone guest in lavender enters. They look
  around and walk to the edge of *your* circle, right beside you, and wait there glancing at you. The circle admits them
  **only if you move off your settled spot by more than 0.28 m** (step back or aside). Otherwise they give up after 16 s,
  go and stand alone by the left wall, and become a lone "group of one" that you can approach.
- **Sound**, after the first pointerdown. It is untested by ear (headless Chrome runs muted). Each circle gets 2
  band-passed pink-noise "voices" with syllabic AM, random pauses and stereo pan by screen x, over a quiet low-passed
  bed. A circle's voices hush in proportion to how close you are and how undecided they are, drop to 60% when they
  close ranks, and brighten and quicken during laughter. There are no words.

## What I faked or skipped
- No pathfinding. Tap-walking goes in a straight line, so crossing a pair's o-space on the way somewhere closes that
  pair. This is arguably correct, but it surprises people.
- Only one applicant per circle is modelled carefully. NPCs never approach each other, except the single newcomer.
- The "made room" test for the newcomer is crude: any 0.28 m move off your spot counts. It does not check that you
  opened the gap on *their* side.
- Lone agents (the barman, the newcomer after giving up) have openness 0.95. They will "admit" you if you just stand
  still near them in view, even when you didn't mean to approach. I saw this happen once in a 100 s fast-forward: the
  player idled near the door and formed a pair with the given-up newcomer. It is sweet, but passive.
- `setTimeout` is used for the glance ripple and for the door glances at the start. This is fine here, but it is not
  tied to simulation time.
- No real people-to-people avoidance while walking. People are simply pushed apart (radius 0.22 m), and the player
  gets 85% of the push.

## What felt alive and what felt dead (from driving it headless, looking at frame sequences, desktop and phone)
- **Alive:**
  - The resting room. With heads tracking whoever is speaking, occasional nods and group laughter, it reads as a party
    in one glance. The blue figure in the bright doorway is obviously "you" before you do anything.
  - The opening. The ring re-spaces around you, the two neighbours visibly step apart, one person turns their face and
    an open hand to you, and a few seconds later the group laughs with you in it. In frame sequences this reads clearly
    as being let in.
  - The camera push-in near a circle. It makes the face crescents and eyes readable just when they matter. On a phone,
    at this scale, the figures look good and a glance is unmistakable.
  - Glances when you pause at the edge. The held look at A > 0.3 is the best moment of anticipation in the prototype.
- **Weaker or dead:**
  - The **close** is not sharp enough yet. The shoulder turn is a 20 to 40 deg body rotation, and at full-room scale it
    blends in with ordinary idle motion. What reads is "the group slid away from me". That is the right meaning, but it
    lacks a single stinging beat. A fuller version needs a synchronised moment: every head snaps back to the centre at
    once, the nearest person makes a visible half-step across the gap, and the murmur surges back up.
  - With the "tap on a circle = walk to its edge" rule, most tap users will approach politely. Then the outcome mostly
    depends on the circle's openness and on whether you ended up behind someone's back. So *how* you approach matters
    less for tap users than for hold-and-drag users. I think this is the right default, but it means rejection mostly
    comes from "where you stood" and "they were deep in conversation", not from pace.
  - Rushing only happens if you hold the pointer far ahead of you. That is plausible, but nobody will discover
    "slow = polite" unless they hold and drag.
  - The player figure has no expressive idle beyond looking around at circles. There is no fidget, no crossed arms, no
    drink. "Alone" should read in your own body too.
  - The lamp shadows radiate like spokes around each floor lamp. They look busy.
- **Honest verdict on the feeling:** the *welcome* half works. I would expect a small, real "oh, they let me in" the
  first time a hand opens toward you and the circle laughs. The *sting* half is legible as information ("they closed"),
  but it is not yet felt as a pang. It needs one decisive, synchronised beat and the sound dip to land. I could not
  judge sound or real hand-feel headless. Someone should drive it by hand with audio on before deciding.

## Known bugs / rough edges
- If a circle closes while you stand in its old centre, the barrier pushes you outward, and meanwhile the group drifts.
  For about a second, figures can overlap slightly.
- Circles that grow near a wall get clamped by the wall. The ring then squashes a little into its neighbours; group
  repulsion only runs one way per frame.
- The auto-settle into your slot waits 1.4 s after your last input. If you tap inside your own circle you walk there,
  then drift back.
- Phone: the camera follows smoothly, but a fast drag can put the pointer target under your thumb. There is no offset.
- The tap marker (a faint expanding ring on the floor) is the only non-diegetic mark.

## What the full version would need
1. **A decisive rejection beat.** Heads snap to the centre together, and a half-step closes the gap on the frame the
   meter trips. Add a soft sonic "door closing": the local murmur swells and a laugh you are not part of. The opening
   needs a clear beat too: a lift in the murmur and one audible laugh-texture (synthesised, not voices).
2. **Your own body language.** Idle fidgets when alone, an arm cross after being rejected, and a small nod back when
   someone looks at you. Maybe you could *nod* (a quick tap on yourself) as an explicit social signal the model reads.
3. **Richer approach reading.** Track path curvature (arcing around into view vs. beelining), dwell time in view, and
   eye contact from the held look. Holding still *after* someone looks at you should count more than holding still
   before.
4. **Better group geometry.** Proper Kendon o/p/r-spaces, side-by-side and L-shaped pairs, circles that split and merge,
   and NPCs who themselves leave and join. The room needs to churn so that new openings appear over time.
5. **An arc.** Something like: arrive, fail once, get in, and then be the one who lets the next person in. The ending
   should be the newcomer's face turning to you when you step back. That beat is implemented but not staged; it needs
   the camera to frame both of you and the room to go quieter.
6. **Craft.** Softer and fewer shadows, subtle film grain, and a door that actually opens and closes. Test the audio by
   ear, add a loading and first-gesture state for sound, handle reduced-motion, and run a performance pass on low-end
   phones (currently 57 to 60 fps in headless on an M3 with 31 figures).

## Test log (headless, `tools/snap.mjs`, screenshots in `shots/`)
- `d0`, `d1`: first renders. They showed too much perspective at dist 17 m, so I moved the camera to 34 m and enlarged
  the heads.
- `polite`, `polite2`: slow approach to G0's gap, then a pause. A reached 1 about 2 s after stopping; the ring re-spaced
  and a member beckoned.
- `rude`: charged at 1.5 m/s into G1's centre. After the fix, rudeness trips before you reach the ring, and the barrier
  keeps you out.
- `behind`: standing behind a member of G0 closes it (now a soft close via the lurk meter).
- `newc`: joined G0, the newcomer spawned and waited beside you, you stepped back 0.5 m, and the newcomer was admitted
  (the ring went from 5 to 6).
- `click`: real CDP mouse click and drag through the pointer handlers. No errors.
- `mobile*`: 390x844 at 2x, 57 to 58 fps, no horizontal overflow, no console errors.
- `debug`: 100 s fast-forward via `simulate({fast:100})`. No errors, and the newcomer lifecycle completed.
