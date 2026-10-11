import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

console.log('=== RUNNING ZUVO SEO & GEO RIGOROUS POST-IMPLEMENTATION AUDIT ===\n');

let errors = 0;
let passes = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passes++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    errors++;
  }
}

// 1. Check robots.txt
const robotsPath = path.join(distDir, 'robots.txt');
assert(fs.existsSync(robotsPath), 'dist/robots.txt exists');
if (fs.existsSync(robotsPath)) {
  const content = fs.readFileSync(robotsPath, 'utf-8');
  assert(content.includes('User-agent: *'), 'robots.txt contains User-agent: *');
  assert(content.includes('Sitemap: https://www.zuvoandroidtv.com/sitemap.xml'), 'robots.txt points to correct sitemap URL');
}

// 2. Check sitemap.xml
const sitemapPath = path.join(distDir, 'sitemap.xml');
assert(fs.existsSync(sitemapPath), 'dist/sitemap.xml exists');
if (fs.existsSync(sitemapPath)) {
  const content = fs.readFileSync(sitemapPath, 'utf-8');
  assert(content.includes('<urlset') && content.includes('</urlset>'), 'sitemap.xml is valid XML urlset');
  assert(content.includes('<loc>https://www.zuvoandroidtv.com/</loc>'), 'sitemap contains homepage');
  assert(content.includes('<loc>https://www.zuvoandroidtv.com/products</loc>'), 'sitemap contains /products');
  assert(content.includes('<loc>https://www.zuvoandroidtv.com/dealership</loc>'), 'sitemap contains /dealership');
  assert(content.includes('<loc>https://www.zuvoandroidtv.com/warranty</loc>'), 'sitemap contains /warranty');
  assert(content.includes('<loc>https://www.zuvoandroidtv.com/products/zuvo-55-smart-bt-voice</loc>'), 'sitemap contains 55" TV product URL');
}

// 3. Check Vercel & Netlify routing files
assert(fs.existsSync(path.resolve(__dirname, '../vercel.json')), 'vercel.json exists in root');
assert(fs.existsSync(path.join(distDir, '_redirects')), 'dist/_redirects exists for Netlify');

// 4. Verify canonical routes in dist
const expectedRoutes = [
  '',
  'products',
  'products/zuvo-24-normal',
  'products/zuvo-32-smart',
  'products/zuvo-32-smart-bt-voice',
  'products/zuvo-43-smart',
  'products/zuvo-43-smart-bt-voice',
  'products/zuvo-50-smart-bt-voice',
  'products/zuvo-55-smart-bt-voice',
  'dealership',
  'warranty',
  'technology',
  'about',
  'support',
  'contact',
  'privacy',
  'terms'
];

for (const route of expectedRoutes) {
  const filePath = route === '' ? path.join(distDir, 'index.html') : path.join(distDir, route, 'index.html');
  assert(fs.existsSync(filePath), `Route HTML exists: /${route}`);
  if (fs.existsSync(filePath)) {
    const html = fs.readFileSync(filePath, 'utf-8');
    assert(html.includes('<title>') && !html.includes('<title></title>'), `Unique Title present in /${route}`);
    assert(html.includes('<meta name="description"'), `Meta description present in /${route}`);
    
    // Check for exact single canonical tag (no duplicates)
    const canonicalMatches = html.match(/<link\s+rel=["']canonical["']/gi) || [];
    assert(canonicalMatches.length === 1, `Exactly ONE canonical tag in /${route} (found: ${canonicalMatches.length})`);
    
    // Check for exact single og:title tag (no duplicates)
    const ogTitleMatches = html.match(/<meta\s+property=["']og:title["']/gi) || [];
    assert(ogTitleMatches.length === 1, `Exactly ONE og:title tag in /${route} (found: ${ogTitleMatches.length})`);

    // Check for static JSON-LD schema
    assert(html.includes('<script type="application/ld+json"'), `Static JSON-LD script present in /${route}`);

    // Check crawlable H1 heading in initial HTML
    assert(html.includes('<h1'), `Crawlable H1 present in initial HTML for /${route}`);

    // Check that quotes in meta attributes are properly escaped
    assert(!html.includes('content="ZUVO 55"'), `Attribute quotes properly escaped in /${route}`);
  }
}

// 5. Verify 404 page
const notFoundPath = path.join(distDir, '404.html');
assert(fs.existsSync(notFoundPath), '404.html exists in dist');

console.log(`\n======================================================`);
console.log(`VERIFICATION SUMMARY: ${passes} Passed, ${errors} Failed`);
console.log(`======================================================\n`);

if (errors > 0) {
  process.exit(1);
}
