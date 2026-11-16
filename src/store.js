/* Where profiles live. With DATABASE_URL set: Postgres (one row per profile, jsonb). Otherwise a JSON file
   (DATA_FILE, default ./data/found.json) for local play. Both keep everything in memory and write changes in batches. */
import fs from 'node:fs';
import path from 'node:path';

export async function openStore(opts = {}) {
  const url = opts.databaseUrl ?? process.env.DATABASE_URL;
  return url ? pgStore(url) : fileStore(opts.file || process.env.DATA_FILE || path.resolve('data/found.json'));
}

function fileStore(file) {
  const profiles = new Map(); let dirty = false, timer = null;
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); for (const [k, v] of Object.entries(j.profiles || {})) profiles.set(k, v); } catch (e) { /* first run */ }
  const flush = () => {
    timer = null; if (!dirty) return; dirty = false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ v: 1, profiles: Object.fromEntries(profiles) })); fs.renameSync(tmp, file);
  };
  return {
    kind: 'file', profiles,
    touch() { dirty = true; if (!timer) timer = setTimeout(flush, 1500); },
    async close() { if (timer) clearTimeout(timer); flush(); }
  };
}

async function pgStore(url) {
  const { default: postgres } = await import('postgres');
  const clean = String(url).trim().replace(/^['"]|['"]$/g, '').replace(/([?&])channel_binding=[^&]*&?/, '$1').replace(/[?&]$/, '');
  /* Render's internal hosts (no dots) and local servers don't use TLS; external hosts prefer it */
  let host = ''; try { host = new URL(clean).hostname; } catch (e) {}
  const ssl = process.env.PGSSL === 'disable' || host === 'localhost' || host === '127.0.0.1' || !host.includes('.') ? false : 'prefer';
  const sql = postgres(clean, { ssl, max: 3, idle_timeout: 30, onnotice: () => {} });
  await sql`create table if not exists found_profiles (id text primary key, data jsonb not null, updated_at timestamptz not null default now())`;
  const profiles = new Map();
  for (const r of await sql`select id, data from found_profiles`) profiles.set(r.id, typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
  const pending = new Set(); let timer = null, writing = Promise.resolve();
  const flush = () => {
    timer = null; if (!pending.size) return writing;
    const ids = [...pending]; pending.clear();
    writing = writing.then(async () => {
      for (const id of ids) { const p = profiles.get(id); if (!p) continue;
        try { await sql`insert into found_profiles (id, data, updated_at) values (${id}, ${sql.json(p)}, now()) on conflict (id) do update set data = excluded.data, updated_at = now()`; }
        catch (e) { console.error('save failed', id, e.message); pending.add(id); } }
    });
    return writing;
  };
  return {
    kind: 'postgres', profiles,
    touch(id) { if (id) pending.add(id); else for (const k of profiles.keys()) pending.add(k); if (!timer) timer = setTimeout(flush, 2000); },
    async close() { if (timer) clearTimeout(timer); await flush(); await sql.end({ timeout: 5 }); }
  };
}
