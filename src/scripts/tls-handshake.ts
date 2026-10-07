// Step-through message diagram of a TLS handshake, for the TLS handshake primer.
// Markdown drops in <div class="tls-walk"></div> and this fills it in. Pick TLS 1.3 or
// TLS 1.2, then step (or play) through the messages: each one slides between the client
// and server columns, shows what it carries, and is marked when it's encrypted. A round
// trip counter shows why 1.3 is faster. Without JavaScript the div stays empty and the
// numbered list in the primer describes the same messages.

interface Msg {
  dir: 'right' | 'left'; // right = client to server
  name: string;
  carries: string;
  encrypted: boolean;
  explain: string;
  /** A check the receiver does on its own when the message arrives (not a message). */
  check?: string;
  /** Round trips completed once this message arrives (shown on the counter). */
  rtt: number;
}

const FLOWS: Record<string, { label: string; msgs: Msg[]; done: string }> = {
  '1.3': {
    label: 'TLS 1.3',
    done: 'One round trip, and the request goes out. The server never sent anything readable after its hello.',
    msgs: [
      { dir: 'right', name: 'ClientHello', encrypted: false, rtt: 0, carries: 'name it wants (SNI): app.example.com · protocols (ALPN): h2, http/1.1 · versions: 1.3, 1.2 · cipher suites · its key share (its half of the key exchange)', explain: 'The client says which site it wants and what it supports, and sends its key share (its paint) right away, guessing which key exchange method the server will pick.' },
      { dir: 'left', name: 'ServerHello', encrypted: false, rtt: 1, carries: 'chosen version: 1.3 · chosen cipher suite · its key share', explain: 'The server picks a version and cipher suite from the client’s lists and sends its own key share. Both sides can now make the same session key (the brown), so everything from here on is encrypted.' },
      { dir: 'left', name: 'EncryptedExtensions', encrypted: true, rtt: 1, carries: 'chosen protocol (ALPN): h2', explain: 'The rest of the server’s choices, now encrypted, including which application protocol to speak.' },
      { dir: 'left', name: 'Certificate', encrypted: true, rtt: 1, check: 'client checks the chain against its trust store', carries: 'leaf certificate + intermediates', explain: 'The server’s certificate chain. The client checks it against its trust store, the way the Certificates and Trust primer describes. Encrypted in 1.3, so someone watching can’t see which certificate it is.' },
      { dir: 'left', name: 'CertificateVerify', encrypted: true, rtt: 1, check: 'client checks the signature with the certificate’s public key', carries: 'a signature over the whole handshake so far, made with the certificate’s private key', explain: 'The server signs the handshake so far with its certificate’s private key, and the client checks the signature with the public key in the certificate. That proves the server really holds the key. A copied certificate is useless without it.' },
      { dir: 'left', name: 'Finished', encrypted: true, rtt: 1, check: 'client checks the checksum against its own record', carries: 'a checksum of the whole handshake', explain: 'A checksum of the whole handshake, made with the new session key. The client compares it with its own record of the handshake, so it knows nothing was changed on the way.' },
      { dir: 'right', name: 'Finished', encrypted: true, rtt: 1, check: 'server checks the client’s checksum', carries: 'the client’s checksum of the handshake', explain: 'Everything checked out, so the client sends its own checksum for the server to check the same way.' },
      { dir: 'right', name: 'GET / (HTTP)', encrypted: true, rtt: 1, carries: 'the actual request', explain: 'The client can send its request right behind its Finished, without waiting for another reply.' },
    ],
  },
  '1.2': {
    label: 'TLS 1.2',
    done: 'Two round trips before the request goes out, and the certificate crossed the network unencrypted.',
    msgs: [
      { dir: 'right', name: 'ClientHello', encrypted: false, rtt: 0, carries: 'name it wants (SNI) · protocols (ALPN) · versions · cipher suites', explain: 'The client says what it supports, but doesn’t send any key exchange yet.' },
      { dir: 'left', name: 'ServerHello', encrypted: false, rtt: 1, carries: 'chosen version and cipher suite', explain: 'The server picks from the client’s lists.' },
      { dir: 'left', name: 'Certificate', encrypted: false, rtt: 1, check: 'client checks the chain against its trust store', carries: 'leaf certificate + intermediates', explain: 'Same certificate chain as in 1.3, and the client checks it the same way, but here it’s sent in the clear, so anyone watching can read it.' },
      { dir: 'left', name: 'ServerKeyExchange', encrypted: false, rtt: 1, check: 'client checks the signature with the certificate’s public key', carries: 'its half of the key exchange, signed with the certificate’s private key', explain: 'The server’s half of the key exchange, signed so the client knows it came from the certificate’s owner.' },
      { dir: 'left', name: 'ServerHelloDone', encrypted: false, rtt: 1, carries: '(nothing else)', explain: 'The server is done with its part and waits for the client.' },
      { dir: 'right', name: 'ClientKeyExchange', encrypted: false, rtt: 1, carries: 'its half of the key exchange', explain: 'Only now does the client send its half, a whole round trip later than in 1.3.' },
      { dir: 'right', name: 'ChangeCipherSpec + Finished', encrypted: true, rtt: 1, carries: '“switching to encryption now” + checksum', explain: 'The client switches to encryption and confirms the handshake.' },
      { dir: 'left', name: 'ChangeCipherSpec + Finished', encrypted: true, rtt: 2, carries: '“switching to encryption now” + checksum', explain: 'The server does the same. That’s the second round trip.' },
      { dir: 'right', name: 'GET / (HTTP)', encrypted: true, rtt: 2, carries: 'the actual request', explain: 'Finally the request goes out.' },
    ],
  },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

for (const root of document.querySelectorAll<HTMLElement>('.tls-walk')) {
  let flow = FLOWS['1.3'];
  let shown = 0; // how many messages are on screen
  let timer: number | undefined;

  root.innerHTML = `
    <div class="tw-controls">
      <span class="tw-modes" role="group" aria-label="TLS version">${Object.entries(FLOWS)
        .map(([k, f]) => `<button type="button" class="tw-mode" data-mode="${k}" aria-pressed="${k === '1.3'}">${esc(f.label)}</button>`)
        .join('')}</span>
      <span class="tw-buttons">
        <button type="button" class="tw-back">Back</button>
        <button type="button" class="tw-next">Next</button>
        <button type="button" class="tw-play">Play</button>
      </span>
    </div>
    <p class="tw-key">Each arrow is one message, from the side that sends it (the dot) to the side that receives it (the arrowhead), in order from top to bottom. <span class="tw-key-enc">Teal with a 🔒</span> means encrypted. A ✓ is a check the receiving side does on its own when a message arrives, so it has no arrow.</p>
    <div class="tw-stage">
      <div class="tw-ends" aria-hidden="true"><span>Client</span><span class="tw-rtt"></span><span>Server</span></div>
      <ol class="tw-msgs"></ol>
    </div>
    <div class="tw-explain" aria-live="polite"></div>`;

  const list = root.querySelector<HTMLElement>('.tw-msgs')!;
  const rtt = root.querySelector<HTMLElement>('.tw-rtt')!;
  const explain = root.querySelector<HTMLElement>('.tw-explain')!;
  const back = root.querySelector<HTMLButtonElement>('.tw-back')!;
  const next = root.querySelector<HTMLButtonElement>('.tw-next')!;
  const play = root.querySelector<HTMLButtonElement>('.tw-play')!;
  const modes = [...root.querySelectorAll<HTMLButtonElement>('.tw-mode')];

  const render = () => {
    list.innerHTML = flow.msgs
      .map((m, i) => {
        const state = i < shown - 1 ? 'past' : i === shown - 1 ? 'current' : 'future';
        return `<li class="tw-msg tw-${m.dir} tw-${state}${m.encrypted ? ' tw-enc' : ''}" ${state === 'future' ? 'aria-hidden="true"' : ''}>
          <span class="tw-line"><span class="tw-name">${m.encrypted ? '<span class="tw-lock" aria-label="encrypted">🔒</span> ' : ''}${esc(m.name)}</span>
            <span class="tw-arrow" aria-hidden="true"><i class="tw-dot"></i><i class="tw-shaft"></i><i class="tw-head"></i></span></span>
          <span class="tw-carries">${esc(m.carries)}</span>
          ${m.check ? `<span class="tw-check tw-check-${m.dir === 'left' ? 'client' : 'server'}">✓ ${esc(m.check)}</span>` : ''}
        </li>`;
      })
      .join('');
    const current = flow.msgs[shown - 1];
    rtt.textContent = `round trips: ${current ? current.rtt : 0}`;
    if (shown === 0) {
      explain.innerHTML = `A browser opening <code>https://app.example.com</code> over ${esc(flow.label)}. Press <b>Next</b> or <b>Play</b>.`;
    } else if (shown === flow.msgs.length) {
      explain.innerHTML = `<b>${esc(current.name)}.</b> ${esc(current.explain)} <b>${esc(flow.done)}</b>`;
    } else {
      explain.innerHTML = `<b>${esc(current.name)}${current.encrypted ? ' (encrypted)' : ' (not encrypted)'}.</b> ${esc(current.explain)}`;
    }
    back.disabled = shown === 0;
    next.disabled = shown === flow.msgs.length;
  };

  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = undefined;
    play.textContent = 'Play';
  };
  const go = (n: number) => {
    shown = Math.max(0, Math.min(flow.msgs.length, n));
    render();
    if (shown === flow.msgs.length) stop();
  };

  for (const b of modes) {
    b.addEventListener('click', () => {
      stop();
      flow = FLOWS[b.dataset.mode!];
      modes.forEach((m) => m.setAttribute('aria-pressed', String(m === b)));
      go(0);
    });
  }
  back.addEventListener('click', () => { stop(); go(shown - 1); });
  next.addEventListener('click', () => { stop(); go(shown + 1); });
  play.addEventListener('click', () => {
    if (timer) return stop();
    if (shown === flow.msgs.length) go(0);
    play.textContent = 'Pause';
    go(shown + 1);
    timer = window.setInterval(() => go(shown + 1), reducedMotion() ? 4000 : 2400);
  });

  go(0);
}
