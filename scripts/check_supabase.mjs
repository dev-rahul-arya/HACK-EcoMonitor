import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envPath = '.env';
if (!fs.existsSync(envPath)) {
  console.log('env_exists=false');
  process.exit(0);
}

const envRaw = fs.readFileSync(envPath, 'utf8');
const getEnv = (key) => {
  const match = envRaw.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

console.log(`env_exists=true`);
console.log(`url_set=${Boolean(supabaseUrl)}`);
console.log(`anon_set=${Boolean(supabaseAnonKey)}`);

if (!supabaseUrl || !supabaseAnonKey) {
  process.exit(0);
}

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const sessionRes = await client.auth.getSession();
console.log(`auth_getSession_ok=${sessionRes.error ? false : true}`);
console.log(`auth_hasSession=${sessionRes.data?.session ? true : false}`);
if (sessionRes.error) {
  console.log(`auth_error=${sessionRes.error.message}`);
}

const probeRes = await client.from('sensor_readings').select('id,recorded_at').limit(1);
console.log(`db_query_ok=${probeRes.error ? false : true}`);
if (probeRes.error) {
  console.log(`db_error_code=${probeRes.error.code || 'none'}`);
  console.log(`db_error_message=${probeRes.error.message}`);
}
