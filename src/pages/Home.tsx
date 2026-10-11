import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { HeroSection } from '../components/sections/HeroSection';
import { IntroSection } from '../components/sections/IntroSection';
import { AndroidTVSection } from '../components/sections/AndroidTVSection';
import { FeaturesSection } from '../components/sections/FeaturesSection';
import { ProductShowcase } from '../components/sections/ProductShowcase';
import { WhyZuvoSection } from '../components/sections/WhyZuvoSection';
import { CTASection } from '../components/sections/CTASection';
import { SEO } from '../components/common/SEO';
import { getOrganizationSchema, getWebSiteSchema, getLocalBusinessSchema } from '../utils/schema';

export const Home: React.FC = () => {
  const schemas = [
    getOrganizationSchema(),
    getWebSiteSchema(),
    getLocalBusinessSchema(),
  ];

  return (
    <PageContainer noPadding>
      <SEO
        title="ZUVO Android TV — Official Smart TV Brand | 24 to 55 Inch TVs in India"
        description="Official ZUVO Android TV platform. Explore 24-inch normal LED to 55-inch 4K UHD Smart TVs with official Google Android TV, Dolby audio, Voice Remote, and brand warranty."
        canonicalPath="/"
        keywords="ZUVO TV, ZUVO Android TV, ZUVO smart TV, 32 inch smart TV India, 43 inch smart TV, 55 inch 4K TV, smart TV dealer India"
        schema={schemas}
      />
      <HeroSection />
      <IntroSection />
      <AndroidTVSection />
      <FeaturesSection />
      <ProductShowcase />
      <WhyZuvoSection />
      <CTASection />
    </PageContainer>
  );
};
export default Home;
