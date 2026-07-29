// Startseite: der tägliche Blick auf "uns".

import { h, icon, sheet, toast, friendlyDate, plural, money, emptyState, todayISO } from '../ui.js';
import { store, KINDS } from '../store.js';
import { session } from '../session.js';
import { names, daysTogether, upcomingOccasions, todaysAgenda, balance, moodToday } from '../model.js';

const MOODS = ['😍', '😊', '😌', '😐', '😔', '😤'];

export const home = {
  id: 'home',
  label: 'Wir',
  icon: 'home',
  title: () => greeting(),
  subtitle: () => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),

  render() {
    return h('div', { class: 'stack' },
      hero(),
      moodCard(),
      todayCard(),
      moneyGlimpse(),
      lastNote(),
    );
  },
};

function greeting() {
  const hour = new Date().getHours();
  const n = names()[session.me];
  const part = hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  return `${part}, ${n.split(' ')[0]}`;
}

function hero() {
  const c = store.couple();
  const days = daysTogether();
  const { a, b } = names();
  const next = upcomingOccasions(1)[0];

  if (!c || !c.since) {
    return h('div', { class: 'hero' },
      h('div', { class: 'names' }, 'Noch nichts eingerichtet'),
      h('div', { style: 'font-size:15px;opacity:.92;line-height:1.5' },
        'Tragt eure Namen und euer Anfangsdatum ein – dann zählt die App ab hier jeden gemeinsamen Tag mit.'),
      h('button', {
        class: 'btn block',
        style: 'margin-top:16px;background:rgba(255,255,255,.95);color:var(--coral-deep)',
        onClick: () => session.navigate('settings'),
      }, 'Jetzt einrichten'),
    );
  }

  return h('div', { class: 'hero' },
    h('div', { class: 'names' }, `${a} & ${b}`),
    h('div', { class: 'days' }, days.toLocaleString('de-DE')),
    h('div', { class: 'label' }, days === 1 ? 'Tag zusammen' : 'Tage zusammen'),
    next && h('div', { class: 'next' },
      h('span', {}, next.label === 'Jahrestag' && next.years ? `${next.years}. Jahrestag` : next.label),
      h('strong', {}, next.inDays === 0 ? 'Heute! 🎉' : `in ${plural(next.inDays, 'Tag', 'Tagen')}`),
    ),
  );
}

function moodCard() {
  const { a, b } = names();
  const mine = moodToday(session.me);
  const theirs = moodToday(session.partner);
  const partnerName = session.me === 'a' ? b : a;

  return h('div', { class: 'card' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px' },
      h('strong', {}, 'Wie geht\'s dir heute?'),
      h('span', { class: 'small muted' },
        theirs ? `${partnerName}: ${theirs.data.emoji}` : `${partnerName}: noch offen`),
    ),
    h('div', { class: 'mood-grid' },
      MOODS.map((emoji) => h('button', {
        type: 'button',
        'aria-pressed': String(mine?.data.emoji === emoji),
        'aria-label': `Stimmung ${emoji}`,
        onClick: () => setMood(emoji, mine),
      }, emoji)),
    ),
    theirs?.data.text && h('p', { class: 'small muted', style: 'margin:12px 0 0' },
      `„${theirs.data.text}" – ${partnerName}`),
  );
}

function setMood(emoji, existing) {
  if (existing) store.patch(existing.id, { emoji });
  else store.put(KINDS.MOOD, { date: todayISO(), who: session.me, emoji, text: '' });
  toast('Stimmung gespeichert');
}

function todayCard() {
  const { events, tasks } = todaysAgenda();
  if (!events.length && !tasks.length) {
    return h('div', { class: 'card' },
      h('strong', {}, 'Heute'),
      emptyState('🌤️', 'Nichts geplant – ein freier Tag für euch zwei.'),
    );
  }

  return h('div', { class: 'card' },
    h('strong', {}, 'Heute'),
    h('div', { style: 'margin-top:8px' },
      events.map((e) => h('div', { class: 'row' },
        h('span', { class: 'avatar', style: 'background:var(--coral-soft);color:var(--coral-deep)' },
          icon('calendar', 15)),
        h('div', { class: 'grow' },
          h('div', { class: 'title' }, e.data.title),
          h('div', { class: 'meta' }, [e.data.time, e.data.place].filter(Boolean).join(' · ') || 'ganztägig'),
        ),
      )),
      tasks.map((t) => h('div', { class: 'row' },
        h('button', {
          class: 'check',
          'aria-pressed': 'false',
          'aria-label': `${t.data.title} erledigen`,
          onClick: () => { store.patch(t.id, { done: true }); toast('Erledigt ✓'); },
        }, icon('check')),
        h('div', { class: 'grow' },
          h('div', { class: 'title' }, t.data.title),
          h('div', { class: 'meta' }, t.data.due < todayISO() ? 'überfällig' : 'heute fällig'),
        ),
      )),
    ),
  );
}

function moneyGlimpse() {
  const { net } = balance();
  if (net === 0) return null;
  const { a, b } = names();
  const debtor = net > 0 ? b : a;
  const creditor = net > 0 ? a : b;

  return h('button', {
    class: 'card',
    style: 'width:100%;text-align:left;display:flex;align-items:center;gap:14px',
    onClick: () => session.navigate('money'),
  },
    h('span', { class: 'avatar', style: 'background:var(--surface-2);color:var(--fg-mid)' }, icon('wallet', 16)),
    h('span', { class: 'grow' },
      h('div', { class: 'title' }, `${debtor} schuldet ${creditor}`),
      h('div', { class: 'meta' }, 'Tippen für alle Ausgaben'),
    ),
    h('strong', { style: 'font-size:18px' }, money(Math.abs(net))),
  );
}

function lastNote() {
  const notes = store.list(KINDS.NOTE)
    .sort((x, y) => y.updated_at.localeCompare(x.updated_at));
  const latest = notes[0];

  return h('div', {},
    h('div', { class: 'section-title' },
      'Liebesnachricht',
      h('button', {
        class: 'icon-btn',
        'aria-label': 'Nachricht schreiben',
        onClick: writeNote,
      }, icon('pencil')),
    ),
    latest
      ? h('div', { class: 'note' },
          h('div', { class: 'body' }, latest.data.body),
          h('div', { class: 'by' },
            h('span', {}, names()[latest.data.author] || ''),
            h('button', {
              class: 'btn danger small',
              style: 'padding:0;background:none',
              onClick: () => session.navigate('us'),
            }, 'alle ansehen'),
          ),
        )
      : h('button', { class: 'card', style: 'width:100%;text-align:left', onClick: writeNote },
          h('div', { class: 'muted small' }, '💌 Hinterlass ihr eine Nachricht – sie sieht sie sofort.')),
  );
}

export function writeNote() {
  sheet('Liebesnachricht', (close) => {
    const body = h('textarea', { placeholder: 'Was möchtest du sagen?', maxlength: '600' });
    return h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'Nachricht'), body),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn ghost', onClick: close }, 'Abbrechen'),
        h('button', {
          class: 'btn primary',
          onClick: () => {
            const text = body.value.trim();
            if (!text) return body.focus();
            store.put(KINDS.NOTE, { body: text, author: session.me });
            close();
            toast('Abgeschickt 💌');
          },
        }, 'Senden'),
      ),
    );
  });
}
