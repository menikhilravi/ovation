# 01 — Why Cosmogenesis was "ok", and 25 concepts

## Diagnosis (≈15 minutes with the earlier attempt)

Cosmogenesis is competent everywhere and memorable nowhere.

- **It explains instead of making you feel.** Every chapter has a HUD of numbers, a "Story" tab, a "Science" tab,
  a control deck. The screenshots are ~40% chrome. The page tells you what to find wonderful.
- **The interaction is parameter-fiddling.** Toggles for Doppler beaming, sliders for inclination. You adjust a model;
  you never *do* anything that means something.
- **Every centrepiece is a demo the audience has already seen.** Gargantua-style black hole, boids murmuration, Lenia,
  Gray–Scott spots, particle life. Well executed remakes produce "nice", never "what is this?"
- **Breadth dilutes everything.** 22 chapters × a template = no single moment carries the weight of the whole.
- **No authorial voice.** A committee working from a spec produces uniform polish: same panel, same fonts, same
  rhythm, chapter after chapter. Nobody decided what the one feeling should be.

What to do instead: one act, one feeling, no chrome. The interaction should *be* the meaning. The first 10 seconds
should do the persuading, and the depth should be discovered, not presented.

## 25 concepts

Each: **hook** · *why it's new* · first 10 seconds.

### 1. OVATION — music / social simulation
**Hook:** You are alone on a stage. A hall of 2,000 simulated people applauds you, and you can lead them.
*New:* Applause is a studied physical phenomenon (Néda et al., *Nature* 2000: audiences spontaneously synchronise,
then lose sync when they try to get louder; Mann et al. 2013: applause spreads by social contagion; Miller & Page's
standing-ovation cascade). Nobody has made it something you *receive*. Every clap is synthesised per person
(Repp / Peltola hand-configuration spectra) in an AudioWorklet, in a procedurally-generated hall reverb.
**First 10 s:** A dark hall from the stage, a murmur, a single warm spotlight on you. You click (a bow) and the house
erupts. It swells, drifts, and falls into rhythmic sync on its own. You raise your hand and they roar; lower it and
they hush. You walk off and they chant for an encore.

### 2. EARSHOT — sound / tool
**Hook:** Draw any floor plan with your finger, clap, and *hear* that space.
*New:* The ripple tank (Falstad) lets you see waves. Here a GPU wave simulation of your drawing produces the actual
impulse response at the listener, convolved live with your clap. Draw parallel walls → flutter echo. A staircase →
the Chichén Itzá chirp. A bottle → Helmholtz hoot. A dome → whispering gallery.
**First 10 s:** A dark stone room in plan view. Click: a ring of light expands, bounces, interferes, and you hear the
room ring out in exact sync with what you see.

### 3. TORCHLIGHT — art / deep history
**Hook:** A Palaeolithic cave in total darkness; your cursor is a flickering torch, and its flicker makes the paintings run.
*New:* Marc Azéma's thesis that multi-legged cave animals were drawn to animate in flickering firelight: "the first
cinema, 36,000 years ago". The torch light on a relief-mapped rock wall. The ending: blow ochre around your own hand
and leave your stencil next to theirs.
**First 10 s:** Blackness, crackle, a warm flame at your cursor. Red and black horses loom from the rock; as the flame
gutters they gallop.

### 4. WALLFLOWER — game / social simulation
**Hook:** A cocktail party seen from above. You're the one who just walked in alone.
*New:* Real proxemics: Kendon's F-formations (conversation circles that open a gap to admit a newcomer or close ranks),
Hall's distances, gaze, murmured spatialised gibberish. Awkwardness and belonging emerge from the model rather than a script.
**First 10 s:** Warm lamplight, murmuring clusters, a door. You drift toward a circle and they shuffle to let you
in — or someone's shoulder turns, the gap closes, and you feel it.

### 5. DRIFT — language
**Hook:** Type your name. Watch it evolve over 3,000 years into a family of future languages, and hear each one.
*New:* Conlanger sound-change appliers exist as text tools. Here the tree of daughter languages grows live with real
sound laws (lenition, palatalisation, chain shifts, apocope, umlaut, tonogenesis), and a formant synthesiser speaks
every descendant form.
**First 10 s:** "Nikhil" splits and splits again; the leaves read *Ñéil*, *Nikkə*, *Tsiyi*; a strange voice says them.

### 6. FOUNDRY — music / physics
**Hook:** Pull a bell's profile into any shape and strike it: you hear its true partials.
*New:* Axisymmetric shell finite-element eigenmodes computed live (hum, prime, tierce, quint, nominal), with the mode
shapes visible on the bronze. Bell founders spent centuries on this.
**First 10 s:** A bronze bell; tap it and a long, beating chime blooms; drag its lip and it sounds ugly, then glorious.

### 7. UNTANGLE — maths / tool
**Hook:** Scribble any tangled loop. Let go: it pulls itself tight, and either falls open into a circle or reveals the knot you tied, by name.
*New:* KnotPlot-style energy relaxation plus Alexander-polynomial identification, all in a scribble.
**First 10 s:** You draw a mess; it writhes and shrinks. "Unknot." It falls open into a perfect ring.

