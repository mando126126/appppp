// Synchronisation über Supabase.
//
// Ablauf: einmal alles holen (Pull) → Realtime-Kanal abonnieren → lokale
// Änderungen hochladen. Schlägt ein Upload fehl (offline, Flugmodus, Server
// weg), landet der Eintrag in einer Warteschlange und geht später raus.

import { store } from './store.js';

const QUEUE_KEY = 'wz.queue';
const LIB = 'js/vendor/supabase.js';

let libPromise = null;
let client = null;
let channel = null;
let cfg = null;

export const sync = {
  /** 'off' | 'connecting' | 'live' | 'offline' */
  status: 'off',
  onStatus: () => {},
};

function setStatus(s) {
  if (sync.status === s) return;
  sync.status = s;
  sync.onStatus(s);
}

/** Lädt die mitgelieferte Supabase-Bibliothek einmalig nach. */
function loadSupabase() {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = LIB;
      tag.onload = () => globalThis.supabase?.createClient
        ? resolve(globalThis.supabase)
        : reject(new Error('Bibliothek unvollständig geladen'));
      tag.onerror = () => {
        libPromise = null;
        reject(new Error('Supabase-Bibliothek nicht gefunden'));
      };
      document.head.append(tag);
    });
  }
  return libPromise;
}

export async function initSync(config) {
  cfg = config;
  store.uploader = upload;

  if (!config.url || !config.key) {
    setStatus('off'); // reiner Offline-Modus, nur dieses Gerät
    return;
  }

  setStatus('connecting');
  try {
    const { createClient } = await loadSupabase();
    client = createClient(config.url, config.key, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
    await pull();
    listen();
    await flushQueue();
    setStatus('live');
  } catch (err) {
    console.warn('[sync] Verbindung fehlgeschlagen:', err);
    setStatus('offline');
    scheduleRetry();
  }

  addEventListener('online', () => { flushQueue(); reconnect(); });
  addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && sync.status !== 'live') reconnect();
  });
}

async function pull() {
  const { data, error } = await client
    .from('entries')
    .select('id, room, kind, data, updated_at, deleted')
    .eq('room', cfg.room);
  if (error) throw error;
  if (store.mergeAll(data || [])) store.notify();
}

function listen() {
  if (channel) client.removeChannel(channel);
  channel = client
    .channel(`room:${cfg.room}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'entries',
      filter: `room=eq.${cfg.room}`,
    }, (payload) => {
      const row = payload.new;
      if (!row || !row.id) return;
      if (store.merge(row)) store.notify();
    })
    .subscribe((state) => {
      if (state === 'SUBSCRIBED') setStatus('live');
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        setStatus('offline');
        scheduleRetry();
      }
    });
}

let retryTimer = null;
let retryDelay = 2000;

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(reconnect, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 60000); // sanfter Backoff bis 1 Min.
}

async function reconnect() {
  if (!client || sync.status === 'live' || sync.status === 'connecting') return;
  setStatus('connecting');
  try {
    await pull();
    listen();
    await flushQueue();
    retryDelay = 2000;
    setStatus('live');
  } catch {
    setStatus('offline');
    scheduleRetry();
  }
}

/* ---------- Upload + Warteschlange ---------- */

async function upload(entry) {
  if (!client) return;
  try {
    const { error } = await client.from('entries').upsert(entry, { onConflict: 'id' });
    if (error) throw error;
  } catch (err) {
    console.warn('[sync] Upload verschoben:', err);
    enqueue(entry);
    setStatus('offline');
    scheduleRetry();
  }
}

function enqueue(entry) {
  const q = readQueue().filter((e) => e.id !== entry.id);
  q.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

async function flushQueue() {
  const q = readQueue();
  if (!q.length || !client) return;
  const { error } = await client.from('entries').upsert(q, { onConflict: 'id' });
  if (!error) localStorage.removeItem(QUEUE_KEY);
}

export const pendingUploads = () => readQueue().length;

/**
 * Test-Verbindung für den Einrichtungs-Bildschirm. Übersetzt die typischen
 * Stolpersteine in Sätze, mit denen man auch ohne Vorwissen weiterkommt.
 */
export async function testConnection(url, key) {
  let probe;
  try {
    const { createClient } = await loadSupabase();
    probe = createClient(url, key, { auth: { persistSession: false } });
  } catch {
    throw new Error('Die Verbindungs-Bibliothek konnte nicht geladen werden.');
  }

  let result;
  try {
    result = await probe.from('entries').select('id').limit(1);
  } catch {
    throw new Error('Server nicht erreichbar – stimmt die Projekt-URL?');
  }

  const msg = result.error?.message;
  if (!msg) return true;
  if (/jwt|api key|invalid|unauthor/i.test(msg)) throw new Error('Der Anon Key passt nicht zu dieser URL.');
  if (/relation|does not exist|schema|table/i.test(msg)) {
    throw new Error('Tabelle fehlt – bitte zuerst supabase/schema.sql im SQL Editor ausführen.');
  }
  throw new Error(msg);
}
