import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const templatePath = path.join(distDir, 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error('Error: dist/index.html not found. Run "npm run build" first.');
  process.exit(1);
}

let template = fs.readFileSync(templatePath, 'utf-8');
const BASE_URL = 'https://www.zuvoandroidtv.com';

// 1. Clean template of any pre-existing canonical, Open Graph, or Twitter tags to prevent duplicates
template = template.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
template = template.replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '');
template = template.replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '');

const siteContact = {
  email: 'zuvoandroidtv@gmail.com',
  phone: '+91 8056666653',
  address: 'Aarani, Tamil Nadu, India'
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ZUVO Android TV',
  legalName: 'ZUVO Consumer Electronics',
  url: BASE_URL,
  logo: `${BASE_URL}/zuvo-logo.png`,
  email: siteContact.email,
  telephone: siteContact.phone,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Aarani',
    addressRegion: 'Tamil Nadu',
    addressCountry: 'IN'
  }
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'ZUVO TV Sales & Service Hub',
  image: `${BASE_URL}/zuvo-logo.png`,
  telephone: siteContact.phone,
  email: siteContact.email,
  priceRange: '₹₹',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Headquarters & Service Center',
    addressLocality: 'Aarani',
    addressRegion: 'Tamil Nadu',
    addressCountry: 'IN'
  },
  url: BASE_URL
};

const products = [
  {
    id: 'zuvo-24-normal',
    name: 'ZUVO 24" Normal LED TV',
    tagline: 'Compact HD Display. Crisp Audio & Media Playback.',
    category: 'Normal TV',
    resolution: '1366 x 768 (HD Ready)',
    audioTech: '16W Stereo Speaker System',
    smartOS: 'Standard Media Engine',
    description: 'The ZUVO 24" Normal LED TV delivers crisp HD picture clarity, vivid color accuracy, and reliable multi-port connectivity, ideal for bedrooms, kitchens, or office setups.',
    specs: [
      { name: 'Display Panel', value: '24" Direct LED Matrix' },
      { name: 'Resolution', value: '1366 x 768 Pixels (HD Ready)' },
      { name: 'Audio Output', value: '16W Dual Stereo Speakers' },
      { name: 'Connectivity', value: '1x HDMI, 1x USB, AV In, Coaxial Port' },
      { name: 'Warranty', value: 'Official ZUVO Brand Warranty' }
    ]
  },
  {
    id: 'zuvo-32-smart',
    name: 'ZUVO 32" Smart LED TV',
    tagline: 'Smart Entertainment. Wi-Fi & Android TV Apps.',
    category: 'Smart TV',
    resolution: '1366 x 768 (HD Ready)',
    audioTech: '20W Surround Audio System',
    smartOS: 'Official Android TV OS',
    description: 'Enjoy seamless online video streaming and thousands of smart applications with the ZUVO 32" Smart TV. Features built-in Wi-Fi and vivid LED color processing.',
    specs: [
      { name: 'Display Panel', value: '32" High-Contrast Smart LED' },
      { name: 'Resolution', value: '1366 x 768 Pixels (HD)' },
      { name: 'Operating System', value: 'Android TV Platform' },
      { name: 'Audio Output', value: '20W Surround Sound' },
      { name: 'Warranty', value: 'Official ZUVO Brand Warranty' }
    ]
  },
  {
    id: 'zuvo-32-smart-bt-voice',
    name: 'ZUVO 32" Smart TV + B/T + Voice Remote',
    tagline: 'Bluetooth Audio & Hands-Free Voice Search.',
    category: 'Voice & Bluetooth Smart TV',
    resolution: '1366 x 768 (HD Ready)',
    audioTech: '20W Surround + Wireless Bluetooth Audio',
    smartOS: 'Official Android TV OS',
    description: 'Elevate your viewing experience with the ZUVO 32" Smart TV equipped with Bluetooth wireless connectivity and a dedicated Google Assistant Voice Remote.',
    specs: [
      { name: 'Display Panel', value: '32" Smart LED Matrix' },
      { name: 'Resolution', value: '1366 x 768 Pixels' },
      { name: 'Wireless Tech', value: 'Bluetooth 5.0 & Dual-Band Wi-Fi' },
      { name: 'Remote Control', value: 'Smart Bluetooth Remote with Voice Mic' },
      { name: 'Warranty', value: 'Official ZUVO Brand Warranty' }
    ]
  },
  {
    id: 'zuvo-43-smart',
    name: 'ZUVO 43" Smart LED TV',
    tagline: 'Full HD Visuals. Rapid Quad-Core Streaming.',
    category: 'Smart TV',
    resolution: '1920 x 1080 (Full HD)',
    audioTech: '24W Stereo Surround System',
    smartOS: 'Official Android TV OS',
    description: 'The ZUVO 43" Smart LED TV brings rich Full HD detail, sleek ultra-thin frame aesthetics, and instant access to thousands of Android streaming apps.',
    specs: [
      { name: 'Display Panel', value: '43" Full HD Direct LED' },
      { name: 'Resolution', value: '1920 x 1080 Pixels (Full HD)' },
      { name: 'Audio Output', value: '24W Stereo Surround' },
      { name: 'Warranty', value: 'Official ZUVO Brand Warranty' }
    ]
  },
  {
    id: 'zuvo-43-smart-bt-voice',
    name: 'ZUVO 43" Smart TV + B/T + Voice Remote',
    tagline: 'Vivid Clarity. Bluetooth Wireless & Voice Mic Remote.',
    category: 'Voice & Bluetooth Smart TV',
    resolution: '3840 x 2160 (4K Ultra HD)',
    audioTech: '24W Dolby Audio with Bluetooth Sync',
    smartOS: 'Official Android TV OS',
    description: 'Experience stunning picture clarity paired with a smart Bluetooth voice remote. Easily search content, adjust volume, and connect wireless speakers.',
    specs: [
      { name: 'Display Panel', value: '43" Ultra Clarity Smart Matrix' },
      { name: 'Resolution', value: '3840 x 2160 4K UHD' },
      { name: 'Wireless Tech', value: 'Bluetooth 5.0 & High-Speed Wi-Fi' },
      { name: 'Warranty', value: 'Official ZUVO Brand Warranty' }
    ]
  },
  {
    id: 'zuvo-50-smart-bt-voice',
    name: 'ZUVO 50" Smart TV + B/T + Voice Remote',
    tagline: '50" Big Screen 4K. Bluetooth Sound & Voice Search.',
    category: 'Voice & Bluetooth Smart TV',
    resolution: '3840 x 2160 (4K Ultra HD)',
    audioTech: '30W Cinema Surround with Bluetooth Out',
    smartOS: 'Official Android TV OS',
    description: 'Transform your home entertainment with the ZUVO 50" Smart TV. Featuring a magnificent 4K UHD display, Bluetooth wireless soundbar sync, and Voice Remote.',
    specs: [
      { name: 'Display Panel', value: '50" 4K UHD Direct LED' },
      { name: 'Resolution', value: '3840 x 2160 Pixels (4K)' },
      { name: 'Audio Output', value: '30W Cinema Surround Sound' },
      { name: 'Warranty', value: 'Official ZUVO Brand Warranty' }
    ]
  },
  {
    id: 'zuvo-55-smart-bt-voice',
    name: 'ZUVO 55" Smart TV + B/T + Voice Remote',
    tagline: 'Flagship 55" 4K Theater TV with Voice & Bluetooth.',
    category: 'Voice & Bluetooth Smart TV',
    resolution: '3840 x 2160 (4K Ultra HD)',
    audioTech: '30W Dolby Atmos Surround System',
    smartOS: 'Official Android TV OS',
    description: 'The flagship ZUVO 55" Smart TV delivers theater-grade visuals, deep surround sound, hands-free Google Assistant Voice Remote control, and Bluetooth audio.',
    specs: [
      { name: 'Display Panel', value: '55" 4K UHD Premium LED Matrix' },
      { name: 'Resolution', value: '3840 x 2160 Pixels (4K UHD)' },
      { name: 'Audio Output', value: '30W Dolby Audio / Atmos Support' },
      { name: 'Warranty', value: 'Official ZUVO Brand Warranty' }
    ]
  }
];

