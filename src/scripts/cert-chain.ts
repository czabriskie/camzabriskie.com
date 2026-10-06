// Step-through animation of how a client decides to trust a server's certificate, for
// the Certificates and Trust primer. Markdown drops in <div class="cert-walk"></div>
// and this fills it in. Pick a scenario, then step (or play) through the checks: each
// step highlights the fields it looks at, and a failing scenario stops at the check that
// fails with the error a client would report. Without JavaScript the div stays empty
// and the prose above it describes the same checks.

type Status = 'pending' | 'checking' | 'pass' | 'fail';

interface Card {
  id: 'leaf' | 'inter' | 'root';
  label: string;
  name: string;
  issuer: string;
  covers?: string;
  valid: string;
  note?: string;
  missing?: boolean;
}

interface Step {
  title: string;
  /** Which card fields to highlight: "<card>.<field>", or "server" for the server box. */
  focus: string[];
  explain: string;
}

interface Scenario {
  label: string;
  cards: Record<Card['id'], Card>;
  /** Index of the step that fails, if any, and what the client reports. */
  failAt?: number;
  failExplain?: string;
  error?: string;
}

const STEPS: Step[] = [
  {
    title: 'Does the certificate cover this name?',
    focus: ['leaf.covers'],
    explain: 'The browser asked for app.example.com, so that name has to be on the certificate, either exactly or through a wildcard.',
  },
  {
    title: 'Is it in date?',
    focus: ['leaf.valid'],
    explain: "Today (Oct 6, 2026 in this example) has to fall between the certificate's start and end dates.",
  },
  {
    title: 'Did the intermediate really sign it?',
    focus: ['leaf.issuer', 'inter.name', 'arrow1'],
    explain: "The certificate says it was issued by Example Intermediate CA. The browser checks the certificate's signature using that intermediate's public key. Only the intermediate's private key could have made a signature that checks out.",
  },
  {
    title: 'Did a root sign the intermediate?',
    focus: ['inter.issuer', 'root.name', 'arrow2'],
    explain: "Same check one level up: the intermediate's signature is checked with the root's public key.",
  },
  {
    title: 'Is that root in the trust store?',
    focus: ['root.store'],
    explain: "A root signs itself, so its signature proves nothing. It's trusted only because it's already in the browser's built-in trust store.",
  },
  {
    title: 'Does the server hold the private key?',
    focus: ['server'],
    explain: "Certificates are public, so anyone could send this one. During the handshake the server signs the conversation with the certificate's private key, and the browser checks that signature with the certificate's public key.",
  },
];

const base = (): Scenario['cards'] => ({
  leaf: { id: 'leaf', label: "Site's certificate", name: 'app.example.com', issuer: 'Example Intermediate CA', covers: 'app.example.com, example.com', valid: 'Aug 1, 2026 to Oct 30, 2026' },
  inter: { id: 'inter', label: 'Intermediate', name: 'Example Intermediate CA', issuer: 'Example Root CA', valid: '2024 to 2029' },
  root: { id: 'root', label: 'Root certificate', name: 'Example Root CA', issuer: 'itself', valid: '2015 to 2040', note: 'In this browser’s trust store' },
});

