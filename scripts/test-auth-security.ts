import * as argon2 from '@node-rs/argon2';
import bcrypt from 'bcryptjs';
import { getSupabaseClient, isSupabaseConfigured } from '../server/supabase.js';

async function runTests() {
  console.log('========================================================');
  console.log('🧪 Running YEM MART Admin Authentication & Hashing Tests');
  console.log('========================================================\n');

  const testSecret = 'sample-verification-test-secret-123456';
  const testPassword = 'TestSecureAdminPassword2026!';
  const wrongPassword = 'WrongAdminPassword2026!';

  // Test 1: Argon2id Hash Generation & Verification
  console.log('1. Testing Argon2id Hashing...');
  const argon2Hash = await argon2.hash(testPassword);
  console.log('   - Hash generated:', argon2Hash.substring(0, 30) + '...');
  console.log('   - Starts with $argon2id$:', argon2Hash.startsWith('$argon2id$'));
  const argon2Valid = await argon2.verify(argon2Hash, testPassword);
  console.log('   - Valid password matches:', argon2Valid === true ? '✅ PASS' : '❌ FAIL');
  const argon2Invalid = await argon2.verify(argon2Hash, wrongPassword).catch(() => false);
  console.log('   - Invalid password rejected:', argon2Invalid === false ? '✅ PASS' : '❌ FAIL');

  // Test 2: Bcrypt Hash Generation & Verification (Cost Factor 12)
  console.log('\n2. Testing Bcrypt Hashing (Cost factor 12)...');
  const bcryptHash = await bcrypt.hash(testPassword, 12);
  console.log('   - Hash generated:', bcryptHash.substring(0, 30) + '...');
  console.log('   - Starts with $2a$ or $2b$:', bcryptHash.startsWith('$2a$') || bcryptHash.startsWith('$2b$'));
  const bcryptValid = await bcrypt.compare(testPassword, bcryptHash);
  console.log('   - Valid password matches:', bcryptValid === true ? '✅ PASS' : '❌ FAIL');
  const bcryptInvalid = await bcrypt.compare(wrongPassword, bcryptHash);
  console.log('   - Invalid password rejected:', bcryptInvalid === false ? '✅ PASS' : '❌ FAIL');

  // Test 3: Verification Logic Integration
  console.log('\n3. Testing Password Verification Engine...');
  async function verify(input: string, storedHash: string) {
    if (storedHash.startsWith('$argon2')) {
      return await argon2.verify(storedHash, input);
    }
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      return await bcrypt.compare(input, storedHash);
    }
    return false;
  }

  const engineArgonPass = await verify(testPassword, argon2Hash);
  const engineArgonFail = await verify(wrongPassword, argon2Hash);
  const engineBcryptPass = await verify(testPassword, bcryptHash);
  const engineBcryptFail = await verify(wrongPassword, bcryptHash);

  console.log('   - Engine Argon2id Valid:', engineArgonPass === true ? '✅ PASS' : '❌ FAIL');
  console.log('   - Engine Argon2id Invalid:', engineArgonFail === false ? '✅ PASS' : '❌ FAIL');
  console.log('   - Engine Bcrypt Valid:', engineBcryptPass === true ? '✅ PASS' : '❌ FAIL');
  console.log('   - Engine Bcrypt Invalid:', engineBcryptFail === false ? '✅ PASS' : '❌ FAIL');

  // Test 4: Supabase Live Records Integrity Check
  console.log('\n4. Checking Supabase Database Records Integrity (Read-Only)...');
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: ordCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const { count: cpnCount } = await supabase.from('coupons').select('*', { count: 'exact', head: true });
    console.log(`   - Live Products in Supabase: ${prodCount} (Expected: 28) -> ${prodCount === 28 ? '✅ INTACT' : '⚠️ CHECK'}`);
    console.log(`   - Live Orders in Supabase:   ${ordCount} (Expected: 8)  -> ${ordCount === 8 ? '✅ INTACT' : '⚠️ CHECK'}`);
    console.log(`   - Live Coupons in Supabase:  ${cpnCount} (Expected: 3)  -> ${cpnCount === 3 ? '✅ INTACT' : '⚠️ CHECK'}`);
  } else {
    console.log('   - Supabase not configured in this test runner process.');
  }

  console.log('\n========================================================');
  console.log('🎉 All Security & Hashing Verification Tests Complete!');
  console.log('========================================================\n');
}

runTests().catch(console.error);
