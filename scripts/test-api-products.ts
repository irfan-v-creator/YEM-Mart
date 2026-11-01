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
  console.log(`   - Public storefront returned ${products1.length} products.`);
  if (products1.length !== 28) {
    throw new Error(`Expected 28 products, got ${products1.length}`);
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

  // 3. Admin POST /api/products (Create Product)
  console.log('▶ Step 3: Admin POST /api/products (Create Product)...');
  const testId = `prod-http-${Date.now()}`;
  const newProduct = {
    id: testId,
    name: 'Wayanad Organic Robusta Coffee Beans (500g)',
    brand: 'Wayanad Hills Agro',
    category: 'Home & Kitchen',
    description: 'Single-estate shade-grown Robusta coffee beans sun-dried on the slopes of Wayanad.',
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

  const createRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-admin-token': token,
    },
    body: JSON.stringify(newProduct),
  });
  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Failed to create product via HTTP: ${JSON.stringify(err)}`);
  }
  const createdProd = await createRes.json();
  console.log(`   - Created product: "${createdProd.name}" (${createdProd.id})`);

  // Verify it appears in public list
  const res2 = await fetch(`${BASE_URL}/api/products?fresh=true`);
  const products2 = await res2.json();
  const existsAfterCreate = products2.some((p: any) => p.id === testId);
  if (!existsAfterCreate) {
    throw new Error('Newly created product does not appear in fresh products query!');
  }
  console.log(`   - Product confirmed visible in storefront (${products2.length} total products).`);
  console.log('   ✅ Product creation via HTTP verified.\n');

  // 4. Admin DELETE /api/products/:id (Delete Product)
  console.log(`▶ Step 4: Admin DELETE /api/products/${testId}...`);
  const deleteRes = await fetch(`${BASE_URL}/api/products/${testId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-admin-token': token,
    },
  });
  if (!deleteRes.ok) {
    const err = await deleteRes.json();
    throw new Error(`Failed to delete product via HTTP: ${JSON.stringify(err)}`);
  }
  console.log('   - Product deleted successfully via DELETE endpoint.');

  // Verify it is gone in fresh query
  const res3 = await fetch(`${BASE_URL}/api/products?fresh=true`);
  const products3 = await res3.json();
  const existsAfterDelete = products3.some((p: any) => p.id === testId);
  if (existsAfterDelete) {
    throw new Error('Deleted product STILL appears in fresh products query!');
  }
  console.log(`   - Confirmed: Product is gone from storefront (${products3.length} total products).`);
  console.log('   ✅ Product deletion via HTTP verified.\n');

  console.log('====================================================');
  console.log('🎉 ALL PRODUCT HTTP ENDPOINT TESTS PASSED!');
  console.log('====================================================');
}

testHttpEndpoints().catch((err) => {
  console.error('❌ HTTP test failed:', err);
  process.exit(1);
});
