import React, { useEffect } from 'react';
import { BASE_URL } from '../../utils/schema';

export interface SEOProps {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  schema?: Record<string, any> | Record<string, any>[];
  keywords?: string;
}

const updateMetaTag = (attrName: string, attrVal: string, content: string) => {
  let element = document.querySelector(`meta[${attrName}="${attrVal}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrVal);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const updateLinkCanonical = (href: string) => {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
};

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  canonicalPath = '',
  image = `${BASE_URL}/zuvo-logo.png`,
  type = 'website',
  noindex = false,
  schema,
  keywords,
}) => {
  useEffect(() => {
    // 1. Document Title
    const formattedTitle = title.includes('ZUVO') ? title : `${title} | ZUVO Android TV`;
    document.title = formattedTitle;

    // 2. Meta Description
    updateMetaTag('name', 'description', description);

    // 3. Robots
    updateMetaTag('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // 4. Canonical URL
    const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    const canonicalUrl = canonicalPath === '/' ? `${BASE_URL}/` : `${BASE_URL}${cleanPath}`;
    updateLinkCanonical(canonicalUrl);

    // 5. Keywords (if provided)
    if (keywords) {
      updateMetaTag('name', 'keywords', keywords);
    }

    // 6. Open Graph
    updateMetaTag('property', 'og:site_name', 'ZUVO Android TV');
    updateMetaTag('property', 'og:locale', 'en_IN');
    updateMetaTag('property', 'og:type', type);
    updateMetaTag('property', 'og:title', formattedTitle);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:url', canonicalUrl);
    updateMetaTag('property', 'og:image', image);

    // 7. Twitter / X Card
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', formattedTitle);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', image);

    // 8. Structured Data JSON-LD
    const scriptId = 'zuvo-structured-data';
    let scriptElement = document.getElementById(scriptId) as HTMLScriptElement | null;
    
    if (schema) {
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.id = scriptId;
        scriptElement.type = 'application/ld+json';
        document.head.appendChild(scriptElement);
      }
      scriptElement.textContent = JSON.stringify(schema, null, 2);
    } else if (scriptElement) {
      scriptElement.remove();
    }

    return () => {
      // Optional cleanup on unmount
    };
  }, [title, description, canonicalPath, image, type, noindex, schema, keywords]);

  return null;
};
