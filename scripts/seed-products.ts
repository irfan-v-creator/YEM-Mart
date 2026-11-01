import dotenv from 'dotenv';
dotenv.config();
import { getSupabaseClient, isSupabaseConfigured } from '../server/supabase.js';
import { deriveShortSummary } from '../server/store.js';
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
    const shortSummary = deriveShortSummary(p);
    const mainImage = p.mainImage || (Array.isArray(p.images) && p.images[0]) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80';
    const images = Array.isArray(p.images) && p.images.length > 0 ? p.images : [mainImage];

    const payload = {
      id: p.id,
      name: p.name.trim(),
      brand: p.brand?.trim() || 'YEM MART',
      category: p.category.trim(),
      short_summary: shortSummary,
      description: p.description?.trim() || shortSummary,
      highlights: Array.isArray(p.highlights) ? p.highlights : [],
      specs: p.specs && typeof p.specs === 'object' ? p.specs : {},
      rating: p.rating ?? 4.5,
      review_count: p.reviewCount ?? 0,
      original_price: p.originalPrice || p.price,
      price: Number(p.price),
      discount_percent: p.discountPercent ?? 0,
      images,
      main_image: mainImage,
      tags: Array.isArray(p.tags) ? p.tags : [],
      stock: Number(p.stock ?? 0),
      low_stock_threshold: Number(p.lowStockThreshold ?? 5),
      sku: p.sku || `YM-${p.category.slice(0, 3).toUpperCase()}-${p.id}`,
      is_featured: Boolean(p.isFeatured),
      is_best_deal: Boolean(p.isBestDeal),
      is_new_arrival: Boolean(p.isNewArrival),
      required_variant_type: p.requiredVariantType || null,
      status: p.status || 'published',
      scheduled_publish_date: p.scheduledPublishDate || null,
      variants: Array.isArray(p.variants) ? p.variants : [],
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
