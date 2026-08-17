const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const parts = line.split('=');
  if (parts.length > 1) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    acc[key] = val;
  }
  return acc;
}, {});

// Supabase direct connection: use the project ref + database password
// Connection string format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
const projectRef = env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Try using the Supabase Management API with personal access token
// Or try direct connection with the transaction pooler
async function runWithManagementAPI() {
  const sql = fs.readFileSync('supabase/migrations/20260817000000_admin_create_driver.sql', 'utf8');
  
  console.log('Project ref:', projectRef);
  console.log('SQL length:', sql.length, 'chars');
  console.log('');
  
  // The Supabase Management API requires a personal access token
  // Let's try using the direct database connection instead
  // Supabase provides a transaction mode pooler at port 6543
  
  // Database password is needed - let's check if it's in an env var
  const dbPassword = env.SUPABASE_DB_PASSWORD || env.DATABASE_PASSWORD || env.DB_PASSWORD;
  
  if (!dbPassword) {
    console.log('=== DATABASE PASSWORD NEEDED ===');
    console.log('');
    console.log('To run this migration, I need your Supabase database password.');
    console.log('You can find it at:');
    console.log(`  https://supabase.com/dashboard/project/${projectRef}/settings/database`);
    console.log('');
    console.log('Look for "Database password" and copy it.');
    console.log('Then add this line to your .env file:');
    console.log('  SUPABASE_DB_PASSWORD=your_password_here');
    console.log('');
    console.log('Then run this script again.');
    console.log('');
    console.log('--- ALTERNATIVE: Copy the SQL below and paste it in the SQL Editor ---');
    console.log('Make sure to paste the ENTIRE content without any edits.');
    console.log('');
    console.log('='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
    return;
  }
  
  // Connect via transaction pooler
  const connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
  
  console.log('Connecting to Supabase database...');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected! Running migration...');
    await client.query(sql);
    console.log('');
    console.log('=== MIGRATION SUCCESSFUL! ===');
    console.log('The admin_create_driver function has been created.');
    console.log('Admins can now set email + password when creating employees.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

runWithManagementAPI().catch(console.error);
