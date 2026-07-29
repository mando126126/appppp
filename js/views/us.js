// Liebes-Extras: Nachrichten, Date-Bucketlist und die Momente, die zählen.

import { h, icon, sheet, toast, confirmSheet, relativeTime, friendlyDate, emptyState, plural } from '../ui.js';
import { store, KINDS } from '../store.js';
import { session } from '../session.js';
import { names, upcomingOccasions } from '../model.js';
import { writeNote } from './home.js';

const TAGS = ['🍿 Zuhause', '🌆 Ausgehen', '🌿 Draußen', '✈️ Reisen', '💡 Verrückt'];

let tab = 'notes';

export const us = {
  id: 'us',
  label: 'Extras',
  icon: 'heart',
  title: () => 'Für uns',
  subtitle: () => 'Nachrichten, Ideen, Jahrestage',
  fab: () => (tab === 'notes' ? writeNote() : tab === 'ideas' ? editIdea(null) : editMilestone()),

  render() {
    return h('div', {},
      h('div', { class: 'segment', role: 'tablist' },
        h('button', { role: 'tab', 'aria-selected': String(tab === 'notes'), onClick: () => go('notes') }, 'Nachrichten'),
        h('button', { role: 'tab', 'aria-selected': String(tab === 'ideas'), onClick: () => go('ideas') }, 'Date-Ideen'),
        h('button', { role: 'tab', 'aria-selected': String(tab === 'dates'), onClick: () => go('dates') }, 'Anlässe'),
      ),
      tab === 'notes' ? notesPane() : tab === 'ideas' ? ideasPane() : occasionsPane(),
    );
  },
};

function go(t) {
  tab = t;
  store.notify();
}

/* ---------- Nachrichten ---------- */

function notesPane() {
  const notes = store.list(KINDS.NOTE).sort((x, y) => y.updated_at.localeCompare(x.updated_at));
  if (!notes.length) {
    return emptyState('💌', 'Noch keine Nachrichten. Schreib die erste – sie erscheint sofort auf ihrem Handy.');
  }
  return h('div', {}, notes.map((n) => h('div', { class: 'note' },
    h('div', { class: 'body' }, n.data.body),
    h('div', { class: 'by' },
      h('span', {}, `${names()[n.data.author] || ''} · ${relativeTime(n.updated_at)}`),
      n.data.author === session.me && h('button', {
        class: 'icon-btn', style: 'padding:0', 'aria-label': 'Nachricht löschen',
        onClick: () => confirmSheet('Nachricht löschen?', 'Sie verschwindet bei euch beiden.',
          () => { store.remove(n.id); toast('Gelöscht'); }),
      }, icon('trash')),
    ),
  )));
}

/* ---------- Date-Ideen ---------- */

function ideasPane() {
  const ideas = store.list(KINDS.IDEA);
  const open = ideas.filter((i) => !i.data.done);
  const done = ideas.filter((i) => i.data.done);

  return h('div', {},
    open.length ? h('div', {},
      h('div', { class: 'card', style: 'padding:6px 16px' }, open.map(ideaRow)),
      h('button', {
        class: 'btn ghost block', style: 'margin-top:14px',
        onClick: () => surprise(open),
      }, '🎲 Überrasch uns'),
    ) : emptyState('💡', 'Sammelt hier alles, was ihr mal zusammen machen wollt.'),
    done.length ? h('div', {},
      h('div', { class: 'section-title' }, `Schon erlebt (${done.length})`),
      h('div', { class: 'card', style: 'padding:6px 16px;opacity:.72' }, done.map(ideaRow)),
    ) : null,
  );
}

function ideaRow(item) {
  const d = item.data;
  return h('div', { class: 'row' + (d.done ? ' done' : '') },
    h('button', {
      class: 'check', 'aria-pressed': String(!!d.done), 'aria-label': d.title,
      onClick: () => {
        store.patch(item.id, { done: !d.done });
        if (!d.done) toast('Abgehakt – schön war\'s ✨');
      },
    }, icon('check')),
    h('div', { class: 'grow', style: 'cursor:pointer', onClick: () => editIdea(item) },
      h('div', { class: 'title' }, d.title),
      d.tag && h('div', { class: 'meta' }, d.tag),
    ),
    h('button', {
      class: 'icon-btn', 'aria-label': 'Löschen',
      onClick: () => { store.remove(item.id); toast('Gelöscht'); },
    }, icon('trash')),
  );
}

