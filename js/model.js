// Abgeleitete Werte, die mehrere Ansichten brauchen.

import { store, KINDS } from './store.js';
import { todayISO, toISO, parseISO, daysBetween } from './ui.js';

export function names() {
  const c = store.couple() || {};
  return { a: c.nameA || 'Ich', b: c.nameB || 'Du' };
}

export function nameOf(side) {
  return names()[side];
}

/** Wie viele Tage seid ihr schon zusammen? null, wenn kein Startdatum gesetzt. */
export function daysTogether() {
  const c = store.couple();
  if (!c || !c.since) return null;
  return daysBetween(c.since, todayISO());
}

/**
 * Alle wiederkehrenden Anlässe (Jahrestag + eigene Einträge) als nächste
 * Termine, aufsteigend nach Datum.
 */
export function upcomingOccasions(limit = 3) {
  const c = store.couple();
  if (!c) return [];
  const items = [];
  if (c.since) items.push({ label: 'Jahrestag', date: c.since, recurring: true });
  for (const a of c.anniversaries || []) items.push({ ...a, recurring: true });

  return items
    .map((it) => {
      const next = nextOccurrence(it.date);
      return { ...it, next, inDays: daysBetween(todayISO(), next), years: yearsAt(it.date, next) };
    })
    .sort((x, y) => x.inDays - y.inDays)
    .slice(0, limit);
}

/** Nächstes Vorkommen eines jährlichen Datums (heute zählt als "heute"). */
export function nextOccurrence(iso) {
  const d = parseISO(iso);
  const now = new Date();
  const candidate = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (toISO(candidate) < todayISO()) candidate.setFullYear(now.getFullYear() + 1);
  return toISO(candidate);
}

function yearsAt(startISO, atISO) {
  return parseISO(atISO).getFullYear() - parseISO(startISO).getFullYear();
}

/* ---------- Termine & Aufgaben ---------- */

export const eventsSorted = () =>
  store.list(KINDS.EVENT).sort(byDateTime);

export const upcomingEvents = () =>
  eventsSorted().filter((e) => e.data.date >= todayISO());

const byDateTime = (x, y) =>
  (x.data.date + (x.data.time || '')).localeCompare(y.data.date + (y.data.time || ''));

export function todaysAgenda() {
  const t = todayISO();
  return {
    events: eventsSorted().filter((e) => e.data.date === t),
    tasks: store.list(KINDS.TASK).filter((e) => !e.data.done && e.data.due && e.data.due <= t),
  };
}

/* ---------- Geld ---------- */

/**
 * Saldo aus allen Ausgaben.
 * split 'half' → der Zahler hat die Hälfte für den anderen ausgelegt.
 * split 'full' → die Ausgabe war komplett für den anderen.
 * @returns {{net:number, spentA:number, spentB:number}} net > 0 ⇒ B schuldet A.
 */
export function balance() {
  let net = 0, spentA = 0, spentB = 0;
  for (const e of store.list(KINDS.EXPENSE)) {
    const amount = Number(e.data.amount) || 0;
    const owed = e.data.split === 'full' ? amount : amount / 2;
    if (e.data.payer === 'b') { spentB += amount; net -= owed; }
    else { spentA += amount; net += owed; }
  }
  return { net: round2(net), spentA: round2(spentA), spentB: round2(spentB) };
}

export const round2 = (n) => Math.round(n * 100) / 100;

/* ---------- Stimmung ---------- */

export function moodToday(who) {
  const t = todayISO();
  return store.list(KINDS.MOOD).find((m) => m.data.date === t && m.data.who === who) || null;
}