### 8. LOOM — craft / language
**Hook:** Every key you type throws the shuttle; your words become a woven cloth that encodes them.
*New:* Real weaving drafts (threading, tie-up, treadling) driven by characters; the cloth can be read back.
**First 10 s:** Clack-thump: a line of twill grows under your typing, the colours shifting with each letter.

### 9. PALIMPSEST — story / history
**Hook:** Scrape an old parchment and dig through a thousand years of overwritten text.
*New:* The same lullaby in Modern English, Middle English, Old English, Latin, Greek, each in its era's hand,
layered like the Archimedes palimpsest.
**First 10 s:** Your finger scrapes; faded brown letters of an older script bleed through.

### 10. THE BUILDING — story / simulation
**Hook:** An apartment block at night; 60 simulated lives visible through lit windows on a 24-hour loop.
*New:* Interlocking schedules and relationships produce stories you piece together as a voyeur.
**First 10 s:** Windows switch on at dusk; silhouettes move; a phone rings in 4B.

### 11. DOPPELGÄNGER — unease / machine learning
**Hook:** A faint second cursor follows yours, then learns your habits, then starts arriving first.
*New:* Online-learned model of your own pointer dynamics that predicts and anticipates you.
**First 10 s:** A ghost trails your pointer. Seconds later it's ahead of you.

### 12. MILLENNIUM BRIDGE — simulation / game
**Hook:** Add walkers to a footbridge until their steps lock together and the bridge starts to sway.
*New:* Strogatz et al. (*Nature* 2005): crowd–structure synchronisation with a sharp critical crowd size.
**First 10 s:** Footsteps patter; you add people; at 160 the bridge begins to wobble and the footsteps fall in step.

### 13. ANCESTORS — data / wonder
**Hook:** Your family tree, followed back 5,000 years, explodes past the population of the Earth and collapses into everyone.
*New:* The Rohde–Olson–Chang (Nature 2004) identical-ancestors point, simulated on a migrating world population.
**First 10 s:** One dot, two, four, a thousand; lines flood back across a map.

### 14. WHILE YOU WEREN'T LOOKING — story / unease
**Hook:** A photograph of an ordinary room that changes only when you look away.
*New:* The page uses focus, visibility and pointer exit as "blinks"; a story told in differences.
**First 10 s:** You look, nothing. You glance at another tab. Something on the table has moved.

### 15. GLASS HARP — music
**Hook:** Circle a wet fingertip around a wine glass's rim and it sings.
*New:* A stick–slip friction model driven by your actual circular pointer speed; water level tunes it.
**First 10 s:** Your cursor circles; a pure tone swells from nothing.

### 16. CLOUDWORK — art
**Hook:** Draw a shape in the sky; over half a minute the real clouds drift into it, then let it go.
**First 10 s:** Volumetric cumulus drift over a field; your stroke glows faintly and the vapour begins to lean toward it.

### 17. OUIJA — language / unease
**Hook:** The planchette amplifies your unconscious hand tremor into letters, and it spells words.
**First 10 s:** You rest your cursor on the glass; it creeps toward "Y".

### 18. MARGINALIA — story
**Hook:** A second-hand book in which 60 years of owners argue, flirt and grieve in the margins.
**First 10 s:** Pencil notes in three different hands, one of which is answering another decades later.

### 19. WAGGLE — game / biology
**Hook:** Dance on the honeycomb to tell the hive where the flowers are.
*New:* The bees decode your drawn waggle run (angle to gravity = bearing to the sun, duration = distance) and fly exactly there.
**First 10 s:** The dark comb, bees crowding your cursor, antennae touching you.

### 20. KINTSUGI — art
**Hook:** Break a bowl, then mend it with gold; every break makes it more beautiful.
**First 10 s:** A tea bowl; a click; it shatters with a real crack pattern; gold wells into the seams as you trace them.

### 21. SILBO — language / sound
**Hook:** Type anything and it is whistled across a volcanic ravine in Silbo Gomero; a shepherd on the far ridge whistles back.
*New:* Real whistled-language phonology (Meyer): vowels as pitch registers, consonants as contour transitions.
**First 10 s:** Wind in a canyon. You type "hola" and a whistle carries across, delayed by 3 km of air.

### 22. POP-UP — story / paper engineering
**Hook:** A pop-up book whose paper city rises with physically correct V-folds and parallel folds as you open it.
**First 10 s:** You drag the cover open; a paper street stands up, tab by tab.

### 23. PATTERN SHELL — art / pyrotechnics
**Hook:** Pack the stars of a firework shell by hand; launch it and it bursts into exactly your pattern.
**First 10 s:** A night harbour; a shell rises and opens into a heart; you are handed a cross-section to fill.

### 24. SAND MANDALA — art / impermanence
**Hook:** Rasp a chak-pur funnel to lay coloured sand grain by grain, then sweep it all away.
**First 10 s:** The rasping sound, a thin stream of red grains falling where you rub.

### 25. SKIP — game
**Hook:** Flick a stone across a lake at dusk with real skipping hydrodynamics (Clanet et al.: the 20° magic angle).
**First 10 s:** Flick; plink-plink-plink; rings spread across still water.
