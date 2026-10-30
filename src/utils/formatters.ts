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

💳 *PAYMENT & ORDER CONFIRMATION*
• Please tap SEND to share your order with YEM MART on WhatsApp.
• Our support team will confirm item availability, payment details, and dispatch schedule directly with you.

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

💳 *PAYMENT & ORDER CONFIRMATION*
• Payment details and delivery confirmation are handled directly in this chat.

📍 *CUSTOMER DELIVERY DETAILS (Please fill):*
• Full Name: 
• Contact Number: 
• Delivery Address: 
• Pincode & Kerala District: 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Hello YEM MART, I would like to order this item directly. Please verify availability and share order confirmation!_`;
}

/**
 * Checks if a WhatsApp number is configured and conforms to valid digits format.
 */
export function isWhatsAppConfigured(number?: string | null): boolean {
  if (!number || typeof number !== 'string') return false;
  let raw = number.replace(/[^0-9]/g, '');
  if (raw.startsWith('0')) raw = raw.slice(1);
  return raw.length === 10 || (raw.length === 12 && raw.startsWith('91'));
}

/**
 * Generates an official WhatsApp URL with 91 country code.
 * Returns empty string if the number is unconfigured or invalid, preventing
 * redirection to unverified fallback numbers.
 */
export function formatWhatsAppUrl(number?: string | null, text?: string): string {
  if (!number || typeof number !== 'string') return '';
  let raw = number.replace(/[^0-9]/g, '');
  if (raw.startsWith('0')) raw = raw.slice(1);
  if (!raw) return '';
  const cleanNumber = raw.length === 10 ? `91${raw}` : raw;
  if (cleanNumber.length !== 12 || !cleanNumber.startsWith('91')) {
    return '';
  }
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${cleanNumber}${query}`;
}


/**
 * Generates a clean, professional, itemized receipt message for customer support & WhatsApp sharing.
 */
export function generateOrderReceiptMessage(order: Order, supportWhatsApp?: string): string {
  const customerName = order.customer.fullName || 'Valued Customer';
  const customerPhone = order.customer.phone || 'N/A';
  const destination = `${order.customer.address}, ${order.customer.pincode}${order.customer.district ? ` (${order.customer.district}, Kerala)` : ''}`;
  const landmarkLine = order.customer.landmark ? `\n📌 *Landmark:* ${order.customer.landmark}` : '';

  const normalizedItems = normalizeOrderItems(order.items);
  const itemsText = normalizedItems.length > 0
    ? normalizedItems.map((item, idx) => {
        const optionStr = item.variant ? ` (${item.variant})` : '';
        return `${idx + 1}. *${item.name}*${optionStr}\n   ▫️ Qty: ${item.quantity} × ₹${item.unitPrice.toLocaleString('en-IN')} = *₹${item.totalPrice.toLocaleString('en-IN')}*`;
      }).join('\n')
    : 'No items recorded';

  const discountLine = (order.discountAmount && order.discountAmount > 0)
    ? `\n• Discounts${order.couponCode ? ` (Coupon: ${order.couponCode})` : ''}: -₹${order.discountAmount.toLocaleString('en-IN')}`
    : '';

  const deliveryStr = order.deliveryFee === 0 
    ? '🟢 FREE (Express Kerala Delivery)' 
    : `₹${order.deliveryFee.toLocaleString('en-IN')}`;

  const paymentStr = order.paymentMethod === 'cod'
    ? '💵 Cash on Delivery (Pay at Doorstep)'
    : `⚡ Prepaid UPI (${order.paymentRef || order.utrNumber ? `UTR: ${order.paymentRef || order.utrNumber}` : order.paymentStatus === 'verified' ? 'Verified' : 'Pending Verification'})`;

  const statusMap: Record<string, string> = {
    prepared: 'Order Prepared',
    whatsapp_pending: 'Awaiting Confirmation',
    payment_submitted: 'Payment Under Review',
    confirmed: 'Order Confirmed',
    processing: 'Processing & Packed',
    shipped: 'Dispatched / In Transit',
    delivered: 'Delivered Successfully',
    cancelled: 'Cancelled',
  };
  const statusStr = statusMap[order.status] || (order.status || 'awaiting_confirmation').replace(/_/g, ' ').toUpperCase();

  const isConfigured = isWhatsAppConfigured(supportWhatsApp);
  const cleanDigits = isConfigured ? supportWhatsApp!.replace(/[^0-9]/g, '').slice(-10) : '';
  const supportLine = isConfigured
    ? `\n💬 *Store Support WhatsApp:* +91 ${cleanDigits}`
    : '';

  return `🧾 *YEM MART • OFFICIAL ORDER RECEIPT*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 *Order ID:* \`${order.id}\`
📅 *Date:* ${formatDate(order.createdAt)}
📊 *Order Status:* ${statusStr}
👤 *Customer Name:* ${customerName}
📞 *Mobile:* ${customerPhone}
📍 *Delivery Address:* ${destination}${landmarkLine}

📦 *ITEMIZED PRODUCTS LIST (${order.items.reduce((sum, i) => sum + i.quantity, 0)} Units):*
${itemsText}

💰 *BILLING & SUMMARY:*
• Subtotal: ₹${order.subtotal.toLocaleString('en-IN')}${discountLine}
• Delivery Charge: ${deliveryStr}
• *Grand Total:* *₹${order.grandTotal.toLocaleString('en-IN')}*
• *Payment Mode:* ${paymentStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━${supportLine}
🛍️ *YEM MART Kerala* — Express Delivery Across All 14 Districts
_Thank you for shopping with YEM MART!_`;
}

