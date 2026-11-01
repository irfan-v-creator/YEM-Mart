import dotenv from 'dotenv';
dotenv.config();
import { getSupabaseClient, isSupabaseConfigured } from '../server/supabase.js';
import { INITIAL_PRODUCTS } from '../src/data/initialData.js';

export async function seedProductsToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, count: 0, error: 'Supabase credentials not configured' };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, count: 0, error: 'Failed to initialize Supabase client' };
  }

  console.log(`Starting seed of ${INITIAL_PRODUCTS.length} initial products to Supabase...`);

  let seededCount = 0;
  for (const p of INITIAL_PRODUCTS) {
    const payload = {
      id: p.id,
      name: p.name,
      brand: p.brand || null,
      category: p.category,
      short_summary: p.shortSummary || null,
      description: p.description || '',
      highlights: p.highlights || [],
      specs: p.specs || {},
      rating: p.rating ?? 4.5,
      review_count: p.reviewCount ?? 0,
      original_price: p.originalPrice || p.price,
      price: p.price,
      discount_percent: p.discountPercent ?? 0,
      images: p.images || [],
      main_image: p.mainImage || (p.images?.[0] ?? null),
      tags: p.tags || [],
      stock: p.stock ?? 0,
      low_stock_threshold: p.lowStockThreshold ?? 5,
      sku: p.sku || null,
      is_featured: Boolean(p.isFeatured),
      is_best_deal: Boolean(p.isBestDeal),
      is_new_arrival: Boolean(p.isNewArrival),
      required_variant_type: p.requiredVariantType || null,
      status: p.status || 'published',
      scheduled_publish_date: p.scheduledPublishDate || null,
      variants: p.variants || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('products').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error(`Error upserting product ${p.id} (${p.sku}):`, error);
      return { success: false, count: seededCount, error: `Product ${p.id}: ${error.message}` };
    }
    seededCount++;
  }

  console.log(`Successfully seeded ${seededCount} products to Supabase!`);
  return { success: true, count: seededCount };
}

if (process.argv[1]?.endsWith('seed-products.ts')) {
  seedProductsToSupabase().then((res) => {
    console.log('Seed result:', res);
    process.exit(res.success ? 0 : 1);
  });
}
