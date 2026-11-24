// The pixel comparison against another version rendered on this machine, for CI: fonts differ between machines (the
// tests block web fonts, and the fallback fonts are whatever the system has), so tests/baseline/ (taken here) can't be
// compared with pictures taken on a CI runner. Instead the earlier version is built and photographed on the same
// machine, then this version is compared with it, screen by screen, with the same zero tolerance.
//   node tests/visual-against.js <git ref>     e.g. origin/main, HEAD~1, a commit
// Without a ref (or the all-zero ref of a new branch): the merge base with origin/main, or HEAD~1 on main itself.
// A version from before the Vite build (no package.json) is served as it is, like the old single-file app.
// Screens whose baseline image was changed between the two versions (an intended visual change, see
// tests/baseline/) are skipped: they are expected to differ. The screens are tests/visual.js's.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { OUT } = require('./lib');          // builds this version's dist/ (unless SKIP_BUILD=1)
const visual = require('./visual');

const ROOT = path.join(__dirname, '..');
const git = cmd => execSync('git ' + cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
const tryGit = cmd => { try { return git(cmd); } catch(e){ return ''; } };

function baseRef(){
  const given = process.argv[2] || process.env.BASE_REF || '';
  // A ref that isn't in this clone (the old head of a force-push) falls back like no ref at all.
  const sha = given && !/^0+$/.test(given) ? tryGit(`rev-parse --verify --quiet ${given}^{commit}`) : '';
  if (sha) return sha;
  if (given && !/^0+$/.test(given)) console.log(`no commit ${given} here: comparing with the merge base instead`);
  const head = git('rev-parse HEAD'), mb = tryGit('merge-base HEAD origin/main');
  return mb && mb !== head ? mb : git('rev-parse HEAD~1');
}

// The earlier version's files, and the folder to serve: its dist/ after a build, or its root.
function prepare(sha){
  const dir = path.join(OUT, 'base-' + sha.slice(0, 10));
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  execSync(`git archive ${sha} | tar -x -C "${dir}"`, { cwd: ROOT });
  if (!fs.existsSync(path.join(dir, 'package.json'))) return dir;
  const same = f => fs.existsSync(path.join(dir, f)) && fs.readFileSync(path.join(dir, f), 'utf8') === fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (same('package-lock.json')) fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  else execSync('npm ci --no-audit --no-fund --loglevel error', { cwd: dir, stdio: 'inherit' });
  execSync('npx vite build --logLevel warn', { cwd: dir, stdio: 'inherit' });
  return path.join(dir, 'dist');
}

(async () => {
  const sha = baseRef(), head = git('rev-parse HEAD');
  console.log(`pixel comparison: this version (${head.slice(0, 10)}) against ${sha.slice(0, 10)}, both rendered here`);
  // Baselines changed in between are intended visual changes.
  const changed = new Set(tryGit(`log --diff-filter=AM --name-only --format= ${sha}..HEAD -- tests/baseline`).split('\n')
    .filter(Boolean).map(f => path.basename(f, '.png')));
  const names = visual.SCREENS.map(s => s.name), only = names.filter(n => !changed.has(n));
  names.filter(n => changed.has(n)).forEach(n => console.log(`SKIP  visual ${n}  (baseline changed since ${sha.slice(0, 10)}: an intended change)`));
  const dist = prepare(sha), baseline = path.join(OUT, 'base-pictures');
  fs.rmSync(baseline, { recursive: true, force: true });
  console.log(`photographing ${sha.slice(0, 10)} (${only.length} screens)…`);
  const baseErrors = await visual.run({ update: true, dist, baseline, only, quiet: true });
  if (baseErrors) console.log(`(${baseErrors} page error(s) on the earlier version, above; its pictures are compared all the same)`);
  const failed = await visual.run({ baseline, only });
  console.log(failed ? `${failed} visual check(s) failed against ${sha.slice(0, 10)}` : `visual: all screens match ${sha.slice(0, 10)}`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
