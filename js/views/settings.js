// Einstellungen: Paar-Profil, wer bin ich, Verbindung, Daten.

import { h, toast, confirmSheet, sheet, todayISO } from '../ui.js';
import { store, KINDS, loadConfig, saveConfig, clearConfig } from '../store.js';
import { session } from '../session.js';
import { sync, pendingUploads } from '../sync.js';

export const settings = {
  id: 'settings',
  label: 'Mehr',
  icon: 'gear',
  title: () => 'Einstellungen',
  subtitle: () => 'Euer Profil und die Verbindung',

  render() {
    return h('div', { class: 'stack' }, profileCard(), meCard(), connectionCard(), dataCard(), aboutCard());
  },
};

function profileCard() {
  const c = store.couple() || { nameA: '', nameB: '', since: '' };
  const nameA = h('input', { type: 'text', value: c.nameA || '', placeholder: 'Dein Name' });
  const nameB = h('input', { type: 'text', value: c.nameB || '', placeholder: 'Ihr Name' });
  const since = h('input', { type: 'date', value: c.since || '', max: todayISO() });

  const save = () => {
    store.saveCouple({
      ...c,
      nameA: nameA.value.trim() || 'Ich',
      nameB: nameB.value.trim() || 'Du',
      since: since.value,
    });
    toast('Gespeichert');
  };

  return h('div', { class: 'card' },
    h('strong', {}, 'Ihr zwei'),
    h('p', { class: 'small muted', style: 'margin:4px 0 14px' },
      'Diese Angaben teilt ihr euch – beide sehen dieselben Namen und dasselbe Datum.'),
    h('div', { class: 'field-row' },
      h('label', { class: 'field' }, h('span', {}, 'Person A'), nameA),
      h('label', { class: 'field' }, h('span', {}, 'Person B'), nameB),
    ),
    h('label', { class: 'field' }, h('span', {}, 'Zusammen seit'), since),
    h('button', { class: 'btn primary block', onClick: save }, 'Profil speichern'),
  );
}

function meCard() {
  const c = store.couple() || {};
  const cfg = loadConfig() || {};
  const options = [['a', c.nameA || 'Person A'], ['b', c.nameB || 'Person B']];

  const row = h('div', { class: 'chips' },
    options.map(([val, label]) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(session.me === val),
      onClick: (e) => {
        saveConfig({ ...cfg, me: val });
        session.config = loadConfig();
        [...row.children].forEach((x) => x.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        store.notify();
        toast('Übernommen');
      },
    }, label)),
  );

  return h('div', { class: 'card' },
    h('strong', {}, 'Wer bist du auf diesem Gerät?'),
    h('p', { class: 'small muted', style: 'margin:4px 0 12px' },
      'Bestimmt, wer Nachrichten schreibt und wer Ausgaben bezahlt hat. Nur auf diesem Handy gespeichert.'),
    row,
  );
}

function connectionCard() {
  const cfg = loadConfig() || {};
  const labels = {
    live: ['live', 'Verbunden – Änderungen kommen sofort an'],
    connecting: ['', 'Verbinde …'],
    offline: ['offline', 'Offline – wird nachgetragen, sobald es wieder geht'],
    off: ['offline', 'Nur dieses Gerät – kein Sync eingerichtet'],
  };
  const [cls, text] = labels[sync.status] || labels.off;
  const queued = pendingUploads();

  return h('div', { class: 'card' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:10px' },
      h('strong', {}, 'Verbindung'),
      h('span', { class: `status ${cls}` }, h('span', { class: 'dot' }), sync.status === 'live' ? 'Live' : 'Lokal'),
    ),
    h('p', { class: 'small muted', style: 'margin:8px 0 0' }, text),
    queued > 0 && h('p', { class: 'small', style: 'margin:6px 0 0;color:var(--gold)' },
      `${queued} Änderung(en) warten auf Upload.`),
    cfg.room && h('div', { style: 'margin-top:14px' },
      h('div', { class: 'small muted' }, 'Euer Paar-Code'),
      h('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:6px' },
        h('code', {
          style: 'flex:1;background:var(--surface-2);padding:10px 12px;border-radius:10px;font-size:13px;overflow-wrap:anywhere',
        }, cfg.room),
        h('button', {
          class: 'btn ghost', style: 'padding:10px 14px',
          onClick: () => copy(cfg.room),
        }, 'Kopieren'),
      ),
      h('p', { class: 'small muted', style: 'margin:8px 0 0' },
        'Denselben Code braucht deine Freundin beim Einrichten – dann seid ihr im selben Raum.'),
    ),
    cfg.url && cfg.key && h('button', {
      class: 'btn primary block', style: 'margin-top:14px', onClick: () => shareInvite(cfg),
    }, 'Einladungslink teilen'),
    h('button', { class: 'btn ghost block', style: 'margin-top:8px', onClick: () => reconfigure(cfg) },
      'Verbindungsdaten ändern'),
  );
}

