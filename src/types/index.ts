export type Category = 
  | 'Fashion' 
  | 'Accessories' 
  | 'Electronics' 
  | 'Home & Kitchen' 
  | 'Stationery' 
  | 'Kids' 
  | 'Gifts' 
  | 'Others';

export type ProductPublicationStatus = 'published' | 'draft' | 'scheduled';

export interface ProductVariant {
  id: string;
  name: string;
  type: 'size' | 'color' | 'option';
  sku: string;
  price: number;
  originalPrice?: number;
  stock: number;
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  description: string;
  shortSummary: string;
  highlights: string[];
  specs: Record<string, string>;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  rating?: number;
  reviewCount?: number;
  images: string[];
  mainImage: string;
  status: ProductPublicationStatus;
  scheduledPublishDate?: string;
  stock: number;
  lowStockThreshold: number;
  isFeatured?: boolean;
  isBestDeal?: boolean;
  isNewArrival?: boolean;
  variants?: ProductVariant[];
  requiredVariantType?: string;
  sku: string;
  tags: string[];
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minPurchase: number;
  maxDiscount?: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
  targetId?: string;
}

export interface StockAdjustmentLog {
  id: string;
  timestamp: string;
  productId: string;
  productName: string;
  variantSku?: string;
  previousStock: number;
  newStock: number;
  difference: number;
  reason: string;
  actor: string;
}

export type AdminPermission = 
  | 'manage_products'
  | 'manage_orders'
  | 'verify_payments'
  | 'manage_inventory'
  | 'manage_coupons'
  | 'manage_settings'
  | 'view_audit_logs';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'manager' | 'support';
  permissions: AdminPermission[];
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  price: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  variantName?: string;
  variantSku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  image: string;
}

export type OrderStatus = 
  | 'prepared' 
  | 'whatsapp_pending' 
  | 'payment_submitted' 
  | 'confirmed' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled';

export type PaymentStatus = 
  | 'pending' 
  | 'submitted' 
  | 'verified' 
  | 'rejected';

export interface CustomerDetails {
  fullName: string;
  phone: string;
  address: string;
  pincode: string;
  district?: string;
  landmark?: string;
  orderNotes?: string;
}

export interface StatusHistory {
  status: OrderStatus;
  timestamp: string;
  note: string;
}

export interface Order {
  id: string;
  createdAt: string;
  customer: CustomerDetails;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount?: number;
  couponCode?: string;
  grandTotal: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: 'upi' | 'cod' | string;
  paymentRef?: string;
  utrNumber?: string;
  paymentSubmittedAt?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  isRestockedOnCancellation?: boolean;
  statusTimeline: StatusHistory[];
}

export interface HeroBanner {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaText: string;
  categoryFilter?: Category | 'All';
  accentColor?: string;
  image: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  whatsappNumber: string;
  supportPhone: string;
  upiId: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  lowStockThreshold: number;
  announcementText: string;
  coverageArea: string;
  officeCity: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  searchGrounding?: Array<{ title: string; url: string }>;
}

export type AddressLabel = 'Home' | 'Work' | 'Other';

export interface SavedAddress {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  address: string;
  landmark?: string;
  district: string;
  pincode: string;
  label: AddressLabel;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerUser {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
}