const SCENARIOS: Record<string, Scenario> = {
  valid: { label: 'Everything checks out', cards: base() },
  name: (() => {
    const cards = base();
    cards.leaf.covers = '*.example.org';
    return {
      label: 'Wrong name',
      cards,
      failAt: 0,
      failExplain: "The certificate covers *.example.org, not app.example.com. Often this means the server sent the certificate for a different site it also hosts.",
      error: 'hostname mismatch (browsers: "your connection is not private")',
    };
  })(),
  expired: (() => {
    const cards = base();
    cards.leaf.valid = 'Jun 1, 2026 to Sep 1, 2026';
    return {
      label: 'Expired',
      cards,
      failAt: 1,
      failExplain: 'The certificate ended on Sep 1. Nothing else about it changed, but an expired certificate is rejected anyway. Usually something that was supposed to renew it didn’t.',
      error: 'certificate has expired',
    };
  })(),
  missing: (() => {
    const cards = base();
    cards.inter.missing = true;
    return {
      label: 'Missing intermediate',
      cards,
      failAt: 2,
      failExplain: 'The certificate says Example Intermediate CA signed it, but the server didn’t send that certificate, so there’s no public key to check the signature with. Some browsers find the intermediate on their own; scripts and other tools usually don’t.',
      error: 'unable to get local issuer certificate',
    };
  })(),
  untrusted: (() => {
    const cards = base();
    cards.inter.issuer = 'Corp Internal Root';
    cards.root.name = 'Corp Internal Root';
    cards.root.note = 'Not in this browser’s trust store';
    return {
      label: 'Untrusted root',
      cards,
      failAt: 4,
      failExplain: 'Every signature checks out, but the chain ends at Corp Internal Root, which this browser has never been told to trust. This is the private CA case: add the root to the trust store, and this passes.',
      error: 'self-signed certificate in certificate chain (Java: PKIX path building failed)',
    };
  })(),
  stolen: (() => ({
    label: 'Copied certificate, no key',
    cards: base(),
    failAt: 5,
    failExplain: 'The certificate itself is fine, because it’s the real one, copied from the real site. But whoever sent it doesn’t have the private key, so they can’t produce a signature that checks out with the certificate’s public key.',
    error: 'decrypt_error alert: the handshake is aborted',
  }))(),
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function cardHtml(c: Card) {
  const row = (field: string, k: string, v: string) =>
    `<div class="cw-row" data-f="${c.id}.${field}"><span class="cw-k">${k}</span><span class="cw-v">${esc(v)}</span></div>`;
  return `<div class="cw-card${c.missing ? ' cw-missing' : ''}" data-card="${c.id}">
    <div class="cw-label">${esc(c.label)}${c.missing ? ' <em>(not sent)</em>' : ''}</div>
    ${row('name', 'Name', c.name)}
    ${row('issuer', 'Signed by', c.issuer)}
    ${c.covers ? row('covers', 'Covers', c.covers) : ''}
    ${row('valid', 'Valid', c.valid)}
    ${c.note ? `<div class="cw-row cw-store" data-f="${c.id}.store">${esc(c.note)}</div>` : ''}
  </div>`;
}

for (const root of document.querySelectorAll<HTMLElement>('.cert-walk')) {
  let scenario = SCENARIOS.valid;
  let step = -1; // -1 = before the first check
  let timer: number | undefined;

  root.innerHTML = `
    <div class="cw-controls">
      <label>Scenario <select class="cw-scenario">${Object.entries(SCENARIOS)
        .map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`)
        .join('')}</select></label>
      <span class="cw-buttons">
        <button type="button" class="cw-back">Back</button>
        <button type="button" class="cw-next">Next</button>
        <button type="button" class="cw-play">Play</button>
      </span>
    </div>
    <div class="cw-chain"></div>
    <div class="cw-server" data-f="server">Server <span class="cw-v">app.example.com, holding the private key</span></div>
    <ol class="cw-checks">${STEPS.map((s) => `<li><span class="cw-icon" aria-hidden="true"></span>${esc(s.title)}</li>`).join('')}</ol>
    <div class="cw-explain" aria-live="polite"></div>`;

  const chain = root.querySelector<HTMLElement>('.cw-chain')!;
  const select = root.querySelector<HTMLSelectElement>('.cw-scenario')!;
  const back = root.querySelector<HTMLButtonElement>('.cw-back')!;
  const next = root.querySelector<HTMLButtonElement>('.cw-next')!;
  const play = root.querySelector<HTMLButtonElement>('.cw-play')!;
  const server = root.querySelector<HTMLElement>('.cw-server')!;
  const items = [...root.querySelectorAll<HTMLLIElement>('.cw-checks li')];
  const explain = root.querySelector<HTMLElement>('.cw-explain')!;

  const lastStep = () => (scenario.failAt ?? STEPS.length - 1) + 1; // the step after the last check is the verdict

  const renderChain = () => {
    const c = scenario.cards;
    chain.innerHTML =
      cardHtml(c.leaf) +
      `<div class="cw-arrow" data-f="arrow1" aria-hidden="true">signed by →</div>` +
      cardHtml(c.inter) +
      `<div class="cw-arrow" data-f="arrow2" aria-hidden="true">signed by →</div>` +
      cardHtml(c.root);
    server.classList.toggle('cw-nokey', scenario === SCENARIOS.stolen);
    server.querySelector('.cw-v')!.textContent =
      scenario === SCENARIOS.stolen ? 'an impostor with a copy of the certificate, but no private key' : 'app.example.com, holding the private key';
  };

  const render = () => {
    const failAt = scenario.failAt;
    items.forEach((li, i) => {
      let s: Status = 'pending';
      if (i < step) s = failAt === i ? 'fail' : 'pass';
      if (i === step) s = failAt === i ? 'fail' : 'checking';
      if (failAt !== undefined && i > failAt) s = 'pending';
      li.dataset.status = failAt !== undefined && i > failAt && step > failAt ? 'skipped' : s;
    });
    root.querySelectorAll('[data-f]').forEach((el) => el.classList.remove('cw-focus', 'cw-bad'));
    // Highlight only while a check is on screen, not on the verdict that follows it.
    const current = step >= 0 && step < lastStep() ? STEPS[step] : undefined;
    if (current) {
      for (const f of current.focus) {
        root.querySelectorAll(`[data-f="${f}"]`).forEach((el) => el.classList.add(failAt === step ? 'cw-bad' : 'cw-focus'));
      }
    }
    const verdict = step >= lastStep();
    root.dataset.verdict = verdict ? (failAt === undefined ? 'trusted' : 'rejected') : '';
    if (step < 0) {
      explain.innerHTML = 'The server has sent its certificate and the intermediate that signed it. Press <b>Next</b> or <b>Play</b> to watch the browser check them.';
    } else if (verdict && failAt === undefined) {
      explain.innerHTML = '<b>Trusted.</b> Every check passed, so the browser finishes the handshake and shows the page.';
    } else if (verdict) {
      explain.innerHTML = `<b>Rejected</b> at check ${failAt! + 1}. The client reports: <code>${esc(scenario.error!)}</code>. See <a href="#reading-the-errors">Reading the errors</a>.`;
    } else if (failAt === step) {
      explain.innerHTML = `<b>${esc(current!.title)}</b> No. ${esc(scenario.failExplain!)}`;
    } else {
      explain.innerHTML = `<b>${esc(current!.title)}</b> ${esc(current!.explain)}`;
    }
    back.disabled = step < 0;
    next.disabled = step >= lastStep();
  };

  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = undefined;
    play.textContent = 'Play';
  };
  const go = (n: number) => {
    step = Math.max(-1, Math.min(lastStep(), n));
    render();
    if (step >= lastStep()) stop();
  };

  select.addEventListener('change', () => {
    stop();
    scenario = SCENARIOS[select.value];
    renderChain();
    go(-1);
  });
  back.addEventListener('click', () => { stop(); go(step - 1); });
  next.addEventListener('click', () => { stop(); go(step + 1); });
  play.addEventListener('click', () => {
    if (timer) return stop();
    if (step >= lastStep()) go(-1);
    play.textContent = 'Pause';
    go(step + 1);
    timer = window.setInterval(() => go(step + 1), reducedMotion() ? 4000 : 2600);
  });

  renderChain();
  go(-1);
}