/**
 * Downloads a clean formatted order receipt text file on the user's device.
 */
export function downloadOrderReceiptText(order: Order, supportWhatsApp?: string): void {
  const receiptText = generateOrderReceiptMessage(order, supportWhatsApp);
  const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `YEM-Receipt-${order.id}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Generates professional WhatsApp message templates for Admin Order Communication.
 * Clearly separates store identification, recipient details, and actionable updates.
 */
export function generateAdminOrderWhatsAppMessage(
  type: 'order_details' | 'order_confirmation' | 'processing_update' | 'shipped_update' | 'delivered_update' | 'custom_message',
  order: Order,
  customText?: string
): string {
  const customerName = order.customer.fullName || 'Valued Customer';
  const destination = `${order.customer.address}, ${order.customer.pincode}${order.customer.district ? ` (${order.customer.district}, Kerala)` : ''}`;
  const totalAmount = `₹${order.grandTotal.toLocaleString('en-IN')}`;
  const itemsCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

  const itemsList = order.items
    .map((it, idx) => `  ${idx + 1}. *${it.productName}*${it.variantName ? ` (${it.variantName})` : ''} × ${it.quantity} = ₹${it.totalPrice.toLocaleString('en-IN')}`)
    .join('\n');

  switch (type) {
    case 'order_details':
      return `📦 *YEM MART • ORDER SUMMARY*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello *${customerName}*, here are your order details:

🆔 *Order ID:* \`${order.id}\`
📅 *Date Placed:* ${formatDate(order.createdAt)}
📍 *Delivery Destination:* ${destination}

🛍️ *Items (${itemsCount} Units):*
${itemsList}

💰 *Grand Total:* *${totalAmount}*
💳 *Payment Mode:* ${order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Prepaid UPI'}
📊 *Current Status:* ${order.status.replace(/_/g, ' ').toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Thank you for choosing YEM MART Kerala!_`;

    case 'order_confirmation':
      return `✅ *YEM MART • ORDER CONFIRMED*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello *${customerName}*,

Good news! Your order *#${order.id}* has been verified and confirmed by our fulfillment team.

🆔 *Order ID:* \`${order.id}\`
💰 *Amount:* *${totalAmount}*
📍 *Delivering To:* ${destination}
🛍️ *Total Items:* ${itemsCount} items

Our team is preparing your package for express dispatch across Kerala. We will keep you updated as your order progresses!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_YEM MART Kerala — Fast & Reliable Delivery_`;

    case 'processing_update':
      return `⚙️ *YEM MART • ORDER PROCESSING*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello *${customerName}*,

Your order *#${order.id}* is currently being packed with utmost care at our Kerala dispatch center.

🆔 *Order ID:* \`${order.id}\`
🛍️ *Items:* ${itemsCount} items
📦 *Status:* Packing & Quality Check in Progress

We are preparing your shipment for handoff to our delivery partner. You will receive tracking details once dispatched!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_YEM MART Kerala — Your Everyday Store_`;

    case 'shipped_update':
      return `🚚 *YEM MART • DISPATCHED & IN TRANSIT*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello *${customerName}*,

Exciting news! Your order *#${order.id}* has been dispatched and is currently on its way to you!

🆔 *Order ID:* \`${order.id}\`
📍 *Delivering To:* ${destination}
💰 *Payable:* ${order.paymentMethod === 'cod' ? `*${totalAmount}* (Cash on Delivery)` : 'Prepaid (Paid in Full)'}
🚚 *Courier / Tracking:* ${order.statusTimeline?.find(s => s.status === 'shipped')?.note || 'Express Courier Handoff'}

Please ensure someone is available at the delivery location to receive the package.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_YEM MART Kerala — Express Delivery_`;

    case 'delivered_update':
      return `🎉 *YEM MART • ORDER DELIVERED*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello *${customerName}*,

Your order *#${order.id}* has been successfully delivered!

🆔 *Order ID:* \`${order.id}\`
📍 *Delivered To:* ${destination}
🛍️ *Total Units:* ${itemsCount}

We hope you love your purchase! If you have any questions or feedback, please feel free to reach out to our support team.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Thank you for shopping with YEM MART Kerala!_`;

    case 'custom_message':
      return `💬 *YEM MART • ORDER UPDATE*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello *${customerName}*,

Regarding your order *#${order.id}*:

${(customText || '').trim()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_YEM MART Kerala — Your Everyday Store_`;

    default:
      return '';
  }
}



