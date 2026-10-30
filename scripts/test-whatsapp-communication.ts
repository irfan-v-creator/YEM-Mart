import assert from 'assert';
import { store } from '../server/store.js';
import { generateAdminOrderWhatsAppMessage, formatWhatsAppUrl } from '../src/utils/formatters.js';
import type { CustomerDetails, Order } from '../src/types/index.js';

async function runWhatsAppTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 YEM MART — WhatsApp Order Communication Test Suite');
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

  // Common in-stock cart item for testing
  const products = store.getProducts();
  const testProduct = products.find(p => p.stock > 0) || products[0];
  const dummyItem = [{
    productId: testProduct.id,
    quantity: 1
  }];

  // --------------------------------------------------------------------------
  // TEST 1: Guest checkout WITHOUT a WhatsApp number
  // --------------------------------------------------------------------------
  console.log('1. Guest Checkout Without WhatsApp Number');
  const customerNoWa: CustomerDetails = {
    fullName: 'Arjun Das',
    phone: '9847111222',
    address: 'Kacheripady, MG Road',
    pincode: '682011',
    district: 'Ernakulam',
    isWhatsAppSameAsPhone: false,
  };
  const order1Res = await store.createOrder(customerNoWa, dummyItem);
  test('Order 1 created successfully', order1Res.success && Boolean(order1Res.order));
  const order1 = order1Res.order!;
  test('Order 1 mobile number preserved', order1.customer.phone === '9847111222');
  test('Order 1 whatsappNumber is undefined', order1.customer.whatsappNumber === undefined);
  test('Order 1 isWhatsAppSameAsPhone is false', order1.customer.isWhatsAppSameAsPhone === false);

  // --------------------------------------------------------------------------
  // TEST 2: Guest checkout with "Same as mobile" checkbox selected
  // --------------------------------------------------------------------------
  console.log('\n2. Guest Checkout with Same-as-Mobile Checkbox');
  const customerSameWa: CustomerDetails = {
    fullName: 'Lakshmi Nair',
    phone: '9847222333',
    whatsappNumber: undefined,
    isWhatsAppSameAsPhone: true,
    address: 'Vyttila Hub, Kochi',
    pincode: '682019',
    district: 'Ernakulam',
  };
  const order2Res = await store.createOrder(customerSameWa, dummyItem);
  test('Order 2 created successfully', order2Res.success && Boolean(order2Res.order));
  const order2 = order2Res.order!;
  test('Order 2 whatsappNumber equals mobile number', order2.customer.whatsappNumber === '9847222333');
  test('Order 2 isWhatsAppSameAsPhone is true', order2.customer.isWhatsAppSameAsPhone === true);

  // --------------------------------------------------------------------------
  // TEST 3: Guest checkout with separate dedicated WhatsApp number
  // --------------------------------------------------------------------------
  console.log('\n3. Guest Checkout with Dedicated WhatsApp Number');
  const customerSeparateWa: CustomerDetails = {
    fullName: 'Vineeth Kumar',
    phone: '9847333444',
    whatsappNumber: '9447999888',
    isWhatsAppSameAsPhone: false,
    address: 'Palayam, Trivandrum',
    pincode: '695034',
    district: 'Thiruvananthapuram',
  };
  const order3Res = await store.createOrder(customerSeparateWa, dummyItem);
  test('Order 3 created successfully', order3Res.success && Boolean(order3Res.order));
  const order3 = order3Res.order!;
  test('Order 3 mobile number is 9847333444', order3.customer.phone === '9847333444');
  test('Order 3 whatsappNumber is dedicated 9447999888', order3.customer.whatsappNumber === '9447999888');
  test('Order 3 isWhatsAppSameAsPhone is false', order3.customer.isWhatsAppSameAsPhone === false);

  // --------------------------------------------------------------------------
  // TEST 4 & 5: Message templates for each action
  // --------------------------------------------------------------------------
  console.log('\n4 & 5. Message Templates Generation for All Types');
  const msgDetails = generateAdminOrderWhatsAppMessage('order_details', order3);
  test('Order Details message contains Order ID', msgDetails.includes(order3.id));
  test('Order Details message contains Customer Name', msgDetails.includes('Vineeth Kumar'));

  const msgConfirmed = generateAdminOrderWhatsAppMessage('order_confirmation', order3);
  test('Order Confirmation message contains confirmed header', msgConfirmed.includes('ORDER CONFIRMED'));

  const msgProcessing = generateAdminOrderWhatsAppMessage('processing_update', order3);
  test('Processing message contains processing header', msgProcessing.includes('ORDER PROCESSING'));

  const msgShipped = generateAdminOrderWhatsAppMessage('shipped_update', order3);
  test('Shipped message contains dispatched header', msgShipped.includes('DISPATCHED & IN TRANSIT'));

  const msgDelivered = generateAdminOrderWhatsAppMessage('delivered_update', order3);
  test('Delivered message contains delivered header', msgDelivered.includes('ORDER DELIVERED'));

  // --------------------------------------------------------------------------
  // TEST 6: Custom Message template
  // --------------------------------------------------------------------------
  console.log('\n6. Custom Message Generation');
  const customNote = 'Your delivery is scheduled for 3 PM via DTDC courier with tracking number KL-9812.';
  const msgCustom = generateAdminOrderWhatsAppMessage('custom_message', order3, customNote);
  test('Custom message incorporates custom text', msgCustom.includes(customNote));
  test('Custom message incorporates order ID', msgCustom.includes(order3.id));

  // --------------------------------------------------------------------------
  // TEST 7 & 8: WhatsApp URL generation & Phone fallback behavior
  // --------------------------------------------------------------------------
  console.log('\n7 & 8. Click-to-Chat URL Generation');
  // Order 3 has dedicated WhatsApp number
  const url3 = formatWhatsAppUrl(order3.customer.whatsappNumber, msgConfirmed);
  test('Order 3 URL targets dedicated whatsappNumber (919447999888)', url3.includes('wa.me/919447999888'));

  // Order 1 has no WhatsApp number: formatWhatsAppUrl with undefined returns empty string
  const url1 = formatWhatsAppUrl(order1.customer.whatsappNumber, msgConfirmed);
  test('Order 1 formatWhatsAppUrl returns empty string when unconfigured (no silent fallback)', url1 === '');

  // Admin opting to use mobile number fallback explicitly
  const urlFallback = formatWhatsAppUrl(order1.customer.phone, msgConfirmed);
  test('Fallback URL formats customer mobile number (919847111222)', urlFallback.includes('wa.me/919847111222'));

  // --------------------------------------------------------------------------
  // TEST 9: Message History recording & status transitions
  // --------------------------------------------------------------------------
  console.log('\n9. Message History Recording & Status Transitions');
  const logRes1 = await store.recordOrderWhatsAppMessage({
    orderId: order3.id,
    messageType: 'order_confirmation',
    recipientNumber: order3.customer.whatsappNumber!,
    messageContent: msgConfirmed,
    adminId: 'admin_owner',
    adminName: 'Owner Admin',
    status: 'WhatsApp Opened',
  });
  test('Message logged successfully with "WhatsApp Opened"', logRes1.success && logRes1.message?.status === 'WhatsApp Opened');
  const loggedMsg = logRes1.message!;

  // Verify status update to "Marked as Sent"
  const updateRes = await store.updateOrderWhatsAppMessageStatus(
    order3.id,
    loggedMsg.id,
    'Marked as Sent',
    'Owner Admin'
  );
  test('Status updated to "Marked as Sent"', updateRes.success && updateRes.message?.status === 'Marked as Sent');
  test('sentAt timestamp populated', Boolean(updateRes.message?.sentAt));

  // Verify history retrieval
  const history = store.getOrderWhatsAppMessages(order3.id);
  test('Message history retrieved for order 3', history.length >= 1 && history[0].id === loggedMsg.id);

  // --------------------------------------------------------------------------
  // TEST 10: Unauthorized access / Input validation
  // --------------------------------------------------------------------------
  console.log('\n10. Input Validation & Data Integrity');
  const invalidStatusUpdate = await store.updateOrderWhatsAppMessageStatus(
    order3.id,
    'non_existent_id',
    'Marked as Sent'
  );
  test('Invalid message ID safely rejected', !invalidStatusUpdate.success);

  // --------------------------------------------------------------------------
  // TEST 11: Historical order snapshot immutability
  // --------------------------------------------------------------------------
  console.log('\n11. Snapshot Immutability Check');
  test('Order 1 snapshot retains empty WhatsApp contact', order1.customer.whatsappNumber === undefined);
  test('Order 2 snapshot retains same-as-phone flag', order2.customer.isWhatsAppSameAsPhone === true);
  test('Order 3 snapshot retains dedicated WhatsApp number', order3.customer.whatsappNumber === '9447999888');

  // --------------------------------------------------------------------------
  // TEST 12: Public order tracking privacy protection
  // --------------------------------------------------------------------------
  console.log('\n12. Public Order Tracking Privacy Protection');
  const trackRes = store.trackOrder(order3.id, order3.customer.phone);
  test('Tracking succeeds with valid ID and phone', trackRes.success && Boolean(trackRes.order));
  test('Tracking omits whatsAppMessages (never exposes admin history)', trackRes.order?.whatsAppMessages === undefined);

  console.log('\n=============================================');
  console.log(`WHATSAPP TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) process.exit(1);
}

runWhatsAppTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