function surprise(open) {
  const pick = open[Math.floor(Math.random() * open.length)];
  sheet('Euer nächstes Date', (close) => h('div', {},
    h('div', { style: 'text-align:center;padding:10px 0 6px' },
      h('div', { style: 'font-size:42px' }, '🎲'),
      h('h3', { style: 'margin:12px 0 6px;font-size:22px' }, pick.data.title),
      pick.data.tag && h('div', { class: 'muted small' }, pick.data.tag),
    ),
    h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn ghost', onClick: () => { close(); surprise(open); } }, 'Nochmal'),
      h('button', {
        class: 'btn primary',
        onClick: () => {
          close();
          import('./calendar.js').then(({ editEvent }) => {
            editEvent({ data: { title: pick.data.title, date: '', time: '', place: '', note: '' } });
          });
        },
      }, 'Termin machen'),
    ),
  ));
}

export function editIdea(entry) {
  const d = entry?.data || { title: '', tag: '', done: false };

  sheet(entry ? 'Idee bearbeiten' : 'Neue Date-Idee', (close) => {
    const title = h('input', { type: 'text', value: d.title, placeholder: 'z. B. Sonnenaufgang am See' });
    let tag = d.tag;
    const tags = h('div', { class: 'chips' },
      TAGS.map((t) => h('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(tag === t),
        onClick: (e) => {
          tag = tag === t ? '' : t;
          [...tags.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
          if (tag) e.currentTarget.setAttribute('aria-pressed', 'true');
        },
      }, t)),
    );

    return h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'Idee'), title),
      h('div', { class: 'field' }, h('span', {}, 'Kategorie'), tags),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn ghost', onClick: close }, 'Abbrechen'),
        h('button', {
          class: 'btn primary',
          onClick: () => {
            if (!title.value.trim()) return title.focus();
            const data = { title: title.value.trim(), tag, done: d.done };
            if (entry) store.patch(entry.id, data);
            else store.put(KINDS.IDEA, data);
            close();
            toast('Auf die Liste ✨');
          },
        }, 'Speichern'),
      ),
    );
  });
}

/* ---------- Anlässe / Jahrestage ---------- */

function occasionsPane() {
  const c = store.couple();
  const list = upcomingOccasions(20);

  if (!list.length) {
    return h('div', {},
      emptyState('🎂', 'Tragt Geburtstage, den ersten Kuss oder euren Jahrestag ein – die App erinnert euch.'),
      h('button', { class: 'btn primary block', onClick: editMilestone }, 'Anlass hinzufügen'),
    );
  }

  return h('div', {},
    h('div', { class: 'card', style: 'padding:6px 16px' },
      list.map((o) => h('div', { class: 'row' },
        h('span', { class: 'avatar', style: 'background:var(--coral-soft);color:var(--coral-deep)' },
          icon('sparkle', 15)),
        h('div', { class: 'grow' },
          h('div', { class: 'title' },
            o.label === 'Jahrestag' && o.years ? `${o.years}. Jahrestag` : o.label),
          h('div', { class: 'meta' }, `${friendlyDate(o.next)} · seit ${friendlyDate(o.date)}`),
        ),
        h('strong', { class: 'small', style: o.inDays <= 7 ? 'color:var(--coral-deep)' : '' },
          o.inDays === 0 ? 'heute' : `in ${plural(o.inDays, 'Tag', 'Tagen')}`),
        o.label !== 'Jahrestag' && h('button', {
          class: 'icon-btn', 'aria-label': 'Anlass löschen',
          onClick: () => removeMilestone(o),
        }, icon('trash')),
      )),
    ),
    h('button', { class: 'btn ghost block', style: 'margin-top:14px', onClick: editMilestone },
      'Anlass hinzufügen'),
    c?.since ? null : h('p', { class: 'small muted', style: 'text-align:center;margin-top:14px' },
      'Tipp: Euer Anfangsdatum setzt ihr in den Einstellungen.'),
  );
}

export function editMilestone() {
  sheet('Neuer Anlass', (close) => {
    const label = h('input', { type: 'text', placeholder: 'z. B. Erstes Date, Geburtstag Lena' });
    const date = h('input', { type: 'date' });

    return h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'Anlass'), label),
      h('label', { class: 'field' }, h('span', {}, 'Datum'), date),
      h('p', { class: 'small muted' }, 'Wiederholt sich jedes Jahr.'),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn ghost', onClick: close }, 'Abbrechen'),
        h('button', {
          class: 'btn primary',
          onClick: () => {
            if (!label.value.trim()) return label.focus();
            if (!date.value) return date.focus();
            const c = store.couple() || {};
            const anniversaries = [...(c.anniversaries || []), { label: label.value.trim(), date: date.value }];
            store.saveCouple({ ...c, anniversaries });
            close();
            toast('Anlass gespeichert');
          },
        }, 'Speichern'),
      ),
    );
  });
}

function removeMilestone(occ) {
  confirmSheet('Anlass löschen?', `„${occ.label}" wird bei euch beiden entfernt.`, () => {
    const c = store.couple() || {};
    const anniversaries = (c.anniversaries || [])
      .filter((x) => !(x.label === occ.label && x.date === occ.date));
    store.saveCouple({ ...c, anniversaries });
    toast('Gelöscht');
  });
}
