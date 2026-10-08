import {createSender} from './index.js';

// Settings that were proven to send exactly once on web.snapchat.com.
const SENDER_DEFAULTS = {
  targetSnapCount: 1,
  actionDelay: 400,
  singleSendClick: true,
  maxSendClicks: 1,
  maxTotalSendClicks: 1,
  patchCanvas: false,
};
const STORE = 'ghostmessage.panel.v1';
const DEFAULTS = {tab: 'shortcut', shortcut: '', names: '', count: 1, forever: false, gap: 0, members: false, minimized: false, x: null, y: null};
const CYCLE_WATCHDOG_MS = 45000;
const MAX_FAILURES_IN_A_ROW = 3;
const MIN_GAP_SECONDS = 0;

const load = () => { try { return {...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}')}; } catch { return {...DEFAULTS}; } };
const save = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch {} };

const CSS = `
:host{all:initial}
*{box-sizing:border-box}
[hidden]{display:none!important}
.panel{width:300px;font:13px/1.4 ui-sans-serif,"Segoe UI",system-ui,sans-serif;color:#1c2433;background:#eef1f5;border:1px solid #cfd6e0;border-radius:10px;box-shadow:0 10px 30px rgba(20,30,50,.28);overflow:hidden}
.bar{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 12px;background:#1c2433;color:#eef1f5;cursor:grab;user-select:none;touch-action:none}
.bar:active{cursor:grabbing}
.title{font-weight:600;letter-spacing:.01em}
.body{padding:12px;display:grid;gap:10px}
.readout{display:flex;align-items:baseline;gap:8px}
.done{font-size:44px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums}
.of{font-size:16px;color:#5b6678;font-variant-numeric:tabular-nums}
.status{margin:0;min-height:1.4em;color:#5b6678}
.status.bad{color:#c7372f}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:3px;background:#dfe4ec;border-radius:8px}
.tabs button{border:0;border-radius:6px;padding:6px;background:transparent;color:#5b6678;font:inherit;cursor:pointer}
.tabs button[aria-selected="true"]{background:#fff;color:#1c2433;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.12)}
label{display:grid;gap:4px;color:#3a4558}
input[type=text],input[type=number],textarea,select{width:100%;font:inherit;color:#1c2433;background:#fff;border:1px solid #cfd6e0;border-radius:6px;padding:6px 8px}
textarea{resize:vertical}
.row{display:grid;grid-template-columns:1fr auto;gap:6px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.check{display:flex;align-items:center;gap:8px}
.hint{margin:0;font-size:12px;color:#6a7588}
button{font:inherit}
.quiet{border:1px solid #cfd6e0;background:#fff;color:#1c2433;border-radius:6px;padding:6px 10px;cursor:pointer}
.ghost{border:0;background:transparent;color:inherit;font-size:16px;line-height:1;padding:2px 6px;cursor:pointer;border-radius:4px}
.go{border:0;border-radius:8px;padding:10px;background:#0e8f7e;color:#fff;font-weight:600;cursor:pointer}
.go.stop{background:#c7372f}
.log{list-style:none;margin:0;padding:8px;background:#fff;border:1px solid #d9dfe8;border-radius:6px;max-height:112px;overflow:auto;font-size:12px;color:#3a4558}
.log li{padding:1px 0}
.log time{color:#8a94a6;margin-right:6px;font-variant-numeric:tabular-nums}
input:disabled,textarea:disabled,select:disabled{opacity:.6}
button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #0e8f7e;outline-offset:1px}
@media (prefers-reduced-motion:no-preference){.go{transition:background .15s}}
`;

const HTML = `
<style>${CSS}</style>
<section class="panel">
  <header class="bar" id="bar"><span class="title">Ghost Messenger</span><button class="ghost" id="min" aria-label="Minimize panel">&ndash;</button></header>
  <div class="body" id="body">
    <div class="readout" aria-live="polite"><span class="done" id="done">0</span><span class="of" id="of">of 1</span></div>
    <p class="status" id="status">Ready</p>
    <div class="tabs" role="tablist">
      <button role="tab" id="tab-shortcut" aria-selected="true">Shortcut</button>
      <button role="tab" id="tab-names" aria-selected="false">Names</button>
    </div>
    <div id="pane-shortcut">
      <label>Shortcut name<input type="text" id="shortcut" placeholder="Paste the emoji, for example 🛫"></label>
      <div class="row" style="margin-top:6px"><select id="found" aria-label="Shortcuts found on the page"><option value="">Shortcuts found</option></select><button class="quiet" id="find">Find shortcuts</button></div>
      <p class="hint" style="margin-top:6px">Take a snap and open Send To, then press Find shortcuts.</p>
    </div>
    <div id="pane-names" hidden>
      <label>Names, one per line<textarea id="names" rows="4"></textarea></label>
      <p class="hint" style="margin-top:6px">Type each name exactly as it shows on the Send To screen.</p>
    </div>
    <div class="grid">
      <label>Snaps to send<input type="number" id="count" min="1" max="9999"></label>
      <label>Wait between (sec)<input type="number" id="gap" min="${MIN_GAP_SECONDS}" max="3600"></label>
    </div>
    <label class="check"><input type="checkbox" id="forever"> Keep going until I press Stop</label>
    <label class="check"><input type="checkbox" id="members"> Read shortcut members (experimental)</label>
    <button class="go" id="go">Start</button>
    <ol class="log" id="log" aria-label="Activity"></ol>
  </div>
</section>`;

export function mountPanel(doc = document) {
  doc.getElementById('ghostmessage-panel')?.remove();
  const host = doc.createElement('div');
  host.id = 'ghostmessage-panel';
  Object.assign(host.style, {position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647'});
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = HTML;
  const $ = (id) => root.getElementById(id);
  // Keep typing in the panel away from the page's own key handlers.
  for (const type of ['keydown', 'keyup', 'keypress']) root.addEventListener(type, (e) => e.stopPropagation());

  const settings = load();
  let running = false, stopping = false, current = null, sent = 0;

  function status(text, bad = false) { $('status').textContent = text; $('status').classList.toggle('bad', bad); }
  function log(text) {
    const li = doc.createElement('li');
    const t = doc.createElement('time');
    t.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    li.append(t, doc.createTextNode(text));
    $('log').prepend(li);
    while ($('log').children.length > 30) $('log').lastChild.remove();
  }
  function readout(total) { $('done').textContent = String(sent); $('of').textContent = total === Infinity ? 'of \u221e' : 'of ' + total; }

  function showTab(tab) {
    settings.tab = tab;
    $('pane-shortcut').hidden = tab !== 'shortcut';
    $('pane-names').hidden = tab !== 'names';
    $('tab-shortcut').setAttribute('aria-selected', String(tab === 'shortcut'));
    $('tab-names').setAttribute('aria-selected', String(tab === 'names'));
  }
  function applyForever() { $('count').disabled = $('forever').checked || running; }
  function lockInputs(locked) {
    for (const id of ['shortcut', 'names', 'gap', 'forever', 'members', 'find', 'found', 'tab-shortcut', 'tab-names']) $(id).disabled = locked;
    applyForever();
  }
  function readSettings() {
    settings.shortcut = $('shortcut').value.trim();
    settings.names = $('names').value;
    settings.count = Math.max(1, Math.min(9999, parseInt($('count').value, 10) || 1));
    settings.gap = Math.max(MIN_GAP_SECONDS, parseInt($('gap').value, 10) || MIN_GAP_SECONDS);
    settings.forever = $('forever').checked;
    settings.members = $('members').checked;
    save(settings);
    return settings;
  }

  function findShortcuts() {
    const labels = [];
    for (const b of doc.querySelectorAll('div.THeKv > button.c47Sk, button.c47Sk')) {
      const label = (b.textContent || '').trim();
      if (label && b.offsetWidth > 0 && !labels.includes(label)) labels.push(label);
    }
    const sel = $('found');
    sel.replaceChildren(new Option(labels.length ? 'Pick a shortcut' : 'None found', ''));
    for (const l of labels) sel.append(new Option(l, l));
    if (labels.length) { status(labels.length + ' shortcut(s) found'); }
    else { status('No shortcuts on this screen. Open Send To first.', true); }
  }

  async function runCycle(s) {
    let clicked = false;
    const useShortcut = s.tab === 'shortcut';
    const recipients = useShortcut ? [s.shortcut] : s.names.split('\n').map((n) => n.trim()).filter(Boolean);
    const sender = createSender({
      document: doc,
      recipients,
      recipientMode: useShortcut ? 'shortcut' : 'nickname',
      expandShortcuts: useShortcut && s.members,
      ...SENDER_DEFAULTS,
      onState: (st) => { if (st.state === 'awaitSendAck' && st.reason === 'final_send_clicked') clicked = true; },
      onShortcutMembers: (m) => log('Shortcut has ' + m.members.length + ' member(s)'),
      onDiagnostic: (d) => { if (d.level === 'warning' && d.message) log(d.message); },
      onError: (e) => log('Error: ' + e.message),
    });
    current = sender;
    const watchdog = setTimeout(() => sender.stop(), CYCLE_WATCHDOG_MS);
    try { await sender.start(); }
    catch (e) { log('Could not start: ' + e.message); }
    finally { clearTimeout(watchdog); try { await sender.dispose(); } catch {} current = null; }
    return clicked;
  }

  async function waitGap(seconds) {
    const end = Date.now() + seconds * 1000;
    while (!stopping && Date.now() < end) {
      status('Next send in ' + Math.ceil((end - Date.now()) / 1000) + 's');
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  async function start() {
    if (running) return;
    const s = readSettings();
    if (s.tab === 'shortcut' && !s.shortcut) { status('Enter a shortcut name first.', true); return; }
    if (s.tab === 'names' && !s.names.split('\n').some((n) => n.trim())) { status('Add at least one name first.', true); return; }
    const total = s.forever ? Infinity : s.count;
    running = true; stopping = false; sent = 0;
    let failures = 0, ending = 'Finished';
    $('go').textContent = 'Stop'; $('go').classList.add('stop');
    lockInputs(true); readout(total);
    log('Started: ' + (total === Infinity ? 'until stopped' : total + ' send(s)'));
    while (!stopping && sent < total) {
      status('Sending ' + (sent + 1) + (total === Infinity ? '' : ' of ' + total) + '\u2026');
      const ok = await runCycle(s);
      if (ok) { sent++; failures = 0; log('Send ' + sent + ' clicked'); readout(total); }
      else if (!stopping) {
        failures++; log('No send detected (' + failures + ' of ' + MAX_FAILURES_IN_A_ROW + ')');
        if (failures >= MAX_FAILURES_IN_A_ROW) { ending = 'Stopped: no send detected ' + MAX_FAILURES_IN_A_ROW + ' times in a row'; break; }
      }
      if (stopping || sent >= total) break;
      await waitGap(s.gap);
    }
    if (stopping) ending = 'Stopped after ' + sent;
    else if (ending === 'Finished') ending = 'Finished: ' + sent + ' sent';
    running = false; stopping = false;
    $('go').textContent = 'Start'; $('go').classList.remove('stop');
    lockInputs(false); status(ending, ending.startsWith('Stopped:')); log(ending);
  }

  function stop() { if (!running) return; stopping = true; status('Stopping\u2026'); current?.stop(); }

  // Wire up the controls.
  $('shortcut').value = settings.shortcut; $('names').value = settings.names;
  $('count').value = settings.count; $('gap').value = settings.gap;
  $('forever').checked = settings.forever; $('members').checked = settings.members;
  showTab(settings.tab); applyForever(); readout(settings.forever ? Infinity : settings.count);
  $('tab-shortcut').onclick = () => showTab('shortcut');
  $('tab-names').onclick = () => showTab('names');
  $('find').onclick = findShortcuts;
  $('found').onchange = () => { if ($('found').value) $('shortcut').value = $('found').value; };
  $('forever').onchange = () => { applyForever(); readout($('forever').checked ? Infinity : (parseInt($('count').value, 10) || 1)); };
  $('count').oninput = () => { if (!running) readout(parseInt($('count').value, 10) || 1); };
  $('go').onclick = () => (running ? stop() : start());
  $('min').onclick = () => { settings.minimized = !settings.minimized; $('body').hidden = settings.minimized; save(settings); };
  $('body').hidden = settings.minimized;

  // Drag by the title bar.
  $('bar').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const rect = host.getBoundingClientRect();
    const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
    $('bar').setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - dx));
      const y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy));
      Object.assign(host.style, {left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto'});
      settings.x = x; settings.y = y;
    };
    const up = () => { $('bar').removeEventListener('pointermove', move); $('bar').removeEventListener('pointerup', up); save(settings); };
    $('bar').addEventListener('pointermove', move);
    $('bar').addEventListener('pointerup', up);
  });
  if (settings.x != null && settings.y != null) {
    Object.assign(host.style, {left: Math.min(settings.x, window.innerWidth - 80) + 'px', top: Math.min(settings.y, window.innerHeight - 60) + 'px', right: 'auto', bottom: 'auto'});
  }

  doc.body.append(host);
  return {start, stop, destroy() { stop(); host.remove(); }};
}
