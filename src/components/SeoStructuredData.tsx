import React, { useEffect } from 'react';
import { Product, StoreSettings, Category } from '../types';

interface SeoStructuredDataProps {
  settings: StoreSettings;
  selectedCategory: Category | 'All';
  activeProduct: Product | null;
}

export const SeoStructuredData: React.FC<SeoStructuredDataProps> = ({
  settings,
  selectedCategory,
  activeProduct,
}) => {
  useEffect(() => {
    // Dynamic document title & description
    if (activeProduct) {
      document.title = `${activeProduct.name} - YEM MART | Your Everyday Store`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', activeProduct.shortSummary || activeProduct.description);
      }
    } else if (selectedCategory !== 'All') {
      document.title = `${selectedCategory} Collection - YEM MART | Kerala`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', `Shop authentic ${selectedCategory} products with express delivery across all 14 districts of Kerala from YEM MART.`);
      }
    } else {
      document.title = `${settings.storeName} | ${settings.tagline}`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', "Kerala's premium online retail store for Fashion, Electronics, Home & Kitchen, and Gifts. Featuring WhatsApp-guided checkout, instant UPI payment tracking, and Gemini AI shopping concierge.");
      }
    }
  }, [activeProduct, selectedCategory, settings]);

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: settings.storeName,
    description: "Kerala's curated retail store for fashion, electronics, home essentials, and gifts.",
    url: window.location.origin,
    areaServed: {
      '@type': 'AdministrativeArea',
      name: 'Kerala, India',
    },
    paymentAccepted: 'UPI, Google Pay, PhonePe, Paytm, BHIM',
    currenciesAccepted: 'INR',
    priceRange: '₹249 - ₹3500',
  };

  const breadcrumbsSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: window.location.origin,
      },
      ...(selectedCategory !== 'All'
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: selectedCategory,
              item: `${window.location.origin}/?category=${encodeURIComponent(selectedCategory)}`,
            },
          ]
        : []),
      ...(activeProduct
        ? [
            {
              '@type': 'ListItem',
              position: selectedCategory !== 'All' ? 3 : 2,
              name: activeProduct.name,
              item: `${window.location.origin}/?product=${activeProduct.id}`,
            },
          ]
        : []),
    ],
  };

  const productSchema = activeProduct
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: activeProduct.name,
        image: activeProduct.images,
        description: activeProduct.description,
        sku: activeProduct.sku,
        brand: {
          '@type': 'Brand',
          name: activeProduct.brand,
        },
        offers: {
          '@type': 'Offer',
          url: `${window.location.origin}/?product=${activeProduct.id}`,
          priceCurrency: 'INR',
          price: activeProduct.price,
          availability:
            activeProduct.stock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
        aggregateRating: activeProduct.rating
          ? {
              '@type': 'AggregateRating',
              ratingValue: activeProduct.rating,
              reviewCount: activeProduct.reviewCount || 1,
            }
          : undefined,
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsSchema) }}
      />
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
    </>
  );
};
