// One-off: apply additive/idempotent migrations 0004–0008 to the live DB and
// (optionally) grant the first admin role. Reads SUPABASE_DB_URL + ADMIN_EMAIL
// from the environment — no secrets are hard-coded. Safe to re-run.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dir, '..', 'supabase', 'migrations');

const DB_URL = process.env.SUPABASE_DB_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
if (!DB_URL) {
  console.error('SUPABASE_DB_URL not set');
  process.exit(1);
}

// Only the migrations that 0001–0003 don't already cover.
const TARGET = /^000[4-8]_/;

// Parse into fields so a password with URL-special chars (e.g. '%') is handled literally.
function parseDbUrl(url) {
  const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error('Could not parse SUPABASE_DB_URL');
  return { user: m[1], password: m[2], host: m[3], port: Number(m[4]), database: m[5] };
}

// Verify TLS against Supabase's pinned CA (its pooler uses a private CA, not a public root).
const caPath = join(__dir, '.supabase-ca.pem');
const ca = readFileSync(caPath, 'utf8');
const client = new pg.Client({ ...parseDbUrl(DB_URL), ssl: { ca, rejectUnauthorized: true } });

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql') && TARGET.test(f))
  .sort();

const run = async () => {
  await client.connect();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('commit');
      console.log(`OK   ${f}`);
    } catch (e) {
      await client.query('rollback').catch(() => {});
      console.error(`FAIL ${f}\n     ${e.message}`);
      throw e;
    }
  }

  if (ADMIN_EMAIL) {
    const res = await client.query(
      `insert into user_roles (user_id, role_id)
       select u.id, r.id from auth.users u, roles r
       where lower(u.email) = lower($1) and r.key = 'admin'
       on conflict do nothing
       returning user_id`,
      [ADMIN_EMAIL],
    );
    if (res.rowCount > 0) console.log(`ADMIN granted to ${ADMIN_EMAIL} (${res.rows[0].user_id})`);
    else {
      const exists = await client.query('select id from auth.users where lower(email)=lower($1)', [ADMIN_EMAIL]);
      console.log(exists.rowCount ? `ADMIN already set for ${ADMIN_EMAIL}` : `ADMIN skipped — no auth user for ${ADMIN_EMAIL} (sign up first)`);
    }
  }
  await client.end();
};

run().then(
  () => { console.log('done'); process.exit(0); },
  (e) => { console.error('aborted:', e.message); process.exit(1); },
);
