const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const parts = line.split('=');
  if (parts.length > 1) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    acc[key] = val;
  }
  return acc;
}, {});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  // 1. Check if user exists
  console.log('1. Listing auth users...');
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 10 });
  for (const u of (users?.users ?? [])) {
    console.log('  ', u.email, '-', u.id);
  }

  // 2. Test login with a known user
  const testEmail = 'akankshasingh0085@gmail.com';
  console.log('\n2. Looking up user:', testEmail);
  const { data: userId, error: lookupErr } = await supabase.rpc('get_user_id_by_email', { email_input: testEmail });
  console.log('  Result:', userId, lookupErr?.message || '');

  // 3. Check user_roles
  console.log('\n3. Checking user_roles...');
  const { data: roles, error: rolesErr } = await supabase.from('user_roles').select('*');
  console.log('  Roles:', JSON.stringify(roles, null, 2));
  if (rolesErr) console.log('  Error:', rolesErr.message);

  // 4. Check employees
  console.log('\n4. Checking employees with user_id...');
  const { data: emps, error: empsErr } = await supabase.from('employees').select('id, employee_code, full_name, user_id, role');
  for (const e of (emps ?? [])) {
    console.log('  ', e.employee_code, e.full_name, 'user_id:', e.user_id, 'role:', e.role);
  }
  if (empsErr) console.log('  Error:', empsErr.message);

  // 5. Test ensure_my_employee (this is what the app calls)
  console.log('\n5. Testing ensure_my_employee RPC exists...');
  const { data: empData, error: empErr } = await supabase.rpc('ensure_my_employee');
  console.log('  Result:', empData ? 'function exists' : 'no data');
  if (empErr) console.log('  Error:', empErr.message);

  // 6. Reload schema cache by sending NOTIFY
  console.log('\n6. Reloading PostgREST schema cache...');
  const { error: notifyErr } = await supabase.rpc('reload_schema_cache', {});
  if (notifyErr) {
    console.log('  reload_schema_cache not available, trying NOTIFY...');
    // Alternative: call pg_notify
    const { error: pgErr } = await supabase.rpc('pg_notify', { channel: 'pgrst', payload: 'reload schema' });
    if (pgErr) {
      console.log('  pg_notify also failed:', pgErr.message);
      console.log('  You may need to restart PostgREST from the Supabase dashboard.');
    }
  } else {
    console.log('  Schema cache reloaded!');
  }
}

test().catch(console.error);
