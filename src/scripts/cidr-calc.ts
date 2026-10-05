// Interactive CIDR calculator for primers. Markdown drops in
// <div class="cidr-calc" data-ip="10.0.1.0" data-n="24"></div> and this fills it in;
// add data-address to also let the reader type the address and see the four steps for
// finding its range. Without JavaScript the div stays empty and the page reads fine.

const toDotted = (x: number) => [24, 16, 8, 0].map((s) => Math.floor(x / 2 ** s) % 256).join('.');
const octetOf = (ip: number, k: number) => Math.floor(ip / 2 ** (24 - k * 8)) % 256;
const ordinal = ['1st', '2nd', '3rd', '4th'];

function parseIp(raw: string): number | null {
  const parts = raw.trim().split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return null;
  return parts.reduce((acc, o) => acc * 256 + Number(o), 0);
}

function bitgrid(ip: number, n: number) {
  const bits = ip.toString(2).padStart(32, '0');
  let html = '';
  for (let k = 0; k < 4; k++) {
    let cells = '';
    for (let j = 0; j < 8; j++) {
      const i = k * 8 + j;
      cells += i < n ? `<span class="n">${bits[i]}</span>` : '<span>?</span>';
    }
    const locked = Math.max(0, Math.min(8, n - k * 8));
    const octet = octetOf(ip, k);
    const lo = octet - (octet % 2 ** (8 - locked));
    const dec = locked === 8 ? `${octet}` : `${lo}–${lo + 2 ** (8 - locked) - 1}`;
    html += `<div class="octet"><div class="bits">${cells}</div><span class="dec">${dec}</span></div>`;
  }
  return html;
}

/** The four steps from the primer, filled in for this address and prefix. */
function steps(ip: number, n: number) {
  if (n === 32) return '<li>A <code>/32</code> locks every bit, so the range is just this one address.</li>';
  if (n === 0) return '<li>A <code>/0</code> locks nothing, so the range is every IPv4 address there is.</li>';
  if (n % 8 === 0) {
    const kept = toDotted(ip).split('.').slice(0, n / 8).join('.');
    return `<li><code>/${n}</code> ends exactly on an octet boundary, so no rounding is needed: <code>${kept}</code> stays as it is and every octet after it runs from 0 to 255.</li>`;
  }
  const k = Math.floor(n / 8);
  const locked = n % 8;
  const block = 2 ** (8 - locked);
  const value = octetOf(ip, k);
  const start = value - (value % block);
  const kept = k === 0 ? 'No earlier octets to keep.' : `Octets before it stay as they are: <code>${toDotted(ip).split('.').slice(0, k).join('.')}</code>.`;
  const rest = k === 3 ? '' : ' Every octet after it runs from 0 to 255.';
  return `
    <li>The prefix ends in the <b>${ordinal[k]} octet</b>, with ${n} − ${k * 8} = ${locked} ${locked === 1 ? 'bit' : 'bits'} locked there. ${kept}</li>
    <li>8 − ${locked} = ${8 - locked} free bits, so the block size is 2<sup>${8 - locked}</sup> = <b>${block}</b>.</li>
    <li>${value} rounds down to a multiple of ${block}: <b>${start}</b>.</li>
    <li>${start} + ${block - 1} = <b>${start + block - 1}</b>.${rest}</li>`;
}

for (const root of document.querySelectorAll<HTMLElement>('.cidr-calc')) {
  const withAddress = 'address' in root.dataset;
  const uid = Math.random().toString(36).slice(2, 8);
  root.innerHTML = `
    <div class="controls">
      ${withAddress ? `<label for="ip-${uid}">Address</label><input id="ip-${uid}" class="ip" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" />` : ''}
      <label for="n-${uid}">Prefix length <span class="mono">/n</span></label>
      <input id="n-${uid}" class="n" type="number" min="0" max="32" step="1" inputmode="numeric" />
      <input type="range" min="0" max="32" step="1" aria-label="Prefix length slider" />
    </div>
    <div class="bitgrid" aria-hidden="true"></div>
    <p class="answer" aria-live="polite"></p>
    <p class="range mono"></p>
    ${withAddress ? '<ol class="steps"></ol>' : ''}`;
  const ipInput = root.querySelector<HTMLInputElement>('input.ip');
  const num = root.querySelector<HTMLInputElement>('input.n')!;
  const slider = root.querySelector<HTMLInputElement>('input[type=range]')!;
  const grid = root.querySelector<HTMLElement>('.bitgrid')!;
  const answer = root.querySelector<HTMLElement>('.answer')!;
  const range = root.querySelector<HTMLElement>('.range')!;
  const stepList = root.querySelector<HTMLElement>('.steps');

  const fail = (msg: string) => {
    answer.textContent = msg;
    grid.innerHTML = range.textContent = '';
    if (stepList) stepList.innerHTML = '';
  };

  const update = () => {
    const ip = parseIp(ipInput ? ipInput.value : root.dataset.ip ?? '10.0.1.0');
    const n = Number(num.value);
    if (ip === null) return fail('Enter an IPv4 address, like 10.0.1.100.');
    if (num.value === '' || !Number.isInteger(n) || n < 0 || n > 32) return fail('Pick a whole number from 0 to 32.');
    slider.value = String(n);
    const size = 2 ** (32 - n);
    const first = Math.floor(ip / size) * size;
    const network = `${toDotted(first)}/${n}`;
    grid.innerHTML = bitgrid(ip, n);
    answer.innerHTML = `2<sup>(32 − ${n})</sup> = 2<sup>${32 - n}</sup> = <b>${size.toLocaleString('en-US')}</b> ${size === 1 ? 'address' : 'addresses'}`;
    range.textContent =
      withAddress && first !== ip
        ? `${toDotted(ip)} is in ${network}  →  ${toDotted(first)} to ${toDotted(first + size - 1)}`
        : `${network}  →  ${toDotted(first)} to ${toDotted(first + size - 1)}`;
    if (stepList) stepList.innerHTML = steps(ip, n);
  };

  if (ipInput) ipInput.value = root.dataset.ip ?? '10.0.1.100';
  num.value = root.dataset.n ?? '24';
  ipInput?.addEventListener('input', update);
  num.addEventListener('input', update);
  slider.addEventListener('input', () => {
    num.value = slider.value;
    update();
  });
  update();
}
