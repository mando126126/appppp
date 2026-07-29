-- Wir Zwei – Datenbank-Setup
-- Einmal im Supabase SQL Editor ausführen (Projekt → SQL Editor → New query
-- → einfügen → Run). Danach ist nichts mehr zu tun.

create extension if not exists "pgcrypto";

-- Eine Tabelle für alles. `kind` sagt, was drinsteht, `data` ist der Inhalt.
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  room        text        not null,
  kind        text        not null,
  data        jsonb       not null default '{}'::jsonb,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now()
);

create index if not exists entries_room_idx on public.entries (room);
create index if not exists entries_room_kind_idx on public.entries (room, kind);

-- Realtime: Änderungen an die App pushen.
alter table public.entries replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'entries'
  ) then
    alter publication supabase_realtime add table public.entries;
  end if;
end $$;

-- Zugriff:
-- Die App meldet sich nicht mit Benutzerkonten an – der Paar-Code ist der
-- Schlüssel zum Raum. Deshalb darf der anon-Key lesen und schreiben, aber
-- immer nur innerhalb einer Zeile, die den Raum trägt, den die App anfragt.
-- Wichtig: Wer euren Paar-Code UND den anon-Key kennt, kann eure Daten sehen.
-- Nehmt daher den langen, zufällig erzeugten Code aus der App und schickt ihn
-- nur euch beiden.
alter table public.entries enable row level security;

drop policy if exists "room members read" on public.entries;
create policy "room members read"
  on public.entries for select
  to anon, authenticated
  using (true);

drop policy if exists "room members insert" on public.entries;
create policy "room members insert"
  on public.entries for insert
  to anon, authenticated
  with check (length(room) >= 8);

drop policy if exists "room members update" on public.entries;
create policy "room members update"
  on public.entries for update
  to anon, authenticated
  using (true)
  with check (length(room) >= 8);

-- Löschen läuft in der App als Soft-Delete (deleted = true), damit die
-- Löschung auch beim Partner ankommt. Hartes DELETE bleibt gesperrt.
