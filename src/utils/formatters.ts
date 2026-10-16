import { Order, CartItem, OrderItem, CustomerDetails, Product, ProductVariant } from '../types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateOrderId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `YEM-${dateStr}-${randomSuffix}`;
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 5) return '*****';
  return phone.slice(0, 3) + '*****' + phone.slice(-2);
}

export function maskName(name: string): string {
  if (!name) return 'Customer';
  const parts = name.trim().split(' ');
  return parts.map(p => (p.length > 1 ? p[0] + '***' : p)).join(' ');
}

export interface UnifiedOrderItem {
  name: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * Normalizes any item structure (CartItem, OrderItem, direct product) into a standard item shape.
 */
export function normalizeOrderItems(rawItems: any[]): UnifiedOrderItem[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];
  return rawItems.map((item) => {
    // 1. If it's a CartItem: item.product is object
    if (item && item.product && typeof item.product === 'object') {
      const name = item.product.name || 'Selected Item';
      const variant = item.variant?.name || item.variantName;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.price ?? item.unitPrice ?? item.product.price ?? 0);
      const totalPrice = Number(item.totalPrice) || (unitPrice * quantity);
      return {
        name,
        variant: variant || undefined,
        quantity,
        unitPrice,
        totalPrice,
      };
    }

    // 2. If it's an OrderItem: item.productName exists
    const name = item.productName || item.name || item.title || 'Selected Item';
    const variant = item.variantName || item.variant?.name || item.variant || item.selectedOption;
    const quantity = Math.max(1, Number(item.quantity ?? item.qty ?? 1) || 1);
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
    const totalPrice = Number(item.totalPrice) || (unitPrice * quantity);

    return {
      name,
      variant: variant || undefined,
      quantity,
      unitPrice,
      totalPrice,
    };
  });
}

/**
 * Redesigned, professional WhatsApp order template.
 * High aesthetic, emoji-guided, cleanly partitioned layout for flawless WhatsApp rendering.
 */
export function buildWhatsAppOrderMessage(
  orderIdOrOrder: string | Partial<Order>,
  customerArg?: CustomerDetails,
  itemsArg?: any[],
  subtotalArg?: number,
  deliveryFeeArg?: number,
  grandTotalArg?: number,
  couponCodeArg?: string,
  discountAmountArg?: number,
  upiIdArg = '7510447887@ybl'
): string {
  const isOrderObject = typeof orderIdOrOrder === 'object' && orderIdOrOrder !== null;

  const orderId = isOrderObject ? (orderIdOrOrder.id || 'YEM-PENDING') : (orderIdOrOrder || 'YEM-PENDING');
  const customer: CustomerDetails = (isOrderObject ? (orderIdOrOrder.customer || customerArg) : customerArg) || {
    fullName: 'Valued Customer',
    phone: '',
    address: 'Kerala, India',
    pincode: 'Kerala',
  };

  const rawItems = isOrderObject ? (orderIdOrOrder.items || itemsArg || []) : (itemsArg || []);
  const normalizedItems = normalizeOrderItems(rawItems);

  const subtotal = isOrderObject ? (orderIdOrOrder.subtotal ?? subtotalArg) : subtotalArg;
  const deliveryFee = isOrderObject ? (orderIdOrOrder.deliveryFee ?? deliveryFeeArg ?? 0) : (deliveryFeeArg ?? 0);
  const grandTotal = isOrderObject ? (orderIdOrOrder.grandTotal ?? grandTotalArg) : grandTotalArg;
  const couponCode = isOrderObject ? (orderIdOrOrder.couponCode ?? couponCodeArg) : couponCodeArg;
  const discountAmount = isOrderObject ? (orderIdOrOrder.discountAmount ?? discountAmountArg) : discountAmountArg;

  // Compute calculated subtotal if 0 or missing
  const calculatedSubtotal = normalizedItems.reduce((sum, it) => sum + it.totalPrice, 0);
  const finalSubtotal = (subtotal && subtotal > 0) ? subtotal : (calculatedSubtotal > 0 ? calculatedSubtotal : 0);
  const finalDiscount = Number(discountAmount) || 0;
  const finalDeliveryFee = Number(deliveryFee) || 0;
  const finalGrandTotal = (grandTotal && grandTotal > 0) 
    ? grandTotal 
    : Math.max(0, finalSubtotal - finalDiscount + finalDeliveryFee);

  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const totalItemUnits = normalizedItems.reduce((acc, i) => acc + i.quantity, 0);

  const itemList = normalizedItems.length > 0
    ? normalizedItems
        .map((item, idx) => {
          const emojiNum = idx < numberEmojis.length ? numberEmojis[idx] : `[${idx + 1}]`;
          const variantBlock = item.variant ? `   ▫️ *Option / Variant:* ${item.variant}\n` : '';
          return `${emojiNum} *${item.name}*\n${variantBlock}   ▫️ *Quantity:* ${item.quantity} × ₹${item.unitPrice.toLocaleString('en-IN')}\n   ▫️ *Item Subtotal:* *₹${item.totalPrice.toLocaleString('en-IN')}*`;
        })
        .join('\n\n')
    : '   • Items verified & logged under Order ID';

  const deliveryNotice =
    finalDeliveryFee === 0 ? '🟢 FREE Kerala Delivery' : `₹${finalDeliveryFee.toLocaleString('en-IN')}`;

  const discountLine =
    finalDiscount > 0
      ? `• Coupon Discount (${couponCode || 'Promo'}): -₹${finalDiscount.toLocaleString('en-IN')}\n`
      : '';

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `🛍️ *NEW ORDER — YEM MART*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *Order ID:* \`${orderId}\`
📅 *Date:* ${currentDate}
🚦 *Status:* Order Prepared (Awaiting Confirmation)

👤 *CUSTOMER & DELIVERY DETAILS*
• *Name:* ${customer.fullName}
• *Mobile:* ${customer.phone}
• *Address:* ${customer.address}
• *Pincode:* ${customer.pincode}${customer.district ? ` (${customer.district}, Kerala)` : ''}
${customer.landmark ? `• *Landmark:* ${customer.landmark}\n` : ''}${customer.orderNotes ? `• *Special Notes:* ${customer.orderNotes}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *ORDERED ITEMS (${totalItemUnits} ${totalItemUnits === 1 ? 'item' : 'items'})*
────────────────────────────
${itemList}
────────────────────────────

💰 *BILLING BREAKDOWN*
• Items Subtotal: ₹${finalSubtotal.toLocaleString('en-IN')}
• Kerala Delivery: ${deliveryNotice}
${discountLine}━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *FINAL PAYABLE: ₹${finalGrandTotal.toLocaleString('en-IN')}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💳 *PAYMENT INSTRUCTIONS (UPI Transfer)*
• Official Store UPI ID: \`${upiIdArg}\`
• Scan & Pay via Google Pay, PhonePe, Paytm, or BHIM.
• _Please send your payment screenshot or 12-digit UPI reference (UTR) here for priority dispatch._

📍 *ORDER VERIFICATION & TRACKING*
Track your order anytime on our store:
🔗 Order ID: \`${orderId}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ *Thank you for choosing YEM MART!*
_Please tap SEND to submit your order to our customer support team._`;
}

