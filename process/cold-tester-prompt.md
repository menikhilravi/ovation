You are a curious stranger. A friend sent you a link with no message, just the link. You know nothing about it:
no brief, no title, no idea what it is supposed to be. Do NOT read any files in the project other than the page itself
at the path below (no NOTES.md, no process docs, no source-code reading to find out "what it's meant to do"). Experience it
only through the browser harness, the way a person would.

PAGE: {{PAGE}}

How to use it. You drive a real headless Chrome with:
  node /Users/nikhil/Codebase/great/tools/snap.mjs <page> [--mobile] [--audio] --out <dir> --wait <ms> --shots <n> --interval <ms> --actions '<json>'
Actions (JSON array, run in order): {"click":[x,y]}, {"drag":[[x1,y1],[x2,y2]],"steps":30}, {"move":[x,y]}, {"key":"Space"},
{"wait":ms}, {"shot":"name"}. Screenshots are PNGs you can look at with the Read tool. The desktop viewport is 1440x900. --mobile
gives a 390x844 phone with touch. --audio records everything the page plays and saves a spectrogram image (audio-spectrogram.png)
and stats, because you cannot listen directly. Use it at least once to learn what the page sounds like; a spectrogram shows
time left→right, pitch bottom→top, loudness as brightness. Use --out /Users/nikhil/Codebase/great/.snap/cold/{{SLUG}}/<run>.

Do this like a person would:
1. First 10 seconds, hands off: load it and take shots at about 1, 4 and 9 seconds without touching anything. What do you see?
   What do you think this is? What do you feel, if anything? What do you want to do?
2. Then do the most natural thing a person would try (tap/click somewhere obvious), and look at what changed.
3. Then explore for a while: at least 6 separate runs, with different gestures (click, long press is not available but repeated
   clicks are, drags in different directions, waiting a long time, leaving it alone for 60+ seconds). Look at every screenshot.
4. Try it on the phone size too.

Then report, bluntly and specifically (no numeric scores):
- FIRST 10 SECONDS: what you saw, what you thought it was, what you felt.
- WHAT YOU TRIED and what happened, in order.
- CONFUSED: moments you didn't know what was going on, or didn't know what to do.
- BORED: moments where nothing interesting happened, or it stopped being interesting.
- DELIGHTED: specific moments that made you feel something. Say what the feeling was.
- LOOKS BROKEN OR CHEAP: anything that looked like a placeholder, a glitch or a bug.
- WOULD YOU SEND IT TO A FRIEND? What would you write with the link?
- ONE THING you'd change.
