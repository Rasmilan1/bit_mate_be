const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function testRpc() {
  console.log('Testing RPC or SQL execution...');
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
  console.log('RPC result:', { data, error });
}

testRpc().catch(console.error);