/**
 * Builds a clean, professional WhatsApp message for direct product inquiry & instant order.
 */
export function buildDirectProductWhatsAppMessage(
  product: Product,
  variant?: ProductVariant,
  quantity = 1,
  deliveryFee = 0,
  upiId = '7510447887@ybl'
): string {
  const currentPrice = variant ? variant.price : product.price;
  const totalPrice = currentPrice * quantity;
  const deliveryNotice = deliveryFee === 0 ? '🟢 FREE Kerala Delivery' : `₹${deliveryFee}`;

  return `🛍️ *DIRECT PRODUCT ORDER INQUIRY — YEM MART*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *PRODUCT SPECIFICATIONS*
• *Product Name:* *${product.name}*
${variant ? `• *Selected Option:* ${variant.name}\n` : ''}• *Brand:* ${product.brand}
• *Category:* ${product.category}
• *Unit Price:* ₹${currentPrice.toLocaleString('en-IN')}
• *Quantity:* ${quantity}
• *Total Item Amount:* *₹${totalPrice.toLocaleString('en-IN')}*

🚚 *DELIVERY ESTIMATE*
• Service: Kerala Fast Courier
• Shipping: ${deliveryNotice}

💳 *PAYMENT METHOD (UPI Transfer)*
• Store UPI ID: \`${upiId}\`
• Accepts: Google Pay, PhonePe, Paytm, BHIM

📍 *CUSTOMER DELIVERY DETAILS (Please fill):*
• Full Name: 
• Contact Number: 
• Delivery Address: 
• Pincode & Kerala District: 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Hello YEM MART, I would like to order this item directly. Please verify availability and share order confirmation!_`;
}

/**
 * Generates an official WhatsApp URL with 91 country code format: https://wa.me/917510447887
 */
export function formatWhatsAppUrl(number?: string, text?: string): string {
  let raw = (number || '917510447887').replace(/[^0-9]/g, '');
  if (raw.startsWith('0')) raw = raw.slice(1);
  const cleanNumber = raw.length === 10 ? `91${raw}` : (raw || '917510447887');
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${cleanNumber}${query}`;
}


