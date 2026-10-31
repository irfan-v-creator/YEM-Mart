import assert from 'assert';

console.log('🧪 =========================================================');
console.log('🧪 YEM MART — Customer Config & Supabase Auth Key Test Suite');
console.log('🧪 =========================================================\n');

let passed = 0;
let failed = 0;

function test(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

// Helper simulating /api/customer/config key resolution logic
function resolveConfigKeys(env: Record<string, string | undefined>) {
  const rawAnonKey =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    '';
  const cleanAnonKey = rawAnonKey.startsWith('Sb_')
    ? 's' + rawAnonKey.slice(1)
    : rawAnonKey;

  return {
    supabaseUrl: env.VITE_SUPABASE_URL || env.SUPABASE_URL || '',
    supabaseAnonKey: cleanAnonKey,
  };
}

// --------------------------------------------------------------------------
// TEST SUITE 1: Priority Order Resolution
// --------------------------------------------------------------------------
console.log('1. Priority Order Resolution');

// 1.1 SUPABASE_PUBLISHABLE_KEY takes top priority
const res1 = resolveConfigKeys({
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_top_priority_1111111111',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_second_priority_22222',
  SUPABASE_ANON_KEY: 'sb_publishable_third_priority_333333',
});
test('SUPABASE_PUBLISHABLE_KEY takes priority over VITE and standard ANON keys', 
  res1.supabaseAnonKey === 'sb_publishable_top_priority_1111111111');

// 1.2 VITE_SUPABASE_ANON_KEY takes priority over SUPABASE_ANON_KEY when PUBLISHABLE is absent
const res2 = resolveConfigKeys({
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_second_priority_22222',
  SUPABASE_ANON_KEY: 'sb_publishable_third_priority_333333',
});
test('VITE_SUPABASE_ANON_KEY takes priority over SUPABASE_ANON_KEY', 
  res2.supabaseAnonKey === 'sb_publishable_second_priority_22222');

// 1.3 SUPABASE_ANON_KEY used as fallback
const res3 = resolveConfigKeys({
  SUPABASE_ANON_KEY: 'sb_publishable_third_priority_333333',
});
test('SUPABASE_ANON_KEY used when higher priority keys are absent', 
  res3.supabaseAnonKey === 'sb_publishable_third_priority_333333');

// 1.4 Empty fallback when no keys are defined
const res4 = resolveConfigKeys({});
test('Safely returns empty string when no keys configured', 
  res4.supabaseAnonKey === '');

// --------------------------------------------------------------------------
// TEST SUITE 2: Case Normalization (Sb_publishable_ -> sb_publishable_)
// --------------------------------------------------------------------------
console.log('\n2. Case Normalization');

const resTypo = resolveConfigKeys({
  SUPABASE_ANON_KEY: 'Sb_publishable_sample_typo_key_9999999999',
});
test('Normalizes uppercase "Sb_" to valid lowercase "sb_"', 
  resTypo.supabaseAnonKey === 'sb_publishable_sample_typo_key_9999999999');
test('Output key prefix starts with lowercase "sb_publishable_"', 
  resTypo.supabaseAnonKey.startsWith('sb_publishable_'));

const resAlreadyLower = resolveConfigKeys({
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_valid_lowercase_key_8888',
});
test('Preserves already-lowercase "sb_publishable_" without modification', 
  resAlreadyLower.supabaseAnonKey === 'sb_publishable_valid_lowercase_key_8888');

// --------------------------------------------------------------------------
// TEST SUITE 3: Secret Keys Exclusion & Leak Prevention
// --------------------------------------------------------------------------
console.log('\n3. Secret Keys Exclusion & Leak Prevention');

const resSecrets = resolveConfigKeys({
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_never_leak_this_key_77777777',
  SUPABASE_SECRET_KEY: 'sb_secret_another_admin_key_6666666666',
});
test('Service role key is NEVER returned as anon key', 
  resSecrets.supabaseAnonKey === '');
test('Response does not include service_role or secret properties', 
  !('supabaseServiceRoleKey' in resSecrets) && !('supabaseSecretKey' in resSecrets));

// --------------------------------------------------------------------------
// TEST SUITE 4: Live Config Endpoint & GoTrue Connectivity Verification
// --------------------------------------------------------------------------
console.log('\n4. Live Config & Supabase Auth Verification');

async function testLiveAuth() {
  const currentEnv = resolveConfigKeys(process.env);
  test('Current environment resolves a valid Supabase URL', 
    Boolean(currentEnv.supabaseUrl && currentEnv.supabaseUrl.startsWith('https://')));
  test('Current environment resolves a key starting with lowercase "sb_publishable_"', 
    Boolean(currentEnv.supabaseAnonKey && currentEnv.supabaseAnonKey.startsWith('sb_publishable_')));

  // Test against Supabase Auth /settings endpoint with the resolved key
  if (currentEnv.supabaseUrl && currentEnv.supabaseAnonKey) {
    try {
      const authRes = await fetch(`${currentEnv.supabaseUrl}/auth/v1/settings`, {
        headers: {
          apikey: currentEnv.supabaseAnonKey,
        },
      });
      test('Supabase Auth accepts the resolved key with HTTP 200 OK (Not 401)', 
        authRes.status === 200);
      const authBody = await authRes.json();
      test('Supabase Auth confirms email signup is enabled', 
        authBody.external && authBody.external.email === true);
    } catch (err: any) {
      test('Supabase Auth request executed successfully', false, err?.message);
    }
  }
}

testLiveAuth().then(() => {
  console.log('\n=============================================');
  console.log(`CONFIG TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) process.exit(1);
});
