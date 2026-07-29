// Einstiegspunkt: Einrichtung, Navigation, Rendering.

import { h, $, clear, icon } from './ui.js';
import { store, loadConfig, saveConfig, uid } from './store.js';
import { session } from './session.js';
import { initSync, sync, testConnection } from './sync.js';
import { home } from './views/home.js';
import { calendar } from './views/calendar.js';
import { lists } from './views/lists.js';
import { moneyView } from './views/money.js';
import { us } from './views/us.js';
import { settings } from './views/settings.js';

const VIEWS = [home, calendar, lists, moneyView, us, settings];
let current = 'home';

boot();

function boot() {
  const invite = readInvite();
  const cfg = loadConfig();

  if (cfg && cfg.room) start(cfg);
  else renderSetup(invite);

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

async function start(cfg) {
  session.config = cfg;
  session.navigate = navigate;
  session.refresh = render;

  store.open(cfg.room);
  store.subscribe(render);

  $('#setup').hidden = true;
  $('#app').hidden = false;
  render();

  sync.onStatus = () => render();
  await initSync(cfg);
}

/* ---------- Navigation & Rendering ---------- */

function navigate(id) {
  if (!VIEWS.some((v) => v.id === id)) return;
  current = id;
  render();
  $('#screen').scrollTop = 0;
  $('#screen').focus({ preventScroll: true });
}

function render() {
  const view = VIEWS.find((v) => v.id === current) || home;

  const bar = clear($('#topbar'));
  bar.append(
    h('div', {},
      h('h1', {}, view.title()),
      h('div', { class: 'sub' }, view.subtitle()),
    ),
    statusPill(),
  );

  const screen = clear($('#screen'));
  screen.append(view.render());
  if (view.fab) {
    screen.append(h('button', {
      class: 'fab', 'aria-label': 'Hinzufügen', onClick: () => view.fab(),
    }, icon('plus')));
  }

  const tabs = clear($('#tabbar'));
  for (const v of VIEWS) {
    tabs.append(h('button', {
      class: 'tab',
      'aria-current': current === v.id ? 'page' : null,
      onClick: () => navigate(v.id),
    }, icon(v.icon), h('span', {}, v.label)));
  }
}

function statusPill() {
  const map = {
    live: ['live', 'Live'],
    connecting: ['', 'Verbinde'],
    offline: ['offline', 'Offline'],
    off: ['offline', 'Lokal'],
  };
  const [cls, label] = map[sync.status] || map.off;
  return h('button', {
    class: `status ${cls}`,
    'aria-label': `Verbindungsstatus: ${label}`,
    onClick: () => navigate('settings'),
  }, h('span', { class: 'dot' }), label);
}

/* ---------- Einrichtung ---------- */

/** Einladungslink der Partnerin: #join=<base64 der Verbindungsdaten>. */
function readInvite() {
  const m = location.hash.match(/join=([^&]+)/);
  if (!m) return null;
  try {
    const bin = atob(decodeURIComponent(m[1]));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    history.replaceState(null, '', location.pathname + location.search);
    return data;
  } catch {
    return null;
  }
}

function renderSetup(invite) {
  const root = $('#setup');
  root.hidden = false;

  const nameA = h('input', { type: 'text', placeholder: 'z. B. Lenny', autocomplete: 'given-name' });
  const nameB = h('input', { type: 'text', placeholder: 'z. B. Mia', autocomplete: 'off' });
  const since = h('input', { type: 'date' });
  const url = h('input', { type: 'url', placeholder: 'https://xxxx.supabase.co', value: invite?.url || '' });
  const key = h('input', { type: 'password', placeholder: 'anon public key', value: invite?.key || '' });
  const room = h('input', { type: 'text', value: invite?.room || suggestRoom() });

  let me = invite ? 'b' : 'a';
  const meRow = h('div', { class: 'chips' },
    [['a', 'Ich bin Person A'], ['b', 'Ich bin Person B']].map(([val, label]) =>
      h('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(me === val),
        onClick: (e) => {
          me = val;
          [...meRow.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
          e.currentTarget.setAttribute('aria-pressed', 'true');
        },
      }, label)),
  );

  const status = h('p', { class: 'small muted', style: 'text-align:center;min-height:20px' });
  const submit = h('button', { class: 'btn primary block' }, 'Los geht\'s');

  submit.addEventListener('click', async () => {
    const cfg = {
      url: url.value.trim().replace(/\/+$/, ''),
      key: key.value.trim(),
      room: room.value.trim() || suggestRoom(),
      me,
    };

    if (cfg.url && cfg.key) {
      submit.disabled = true;
      status.textContent = 'Verbindung wird geprüft …';
      try {
        await testConnection(cfg.url, cfg.key);
      } catch (err) {
        submit.disabled = false;
        status.style.color = 'var(--coral-deep)';
        status.textContent = `Klappt noch nicht: ${err.message}`;
        return;
      }
    }

    saveConfig(cfg);
    store.open(cfg.room);
    // Profil nur anlegen, wenn dieses Gerät das erste ist – sonst kommt es per Sync.
    if (!invite && (nameA.value.trim() || nameB.value.trim() || since.value)) {
      store.saveCouple({
        nameA: nameA.value.trim() || 'Ich',
        nameB: nameB.value.trim() || 'Du',
        since: since.value,
        anniversaries: [],
      });
    }
    root.hidden = true;
    clear(root);
    start(cfg);
  });

  clear(root).append(
    h('div', { class: 'logo' }, '💞'),
    h('h1', {}, 'Wir Zwei'),
    h('p', { class: 'lead' }, invite
      ? 'Du wurdest eingeladen. Nur noch kurz bestätigen, dann seid ihr verbunden.'
      : 'Eine App für euch beide: Kalender, Listen, Ausgaben und alles, was nur euch gehört.'),

    !invite && h('div', { class: 'card' },
      h('div', { class: 'field-row' },
        h('label', { class: 'field' }, h('span', {}, 'Person A'), nameA),
        h('label', { class: 'field' }, h('span', {}, 'Person B'), nameB),
      ),
      h('label', { class: 'field' }, h('span', {}, 'Zusammen seit (optional)'), since),
    ),

    h('div', { class: 'card', style: 'margin-top:14px' },
      h('div', { class: 'field' }, h('span', {}, 'Wer bist du auf diesem Handy?'), meRow),
    ),

    h('div', { class: 'card', style: 'margin-top:14px' },
      h('strong', {}, 'Gemeinsam nutzen'),
      h('p', { class: 'small muted', style: 'margin:6px 0 14px' },
        'Damit ihr beide dasselbe seht, braucht die App einen kleinen kostenlosen Datenspeicher (Supabase). Einmal einrichten, danach nie wieder anfassen.'),
      h('details', {},
        h('summary', {}, 'So bekommst du die zwei Werte (2 Minuten)'),
        h('ol', {},
          h('li', {}, 'Auf ', h('code', {}, 'supabase.com'), ' kostenlos anmelden und ein neues Projekt anlegen.'),
          h('li', {}, 'Im Projekt: SQL Editor öffnen, das Skript aus ', h('code', {}, 'supabase/schema.sql'), ' einfügen und ausführen.'),
          h('li', {}, 'Unter Project Settings → API die ', h('code', {}, 'Project URL'), ' und den ', h('code', {}, 'anon public'), ' Schlüssel kopieren.'),
          h('li', {}, 'Beides hier einsetzen – fertig.'),
        ),
      ),
      h('label', { class: 'field' }, h('span', {}, 'Projekt-URL'), url),
      h('label', { class: 'field' }, h('span', {}, 'Anon Key'), key),
      h('label', { class: 'field' },
        h('span', {}, 'Euer Paar-Code'),
        room,
      ),
      h('p', { class: 'small muted', style: 'margin-top:-6px' },
        'Dieser Code ist euer gemeinsamer Raum. Deine Freundin gibt später genau denselben ein.'),
    ),

    h('div', { style: 'margin-top:20px' }, status, submit),
    h('p', { class: 'small muted', style: 'text-align:center;margin-top:14px' },
      'Ohne URL und Schlüssel läuft alles nur auf diesem Gerät – du kannst den Sync später in den Einstellungen nachtragen.'),
  );
}

/** Lesbarer, aber schwer zu erratender Raumname. */
function suggestRoom() {
  return `wir-${uid().replace(/-/g, '').slice(0, 12)}`;
}

export { navigate };
