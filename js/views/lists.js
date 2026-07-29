// To-dos und Einkaufsliste. Beide teilen sich denselben Aufbau, unterscheiden
// sich aber genug (Fälligkeit vs. Menge), um zwei Reiter zu rechtfertigen.

import { h, icon, sheet, toast, confirmSheet, friendlyDate, emptyState, todayISO, plural } from '../ui.js';
import { store, KINDS } from '../store.js';
import { names } from '../model.js';

let tab = 'task';

export const lists = {
  id: 'lists',
  label: 'Listen',
  icon: 'list',
  title: () => 'Listen',
  subtitle: () => (tab === 'task' ? 'Was zu tun ist' : 'Was noch fehlt'),

  render() {
    const kind = tab === 'task' ? KINDS.TASK : KINDS.SHOP;
    const items = store.list(kind).sort(sorter(kind));
    const open = items.filter((i) => !i.data.done);
    const done = items.filter((i) => i.data.done);

    return h('div', {},
      h('div', { class: 'segment', role: 'tablist' },
        h('button', { role: 'tab', 'aria-selected': String(tab === 'task'), onClick: () => switchTab('task') },
          'To-dos'),
        h('button', { role: 'tab', 'aria-selected': String(tab === 'shop'), onClick: () => switchTab('shop') },
          'Einkauf'),
      ),
      quickAdd(kind),
      open.length
        ? h('div', { class: 'card', style: 'padding:6px 16px' }, open.map((i) => row(i, kind)))
        : emptyState(tab === 'task' ? '✅' : '🛒',
            tab === 'task' ? 'Alles erledigt. Genießt den Tag.' : 'Die Einkaufsliste ist leer.'),
      done.length ? h('div', {},
        h('div', { class: 'section-title' },
          `Erledigt (${done.length})`,
          h('button', {
            class: 'btn danger small', style: 'padding:0;background:none',
            onClick: () => confirmSheet('Erledigtes aufräumen?',
              `${plural(done.length, 'Eintrag wird', 'Einträge werden')} endgültig gelöscht.`,
              () => { done.forEach((i) => store.remove(i.id)); toast('Aufgeräumt'); }, 'Aufräumen'),
          }, 'Aufräumen'),
        ),
        h('div', { class: 'card', style: 'padding:6px 16px;opacity:.72' }, done.map((i) => row(i, kind))),
      ) : null,
    );
  },
};

function switchTab(t) {
  tab = t;
  store.notify();
}

function sorter(kind) {
  if (kind === KINDS.TASK) {
    return (x, y) => (x.data.due || '9999').localeCompare(y.data.due || '9999')
      || x.updated_at.localeCompare(y.updated_at);
  }
  return (x, y) => x.updated_at.localeCompare(y.updated_at);
}

function quickAdd(kind) {
  const input = h('input', {
    type: 'text',
    placeholder: kind === KINDS.TASK ? 'Aufgabe hinzufügen …' : 'Was fehlt? z. B. Milch',
    enterkeyhint: 'done',
    autocapitalize: 'sentences',
  });

  const add = () => {
    const title = input.value.trim();
    if (!title) return;
    store.put(kind, kind === KINDS.TASK
      ? { title, done: false, due: '', assignee: '' }
      : { title, done: false, qty: '' });
    input.value = '';
    input.focus();
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  return h('div', { style: 'display:flex;gap:8px;margin-bottom:14px' },
    h('div', { style: 'flex:1' }, input),
    h('button', { class: 'btn primary', style: 'padding:13px 16px', 'aria-label': 'Hinzufügen', onClick: add },
      icon('plus', 20)),
  );
}

function row(item, kind) {
  const d = item.data;
  const meta = kind === KINDS.TASK
    ? [d.due && `bis ${friendlyDate(d.due)}`, d.assignee && names()[d.assignee]].filter(Boolean).join(' · ')
    : d.qty;

  return h('div', { class: 'row' + (d.done ? ' done' : '') },
    h('button', {
      class: 'check',
      'aria-pressed': String(!!d.done),
      'aria-label': d.title,
      onClick: () => store.patch(item.id, { done: !d.done }),
    }, icon('check')),
    h('div', {
      class: 'grow',
      style: 'cursor:pointer',
      onClick: () => detail(item, kind),
    },
      h('div', { class: 'title' }, d.title),
      meta && h('div', { class: 'meta' }, meta),
      d.due && !d.done && d.due < todayISO() && h('div', { class: 'meta', style: 'color:var(--coral-deep)' }, 'überfällig'),
    ),
    h('button', {
      class: 'icon-btn', 'aria-label': 'Löschen',
      onClick: () => { store.remove(item.id); toast('Gelöscht'); },
    }, icon('trash')),
  );
}

function detail(item, kind) {
  const d = item.data;
  sheet('Bearbeiten', (close) => {
    const title = h('input', { type: 'text', value: d.title });
    const due = h('input', { type: 'date', value: d.due || '' });
    const qty = h('input', { type: 'text', value: d.qty || '', placeholder: 'z. B. 2 Packungen' });
    const { a, b } = names();
    let assignee = d.assignee || '';

    const who = h('div', { class: 'chips' },
      [['', 'Egal'], ['a', a], ['b', b]].map(([val, label]) =>
        h('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(assignee === val),
          onClick: (e) => {
            assignee = val;
            [...who.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
            e.currentTarget.setAttribute('aria-pressed', 'true');
          },
        }, label)),
    );

    return h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'Titel'), title),
      kind === KINDS.TASK
        ? h('div', {},
            h('label', { class: 'field' }, h('span', {}, 'Bis wann'), due),
            h('div', { class: 'field' }, h('span', {}, 'Wer macht\'s'), who),
          )
        : h('label', { class: 'field' }, h('span', {}, 'Menge'), qty),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn ghost', onClick: close }, 'Abbrechen'),
        h('button', {
          class: 'btn primary',
          onClick: () => {
            const patch = kind === KINDS.TASK
              ? { title: title.value.trim() || d.title, due: due.value, assignee }
              : { title: title.value.trim() || d.title, qty: qty.value.trim() };
            store.patch(item.id, patch);
            close();
          },
        }, 'Speichern'),
      ),
    );
  });
}
