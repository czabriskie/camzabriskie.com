// Route table lookup for primers. Markdown drops in
// <div class="route-lookup" data-ip="10.20.5.9" data-routes='[["10.0.0.0/16","local","what happens"], ...]'></div>
// and this lets the reader type a destination and see which routes match and which one
// wins (longest prefix match). Without JavaScript the div stays empty.

type Route = { cidr: string; target: string; outcome: string; base: number; n: number };

function parseIp(raw: string): number | null {
  const parts = raw.trim().split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return null;
  return parts.reduce((acc, o) => acc * 256 + Number(o), 0);
}

const inRange = (ip: number, r: Route) => {
  const size = 2 ** (32 - r.n);
  return Math.floor(ip / size) === Math.floor(r.base / size);
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

for (const root of document.querySelectorAll<HTMLElement>('.route-lookup')) {
  const routes: Route[] = (JSON.parse(root.dataset.routes ?? '[]') as string[][]).map(([cidr, target, outcome]) => {
    const [addr, n] = cidr.split('/');
    return { cidr, target, outcome, base: parseIp(addr)!, n: Number(n) };
  });
  const uid = Math.random().toString(36).slice(2, 8);
  root.innerHTML = `
    <div class="controls">
      <label for="dest-${uid}">Packet headed for</label>
      <input id="dest-${uid}" class="ip" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" />
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Destination</th><th>Target (next hop)</th><th>Matches?</th><th>Prefix</th></tr></thead>
      <tbody></tbody>
    </table></div>
    <p class="answer" aria-live="polite"></p>`;
  const input = root.querySelector<HTMLInputElement>('input')!;
  const tbody = root.querySelector<HTMLElement>('tbody')!;
  const answer = root.querySelector<HTMLElement>('.answer')!;

  const update = () => {
    const ip = parseIp(input.value);
    if (ip === null) {
      tbody.innerHTML = routes
        .map((r) => `<tr><td><code>${r.cidr}</code></td><td><code>${esc(r.target)}</code></td><td></td><td>/${r.n}</td></tr>`)
        .join('');
      answer.textContent = 'Enter an IPv4 address, like 10.20.5.9.';
      return;
    }
    const matches = routes.filter((r) => inRange(ip, r));
    const winner = matches.reduce<Route | null>((best, r) => (!best || r.n > best.n ? r : best), null);
    tbody.innerHTML = routes
      .map((r) => {
        const hit = matches.includes(r);
        const cls = r === winner ? 'win' : hit ? 'hit' : 'miss';
        const label = r === winner ? 'Yes, wins' : hit ? 'Yes' : 'No';
        return `<tr class="${cls}"><td><code>${r.cidr}</code></td><td><code>${esc(r.target)}</code></td><td>${label}</td><td>/${r.n}</td></tr>`;
      })
      .join('');
    const addr = input.value.trim();
    if (!winner) {
      answer.innerHTML = `No route matches <code>${esc(addr)}</code>, so the packet is dropped.`;
    } else if (matches.length === 1) {
      answer.innerHTML = `Only <code>${winner.cidr}</code> matches, so it's ${esc(winner.outcome)}.`;
    } else {
      const others = matches.filter((r) => r !== winner).map((r) => `/${r.n}`).join(' and ');
      answer.innerHTML = `${matches.length} routes match. <b>/${winner.n}</b> is longer than ${others}, so <code>${winner.cidr}</code> wins and it's ${esc(winner.outcome)}.`;
    }
  };

  input.value = root.dataset.ip ?? '';
  input.addEventListener('input', update);
  update();
}
