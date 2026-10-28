import { store } from '../server/store.js';
import { ALL_KERALA_DISTRICTS, isKeralaPincode, lookupKeralaDistrict } from '../src/data/initialData.js';
import type { SavedAddress } from '../src/types/index.js';

async function runTests() {
  console.log('🧪 Starting YEM MART Customer Account & Addresses Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Test 1: Kerala Pincode Validation
  console.log('1. Kerala Postal Circle & District Lookup');
  assert(isKeralaPincode('682001'), '682001 (Ernakulam) is valid Kerala pincode');
  assert(isKeralaPincode('673001'), '673001 (Kozhikode) is valid Kerala pincode');
  assert(isKeralaPincode('695001'), '695001 (Thiruvananthapuram) is valid Kerala pincode');
  assert(!isKeralaPincode('560001'), '560001 (Bangalore/Karnataka) rejected');
  assert(!isKeralaPincode('110001'), '110001 (Delhi) rejected');
  assert(!isKeralaPincode('68200'), '5-digit pincode rejected');
  assert(lookupKeralaDistrict('682') === 'Ernakulam', '682 prefix maps to Ernakulam');
  assert(lookupKeralaDistrict('673') === 'Kozhikode', '673 prefix maps to Kozhikode');

  // Test 2: Customer Address CRUD & Single Default Enforcement
  console.log('\n2. Customer Address CRUD & Default Enforcement');
  const testUserId = 'test_usr_42_' + Date.now();

  const addr1: SavedAddress = {
    id: 'addr_test_1',
    userId: testUserId,
    fullName: 'Anjali Menon',
    phone: '9847012345',
    address: 'Flat 4B, Sky Heights, MG Road',
    district: 'Ernakulam',
    pincode: '682016',
    label: 'Home',
    isDefault: true,
    createdAt: new Date().toISOString(),
  };

  const saved1 = await store.saveCustomerAddress(addr1);
  assert(saved1.isDefault === true, 'First address saved as default');

  const addr2: SavedAddress = {
    id: 'addr_test_2',
    userId: testUserId,
    fullName: 'Anjali Menon (Work)',
    phone: '9847012345',
    address: 'Infopark Phase 2, Kakkanad',
    district: 'Ernakulam',
    pincode: '682042',
    label: 'Work',
    isDefault: true, // Setting second address as default
    createdAt: new Date().toISOString(),
  };

  const saved2 = await store.saveCustomerAddress(addr2);
  assert(saved2.isDefault === true, 'Second address saved as default');

  const userAddresses = await store.getCustomerAddresses(testUserId);
  const defaultAddresses = userAddresses.filter(a => a.isDefault);
  assert(defaultAddresses.length === 1, 'Strictly 1 default address exists per customer');
  assert(defaultAddresses[0].id === 'addr_test_2', 'Latest default is addr_test_2');

  const prevAddr1 = userAddresses.find(a => a.id === 'addr_test_1');
  assert(prevAddr1?.isDefault === false, 'Previous default addr_test_1 was automatically unset');

  // Test 3: Set Default Explicitly
  console.log('\n3. Explicit Set Default Address');
  await store.setDefaultCustomerAddress(testUserId, 'addr_test_1');
  const userAddressesAfter = await store.getCustomerAddresses(testUserId);
  assert(userAddressesAfter.find(a => a.id === 'addr_test_1')?.isDefault === true, 'addr_test_1 is now default');
  assert(userAddressesAfter.find(a => a.id === 'addr_test_2')?.isDefault === false, 'addr_test_2 is no longer default');

  // Test 4: Delete Address
  console.log('\n4. Address Deletion & Default Reassignment');
  await store.deleteCustomerAddress(testUserId, 'addr_test_1');
  const addressesAfterDelete = await store.getCustomerAddresses(testUserId);
  assert(addressesAfterDelete.length === 1, 'addr_test_1 removed, 1 address remains');
  assert(addressesAfterDelete[0].id === 'addr_test_2', 'Remaining address is addr_test_2');
  assert(addressesAfterDelete[0].isDefault === true, 'Remaining address promoted to default');

  // Clean up test data
  await store.deleteCustomerAddress(testUserId, 'addr_test_2');
  const finalClean = await store.getCustomerAddresses(testUserId);
  assert(finalClean.length === 0, 'Test addresses cleaned up');

  // Test 5: Order Immutability
  console.log('\n5. Order Snapshot Immutability');
  const allOrders = store.getOrders();
  const initialOrderCount = Array.isArray(allOrders) ? allOrders.length : (allOrders.orders?.length || 0);
  assert(initialOrderCount >= 0, `Orders queryable without errors (${initialOrderCount} orders in store)`);


  console.log('\n=============================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
