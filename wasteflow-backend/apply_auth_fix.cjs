const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).reduce((acc, line) => {
  if (!line || line.startsWith('#') || !line.includes('=')) return acc;
  const i = line.indexOf('=');
  acc[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const projectRef = (env.SUPABASE_URL || '').replace('https://', '').replace('.supabase.co', '');
const dbPassword = env.SUPABASE_DB_PASSWORD || env.DATABASE_PASSWORD || env.DB_PASSWORD;
const sql = fs.readFileSync(
  path.join(__dirname, 'supabase/migrations/20260817100000_repair_driver_auth.sql'),
  'utf8',
);

const hosts = [
  `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword || '')}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword || '')}@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword || '')}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
];

async function main() {
  if (!dbPassword) {
    console.log('NO_DB_PASSWORD');
    process.exit(2);
  }
  let lastErr = null;
  for (const connectionString of hosts) {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sql);
      await client.end();
      console.log('MIGRATION_OK', connectionString.split('@')[1]);
      return;
    } catch (err) {
      lastErr = err;
      try { await client.end(); } catch {}
    }
  }
  console.error('MIGRATION_FAIL', lastErr && lastErr.message);
  process.exit(1);
}

main();
