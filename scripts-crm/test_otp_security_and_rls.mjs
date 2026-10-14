import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://axpryvuknepqeflymzlv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cHJ5dnVrbmVwcWVmbHltemx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExODI0MjksImV4cCI6MjEwNjc1ODQyOX0.xjeGl44hwspkNuxG3KyJ4QOfZ51GOy-UoTmUAZ5FnO4';

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('--- Phase 6.7.7 Targeted OTP & RLS Security Verification ---');

// Test 1: Anonymous access to customer_communication_preferences
async function testAnonRlsPreferences() {
  console.log('\n[TEST 1] Anonymous Read/Write on customer_communication_preferences...');
  const { data: readData, error: readError } = await anonClient
    .from('customer_communication_preferences')
    .select('*');
  
  if (readError) {
    console.log('  PASS: Read denied with error:', readError.message);
  } else if (!readData || readData.length === 0) {
    console.log('  PASS: Read returned 0 rows (RLS restricted)');
  } else {
    console.error('  FAIL: Anonymous read exposed rows:', readData.length);
  }

  const { error: writeError } = await anonClient
    .from('customer_communication_preferences')
    .insert({
      customer_id: '00000000-0000-0000-0000-000000000000',
      allow_sms: true
    });
  
  if (writeError) {
    console.log('  PASS: Anonymous write rejected:', writeError.message);
  } else {
    console.error('  FAIL: Anonymous write succeeded without auth!');
  }
}

// Test 2: Anonymous call to fn_generate_visit_otp
async function testAnonRpcGeneration() {
  console.log('\n[TEST 2] Anonymous invocation of fn_generate_visit_otp...');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const { data, error } = await anonClient.rpc('fn_generate_visit_otp', {
    p_visit_id: fakeId
  });

  if (error) {
    console.log('  PASS: Anonymous RPC generation denied:', error.message);
  } else {
    console.error('  FAIL: Anonymous RPC generation allowed!', data);
  }
}

// Test 3: Anonymous call to fn_verify_visit_otp_and_complete
async function testAnonRpcVerification() {
  console.log('\n[TEST 3] Anonymous invocation of fn_verify_visit_otp_and_complete...');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const { data, error } = await anonClient.rpc('fn_verify_visit_otp_and_complete', {
    p_visit_id: fakeId,
    p_entered_otp: '123456',
    p_technician_id: null
  });

  if (error) {
    console.log('  PASS: Anonymous RPC verification denied:', error.message);
  } else {
    console.error('  FAIL: Anonymous RPC verification allowed!', data);
  }
}

// Test 4: Anonymous call to read/update system_settings table
async function testAnonSystemSettings() {
  console.log('\n[TEST 4] Anonymous Read/Write on system_settings table...');
  const { data: readData, error: readError } = await anonClient
    .from('system_settings')
    .select('*');

  if (readError) {
    console.log('  PASS: Client read denied on system_settings:', readError.message);
  } else if (!readData || readData.length === 0) {
    console.log('  PASS: Client read returned 0 rows (restricted)');
  } else {
    console.error('  FAIL: Client read exposed system_settings:', readData);
  }

  const { error: writeError } = await anonClient
    .from('system_settings')
    .update({ value: 'development' })
    .eq('key', 'environment');

  if (writeError) {
    console.log('  PASS: Client write denied on system_settings:', writeError.message);
  } else {
    console.error('  FAIL: Client was able to write to system_settings!');
  }
}

async function run() {
  try {
    await testAnonRlsPreferences();
    await testAnonRpcGeneration();
    await testAnonRpcVerification();
    await testAnonSystemSettings();
    console.log('\nAll anonymous client security tests executed.');
  } catch (err) {
    console.error('Error running test script:', err);
  }
}

run();
