import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SEO } from '../components/common/SEO';
import { siteConfig } from '../data/siteConfig';

export const Terms: React.FC = () => {
  return (
    <PageContainer>
      <SEO
        title="Terms of Service | ZUVO Android TV"
        description="Official Terms of Service for ZUVO Android TV website, product purchases, and dealership interactions."
        canonicalPath="/terms"
      />
      <div className="py-16 bg-black">
        <Container>
          <SectionHeading
            badge="LEGAL & TERMS"
            title="TERMS OF"
            highlightTitle="SERVICE"
            subtitle="Please review the terms and conditions governing the use of the ZUVO official website and television services."
          />

          <div className="max-w-4xl mx-auto p-8 sm:p-12 rounded-3xl bg-[#09090b] border border-white/10 space-y-6 text-neutral-300 text-xs sm:text-sm leading-relaxed">
            <h3 className="text-lg font-bold text-white uppercase">1. Product Information & Specifications</h3>
            <p>
              ZUVO strives to provide accurate product information, specifications, screen sizes, and feature highlights on this website. Minor specifications, port configurations, and software interfaces may receive over-the-air updates or design improvements without prior notice.
            </p>

            <h3 className="text-lg font-bold text-white uppercase">2. Pricing & Orders</h3>
            <p>
              Direct quotes provided through our WhatsApp sales desk or authorized dealers reflect current inventory availability and regional delivery terms. Official invoices are issued upon order confirmation and payment.
            </p>

            <h3 className="text-lg font-bold text-white uppercase">3. Intellectual Property</h3>
            <p>
              All trademarks, product graphics, UI assets, logos, and written content appearing on this site are the property of ZUVO Consumer Electronics. Google, Android TV, Google Play, and Chromecast are trademarks of Google LLC. Dolby and the double-D symbol are registered trademarks of Dolby Laboratories.
            </p>

            <h3 className="text-lg font-bold text-white uppercase">4. Customer Support & Inquiries</h3>
            <p>
              For support or formal inquiries under these terms, reach our support team at {siteConfig.contact.email} or call {siteConfig.contact.phone}.
            </p>
          </div>
        </Container>
      </div>
    </PageContainer>
  );
};

export default Terms;
