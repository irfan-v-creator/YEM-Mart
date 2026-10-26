import React, { useEffect } from 'react';
import { Product, StoreSettings, Category } from '../types';
import { updateDynamicMetaTags, categoryToSlug } from '../utils/seo';
import { normalizeProductImageUrl } from '../utils/imageUrl';

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
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    if (activeProduct) {
      // 1. Dynamic Product Meta Tags & Social Cards
      const productUrl = `${origin}/product/${activeProduct.id}`;
      const productImage = normalizeProductImageUrl(activeProduct.mainImage || activeProduct.images[0] || '');
      const productPriceFormatted = `₹${activeProduct.price.toLocaleString('en-IN')}`;
      
      updateDynamicMetaTags({
        title: `${activeProduct.name} - Buy Online for ${productPriceFormatted} | YEM MART Kerala`,
        description: `Order authentic ${activeProduct.name} (${activeProduct.brand}) online at YEM MART. ${activeProduct.shortSummary || activeProduct.description.slice(0, 140)}. Fast Kerala express delivery across all 14 districts.`,
        keywords: `${activeProduct.name}, ${activeProduct.brand}, ${activeProduct.category}, Kerala Online Shopping, Buy ${activeProduct.name} Kerala, Kochi online store`,
        image: productImage,
        url: productUrl,
        type: 'product',
        siteName: settings.storeName || 'YEM MART',
      });
    } else if (selectedCategory !== 'All') {
      // 2. Dynamic Category Meta Tags & Social Cards
      const slug = categoryToSlug(selectedCategory);
      const categoryUrl = `${origin}/category/${slug}`;
      
      updateDynamicMetaTags({
        title: `${selectedCategory} Collection - Authentic Kerala Online Shopping | YEM MART`,
        description: `Discover handcrafted & curated ${selectedCategory} at YEM MART. Authentic Kerala products, guaranteed genuine stock, transparent pricing, and fast delivery across Kerala.`,
        keywords: `${selectedCategory}, ${selectedCategory} Kerala, Kerala Online Shopping, Traditional Handloom, Authentic Kerala Spices, Kochi, Calicut, Trivandrum`,
        url: categoryUrl,
        type: 'website',
        siteName: settings.storeName || 'YEM MART',
      });
    } else {
      // 3. Local Kerala E-Commerce Keyword Optimized Store Home
      updateDynamicMetaTags({
        title: `${settings.storeName} | Kerala Online Shopping - Traditional Wear, Spices & Express Delivery`,
        description: `Kerala's trusted online shopping destination. Handcrafted traditional handloom sarees, authentic Malabar spices, brass nilavilakku, electronics, and lifestyle essentials with fast courier delivery across all 14 Kerala districts.`,
        keywords: `Kerala Online Shopping, Authentic Kerala Spices, Traditional Handloom, Kerala Sarees, Nilavilakku, Express Delivery across Kerala, Malabar chips, Kochi online shopping, YEM MART`,
        url: `${origin}/`,
        type: 'website',
        siteName: settings.storeName || 'YEM MART',
      });
    }
  }, [activeProduct, selectedCategory, settings]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Store Schema (Local OnlineStore with Kerala Delivery Coverage)
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: settings.storeName || 'YEM MART',
    legalName: 'YEM MART Retail Kerala',
    description: "Kerala's premium online retail store for Fashion, Traditional Handloom, Authentic Spices, Home & Kitchen, Electronics, and Gifts.",
    url: origin,
    telephone: '+91 7510447887',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91 7510447887',
      contactType: 'customer support',
      areaServed: 'IN-KL',
      availableLanguage: ['English', 'Malayalam'],
    },
    areaServed: {
      '@type': 'AdministrativeArea',
      name: 'Kerala, India',
    },
    paymentAccepted: 'UPI, Google Pay, PhonePe, Paytm, BHIM Transfer',
    currenciesAccepted: 'INR',
    priceRange: '₹249 - ₹3500',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${origin}/?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  // Dynamic Breadcrumb Schema
  const breadcrumbElements: any[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: origin,
    },
  ];

  if (selectedCategory !== 'All') {
    const slug = categoryToSlug(selectedCategory);
    breadcrumbElements.push({
      '@type': 'ListItem',
      position: 2,
      name: selectedCategory,
      item: `${origin}/category/${slug}`,
    });
  }

  if (activeProduct) {
    breadcrumbElements.push({
      '@type': 'ListItem',
      position: breadcrumbElements.length + 1,
      name: activeProduct.name,
      item: `${origin}/product/${activeProduct.id}`,
    });
  }

  const breadcrumbsSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbElements,
  };

  // Accurate Product Schema with real prices, stock, ratings, and shipping details
  const productSchema = activeProduct
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: activeProduct.name,
        image: activeProduct.images && activeProduct.images.length > 0 
          ? activeProduct.images 
          : [activeProduct.mainImage],
        description: activeProduct.description,
        sku: activeProduct.sku,
        category: activeProduct.category,
        brand: {
          '@type': 'Brand',
          name: activeProduct.brand,
        },
        offers: {
          '@type': 'Offer',
          url: `${origin}/product/${activeProduct.id}`,
          priceCurrency: 'INR',
          price: activeProduct.price,
          priceValidUntil: '2027-12-31',
          availability:
            activeProduct.stock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {
            '@type': 'Organization',
            name: settings.storeName || 'YEM MART',
          },
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: {
              '@type': 'MonetaryAmount',
              value: activeProduct.price >= settings.freeDeliveryThreshold ? '0' : String(settings.deliveryFee),
              currency: 'INR',
            },
            shippingDestination: {
              '@type': 'DefinedRegion',
              addressCountry: 'IN',
              addressRegion: 'Kerala',
            },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 1,
                unitCode: 'DAY',
              },
              transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 1,
                maxValue: 3,
                unitCode: 'DAY',
              },
            },
          },
        },
        aggregateRating: activeProduct.rating
          ? {
              '@type': 'AggregateRating',
              ratingValue: activeProduct.rating,
              reviewCount: activeProduct.reviewCount || 5,
              bestRating: '5',
              worstRating: '1',
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
