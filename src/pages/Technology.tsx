import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { techPillars } from '../data/technology';
import { CTASection } from '../components/sections/CTASection';
import { SEO } from '../components/common/SEO';
import { getBreadcrumbSchema } from '../utils/schema';

export const Technology: React.FC = () => {
  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Technology Engine', url: '/technology' },
  ]);

  return (
    <PageContainer>
      <SEO
        title="ZUVO TV Technology — Display, Dolby Audio & Android TV Engine"
        description="Explore the engineering behind ZUVO Smart TVs: Direct Crystal LED matrices, Dolby Audio immersion, high-performance processors, and official Google Android TV ecosystem."
        canonicalPath="/technology"
        keywords="ZUVO TV technology, smart TV display engine, Dolby Atmos TV, Android TV architecture, 4K UHD processing India"
        schema={breadcrumbs}
      />
      <div className="py-16 bg-black">
        <Container>
          <SectionHeading
            as="h1"
            badge="ZUVO INNOVATION & HARDWARE"
            title="PRECISION"
            highlightTitle="TECHNOLOGY ENGINE"
            subtitle="Explore the display, audio, processing, and smart TV technology architecture engineered into every ZUVO Smart TV."
          />

          <div className="space-y-16">
            {techPillars.map((pillar) => (
              <div
                key={pillar.id}
                id={pillar.id}
                className="p-8 sm:p-12 rounded-3xl bg-[#0a0a0d] border border-white/10 relative overflow-hidden"
              >
                <span className="text-xs font-bold text-cyan-400 tracking-widest uppercase block mb-2">
                  {pillar.subtitle}
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white uppercase tracking-tight mb-4">
                  {pillar.title}
                </h2>
                <p className="text-neutral-300 text-sm sm:text-base max-w-3xl leading-relaxed mb-8">
                  {pillar.description}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/10">
                  {pillar.specs.map((sp, idx) => (
                    <div key={idx}>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                        {sp.label}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-white">{sp.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </div>

      <CTASection />
    </PageContainer>
  );
};
export default Technology;
