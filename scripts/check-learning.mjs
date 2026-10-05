// Fails the build if a learning note contains an IPv4 address that could be someone's
// real network (Decision 0006). Notes stick to the private ranges (RFC 1918) and the
// ranges reserved for documentation (RFC 5737), so anything else is almost certainly a
// copy-paste from a real environment.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src/content/learning';

// [first address, prefix length]
const ALLOWED = [
  ['0.0.0.0', 8], // "this network", incl. 0.0.0.0/0
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['192.0.2.0', 24],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3], // multicast, reserved, and netmasks like 255.255.255.0
];

const toInt = (ip) => ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0);
const inRange = (ip, [base, len]) => {
  const size = 2 ** (32 - len);
  return Math.floor(toInt(ip) / size) === Math.floor(toInt(base) / size);
};

const files = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.md') ? [p] : [];
  });

const problems = [];
for (const file of files(ROOT)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const [ip] of line.matchAll(/(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g)) {
      if (ip.split('.').some((o) => Number(o) > 255)) continue;
      if (!ALLOWED.some((r) => inRange(ip, r))) problems.push(`${file}:${i + 1}  ${ip}`);
    }
  });
}

if (problems.length) {
  console.error('Learning notes may only use private (RFC 1918) or documentation (RFC 5737) addresses:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
