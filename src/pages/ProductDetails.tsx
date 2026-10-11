import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageSquare } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { Badge } from '../components/ui/Badge';
import { products } from '../data/products';
import { TV3D } from '../components/tv/TV3D';
import { getQuickSalesUrl } from '../utils/whatsapp';
import { SEO } from '../components/common/SEO';
import { getProductSchema, getBreadcrumbSchema } from '../utils/schema';
import { trackWhatsAppClick } from '../utils/analytics';

export const ProductDetails: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const product = products.find((p) => p.id === productId) || products[0];

  const schemas = [
    getProductSchema(product),
    getBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Products', url: '/products' },
      { name: product.name, url: `/products/${product.id}` },
    ]),
  ];

  return (
    <PageContainer>
      <SEO
        title={`${product.name} | Specs, Features & Price Inquiry`}
        description={`${product.name} features ${product.resolution}, ${product.smartOS}, ${product.audioTech}. Official brand warranty and direct customer support in India.`}
        canonicalPath={`/products/${product.id}`}
        type="product"
        keywords={`${product.name}, ${product.sizes.join(', ')} TV, ${product.resolution}, ZUVO TV, ${product.smartOS}`}
        schema={schemas}
      />
      <div className="py-12 bg-black">
        <Container>
          {/* Back Navigation */}
          <Link
            to="/products"
            className="inline-flex items-center space-x-2 text-xs font-bold tracking-widest text-neutral-400 hover:text-white uppercase mb-8 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>BACK TO ALL TVS</span>
          </Link>

          {/* Product Overview Header Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
            {/* Left Column: Interactive 3D Visual */}
            <div className="lg:col-span-7">
              <div className="p-8 rounded-3xl bg-[#090a0e] border border-white/10 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="cyan">{product.badge || product.category}</Badge>
                  <span className="text-xs text-neutral-400 font-mono">{product.series}</span>
                </div>
                <TV3D interactive={true} screenContent="home" />
              </div>
            </div>

            {/* Right Column: Title & Key Specs */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold text-cyan-400 tracking-widest uppercase block mb-2">
                  {product.category}
                </span>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase">
                  {product.name}
                </h1>
                <p className="text-neutral-400 text-sm mt-2 font-medium">
                  {product.tagline}
                </p>
              </div>

              <p className="text-neutral-300 text-sm leading-relaxed">
                {product.description}
              </p>

              {/* Screen Sizes Selection */}
              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-3">
                  AVAILABLE SCREEN SIZES
                </span>
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((sz, i) => (
                    <span
                      key={sz}
                      className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider border ${
                        i === 0
                          ? 'bg-zuvo-gradient text-white border-cyan-400/40 shadow-zuvo-glow'
                          : 'bg-white/5 text-neutral-300 border-white/10'
                      }`}
                    >
                      {sz}
                    </span>
                  ))}
                </div>
              </div>

              {/* Key Feature Highlights */}
              <div className="space-y-2 pt-2">
                {product.highlights.map((hl, i) => (
                  <div key={i} className="flex items-center space-x-2 text-xs text-neutral-300">
                    <CheckCircle2 size={16} className="text-cyan-400 flex-shrink-0" />
                    <span>{hl}</span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-4">
                <a
                  href={getQuickSalesUrl(product.name)}
                  onClick={() => trackWhatsAppClick('product_details', product.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center px-8 py-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs tracking-widest uppercase shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <MessageSquare size={16} />
                  <span>INQUIRE / BUY ON WHATSAPP</span>
                </a>
                <Link
                  to="/dealership"
                  className="w-full text-center px-8 py-4 rounded-full bg-white/5 text-white font-bold text-xs tracking-widest uppercase border border-white/20 hover:bg-white/10 transition-all"
                >
                  DEALER & BULK ORDERS
                </Link>
              </div>
            </div>
          </div>

          {/* Full Technical Specifications Table */}
          <div className="mt-20 p-8 sm:p-12 rounded-3xl bg-[#09090b] border border-white/10">
            <h2 className="text-2xl font-extrabold text-white tracking-tight uppercase mb-8 border-b border-white/10 pb-4">
              TECHNICAL SPECIFICATIONS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {product.specifications.map((spec, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
                    {spec.name}
                  </span>
                  <span className="text-sm font-semibold text-white">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </div>
    </PageContainer>
  );
};
export default ProductDetails;