const routes = [
  {
    path: '',
    title: 'ZUVO Android TV — Official Smart TV Brand | 24 to 55 Inch TVs in India',
    description: 'Official ZUVO Android TV platform. Explore 24-inch normal LED to 55-inch 4K UHD Smart TVs with official Google Android TV, Dolby audio, Voice Remote, and brand warranty.',
    h1: 'SMART ENTERTAINMENT. REIMAGINED.',
    content: 'Discover precision Quantum color, immersive Dolby Atmos sound, and seamless Google Android TV intelligence engineered in a modern borderless unibody design. Explore 24", 32", 43", 50", and 55" Smart TV varieties with official brand warranty in India.',
    schema: [organizationSchema, localBusinessSchema]
  },
  {
    path: 'products',
    title: 'ZUVO TV Model Lineup | 24, 32, 43, 50, 55 Inch Smart & LED TVs',
    description: 'Browse the complete ZUVO TV lineup. Budget 24-inch Normal LED TV, 32 & 43-inch Android Smart TVs, and flagship 50 & 55-inch 4K UHD TVs with Bluetooth & Voice Remote.',
    h1: 'OFFICIAL TV MODEL LINEUP',
    content: 'Explore our comprehensive smart television lineup. From compact 24-inch LED to 55-inch theater 4K UHD displays with official Android TV OS and Voice Remote.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'ZUVO Television Lineup',
      itemListElement: products.map((p, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: p.name,
        url: `${BASE_URL}/products/${p.id}`
      }))
    }
  },
  ...products.map(p => ({
    path: `products/${p.id}`,
    title: `${p.name} | Specs, Features & Price Inquiry`,
    description: `${p.name} features ${p.resolution}, ${p.smartOS}, ${p.audioTech}. Official brand warranty and direct customer support in India.`,
    h1: p.name,
    content: `${p.tagline} ${p.description} Category: ${p.category}. Display Resolution: ${p.resolution}. Audio: ${p.audioTech}. Operating System: ${p.smartOS}. Available with official ZUVO brand warranty.`,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description,
      brand: { '@type': 'Brand', name: 'ZUVO' },
      model: p.id,
      category: p.category,
      url: `${BASE_URL}/products/${p.id}`,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        url: `${BASE_URL}/products/${p.id}`,
        seller: { '@type': 'Organization', name: 'ZUVO Official Sales Desk' }
      }
    }
  })),
  {
    path: 'dealership',
    title: 'Become a ZUVO TV Dealer & Distributor in India | Official Partnership',
    description: 'Join the ZUVO Android TV retail and dealership network. High-margin smart TV models from 24 inch to 55 inch with direct brand warranty and owner support.',
    h1: 'BECOME A ZUVO DEALER & DISTRIBUTOR',
    content: 'Expand your electronics business with fast-growing ZUVO Smart TVs. High-margin lineups, robust build quality, direct manufacturer warranty, and direct owner assistance. Available for electronics showrooms, regional distributors, and commercial bulk buyers.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'ZUVO TV Dealership & Distribution Partnership in India',
      url: `${BASE_URL}/dealership`
    }
  },
  {
    path: 'warranty',
    title: 'Official ZUVO TV Warranty Terms & Service Support | ZUVO Android TV',
    description: 'Official ZUVO TV warranty terms, claim procedures, service center assistance, and customer support. Learn how to verify and claim your smart TV warranty.',
    h1: 'OFFICIAL ZUVO WARRANTY & SERVICE',
    content: 'All ZUVO televisions include comprehensive brand warranty coverage covering the display panel, main motherboards, power boards, internal audio modules, and remote controls against manufacturing defects. Service hub in Aarani, Tamil Nadu.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Official ZUVO TV Warranty Policy',
      url: `${BASE_URL}/warranty`
    }
  },
  {
    path: 'technology',
    title: 'ZUVO TV Technology — Display, Dolby Audio & Android TV Engine',
    description: 'Explore the engineering behind ZUVO Smart TVs: Direct Crystal LED matrices, Dolby Audio immersion, high-performance processors, and official Google Android TV ecosystem.',
    h1: 'PRECISION TECHNOLOGY ENGINE',
    content: 'Explore the display, audio, processing, and smart TV technology architecture engineered into every ZUVO Smart TV. Crystal LED dynamic contrast, Dolby sound, quad-core processors, and official Google Android TV ecosystem.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'ZUVO TV Technology Engine',
      url: `${BASE_URL}/technology`
    }
  },
  {
    path: 'about',
    title: 'About ZUVO TV — Brand Philosophy & Android TV Vision',
    description: 'Discover ZUVO Consumer Electronics. Dedicated to crafting smart televisions with vibrant LED panels, Dolby sound, Google Android TV platform, and dependable local service.',
    h1: 'ABOUT ZUVO TELEVISION',
    content: 'ZUVO is an emerging smart television brand focused on bringing high-performance display panels, immersive Dolby audio, and official Google Android TV ecosystem to homes across India.',
    schema: organizationSchema
  },
  {
    path: 'support',
    title: 'ZUVO TV Customer Support, Help Center & FAQs',
    description: 'Official ZUVO TV customer support hub. Find setup guides, frequently asked questions, warranty assistance, and service contacts for your smart TV.',
    h1: 'PRODUCT SUPPORT & RESOURCES',
    content: 'Find user manuals, warranty registration information, setup FAQs, and contact technical support specialists. Customer care helpline: +91 8056666653.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Does ZUVO TV run official Android TV OS?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Every ZUVO Smart TV (32", 43", 50", 55") is powered by official Google Android TV with Google Play Store, Google Assistant voice remote, and Chromecast built-in. The 24" model is a standard HD multimedia LED TV.'
          }
        },
        {
          '@type': 'Question',
          name: 'How do I check warranty coverage for my ZUVO TV?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'All ZUVO TVs come with official brand warranty coverage. Keep your purchase invoice or reach out to customer support with your TV serial number.'
          }
        }
      ]
    }
  },
  {
    path: 'contact',
    title: 'Contact ZUVO TV — Sales Desk, Service Hub & WhatsApp Support',
    description: 'Reach the official ZUVO Android TV sales desk and service hub. Connect via WhatsApp (+91 8056666653), phone, email, or visit our headquarters in Aarani, Tamil Nadu.',
    h1: 'CONTACT ZUVO OFFICIAL BRAND',
    content: 'Connect directly with our sales and service owner. Email: zuvoandroidtv@gmail.com, Phone: +91 8056666653, Headquarters: Aarani, Tamil Nadu, India. Instant WhatsApp chat available.',
    schema: localBusinessSchema
  },
  {
    path: 'privacy',
    title: 'Privacy Policy | ZUVO Android TV',
    description: 'Official Privacy Policy of ZUVO Android TV. Learn how we handle customer inquiries, order data, and contact communications safely.',
    h1: 'PRIVACY POLICY',
    content: 'Transparent details on how ZUVO collects, uses, and safeguards your customer and enquiry information.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'ZUVO Privacy Policy',
      url: `${BASE_URL}/privacy`
    }
  },
  {
    path: 'terms',
    title: 'Terms of Service | ZUVO Android TV',
    description: 'Official Terms of Service for ZUVO Android TV website, product purchases, and dealership interactions.',
    h1: 'TERMS OF SERVICE',
    content: 'Please review the terms and conditions governing the use of the ZUVO official website and television services.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'ZUVO Terms of Service',
      url: `${BASE_URL}/terms`
    }
  }
];