/**
 * Baut einen Link, der URL, Schlüssel und Paar-Code schon enthält – die
 * Partnerin muss ihn nur öffnen und bestätigen.
 */
async function shareInvite(cfg) {
  const payload = JSON.stringify({ url: cfg.url, key: cfg.key, room: cfg.room });
  const bytes = new TextEncoder().encode(payload);
  const b64 = btoa(String.fromCharCode(...bytes));
  const link = `${location.origin}${location.pathname}#join=${encodeURIComponent(b64)}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'kitti-hub', text: 'Unsere App – einfach öffnen 💞', url: link });
      return;
    } catch { /* abgebrochen: unten weiter mit Kopieren */ }
  }
  copy(link);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Kopiert');
  } catch {
    sheet('Paar-Code', () => h('p', { style: 'overflow-wrap:anywhere' }, text));
  }
}

function reconfigure(cfg) {
  sheet('Verbindungsdaten', (close) => {
    const url = h('input', { type: 'url', value: cfg.url || '', placeholder: 'https://xxxx.supabase.co' });
    const key = h('input', { type: 'password', value: cfg.key || '', placeholder: 'anon public key' });
    const room = h('input', { type: 'text', value: cfg.room || '', placeholder: 'Paar-Code' });

    return h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'Projekt-URL'), url),
      h('label', { class: 'field' }, h('span', {}, 'Anon Key'), key),
      h('label', { class: 'field' }, h('span', {}, 'Paar-Code'), room),
      h('p', { class: 'small muted' }, 'Nach dem Speichern lädt die App neu.'),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn ghost', onClick: close }, 'Abbrechen'),
        h('button', {
          class: 'btn primary',
          onClick: () => {
            saveConfig({
              ...cfg,
              url: url.value.trim().replace(/\/+$/, ''),
              key: key.value.trim(),
              room: room.value.trim(),
            });
            location.reload();
          },
        }, 'Speichern'),
      ),
    );
  });
}

function dataCard() {
  const counts = [
    [KINDS.EVENT, 'Termine'],
    [KINDS.TASK, 'Aufgaben'],
    [KINDS.SHOP, 'Einkauf'],
    [KINDS.EXPENSE, 'Ausgaben'],
    [KINDS.NOTE, 'Nachrichten'],
    [KINDS.IDEA, 'Date-Ideen'],
  ];

  return h('div', { class: 'card' },
    h('strong', {}, 'Daten'),
    h('div', { style: 'margin-top:10px' },
      counts.map(([kind, label]) => h('div', {
        style: 'display:flex;justify-content:space-between;padding:6px 0;font-size:14px',
      }, h('span', { class: 'muted' }, label), h('span', {}, store.list(kind).length))),
    ),
    h('button', {
      class: 'btn ghost block', style: 'margin-top:12px',
      onClick: exportJSON,
    }, 'Alles exportieren (JSON)'),
    h('button', {
      class: 'btn danger block', style: 'margin-top:8px',
      onClick: () => confirmSheet('Gerät abmelden?',
        'Deine Einstellungen und der lokale Zwischenspeicher werden von diesem Handy entfernt. Die gemeinsamen Daten bleiben online erhalten.',
        () => { clearConfig(); location.reload(); }, 'Abmelden'),
    }, 'Von diesem Gerät abmelden'),
  );
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(store.all(), null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `kitti-hub-${todayISO()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function aboutCard() {
  return h('div', { class: 'card' },
    h('strong', {}, 'kitti-hub'),
    h('p', { class: 'small muted', style: 'margin:6px 0 0' },
      'Eine kleine App für zwei Menschen. Läuft im Browser, lässt sich zum Homescreen hinzufügen und funktioniert auch offline.'),
  );
}
