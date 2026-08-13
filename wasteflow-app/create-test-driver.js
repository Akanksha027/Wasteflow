require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function createDriver() {
  const email = 'akankshasingh0085@gmail.com';
  const password = 'Akanksha27.,';

  console.log('Attempting to create driver user...');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'driver',
        full_name: 'Test Driver'
      }
    }
  });

  if (error) {
    if (error.message.includes('already registered')) {
      console.log(`User ${email} already exists. You can log in with:`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
    } else {
      console.error('Error creating driver:', error.message);
    }
  } else {
    console.log('Successfully created test driver account!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  }
}

createDriver();
