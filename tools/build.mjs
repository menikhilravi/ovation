#!/usr/bin/env node
// build.mjs — inline src/*.js (in ORDER) and the audio worklet into one self-contained dist/index.html.
// Usage: node tools/build.mjs [--watch]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const OUTDIR = process.argv.includes('--dev') ? 'dev' : 'dist';
const OUT = path.join(ROOT, OUTDIR, 'index.html');
const ORDER = ['util.js', 'house.js', 'crowd.js', 'director.js', 'audio.js', 'gl.js', 'render.js', 'main.js'];

function build() {
  const t0 = Date.now();
  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const worklet = fs.readFileSync(path.join(SRC, 'worklet.js'), 'utf8');
  const parts = [`const WORKLET_SRC = ${JSON.stringify(worklet)};`];
  for (const f of ORDER) {
    const p = path.join(SRC, f);
    if (!fs.existsSync(p)) continue;
    parts.push(`// ───────── ${f} ─────────\n` + fs.readFileSync(p, 'utf8'));
  }
  const js = `(() => {\n'use strict';\n${parts.join('\n')}\n})();`;
  html = html.replace('<!--SCRIPT-->', () => `<script>\n${js}\n</script>`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  // the Artifact host supplies its own document skeleton: publish the same page without ours
  const frag = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/?head>\s*/gi, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '').replace(/<\/html>\s*/i, '')
    .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
  fs.writeFileSync(path.join(path.dirname(OUT), 'ovation.html'), frag);
  fs.copyFileSync(path.join(SRC, 'worklet.js'), path.join(path.dirname(OUT), 'worklet.js'));
  console.log(`built ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(1)} KB) in ${Date.now() - t0} ms`);
}
build();
if (process.argv.includes('--watch')) {
  let timer = null;
  fs.watch(SRC, () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 80); });
}
