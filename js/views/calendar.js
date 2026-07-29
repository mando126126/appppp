// Gemeinsamer Kalender – als Agenda-Liste statt Monatsraster, weil auf dem
// Handy die nächsten Termine zählen, nicht die Kästchen.

import { h, icon, sheet, toast, confirmSheet, friendlyDate, formatDate, emptyState, todayISO } from '../ui.js';
import { store, KINDS } from '../store.js';
import { eventsSorted, upcomingOccasions } from '../model.js';

let showPast = false;

export const calendar = {
  id: 'calendar',
  label: 'Kalender',
  icon: 'calendar',
  title: () => 'Kalender',
  subtitle: () => 'Was bei euch ansteht',
  fab: () => editEvent(null),

  render() {
    const all = eventsSorted();
    const list = showPast
      ? all.filter((e) => e.data.date < todayISO()).reverse()
      : all.filter((e) => e.data.date >= todayISO());

    return h('div', {},
      h('div', { class: 'segment', role: 'tablist' },
        h('button', {
          role: 'tab', 'aria-selected': String(!showPast),
          onClick: () => { showPast = false; rerender(); },
        }, 'Kommend'),
        h('button', {
          role: 'tab', 'aria-selected': String(showPast),
          onClick: () => { showPast = true; rerender(); },
        }, 'Vergangen'),
      ),
      !showPast && occasionsStrip(),
      list.length
        ? h('div', {}, groupByDay(list).map(dayGroup))
        : emptyState(showPast ? '🕰️' : '📅',
            showPast ? 'Noch keine vergangenen Termine.' : 'Nichts geplant. Plus antippen und ein Date eintragen.'),
    );
  },
};

const rerender = () => store.notify();

function occasionsStrip() {
  const occ = upcomingOccasions(3).filter((o) => o.inDays <= 60);
  if (!occ.length) return null;
  return h('div', { class: 'chips', style: 'margin-bottom:6px' },
    occ.map((o) => h('span', { class: 'chip', style: 'background:var(--coral-soft);border-color:var(--coral);color:var(--coral-deep)' },
      `${o.label === 'Jahrestag' && o.years ? `${o.years}. ` : ''}${o.label} · ${o.inDays === 0 ? 'heute' : `in ${o.inDays} T.`}`)),
  );
}

function groupByDay(list) {
  const groups = new Map();
  for (const e of list) {
    if (!groups.has(e.data.date)) groups.set(e.data.date, []);
    groups.get(e.data.date).push(e);
  }
  return [...groups.entries()];
}

function dayGroup([date, items]) {
  return h('div', { class: 'day-group' },
    h('div', { class: 'day-head' + (date === todayISO() ? ' today' : '') },
      `${friendlyDate(date)} · ${formatDate(date, { day: '2-digit', month: '2-digit', year: '2-digit' })}`),
    h('div', { class: 'card', style: 'padding:6px 16px' },
      items.map((e) => h('div', { class: 'row' },
        h('div', { class: 'grow', onClick: () => editEvent(e), style: 'cursor:pointer' },
          h('div', { class: 'title' }, e.data.title),
          h('div', { class: 'meta' },
            [e.data.time, e.data.place].filter(Boolean).join(' · ') || 'ganztägig'),
          e.data.note && h('div', { class: 'meta', style: 'margin-top:4px' }, e.data.note),
        ),
        h('button', {
          class: 'icon-btn', 'aria-label': 'Termin bearbeiten',
          onClick: () => editEvent(e),
        }, icon('pencil')),
      )),
    ),
  );
}

export function editEvent(entry) {
  const d = entry?.data || { title: '', date: todayISO(), time: '', place: '', note: '' };

  sheet(entry ? 'Termin bearbeiten' : 'Neuer Termin', (close) => {
    const title = h('input', { type: 'text', value: d.title, placeholder: 'z. B. Kino, Abendessen, Urlaub' });
    const date = h('input', { type: 'date', value: d.date });
    const time = h('input', { type: 'time', value: d.time || '' });
    const place = h('input', { type: 'text', value: d.place || '', placeholder: 'Ort (optional)' });
    const note = h('textarea', { placeholder: 'Notiz (optional)', style: 'min-height:60px' }, d.note || '');

    const save = () => {
      const data = {
        title: title.value.trim(),
        date: date.value || todayISO(),
        time: time.value,
        place: place.value.trim(),
        note: note.value.trim(),
      };
      if (!data.title) return title.focus();
      if (entry) store.patch(entry.id, data);
      else store.put(KINDS.EVENT, data);
      close();
      toast(entry ? 'Termin aktualisiert' : 'Termin eingetragen');
    };

    return h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'Was'), title),
      h('div', { class: 'field-row' },
        h('label', { class: 'field' }, h('span', {}, 'Wann'), date),
        h('label', { class: 'field' }, h('span', {}, 'Uhrzeit'), time),
      ),
      h('label', { class: 'field' }, h('span', {}, 'Wo'), place),
      h('label', { class: 'field' }, h('span', {}, 'Notiz'), note),
      h('div', { class: 'sheet-actions' },
        entry
          ? h('button', {
              class: 'btn ghost',
              onClick: () => {
                close();
                confirmSheet('Termin löschen?', `„${d.title}" verschwindet auch bei deiner Freundin.`,
                  () => { store.remove(entry.id); toast('Gelöscht'); });
              },
            }, 'Löschen')
          : h('button', { class: 'btn ghost', onClick: close }, 'Abbrechen'),
        h('button', { class: 'btn primary', onClick: save }, 'Speichern'),
      ),
    );
  });
}
