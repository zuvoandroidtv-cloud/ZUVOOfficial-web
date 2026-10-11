import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { CTASection } from '../components/sections/CTASection';
import { SEO } from '../components/common/SEO';
import { getOrganizationSchema, getBreadcrumbSchema } from '../utils/schema';

export const About: React.FC = () => {
  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'About ZUVO Brand', url: '/about' },
    ]),
  ];

  return (
    <PageContainer>
      <SEO
        title="About ZUVO TV — Brand Philosophy & Android TV Vision"
        description="Discover ZUVO Consumer Electronics. Dedicated to crafting smart televisions with vibrant LED panels, Dolby sound, Google Android TV platform, and dependable local service."
        canonicalPath="/about"
        keywords="About ZUVO TV, ZUVO brand India, smart TV company Aarani, ZUVO television vision"
        schema={schemas}
      />
      <div className="py-16 bg-black">
        <Container>
          <SectionHeading
            as="h1"
            badge="BRAND PHILOSOPHY"
            title="ABOUT"
            highlightTitle="ZUVO TELEVISION"
            subtitle="ZUVO is an emerging smart television brand focused on bringing high-performance display panels, immersive Dolby audio, and official Google Android TV ecosystem to homes across India."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="p-8 sm:p-12 rounded-3xl bg-[#09090b] border border-white/10 space-y-4">
              <h2 className="text-xl font-bold text-white uppercase">OUR VISION</h2>
              <p className="text-neutral-400 text-sm leading-relaxed">
                To create smart televisions that seamlessly integrate state-of-the-art crystal LED displays, borderless glass craftsmanship, and pure official Android TV software without unnecessary complexity or bloated markups.
              </p>
            </div>

            <div className="p-8 sm:p-12 rounded-3xl bg-[#09090b] border border-white/10 space-y-4">
              <h2 className="text-xl font-bold text-white uppercase">OUR CRAFT</h2>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Every ZUVO TV model undergoes rigorous panel calibration, color accuracy testing, and heat dissipation engineering to maintain peak picture clarity and durable daily operation for years to come.
              </p>
            </div>
          </div>
        </Container>
      </div>

      <CTASection />
    </PageContainer>
  );
};
export default About;
