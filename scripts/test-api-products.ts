import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3000';

async function testHttpEndpoints() {
  console.log('====================================================');
  console.log('🌐 Testing YEM MART Product HTTP Endpoints (Port 3000)');
  console.log('====================================================\n');

  // 1. Public GET /api/products
  console.log('▶ Step 1: Testing Public GET /api/products...');
  const res1 = await fetch(`${BASE_URL}/api/products`);
  if (!res1.ok) throw new Error(`GET /api/products failed with status ${res1.status}`);
  const products1 = await res1.json();
  const baselineCount = products1.length;
  console.log(`   - Public storefront returned ${baselineCount} products.`);
  if (baselineCount < 1) {
    throw new Error(`Expected at least 1 product, got ${baselineCount}`);
  }
  console.log('   ✅ Public GET verified.\n');

  // 2. Admin Login
  console.log('▶ Step 2: Authenticating Admin...');
  const adminPassword = process.env.ADMIN_PASSWORD || 'yemmart2026';
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword, role: 'owner' }),
  });
  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${loginRes.status}`);
  }
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log(`   - Admin authenticated successfully (Role: ${loginData.role}).`);
  console.log('   ✅ Admin auth verified.\n');

  // 3. Test Server-side Validation: Missing required field rejection
  console.log('▶ Step 3: Testing Server-Side Validation on Missing Required Fields...');
  const invalidPayload = {
    name: 'Incomplete Test Product',
    // Missing category, price, etc.
  };
  const invalidRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-admin-token': token,
    },
    body: JSON.stringify(invalidPayload),
  });
  const invalidJson = await invalidRes.json();
  if (invalidRes.ok || invalidRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request, got status ${invalidRes.status}`);
  }
  console.log(`   - Server rejected incomplete payload with 400: "${invalidJson.error}"`);
  console.log('   ✅ Server-side missing field rejection verified.\n');

  // 4. Admin POST /api/products (Create Product WITHOUT shortSummary - verifies derivation fix)
  console.log('▶ Step 4: Admin POST /api/products (Create Product without shortSummary)...');
  const testId1 = `prod-http-derived-${Date.now()}`;
  const productWithoutSummary = {
    id: testId1,
    name: 'Wayanad Organic Robusta Coffee Beans (500g)',
    brand: 'Wayanad Hills Agro',
    category: 'Home & Kitchen',
    description: 'Single-estate shade-grown Robusta coffee beans sun-dried on the slopes of Wayanad. Delivers an intense aroma and rich crema.',
    price: 499,
    originalPrice: 650,
    discountPercent: 23,
    images: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80'],
    mainImage: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80',
    status: 'published',
    stock: 25,
    lowStockThreshold: 5,
    sku: 'YM-HMK-COF-01',
    tags: ['coffee', 'wayanad', 'organic'],
  };

  const createRes1 = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-admin-token': token,
    },
    body: JSON.stringify(productWithoutSummary),
  });
  if (!createRes1.ok) {
    const err = await createRes1.json();
    throw new Error(`Failed to create product without shortSummary: ${JSON.stringify(err)}`);
  }
  const createdProd1 = await createRes1.json();
  console.log(`   - Successfully created product without explicit shortSummary!`);
  console.log(`   - Server derived shortSummary: "${createdProd1.shortSummary}"`);
  if (!createdProd1.shortSummary || createdProd1.shortSummary.trim().length === 0) {
    throw new Error('shortSummary was not derived!');
  }
  console.log('   ✅ Short summary auto-derivation without NOT NULL failure verified.\n');

  // 5. Admin POST /api/products (Create Product WITH explicit shortSummary)
  console.log('▶ Step 5: Admin POST /api/products (Create Product with explicit shortSummary)...');
  const testId2 = `prod-http-explicit-${Date.now()}`;
  const customSummary = 'Authentic cold-pressed virgin coconut oil from Calicut palms.';
  const productWithSummary = {
    id: testId2,
    name: 'Calicut Cold-Pressed Virgin Coconut Oil (1L)',
    brand: 'Malabar Pure',
    category: 'Home & Kitchen',
    shortSummary: customSummary,
    description: '100% natural, unrefined, extracted from fresh mature coconuts sourced from certified farms in Calicut.',
    price: 349,
    originalPrice: 450,
    discountPercent: 22,
    images: ['https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=800&q=80'],
    mainImage: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=800&q=80',
    status: 'published',
    stock: 30,
    lowStockThreshold: 5,
    sku: 'YM-HMK-OIL-01',
    tags: ['coconut oil', 'organic', 'calicut'],
  };

  const createRes2 = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-admin-token': token,
    },
    body: JSON.stringify(productWithSummary),
  });
  if (!createRes2.ok) {
    const err = await createRes2.json();
    throw new Error(`Failed to create product with explicit shortSummary: ${JSON.stringify(err)}`);
  }
  const createdProd2 = await createRes2.json();
  if (createdProd2.shortSummary !== customSummary) {
    throw new Error(`Expected custom summary "${customSummary}", got "${createdProd2.shortSummary}"`);
  }
  console.log(`   - Successfully created product with explicit shortSummary: "${createdProd2.shortSummary}"`);
  console.log('   ✅ Explicit short summary preservation verified.\n');

  // 6. Clean up test products
  console.log('▶ Step 6: Cleaning up test products via DELETE endpoint...');
  for (const tid of [testId1, testId2]) {
    const delRes = await fetch(`${BASE_URL}/api/products/${tid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-admin-token': token,
      },
    });
    if (!delRes.ok) {
      const err = await delRes.json();
      throw new Error(`Failed to delete product ${tid}: ${JSON.stringify(err)}`);
    }
    console.log(`   - Deleted test product ${tid}.`);
  }

  // Verify baseline restored
  const resFinal = await fetch(`${BASE_URL}/api/products?fresh=true`);
  const productsFinal = await resFinal.json();
  if (productsFinal.length !== baselineCount) {
    throw new Error(`Expected catalog to return to baseline ${baselineCount}, but got ${productsFinal.length}`);
  }
  console.log(`   - Catalog restored to baseline (${productsFinal.length} products).`);
  console.log('   ✅ Cleanup and catalog restoration verified.\n');

  console.log('====================================================');
  console.log('🎉 ALL PRODUCT HTTP ENDPOINT TESTS PASSED!');
  console.log('====================================================');
}

testHttpEndpoints().catch((err) => {
  console.error('❌ HTTP test failed:', err);
  process.exit(1);
});
