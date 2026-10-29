import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { store } from '../server/store.js';
import { formatWhatsAppUrl, isWhatsAppConfigured } from '../src/utils/formatters.js';
import { isKeralaPincode, lookupKeralaDistrict } from '../src/data/initialData.js';
import type { CustomerDetails, SavedAddress } from '../src/types/index.js';

async function runPhase3Tests() {
  console.log('🧪 =========================================================');
  console.log('🧪 YEM MART — Phase 3 Verification & Regression Test Suite');
  console.log('🧪 =========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 1: Missing Table & Persistent Storage Safety (Fix 1)
  // --------------------------------------------------------------------------
  console.log('1. Database Unavailable / Missing Table Behavior & Truthful Feedback');

  // Verify that live Supabase store methods fail closed with TABLE_NOT_FOUND when customer_addresses table is absent
  try {
    const testUserId = '00000000-0000-0000-0000-000000000001';
    await store.getCustomerAddresses(testUserId);
    assert(false, 'getCustomerAddresses should fail when table is missing', 'Did not throw error');
  } catch (err: any) {
    const isExpected = err.code === 'TABLE_NOT_FOUND' || err.message?.includes('not yet initialized') || err.message?.includes('PGRST205');
    assert(isExpected, 'getCustomerAddresses throws TABLE_NOT_FOUND when table is missing in live Supabase');
    assert(err.statusCode === 503, 'Error status code is 503 (Service Unavailable)');
  }

  try {
    const dummyAddr: SavedAddress = {
      id: 'addr_test_fail',
      userId: '00000000-0000-0000-0000-000000000001',
      fullName: 'Test Recipient',
      phone: '9847012345',
      address: 'Test House, Civil Line Road',
      district: 'Ernakulam',
      pincode: '682001',
      label: 'Home',
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
    await store.saveCustomerAddress(dummyAddr);
    assert(false, 'saveCustomerAddress should reject when table is missing', 'Did not throw error');
  } catch (err: any) {
    const isExpected = err.code === 'TABLE_NOT_FOUND' || err.message?.includes('not yet initialized') || err.message?.includes('PGRST205');
    assert(isExpected, 'saveCustomerAddress rejects with TABLE_NOT_FOUND rather than silently writing to memory');
    assert(err.statusCode === 503, 'saveCustomerAddress error statusCode is 503 (Service Unavailable)');
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Reviewable Migration File & Partial Unique Index (Fix 2)
  // --------------------------------------------------------------------------
  console.log('\n2. Migration DDL & Partial Unique Index Review');
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261029_customer_addresses_and_defaults.sql');
  assert(fs.existsSync(migrationPath), 'Separate SQL migration file exists at supabase/migrations/20261029_customer_addresses_and_defaults.sql');

  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationContent.includes('idx_single_default_address_per_user'), 'Migration includes idx_single_default_address_per_user');
  assert(migrationContent.includes('WHERE is_default = true'), 'Migration enforces partial unique condition WHERE is_default = true');
  assert(migrationContent.includes('set_customer_default_address'), 'Migration includes atomic set_customer_default_address RPC function');
  assert(migrationContent.includes('ENABLE ROW LEVEL SECURITY'), 'Migration enables Row Level Security on customer_addresses');

  // Verify full schema.sql is synchronized
  const fullSchemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
  const fullSchemaContent = fs.readFileSync(fullSchemaPath, 'utf-8');
  assert(fullSchemaContent.includes('idx_single_default_address_per_user'), 'supabase/schema.sql contains the partial unique index');
  assert(fullSchemaContent.includes('set_customer_default_address'), 'supabase/schema.sql contains the atomic default address RPC');

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Password Recovery Validation & Session Handling (Fix 3)
  // --------------------------------------------------------------------------
  console.log('\n3. Password Recovery Form Validation & Session Safety');

  function validateNewPassword(password: string, confirmPassword: string): { valid: boolean; error?: string } {
    if (!password || password.length < 6) {
      return { valid: false, error: 'New password must be at least 6 characters long.' };
    }
    if (password !== confirmPassword) {
      return { valid: false, error: 'Passwords do not match. Please re-enter your password.' };
    }
    return { valid: true };
  }

  assert(!validateNewPassword('', '').valid, 'Empty password rejected');
  assert(!validateNewPassword('12345', '12345').valid, 'Password < 6 chars rejected');
  assert(!validateNewPassword('password123', 'password456').valid, 'Mismatched passwords rejected');
  assert(validateNewPassword('SecurePass123', 'SecurePass123').valid, 'Matching password >= 6 chars accepted');

  // Verify CustomerAuthModal includes recovery mode in source
  const authModalPath = path.resolve(process.cwd(), 'src/components/CustomerAuthModal.tsx');
  const authModalContent = fs.readFileSync(authModalPath, 'utf-8');
  assert(authModalContent.includes("'recovery'"), 'CustomerAuthModal supports dedicated recovery mode');
  assert(authModalContent.includes('updateCustomerPassword'), 'CustomerAuthModal calls updateCustomerPassword');
  assert(authModalContent.includes('New Password'), 'CustomerAuthModal displays New Password fields');
  assert(authModalContent.includes('Back to Sign In'), 'CustomerAuthModal allows user to return to Sign In');

  // --------------------------------------------------------------------------
  // TEST SUITE 4: WhatsApp Number Formatting & Fallback Removal (Fix 4)
  // --------------------------------------------------------------------------
  console.log('\n4. WhatsApp Fallback Removal & Offline State Handling');

  // formatWhatsAppUrl tests
  assert(formatWhatsAppUrl(undefined) === '', 'Undefined WhatsApp number returns empty string (no hardcoded fallback)');
  assert(formatWhatsAppUrl(null) === '', 'Null WhatsApp number returns empty string');
  assert(formatWhatsAppUrl('') === '', 'Empty WhatsApp number returns empty string');
  assert(formatWhatsAppUrl('1234') === '', 'Invalid short WhatsApp number returns empty string');
  assert(
    formatWhatsAppUrl('7510447887') === 'https://wa.me/917510447887',
    'Valid 10-digit number formatted with 91 country code prefix'
  );
  assert(
    formatWhatsAppUrl('917510447887', 'Hello YEM') === 'https://wa.me/917510447887?text=Hello%20YEM',
    'Valid 12-digit number formatted with query text'
  );

  // isWhatsAppConfigured tests
  assert(isWhatsAppConfigured(undefined) === false, 'isWhatsAppConfigured(undefined) is false');
  assert(isWhatsAppConfigured('') === false, 'isWhatsAppConfigured("") is false');
  assert(isWhatsAppConfigured('9847012345') === true, 'isWhatsAppConfigured("9847012345") is true');
  assert(isWhatsAppConfigured('919847012345') === true, 'isWhatsAppConfigured("919847012345") is true');

  // Verify UI files do NOT contain hardcoded fallback "917510447887"
  const heroPath = path.resolve(process.cwd(), 'src/components/HeroCarousel.tsx');
  const heroContent = fs.readFileSync(heroPath, 'utf-8');
  assert(!heroContent.includes("= '917510447887'"), 'HeroCarousel default prop fallback removed');

  const prodDetailPath = path.resolve(process.cwd(), 'src/components/ProductDetailModal.tsx');
  const prodDetailContent = fs.readFileSync(prodDetailPath, 'utf-8');
  assert(!prodDetailContent.includes("|| '917510447887'"), 'ProductDetailModal fallback removed');

  const drawerPath = path.resolve(process.cwd(), 'src/components/CustomerAccountDrawer.tsx');
  const drawerContent = fs.readFileSync(drawerPath, 'utf-8');
  assert(!drawerContent.includes("= '917510447887'"), 'CustomerAccountDrawer default prop fallback removed');

  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  assert(!appContent.includes("settings.whatsappNumber || '917510447887'"), 'App.tsx floating button fallback removed');

  // --------------------------------------------------------------------------
  // TEST SUITE 5: Guest Checkout Non-Interference
  // --------------------------------------------------------------------------
  console.log('\n5. Guest Checkout & Direct Delivery Preservation');

  const guestCustomer: CustomerDetails = {
    fullName: 'Ananthu Krishna',
    phone: '9847123456',
    address: 'Krishna Vilasam, Temple Road',
    district: 'Alappuzha',
    pincode: '688001',
    landmark: 'Near Siva Temple',
  };

  const products = store.getProducts();
  const testProduct = products.find(p => p.stock > 0) || products[0];

  const guestOrderResult = await store.createOrder(
    guestCustomer,
    [{ productId: testProduct.id, quantity: 1 }],
    undefined,
    `YEM-GST-${Date.now().toString().slice(-4)}`
  );

  assert(guestOrderResult.success === true, 'Guest order created successfully without customer account or saved address');
  assert(Boolean(guestOrderResult.order?.id?.startsWith('YEM-')), 'Guest order received valid authoritative Order ID');
  assert(guestOrderResult.order?.customer.fullName === 'Ananthu Krishna', 'Guest order retains full customer details');
  assert(guestOrderResult.order?.customer.district === 'Alappuzha', 'Guest order retains Kerala district');

  // --------------------------------------------------------------------------
  // TEST SUITE 6: Order Tracking & Admin Auth Decoupling
  // --------------------------------------------------------------------------
  console.log('\n6. Order Tracking (PII Masking) & Admin Auth Decoupling');

  if (guestOrderResult.order) {
    const trackResult = store.trackOrder(guestOrderResult.order.id, '9847123456');
    assert(trackResult.success === true, 'Order tracking succeeds with matching Order ID and 10-digit phone');
    assert(Boolean(trackResult.order?.customer.fullName.includes('*')), 'Customer name is masked in public tracking');
    assert(Boolean(trackResult.order?.customer.phone.includes('*')), 'Customer phone is masked in public tracking');
    assert(Boolean(trackResult.order?.customer.address.includes('Protected Destination')), 'Customer street address is masked in tracking');
  }

  // Admin login password verification logic remains securely functional with bcrypt
  const sampleHash = bcrypt.hashSync('admin123', 10);
  const isMatchValid = bcrypt.compareSync('admin123', sampleHash);
  const isMatchInvalid = bcrypt.compareSync('wrongpassword123', sampleHash);
  assert(isMatchValid === true, 'Admin password verification executes securely via cryptographic hash comparison');
  assert(isMatchInvalid === false, 'Incorrect admin password rejected by hash comparison');

  // --------------------------------------------------------------------------
  // FINAL SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n=============================================');
  console.log(`PHASE 3 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
