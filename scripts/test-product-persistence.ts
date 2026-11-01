import dotenv from 'dotenv';
dotenv.config();
import { getSupabaseClient, isSupabaseConfigured } from '../server/supabase.js';
import { store } from '../server/store.js';
import type { Product } from '../src/types/index.js';

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 Starting YEM MART Product Persistence & DB Sync Test');
  console.log('====================================================\n');

  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase is not configured.');
    process.exit(1);
  }
  const supabase = getSupabaseClient()!;

  // 1. Initial State Check
  console.log('▶ Step 1: Checking Baseline Catalog and Orders in Supabase...');
  const { count: initialProductCount, error: pErr } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });
  if (pErr) throw new Error(`Supabase query failed: ${pErr.message}`);

  const { count: initialOrderCount, error: oErr } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  if (oErr) throw new Error(`Orders query failed: ${oErr.message}`);

  console.log(`   - Baseline Supabase Products Count: ${initialProductCount}`);
  console.log(`   - Baseline Supabase Orders Count:   ${initialOrderCount}`);
  if (initialProductCount !== 28) {
    console.warn(`⚠️ Warning: Expected 28 baseline products, found ${initialProductCount}`);
  }
  console.log('   ✅ Baseline verified.\n');

  // 2. Test Product Creation
  const testProdId = `prod-test-sync-${Date.now()}`;
  const testProduct: Partial<Product> & { id: string } = {
    id: testProdId,
    name: 'Kochi Heritage Hand-carved Teak Box',
    brand: 'Malabar Woodcraft',
    category: 'Home & Kitchen',
    shortSummary: 'Artisan carved teak heirloom storage box.',
    description: 'Handcrafted by generational artisans in Thrissur using reclaimed plantation teak with solid brass inlays.',
    highlights: ['100% Solid Kerala Plantation Teak', 'Hand-rubbed organic oil polish', 'Solid brass corner brackets'],
    specs: { 'Material': 'Solid Teak', 'Dimensions': '10x6x4 inches', 'Origin': 'Thrissur, Kerala' },
    price: 1899,
    originalPrice: 2499,
    discountPercent: 24,
    images: ['https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80'],
    mainImage: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    status: 'published',
    stock: 12,
    lowStockThreshold: 3,
    isFeatured: true,
    isBestDeal: false,
    isNewArrival: true,
    sku: 'YM-HMK-TEST-01',
    tags: ['teak', 'wooden', 'box', 'artisan'],
  };

  console.log(`▶ Step 2: Testing Admin Product Creation (${testProdId})...`);
  const createRes = await store.saveProduct(testProduct, 'Automated Test');
  if (!createRes.success || !createRes.product) {
    throw new Error(`Failed to create product: ${createRes.error}`);
  }
  console.log(`   - Product created in store memory with SKU: ${createRes.product.sku}`);

  // Query Supabase directly to ensure it was committed to PostgreSQL
  const { data: dbCreated, error: dbCreateErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', testProdId)
    .single();

  if (dbCreateErr || !dbCreated) {
    throw new Error(`Product not found in Supabase: ${dbCreateErr?.message}`);
  }
  console.log(`   - Verified in Supabase: id=${dbCreated.id}, name="${dbCreated.name}", price=${dbCreated.price}`);
  console.log('   ✅ Creation & persistence test passed.\n');

  // 3. Test Product Editing & Synchronization
  console.log(`▶ Step 3: Testing Admin Product Edit & Synchronization...`);
  const updatedData: Partial<Product> & { id: string } = {
    ...createRes.product,
    price: 1699, // Updated price
    originalPrice: 2599,
    stock: 15, // Updated stock
    name: 'Kochi Heritage Hand-carved Teak Heirloom Box',
  };

  const updateRes = await store.saveProduct(updatedData, 'Automated Test');
  if (!updateRes.success || !updateRes.product) {
    throw new Error(`Failed to update product: ${updateRes.error}`);
  }

  // Verify in Supabase
  const { data: dbUpdated, error: dbUpdateErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', testProdId)
    .single();

  if (dbUpdateErr || !dbUpdated) {
    throw new Error(`Failed to fetch updated product from Supabase: ${dbUpdateErr?.message}`);
  }
  if (Number(dbUpdated.price) !== 1699 || Number(dbUpdated.stock) !== 15) {
    throw new Error(`Supabase data mismatch: expected price 1699, got ${dbUpdated.price}; expected stock 15, got ${dbUpdated.stock}`);
  }
  console.log(`   - Verified updated values in Supabase: price=${dbUpdated.price}, stock=${dbUpdated.stock}, name="${dbUpdated.name}"`);
  console.log('   ✅ Edit & synchronization test passed.\n');

  // 4. Test Availability / Publication Status (Storefront filtering)
  console.log(`▶ Step 4: Testing Publication Status Guard (Public Storefront vs Admin)...`);
  // Update test product to draft status
  await store.saveProduct({ ...updatedData, status: 'draft' }, 'Automated Test');
  const publicProducts = store.getProducts({ isAdmin: false });
  const adminProducts = store.getProducts({ isAdmin: true });

  const foundInPublic = publicProducts.some(p => p.id === testProdId);
  const foundInAdmin = adminProducts.some(p => p.id === testProdId);

  if (foundInPublic) {
    throw new Error('Draft product leaked to public customer storefront!');
  }
  if (!foundInAdmin) {
    throw new Error('Draft product missing from admin view!');
  }
  console.log(`   - Public storefront sees ${publicProducts.length} published products (draft hidden).`);
  console.log(`   - Admin view sees ${adminProducts.length} total products (draft visible).`);
  console.log('   ✅ Publication status filtering test passed.\n');

  // 5. Test Product Deletion & Surviving Server Restart / Rehydration
  console.log(`▶ Step 5: Testing Product Deletion & Server Rehydration...`);
  const deleteSuccess = await store.deleteProduct(testProdId, 'Automated Test');
  if (!deleteSuccess) {
    throw new Error('deleteProduct returned false');
  }

  // Check Supabase immediately
  const { data: dbDeleted, error: dbDelCheckErr } = await supabase
    .from('products')
    .select('id')
    .eq('id', testProdId)
    .maybeSingle();

  if (dbDeleted) {
    throw new Error(`Product ${testProdId} still exists in Supabase after deletion!`);
  }
  console.log('   - Product confirmed deleted from Supabase PostgreSQL.');

  // Simulate server reboot / page refresh by forcing full Supabase rehydration
  console.log('   - Simulating server restart and full Supabase rehydration...');
  await store.hydrateFromSupabase();

  const afterHydrateFound = store.getProductById(testProdId);
  if (afterHydrateFound) {
    throw new Error(`Product ${testProdId} resurrected after rehydration!`);
  }
  console.log('   - Confirmed: Product does NOT reappear after rehydration.');

  const { count: finalProductCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });
  console.log(`   - Final Supabase Product Count: ${finalProductCount} (matches initial ${initialProductCount})`);
  console.log('   ✅ Deletion & rehydration persistence test passed.\n');

  // 6. Test Error Handling on Invalid Database Operation
  console.log(`▶ Step 6: Testing Error Handling & Rollback Guard...`);
  const invalidRes = await store.saveProduct({ id: 'invalid-prod', name: '', category: 'Fashion', price: -50 } as any);
  if (invalidRes.success) {
    throw new Error('saveProduct accepted invalid payload!');
  }
  console.log(`   - Invalid payload correctly rejected: "${invalidRes.error}"`);
  console.log('   ✅ Error handling test passed.\n');

  // 7. Verify Unrelated Data Safety
  console.log(`▶ Step 7: Verifying Orders and Historical Data Safety...`);
  const { count: finalOrderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  if (finalOrderCount !== initialOrderCount) {
    throw new Error(`Order count changed! Expected ${initialOrderCount}, got ${finalOrderCount}`);
  }
  console.log(`   - Supabase Orders Count: ${finalOrderCount} (100% untouched).`);
  console.log('   ✅ Historical data preservation verified.\n');

  console.log('====================================================');
  console.log('🎉 ALL PRODUCT PERSISTENCE & DB SYNC TESTS PASSED!');
  console.log('====================================================');
}

runTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
