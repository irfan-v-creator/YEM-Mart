import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getSupabaseClient, isSupabaseConfigured } from '../server/supabase.js';

dotenv.config();

async function runMigration() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('====================================================');
  console.log(`🚀 Starting YEM MART Data Migration (Dry-run: ${isDryRun})`);
  console.log('====================================================\n');

  const backupPath = path.resolve(process.cwd(), 'data/yem_database.backup.json');
  if (!fs.existsSync(backupPath)) {
    console.error('❌ Backup file not found at:', backupPath);
    process.exit(1);
  }

  const rawData = fs.readFileSync(backupPath, 'utf-8');
  const db = JSON.parse(rawData);

  console.log(`📦 Loaded backup database snapshot:`);
  console.log(`   - Products:   ${db.products?.length || 0}`);
  console.log(`   - Orders:     ${db.orders?.length || 0}`);
  console.log(`   - Coupons:    ${db.coupons?.length || 0}`);
  console.log(`   - Stock Logs: ${db.stockLogs?.length || 0}`);
  console.log(`   - Audit Logs: ${db.auditLogs?.length || 0}`);
  console.log(`   - Store Name: "${db.settings?.storeName || 'N/A'}"`);
  console.log(`   - WhatsApp:   "${db.settings?.whatsappNumber || 'N/A'}"`);
  console.log(`   - Support:    "${db.settings?.supportPhone || 'N/A'}"\n`);

  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase credentials missing in environment!');
    console.error('Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const supabase = getSupabaseClient()!;
  let totalErrors = 0;

  // 1. Migrate Store Settings
  if (db.settings) {
    console.log('⏳ Migrating store settings...');
    const { error } = await supabase.from('store_settings').upsert({
      id: 'default',
      store_name: db.settings.storeName || 'YEM MART',
      tagline: db.settings.tagline || 'Your Everyday Store',
      whatsapp_number: db.settings.whatsappNumber || '917510447887',
      support_phone: db.settings.supportPhone || '7510447887',
      upi_id: db.settings.upiId || 'yemmart@okaxis',
      delivery_fee: db.settings.deliveryFee ?? 40.0,
      free_delivery_threshold: db.settings.freeDeliveryThreshold ?? 499.0,
      low_stock_threshold: db.settings.lowStockThreshold ?? 5,
      announcement_text: db.settings.announcementText || 'Free Delivery on Orders Above ₹499 | Kerala Delivery in 24–48 Hours',
      coverage_area: db.settings.coverageArea || 'All 14 Districts across Kerala & Selected Metro Hubs',
      office_city: db.settings.officeCity || 'Kozhikode',
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.error('❌ Error saving store settings:', error);
      totalErrors++;
    } else {
      console.log('✅ Store settings migrated successfully.');
    }
  }

  // 2. Migrate Products (with variants JSONB)
  if (Array.isArray(db.products) && db.products.length > 0) {
    console.log(`⏳ Migrating ${db.products.length} products...`);
    let prodSuccess = 0;
    for (const p of db.products) {
      const { error: prodErr } = await supabase.from('products').upsert({
        id: p.id,
        name: p.name,
        brand: p.brand || null,
        category: p.category,
        short_summary: p.shortSummary || null,
        description: p.description || '',
        highlights: p.highlights || [],
        specs: p.specs || {},
        price: p.price,
        original_price: p.originalPrice || p.price,
        discount_percent: p.discountPercent ?? 0,
        rating: p.rating ?? 4.5,
        review_count: p.reviewCount ?? 0,
        images: p.images || [],
        main_image: p.mainImage || (p.images?.[0] ?? null),
        status: p.status || 'published',
        scheduled_publish_date: p.scheduledPublishDate || null,
        stock: p.stock ?? 0,
        low_stock_threshold: p.lowStockThreshold ?? 5,
        is_featured: Boolean(p.isFeatured),
        is_best_deal: Boolean(p.isBestDeal),
        is_new_arrival: Boolean(p.isNewArrival),
        sku: p.sku || null,
        tags: p.tags || [],
        required_variant_type: p.requiredVariantType || null,
        variants: p.variants || [],
        created_at: p.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (prodErr) {
        console.error(`❌ Error migrating product ${p.id}:`, prodErr);
        totalErrors++;
      } else {
        prodSuccess++;
      }
    }
    console.log(`✅ Products migrated: ${prodSuccess}/${db.products.length}`);
  }

  // 3. Migrate Coupons
  if (Array.isArray(db.coupons) && db.coupons.length > 0) {
    console.log(`⏳ Migrating ${db.coupons.length} coupons...`);
    let couponSuccess = 0;
    for (const c of db.coupons) {
      const { error: coupErr } = await supabase.from('coupons').upsert({
        id: c.id,
        code: c.code,
        description: c.description || null,
        discount_type: c.discountType,
        discount_value: c.discountValue,
        min_purchase: c.minPurchase ?? 0,
        max_discount: c.maxDiscount || null,
        start_date: c.startDate || new Date().toISOString(),
        end_date: c.validUntil || c.endDate || '2030-12-31T23:59:59Z',
        usage_limit: c.usageLimit || null,
        used_count: c.timesUsed ?? c.usedCount ?? 0,
        is_active: c.isActive !== false,
        created_at: new Date().toISOString()
      });
      if (coupErr) {
        console.error(`❌ Error migrating coupon ${c.code}:`, coupErr);
        totalErrors++;
      } else {
        couponSuccess++;
      }
    }
    console.log(`✅ Coupons migrated: ${couponSuccess}/${db.coupons.length}`);
  }

  // 4. Migrate Orders
  if (Array.isArray(db.orders) && db.orders.length > 0) {
    console.log(`⏳ Migrating ${db.orders.length} orders...`);
    let orderSuccess = 0;
    for (const o of db.orders) {
      const { error: ordErr } = await supabase.from('orders').upsert({
        id: o.id,
        created_at: o.createdAt || new Date().toISOString(),
        customer: o.customer || {
          fullName: o.customerName || 'Customer',
          phone: o.phone || '',
          address: o.address || '',
          pincode: o.pincode || '',
          email: o.email || null,
          city: o.city || null
        },
        items: o.items || [],
        subtotal: o.subtotal,
        delivery_fee: o.deliveryFee ?? 0,
        discount_amount: o.discount ?? o.discountAmount ?? 0,
        coupon_code: o.couponCode || null,
        grand_total: o.total ?? o.grandTotal ?? 0,
        status: o.orderStatus || o.status || 'prepared',
        payment_status: o.paymentStatus || 'pending',
        utr_number: o.utrNumber || null,
        payment_submitted_at: o.paymentSubmittedAt || null,
        cancellation_reason: o.cancellationReason || null,
        cancelled_at: o.cancelledAt || null,
        is_restocked_on_cancellation: Boolean(o.isRestockedOnCancellation),
        status_timeline: o.statusTimeline || [],
        updated_at: o.updatedAt || new Date().toISOString()
      });
      if (ordErr) {
        console.error(`❌ Error migrating order ${o.id}:`, ordErr);
        totalErrors++;
      } else {
        orderSuccess++;
      }
    }
    console.log(`✅ Orders migrated: ${orderSuccess}/${db.orders.length}`);
  }

  // 5. Migrate Stock Logs
  if (Array.isArray(db.stockLogs) && db.stockLogs.length > 0) {
    console.log(`⏳ Migrating ${db.stockLogs.length} stock logs...`);
    let stockSuccess = 0;
    for (const s of db.stockLogs) {
      const { error: stockErr } = await supabase.from('stock_adjustment_logs').upsert({
        id: s.id,
        timestamp: s.timestamp || new Date().toISOString(),
        product_id: s.productId,
        product_name: s.productName,
        variant_sku: s.variantSku || null,
        previous_stock: s.previousStock,
        new_stock: s.newStock,
        difference: s.difference ?? s.delta,
        reason: s.reason,
        actor: s.actor || 'admin'
      });
      if (stockErr) {
        console.error(`❌ Error migrating stock log ${s.id}:`, stockErr);
        totalErrors++;
      } else {
        stockSuccess++;
      }
    }
    console.log(`✅ Stock adjustment logs migrated: ${stockSuccess}/${db.stockLogs.length}`);
  }

  // 6. Migrate Audit Logs
  if (Array.isArray(db.auditLogs) && db.auditLogs.length > 0) {
    console.log(`⏳ Migrating ${db.auditLogs.length} audit logs...`);
    let auditSuccess = 0;
    for (const a of db.auditLogs) {
      const { error: auditErr } = await supabase.from('audit_logs').upsert({
        id: a.id,
        timestamp: a.timestamp || new Date().toISOString(),
        action: a.action,
        actor: a.actor || 'admin',
        details: a.details || {},
        target_id: a.targetId || null
      });
      if (auditErr) {
        console.error(`❌ Error migrating audit log ${a.id}:`, auditErr);
        totalErrors++;
      } else {
        auditSuccess++;
      }
    }
    console.log(`✅ Audit logs migrated: ${auditSuccess}/${db.auditLogs.length}`);
  }

  console.log('\n====================================================');
  if (totalErrors === 0) {
    console.log('🎉 ALL DATA MIGRATED TO SUPABASE SUCCESSFULLY WITH 0 ERRORS!');
  } else {
    console.log(`⚠️ MIGRATION COMPLETED WITH ${totalErrors} ERROR(S). See logs above.`);
  }
  console.log('====================================================\n');
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
