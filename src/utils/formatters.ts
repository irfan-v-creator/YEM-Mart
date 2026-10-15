import { Order, CartItem, CustomerDetails } from '../types';

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

export function buildWhatsAppOrderMessage(
  orderId: string,
  customer: CustomerDetails,
  items: CartItem[],
  subtotal: number,
  deliveryFee: number,
  grandTotal: number,
  couponCode?: string,
  discountAmount?: number
): string {
  const itemList = items
    .map(
      (item, idx) =>
        `${idx + 1}. *${item.product.name}*\n` +
        (item.variant ? `   • Variant: ${item.variant.name}\n` : '') +
        `   • Qty: ${item.quantity} × ₹${item.price} = ₹${item.quantity * item.price}`
    )
    .join('\n\n');

  const deliveryNotice =
    deliveryFee === 0 ? 'FREE Kerala Delivery' : `₹${deliveryFee}`;

  const discountLine =
    discountAmount && discountAmount > 0
      ? `• Discount (${couponCode || 'Promo'}): -₹${discountAmount}\n`
      : '';

  return `🛍️ *NEW ORDER ON YEM MART*
━━━━━━━━━━━━━━━━━━━━
*Order ID:* ${orderId}

*Customer Details:*
• Name: ${customer.fullName}
• Phone: ${customer.phone}
• Address: ${customer.address}
• Pincode: ${customer.pincode}${customer.district ? ` (${customer.district})` : ''}
${customer.landmark ? `• Landmark: ${customer.landmark}\n` : ''}${customer.orderNotes ? `• Notes: ${customer.orderNotes}\n` : ''}
━━━━━━━━━━━━━━━━━━━━
*Ordered Items:*
${itemList}

━━━━━━━━━━━━━━━━━━━━
*Order Summary:*
• Subtotal: ₹${subtotal}
${discountLine}• Delivery: ${deliveryNotice}
• *Grand Total: ₹${grandTotal}*
━━━━━━━━━━━━━━━━━━━━

ℹ️ *Payment Method:* UPI Transfer
_Please reply to confirm order availability and share final payment details._`;
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

