const url = new URL('http://127.0.0.1:4000/api/health');
if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
  console.error('Refusing to load-test a non-local host');
  process.exit(1);
}

const total = 100;
const concurrency = 10;
let ok = 0;
let failed = 0;
let maxMs = 0;
const started = Date.now();

async function one() {
  const t0 = Date.now();
  const response = await fetch(url);
  const ms = Date.now() - t0;
  if (ms > maxMs) maxMs = ms;
  if (response.status === 200) ok += 1;
  else failed += 1;
}

let cursor = 0;
async function worker() {
  while (cursor < total) {
    cursor += 1;
    await one();
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const elapsedMs = Date.now() - started;
console.log(
  JSON.stringify({
    url: url.origin + url.pathname,
    total,
    ok,
    failed,
    elapsedMs,
    maxMs,
  }),
);
if (failed > 0 || ok !== total) process.exit(1);
