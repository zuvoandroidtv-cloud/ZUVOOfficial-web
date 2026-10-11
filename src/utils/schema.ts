import { TVProduct } from '../data/products';
import { siteConfig } from '../data/siteConfig';

export const BASE_URL = 'https://www.zuvoandroidtv.com';

/**
 * Organization Schema for ZUVO Brand
 */
export const getOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ZUVO Android TV',
  legalName: 'ZUVO Consumer Electronics',
  url: BASE_URL,
  logo: `${BASE_URL}/zuvo-logo.png`,
  description: siteConfig.description,
  email: siteConfig.contact.email,
  telephone: siteConfig.contact.phone,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Aarani',
    addressRegion: 'Tamil Nadu',
    addressCountry: 'IN',
  },
  sameAs: [
    siteConfig.social.twitter,
    siteConfig.social.instagram,
    siteConfig.social.youtube,
    siteConfig.social.facebook,
  ],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      telephone: siteConfig.contact.phone,
      contactType: 'sales & customer service',
      areaServed: 'IN',
      availableLanguage: ['English', 'Tamil'],
    },
  ],
});

/**
 * WebSite Schema with SearchAction
 */
export const getWebSiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ZUVO Android TV',
  url: BASE_URL,
  publisher: {
    '@type': 'Organization',
    name: 'ZUVO Android TV',
    logo: `${BASE_URL}/zuvo-logo.png`,
  },
});

/**
 * LocalBusiness / Sales Hub Schema
 */
export const getLocalBusinessSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'ZUVO TV Sales & Service Hub',
  image: `${BASE_URL}/zuvo-logo.png`,
  telephone: siteConfig.contact.phone,
  email: siteConfig.contact.email,
  priceRange: '₹₹',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Headquarters & Service Center',
    addressLocality: 'Aarani',
    addressRegion: 'Tamil Nadu',
    addressCountry: 'IN',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '20:00',
    },
  ],
  url: BASE_URL,
});

/**
 * Product Schema for individual TV models
 */
export const getProductSchema = (product: TVProduct) => {
  const productUrl = `${BASE_URL}/products/${product.id}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: `${BASE_URL}/zuvo-logo.png`,
    description: product.description,
    brand: {
      '@type': 'Brand',
      name: 'ZUVO',
    },
    model: product.id,
    category: product.category,
    url: productUrl,
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Screen Sizes',
        value: product.sizes.join(', '),
      },
      {
        '@type': 'PropertyValue',
        name: 'Resolution',
        value: product.resolution,
      },
      {
        '@type': 'PropertyValue',
        name: 'Operating System',
        value: product.smartOS,
      },
      {
        '@type': 'PropertyValue',
        name: 'Audio Technology',
        value: product.audioTech,
      },
      ...product.specifications.map((s) => ({
        '@type': 'PropertyValue',
        name: s.name,
        value: s.value,
      })),
    ],
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: productUrl,
      seller: {
        '@type': 'Organization',
        name: 'ZUVO Official Sales Desk',
        telephone: siteConfig.contact.phone,
      },
    },
  };
};

/**
 * ItemList Schema for Product Collection
 */
export const getItemListSchema = (productList: TVProduct[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'ZUVO Television Lineup',
  url: `${BASE_URL}/products`,
  numberOfItems: productList.length,
  itemListElement: productList.map((product, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: product.name,
    url: `${BASE_URL}/products/${product.id}`,
  })),
});

/**
 * BreadcrumbList Schema
 */
export const getBreadcrumbSchema = (breadcrumbs: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbs.map((crumb, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    name: crumb.name,
    item: crumb.url.startsWith('http') ? crumb.url : `${BASE_URL}${crumb.url}`,
  })),
});

/**
 * FAQPage Schema
 */
export const getFaqSchema = (faqs: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a,
    },
  })),
});
