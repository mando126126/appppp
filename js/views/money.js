// Gemeinsame Kasse: wer hat was bezahlt, und wer schuldet wem wie viel.

import { h, sheet, toast, confirmSheet, friendlyDate, money, emptyState, todayISO } from '../ui.js';
import { store, KINDS } from '../store.js';
import { session } from '../session.js';
import { names, balance, round2 } from '../model.js';

const CATEGORIES = ['🍽️ Essen', '🛒 Einkauf', '🏠 Wohnen', '🚗 Unterwegs', '🎁 Geschenke', '🎬 Freizeit', '✨ Sonstiges'];

export const moneyView = {
  id: 'money',
  label: 'Geld',
  icon: 'wallet',
  title: () => 'Gemeinsame Kasse',
  subtitle: () => 'Ausgeglichen bleiben, ohne Rechnen',
  fab: () => editExpense(null),

  render() {
    const expenses = store.list(KINDS.EXPENSE)
      .sort((x, y) => (y.data.date || '').localeCompare(x.data.date || ''));

    return h('div', {},
      balanceCard(),
      expenses.length
        ? h('div', {}, groupByMonth(expenses).map(monthGroup))
        : emptyState('💸', 'Noch keine Ausgaben erfasst. Plus antippen, sobald einer von euch zahlt.'),
    );
  },
};

function balanceCard() {
  const { net, spentA, spentB } = balance();
  const { a, b } = names();
  const total = spentA + spentB;
  const even = Math.abs(net) < 0.01;

  return h('div', { class: 'card' },
    h('div', { class: 'balance' + (even ? ' even' : '') },
      h('div', { class: 'amount' }, even ? 'Quitt' : money(Math.abs(net))),
      h('div', { class: 'who' }, even
        ? 'Ihr seid genau ausgeglichen ✨'
        : net > 0 ? `${b} schuldet ${a}` : `${a} schuldet ${b}`),
    ),
    total > 0 && h('div', {},
      h('div', { class: 'bar' },
        h('i', { style: `width:${(spentA / total) * 100}%;background:var(--coral)` }),
        h('i', { style: `width:${(spentB / total) * 100}%;background:var(--sky)` }),
      ),
      h('div', { style: 'display:flex;justify-content:space-between;margin-top:8px;font-size:12.5px' },
        h('span', { class: 'muted' }, `${a}: ${money(spentA)}`),
        h('span', { class: 'muted' }, `${b}: ${money(spentB)}`),
      ),
    ),
    !even && h('button', {
      class: 'btn ghost block',
      style: 'margin-top:16px',
      onClick: () => settleUp(net),
    }, 'Ausgleichen & zurücksetzen'),
  );
}

function settleUp(net) {
  const { a, b } = names();
  const payer = net > 0 ? 'b' : 'a';
  const payerName = net > 0 ? b : a;
  confirmSheet('Schulden ausgleichen?',
    `Wir tragen eine Ausgleichszahlung von ${money(Math.abs(net))} durch ${payerName} ein. Die bisherigen Ausgaben bleiben als Verlauf erhalten.`,
    () => {
      store.put(KINDS.EXPENSE, {
        title: 'Ausgleichszahlung',
        amount: round2(Math.abs(net)),
        payer,
        date: todayISO(),
        split: 'full',
        category: '✨ Sonstiges',
      });
      toast('Ausgeglichen ✓');
    }, 'Ausgleichen');
}

function groupByMonth(list) {
  const groups = new Map();
  for (const e of list) {
    const key = (e.data.date || todayISO()).slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.entries()];
}

function monthGroup([month, items]) {
  const sum = items.reduce((acc, e) => acc + (Number(e.data.amount) || 0), 0);
  const label = new Date(`${month}-01T00:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return h('div', {},
    h('div', { class: 'section-title' }, label, h('span', {}, money(sum))),
    h('div', { class: 'card', style: 'padding:6px 16px' }, items.map(expenseRow)),
  );
}

function expenseRow(e) {
  const d = e.data;
  const { a, b } = names();
  const who = d.payer === 'b' ? b : a;

  return h('div', { class: 'row', style: 'cursor:pointer', onClick: () => editExpense(e) },
    h('span', { class: 'avatar' + (d.payer === 'b' ? ' b' : '') }, who.slice(0, 1).toUpperCase()),
    h('div', { class: 'grow' },
      h('div', { class: 'title' }, d.title),
      h('div', { class: 'meta' },
        [friendlyDate(d.date), d.category, d.split === 'full' ? 'ganz übernommen' : null]
          .filter(Boolean).join(' · ')),
    ),
    h('strong', {}, money(d.amount)),
  );
}

export function editExpense(entry) {
  const d = entry?.data || {
    title: '', amount: '', payer: session.me, date: todayISO(), split: 'half', category: CATEGORIES[0],
  };
  const { a, b } = names();

  sheet(entry ? 'Ausgabe bearbeiten' : 'Neue Ausgabe', (close) => {
    const title = h('input', { type: 'text', value: d.title, placeholder: 'z. B. Pizza, Tanken' });
    const amount = h('input', {
      type: 'number', inputmode: 'decimal', step: '0.01', min: '0',
      value: d.amount, placeholder: '0,00',
    });
    const date = h('input', { type: 'date', value: d.date });

    let payer = d.payer;
    const payerChips = pickRow([['a', a], ['b', b]], payer, (v) => { payer = v; });

    let split = d.split;
    const splitChips = pickRow([['half', 'Halbe-halbe'], ['full', 'Ganz für den anderen']], split, (v) => { split = v; });

    let category = d.category;
    const catChips = pickRow(CATEGORIES.map((c) => [c, c]), category, (v) => { category = v; });

    const save = () => {
      const value = round2(parseFloat(String(amount.value).replace(',', '.')));
      if (!title.value.trim()) return title.focus();
      if (!Number.isFinite(value) || value <= 0) return amount.focus();
      const data = { title: title.value.trim(), amount: value, payer, date: date.value || todayISO(), split, category };
      if (entry) store.patch(entry.id, data);
      else store.put(KINDS.EXPENSE, data);
      close();
      toast(entry ? 'Aktualisiert' : 'Ausgabe erfasst');
    };

    return h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'Wofür'), title),
      h('div', { class: 'field-row' },
        h('label', { class: 'field' }, h('span', {}, 'Betrag (€)'), amount),
        h('label', { class: 'field' }, h('span', {}, 'Datum'), date),
      ),
      h('div', { class: 'field' }, h('span', {}, 'Wer hat bezahlt'), payerChips),
      h('div', { class: 'field' }, h('span', {}, 'Aufteilung'), splitChips),
      h('div', { class: 'field' }, h('span', {}, 'Kategorie'), catChips),
      h('div', { class: 'sheet-actions' },
        entry
          ? h('button', {
              class: 'btn ghost',
              onClick: () => {
                close();
                confirmSheet('Ausgabe löschen?', `„${d.title}" wird bei euch beiden entfernt.`,
                  () => { store.remove(entry.id); toast('Gelöscht'); });
              },
            }, 'Löschen')
          : h('button', { class: 'btn ghost', onClick: close }, 'Abbrechen'),
        h('button', { class: 'btn primary', onClick: save }, 'Speichern'),
      ),
    );
  });
}

/** Chip-Reihe mit genau einer Auswahl. */
function pickRow(options, current, onPick) {
  const row = h('div', { class: 'chips' },
    options.map(([val, label]) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(current === val),
      onClick: (e) => {
        onPick(val);
        [...row.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
      },
    }, label)),
  );
  return row;
}
