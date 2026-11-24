// The catalogs and the code agree (R-006). Run by `npm run lint` (so by CI):
//   1. src/i18n/he.ts and src/i18n/en.ts have the same keys (TypeScript checks en.ts against he.ts too);
//   2. every key is used somewhere in src/ (as a quoted string), except the families the code builds from a stored
//      value (DYNAMIC below) and the event lines (`ev.*`), which are stored in tables and must never go away;
//   3. no Hebrew letter (U+0590–U+05FF) anywhere in src/ outside src/i18n/he.ts: every word on the screen comes from
//      a catalog. (Text a test needs in Hebrew is spelled with \u escapes, or read from he.ts.)
// Exits 1 with a list of what is wrong.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'src');
const HE = join(SRC, 'i18n', 'he.ts');
const EN = join(SRC, 'i18n', 'en.ts');

/** Key families looked up as prefix + a stored or computed value (see the file named). */
const DYNAMIC = [
  'result.', // src/ui/labels.ts resultText(): a Blackjack hand's stored result
  'stage.', // src/ui/labels.ts stageText(): the room's stage
  'act.', // src/ui/labels.ts actionText(): a player's stored lastAction.k
  'ev.', // the event line, stored in the table (lastEvent.key); src/app/actions/holdem.ts builds 'ev.' + stage
];

const keysOf = file => [...readFileSync(file, 'utf8').matchAll(/^ {2}'([a-z][\w.]*)':/gm)].map(m => m[1]);

function files(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const problems = [];
const he = keysOf(HE),
  en = keysOf(EN);
if (!he.length) problems.push('no keys found in src/i18n/he.ts');
const dup = l => l.filter((k, i) => l.indexOf(k) !== i);
for (const k of dup(he)) problems.push(`he.ts: key twice: ${k}`);
for (const k of dup(en)) problems.push(`en.ts: key twice: ${k}`);
for (const k of he.filter(k => !en.includes(k))) problems.push(`en.ts: missing ${k}`);
for (const k of en.filter(k => !he.includes(k))) problems.push(`en.ts: not in he.ts: ${k}`);

const all = files(SRC);
const code = all
  .filter(f => /\.(ts|tsx)$/.test(f) && f !== HE && f !== EN && !/\.test\.tsx?$/.test(f))
  .map(f => readFileSync(f, 'utf8'))
  .join('\n');
for (const k of he) {
  if (DYNAMIC.some(p => k.startsWith(p))) continue;
  if (!code.includes(`'${k}'`) && !code.includes(`"${k}"`)) problems.push(`unused key: ${k}`);
}

const HEBREW = /[\u0590-\u05FF]/;
for (const f of all) {
  if (f === HE) continue;
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (HEBREW.test(line)) problems.push(`Hebrew outside he.ts: ${relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
    });
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`check-i18n: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`check-i18n: ${he.length} keys in both catalogs, all used; no Hebrew outside src/i18n/he.ts`);
