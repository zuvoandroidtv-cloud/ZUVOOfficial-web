# ZUVO ANDROID TV — SEO & GEO DEPLOYMENT CHECKLIST

Use this checklist to ensure smooth production deployment, DNS verification, and search engine onboarding.

---

## 1. Pre-Deployment Repository Verification

* [x] **Git Cleanliness:** Unrelated files and temporary build artifacts excluded (`.gitignore`).
* [x] **Secrets Audit:** No private API keys, database credentials, or secret tokens are present in source code.
* [x] **Dependencies:** `.npmrc` configured with `legacy-peer-deps=true` for Vercel/CI builds.
* [x] **Production Build:** `npm run build` succeeds cleanly.
* [x] **Automated SEO Tests:** `npm run test:seo` passes 115/115 checks.
* [x] **Sitemap & Robots:** Both `sitemap.xml` and `robots.txt` generated in `dist/`.

---

## 2. Hosting & DNS Configuration (Vercel)

### A. Vercel Settings
* [x] **Framework Preset:** Vite
* [x] **Build Command:** `npm run build`
* [x] **Output Directory:** `dist`
* [x] **Install Command:** `npm install --legacy-peer-deps` (or automatically handled via `.npmrc`)
* [x] **SPA Rewrites & Caching:** Configured via `vercel.json`

### B. Custom Domain Settings (Vercel & Domain Registrar)
1. In Vercel Project Dashboard &rarr; **Settings** &rarr; **Domains**:
   - Add `zuvoandroidtv.com` and redirect `www.zuvoandroidtv.com` to it (or preferred apex/subdomain combination).
2. In Domain DNS Management (Hostinger / Registrar):
   - **A Record (`@`):** Points to `76.76.21.21` (TTL: 300)
   - **CNAME Record (`www`):** Points to `cname.vercel-dns.com` (TTL: 300)
3. Wait for DNS propagation and verify green checkmark on Vercel.

---

## 3. Post-Deployment Verification Commands

Run these terminal checks once the deployment is live:

```bash
# 1. Verify HTTP to HTTPS 301 Redirect
curl -IL http://www.zuvoandroidtv.com/

# 2. Verify robots.txt is accessible
curl -I https://www.zuvoandroidtv.com/robots.txt

# 3. Verify sitemap.xml is accessible
curl -I https://www.zuvoandroidtv.com/sitemap.xml

# 4. Verify prerendered HTML contains title and h1 without JS
curl -s https://www.zuvoandroidtv.com/dealership | grep -E '<title>|<h1'

# 5. Verify direct deep route returns HTTP 200 (not 404)
curl -I https://www.zuvoandroidtv.com/products/zuvo-55-smart-bt-voice
```

---

## 4. Google Search Console & Bing Onboarding

1. **Add Property in Google Search Console:**
   - Go to [Google Search Console](https://search.google.com/search-console).
   - Add domain property `zuvoandroidtv.com` using DNS TXT record or HTML tag verification.
2. **Submit Sitemap:**
   - Navigate to **Sitemaps** in the left menu.
   - Enter `https://www.zuvoandroidtv.com/sitemap.xml` and click **Submit**.
3. **URL Inspection & Live Test:**
   - Inspect `https://www.zuvoandroidtv.com/` and `https://www.zuvoandroidtv.com/dealership`.
   - Click **Test Live URL** and request indexing.
4. **Bing Webmaster Tools:**
   - Import the verified property from Google Search Console into [Bing Webmaster Tools](https://www.bing.com/webmasters).
   - Confirm sitemap submission.

---

## 5. Rollback Procedure

If any issue arises:
1. In Vercel &rarr; **Deployments**, locate the previous stable deployment and click **Promote to Production** (instant rollback in < 5 seconds).
2. Alternatively via Git:
   ```bash
   git revert HEAD
   git push origin main
   ```
