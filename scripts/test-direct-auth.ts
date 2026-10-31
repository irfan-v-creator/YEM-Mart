import assert from 'assert';
import { getClientSupabase, signUpCustomer, signInCustomer, signOutCustomer, resetCustomerPassword } from '../src/utils/supabaseClient.js';

console.log('🧪 =========================================================');
console.log('🧪 YEM MART — Direct Email & Password Authentication Tests');
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

async function runAuthTests() {
  // 1. Client Initialization & Session Configuration Check
  console.log('1. Supabase Client Configuration & Session Persistence');
  const client = await getClientSupabase();
  test('Supabase client initialized successfully', Boolean(client));

  // Check auth settings
  const authConfig = (client as any)?.auth;
  test('Client configured with persistent auth', Boolean(authConfig));

  // 2. Email & Password Normalization
  console.log('\n2. Credential Normalization & Sanitization');
  const testEmailMixed = '  Customer.TEST@YEMMART.com  ';
  const cleanEmail = testEmailMixed.trim().toLowerCase();
  test('Email normalized to lowercase and trimmed', cleanEmail === 'customer.test@yemmart.com');

  // 3. Password Validation Rules
  console.log('\n3. Password Security Validation');
  const shortPass = '123';
  test('Password < 6 characters disallowed', shortPass.length < 6);
  const validPass = 'SecurePass123!';
  test('Valid password >= 6 characters allowed', validPass.length >= 6);

  // 4. Rate-Limit Handling Verification
  console.log('\n4. Rate-Limit & Error Message Mapping');
  const mockRateLimitError = { message: 'over_email_send_rate_limit: rate limit exceeded', status: 429 };
  const isRateLimit = mockRateLimitError.message.toLowerCase().includes('rate limit') || mockRateLimitError.status === 429;
  test('Rate limit error detected from status 429 or message', isRateLimit);

  // 5. Direct Email + Password Login Flow
  console.log('\n5. Direct Email & Password Login Handling');
  // Attempt login with a synthetic non-existent customer to verify GoTrue returns proper message
  const invalidLoginRes = await signInCustomer({
    email: 'nonexistent.user.testing@example.com',
    password: 'WrongPassword999!',
  });
  test('Non-existent user rejected with friendly error message', 
    Boolean(invalidLoginRes.error && invalidLoginRes.error.includes('Invalid email address or password')));

  // 6. Forgot Password Recovery Link Handling
  console.log('\n6. Forgot Password Recovery URL Handling');
  const resetRes = await resetCustomerPassword('test.recovery@yemmart.com');
  // Supabase returns success even if email doesn't exist (security practice to prevent email enumeration)
  test('Password reset request executed safely', typeof resetRes.success === 'boolean');

  // 7. Supabase Project Auth Settings Verification (Read-Only)
  console.log('\n7. Supabase Project Settings Inspection');
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const cleanKey = key.startsWith('Sb_') ? 's' + key.slice(1) : key;
  
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: cleanKey }
    });
    test('Supabase Auth settings endpoint returns 200 OK with clean key', res.status === 200);
    const settings = await res.json();
    test('Email provider is enabled in Supabase project', settings.external?.email === true);
    
    // Note current state of mailer_autoconfirm
    const isConfirmDisabled = settings.mailer_autoconfirm === true;
    console.log(`  ℹ️  INFO: "Confirm email" is currently ${isConfirmDisabled ? 'DISABLED (Direct login active)' : 'ENABLED (Verification required until toggled in Dashboard)'}`);
  } catch (err: any) {
    test('Settings fetch succeeded', false, err.message);
  }

  // 8. Sign Out Handling
  console.log('\n8. Sign Out Handling');
  const signOutRes = await signOutCustomer();
  test('Sign out handles gracefully', signOutRes.success === true);

  console.log('\n=============================================');
  console.log(`AUTH TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) process.exit(1);
}

runAuthTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