let count = 0;
for (const route of routes) {
  const canonicalUrl = route.path === '' ? `${BASE_URL}/` : `${BASE_URL}/${route.path}`;
  
  let html = template;
  const escapeHtmlAttr = (str) => String(str).replace(/"/g, '&quot;');
  const safeTitle = escapeHtmlAttr(route.title);
  const safeDesc = escapeHtmlAttr(route.description);

  html = html.replace(/<title>.*?<\/title>/i, `<title>${route.title}</title>`);
  
  // Replace or inject meta description
  if (html.includes('<meta name="description"')) {
    html = html.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${safeDesc}" />`);
  } else {
    html = html.replace('</head>', `  <meta name="description" content="${safeDesc}" />\n  </head>`);
  }

  // Canonical tag
  const canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;

  // Open Graph and Twitter tags
  const socialTags = `
    <!-- Canonical & Social Metadata -->
    ${canonicalTag}
    <meta property="og:site_name" content="ZUVO Android TV" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${BASE_URL}/zuvo-logo.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${BASE_URL}/zuvo-logo.png" />
  `;

  // Injected JSON-LD Schema
  const schemaScript = route.schema
    ? `\n    <!-- Static JSON-LD Structured Data -->\n    <script type="application/ld+json" id="zuvo-schema-jsonld">\n${JSON.stringify(route.schema, null, 2)}\n    </script>\n`
    : '';

  html = html.replace('</head>', `${socialTags}${schemaScript}  </head>`);

  // Crawler fallback semantic content inside <div id="root">
  const noscriptContent = `
    <main style="padding: 2rem; max-width: 1200px; margin: 0 auto; color: #fff;">
      <h1 style="font-size: 2.5rem; font-weight: 800; text-transform: uppercase;">${route.h1}</h1>
      <p style="font-size: 1.1rem; line-height: 1.6; color: #d1d5db; margin-top: 1rem;">${route.content}</p>
      <nav style="margin-top: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
        <a href="/" style="color: #00D2FF; text-decoration: underline;">Home</a>
        <a href="/products" style="color: #00D2FF; text-decoration: underline;">TV Products</a>
        <a href="/dealership" style="color: #00D2FF; text-decoration: underline;">Dealership</a>
        <a href="/warranty" style="color: #00D2FF; text-decoration: underline;">Warranty</a>
        <a href="/contact" style="color: #00D2FF; text-decoration: underline;">Contact & WhatsApp</a>
      </nav>
    </main>
  `;
  html = html.replace('<div id="root"></div>', `<div id="root">${noscriptContent}</div>`);

  // Target directory
  const targetDir = route.path === '' ? distDir : path.join(distDir, route.path);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const outFilePath = path.join(targetDir, 'index.html');
  fs.writeFileSync(outFilePath, html, 'utf-8');
  count++;
}

// Also generate dist/404.html
const notFoundHtml = template
  .replace(/<title>.*?<\/title>/i, '<title>404 — Page Not Found | ZUVO Android TV</title>')
  .replace('</head>', '  <meta name="robots" content="noindex, nofollow" />\n  </head>')
  .replace('<div id="root"></div>', '<div id="root"><main style="text-align:center;padding:4rem;color:#fff;"><h1>404 — PAGE NOT FOUND</h1><p>The requested route could not be found.</p><a href="/" style="color:#00D2FF;">Return to Homepage</a></main></div>');
fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf-8');

console.log(`Successfully prerendered ${count} static HTML routes + 404.html in dist/`);
