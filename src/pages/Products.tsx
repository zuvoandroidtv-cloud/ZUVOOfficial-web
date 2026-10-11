import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { ProductShowcase } from '../components/sections/ProductShowcase';
import { CTASection } from '../components/sections/CTASection';
import { SEO } from '../components/common/SEO';
import { products } from '../data/products';
import { getItemListSchema, getBreadcrumbSchema } from '../utils/schema';

export const Products: React.FC = () => {
  const schemas = [
    getItemListSchema(products),
    getBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'TV Products Lineup', url: '/products' },
    ]),
  ];

  return (
    <PageContainer>
      <SEO
        title="ZUVO TV Model Lineup | 24, 32, 43, 50, 55 Inch Smart & LED TVs"
        description="Browse the complete ZUVO TV lineup. Budget 24-inch Normal LED TV, 32 & 43-inch Android Smart TVs, and flagship 50 & 55-inch 4K UHD TVs with Bluetooth & Voice Remote."
        canonicalPath="/products"
        keywords="ZUVO TV models, 32 inch smart TV, 43 inch smart TV price, 55 inch 4K TV, LED TV varieties, Android TV lineup India"
        schema={schemas}
      />
      <div className="pt-8 pb-12 bg-black">
        <Container>
          <SectionHeading
            as="h1"
            badge="ZUVO TELEVISION COLLECTION"
            title="OFFICIAL TV MODEL"
            highlightTitle="LINEUP"
            subtitle="Explore our comprehensive smart television lineup. From compact 24-inch LED to 55-inch theater 4K UHD displays with official Android TV OS and Voice Remote."
          />
        </Container>
      </div>

      <ProductShowcase />
      <CTASection />
    </PageContainer>
  );
};
export default Products;
