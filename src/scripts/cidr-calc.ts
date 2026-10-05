// Interactive CIDR calculator for primers. Markdown drops in
// <div class="cidr-calc" data-ip="10.0.1.0" data-n="24"></div> and this fills it in;
// without JavaScript the div stays empty and the page's static table still does the job.

const toInt = (ip: string) => ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0);
const toDotted = (x: number) => [24, 16, 8, 0].map((s) => Math.floor(x / 2 ** s) % 256).join('.');

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
    const octet = Math.floor(ip / 2 ** (24 - k * 8)) % 256;
    const lo = octet - (octet % 2 ** (8 - locked));
    const dec = locked === 8 ? `${octet}` : `${lo}–${lo + 2 ** (8 - locked) - 1}`;
    html += `<div class="octet"><div class="bits">${cells}</div><span class="dec">${dec}</span></div>`;
  }
  return html;
}

for (const root of document.querySelectorAll<HTMLElement>('.cidr-calc')) {
  const base = toInt(root.dataset.ip ?? '10.0.1.0');
  const id = `cidr-n-${Math.random().toString(36).slice(2, 8)}`;
  root.innerHTML = `
    <div class="controls">
      <label for="${id}">Prefix length <span class="mono">/n</span></label>
      <input id="${id}" type="number" min="0" max="32" step="1" inputmode="numeric" />
      <input type="range" min="0" max="32" step="1" aria-label="Prefix length slider" />
    </div>
    <div class="bitgrid" aria-hidden="true"></div>
    <p class="answer" aria-live="polite"></p>
    <p class="range mono"></p>`;
  const num = root.querySelector<HTMLInputElement>('input[type=number]')!;
  const slider = root.querySelector<HTMLInputElement>('input[type=range]')!;
  const grid = root.querySelector<HTMLElement>('.bitgrid')!;
  const answer = root.querySelector<HTMLElement>('.answer')!;
  const range = root.querySelector<HTMLElement>('.range')!;

  const update = (raw: string) => {
    const n = Math.round(Number(raw));
    if (raw === '' || Number.isNaN(n) || n < 0 || n > 32) {
      answer.textContent = 'Pick a whole number from 0 to 32.';
      return;
    }
    num.value = slider.value = String(n);
    const size = 2 ** (32 - n);
    const first = Math.floor(base / size) * size;
    grid.innerHTML = bitgrid(base, n);
    answer.innerHTML = `2<sup>(32 − ${n})</sup> = 2<sup>${32 - n}</sup> = <b>${size.toLocaleString('en-US')}</b> ${size === 1 ? 'address' : 'addresses'}`;
    range.textContent = `${toDotted(first)}/${n}  →  ${toDotted(first)} to ${toDotted(first + size - 1)}`;
  };

  num.addEventListener('input', () => update(num.value));
  slider.addEventListener('input', () => update(slider.value));
  update(root.dataset.n ?? '24');
}
