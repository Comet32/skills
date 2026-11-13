#!/usr/bin/env node
// Runs a steps file in ego-browser instead of the user's Chrome. Same steps-file API as cdp.mjs,
// same screenshots and results.json, but no DevTools "Allow" prompt: ego-browser drives its own
// signed-in profile, in a task space of its own.
//
// usage: node ego.mjs <steps.mjs> <outDir> [--base <url>] [--keep-open]
//   --base       origin that relative paths in open()/navigate() resolve against (e.g. http://localhost:3000)
//   --keep-open  leave the opened pages open for the user when the run ends
// exit:  0 every check passed · 1 a check failed or the steps threw · 2 bad usage
//        · 5 ego-browser could not be run (not installed, not running)
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(`--${name}`); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const bool = name => { const i = args.indexOf(`--${name}`); if (i < 0) return false; args.splice(i, 1); return true; };
const base = flag('base')?.replace(/\/$/, '');
const keepOpen = bool('keep-open');
const [stepsFile, outDir] = args;
if (!stepsFile || !outDir) {
  console.error('usage: node ego.mjs <steps.mjs> <outDir> [--base <url>] [--keep-open]');
  process.exit(2);
}
// ego-browser's script does not run in this working directory: hand it absolute paths.
const cfg = { stepsFile: resolve(stepsFile), outDir: resolve(outDir), base, keepOpen };

const runtime = pathToFileURL(fileURLToPath(new URL('./ego-runtime.mjs', import.meta.url))).href;
const SENTINEL = '[ego.mjs] exit=';
// ego-browser may decorate the lines it relays (colour codes, a carriage return), so match anywhere.
const SENTINEL_RE = /\[ego\.mjs\] exit=(\d+)/;
// The SDK functions exist only in this script's scope, so they are passed to the runtime explicitly.
const script = `
const rt = await import(${JSON.stringify(runtime)});
const code = await rt.run(${JSON.stringify(cfg)}, { taskSpace });
console.log(${JSON.stringify(SENTINEL)} + code);
`;

const child = spawn('ego-browser', ['nodejs'], { stdio: ['pipe', 'pipe', 'pipe'] });
let code = null;
// ego-browser relays the script's console output on either stream, so scan both: forward every
// line as it arrives and hold back only the sentinel line that carries the exit code.
function relay(stream, print) {
  let tail = '';
  const take = line => {
    const m = SENTINEL_RE.exec(line);
    if (m) code = Number(m[1]);
    else print(line);
  };
  stream.on('data', chunk => {
    const lines = (tail + chunk.toString()).split('\n');
    tail = lines.pop();
    lines.forEach(take);
  });
  stream.on('end', () => { if (tail) take(tail); });
}
relay(child.stdout, line => console.log(line));
relay(child.stderr, line => console.error(line));
child.on('error', e => {
  console.error(`could not run ego-browser: ${e.message}. Install it (see the ego-browser skill) or use cdp.mjs.`);
  process.exit(5);
});
child.on('close', status => {
  // No sentinel means the script died before the runtime returned (a thrown error, a crash,
  // ego-browser not running): report it as 5 so the caller can fall back to cdp.mjs.
  process.exit(code ?? (status === 0 ? 1 : 5));
});
child.stdin.end(script);
