import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SEO } from '../components/common/SEO';
import { siteConfig } from '../data/siteConfig';

export const Privacy: React.FC = () => {
  return (
    <PageContainer>
      <SEO
        title="Privacy Policy | ZUVO Android TV"
        description="Official Privacy Policy of ZUVO Android TV. Learn how we handle customer inquiries, order data, and contact communications safely."
        canonicalPath="/privacy"
      />
      <div className="py-16 bg-black">
        <Container>
          <SectionHeading
            badge="LEGAL & PRIVACY"
            title="PRIVACY"
            highlightTitle="POLICY"
            subtitle="Transparent details on how ZUVO collects, uses, and safeguards your customer and enquiry information."
          />

          <div className="max-w-4xl mx-auto p-8 sm:p-12 rounded-3xl bg-[#09090b] border border-white/10 space-y-6 text-neutral-300 text-xs sm:text-sm leading-relaxed">
            <h3 className="text-lg font-bold text-white uppercase">1. Information We Collect</h3>
            <p>
              When you submit a sales inquiry, service request, or dealership form through our website, we collect your name, phone number, email address, city, and message details. We use this data solely to process your television orders, provide customer service, and answer business queries.
            </p>

            <h3 className="text-lg font-bold text-white uppercase">2. WhatsApp & Direct Communication</h3>
            <p>
              Our website provides direct inquiry features via WhatsApp. When you initiate a WhatsApp conversation with our official support number ({siteConfig.contact.phone}), your phone number and chat communications are subject to WhatsApp's standard end-to-end encrypted messaging policies.
            </p>

            <h3 className="text-lg font-bold text-white uppercase">3. Information Protection</h3>
            <p>
              We do not sell, rent, or trade your personal or business data to third-party marketing companies. Data is retained strictly for customer relationship management, warranty validation, and delivery coordination.
            </p>

            <h3 className="text-lg font-bold text-white uppercase">4. Contacting Us</h3>
            <p>
              If you have any questions regarding your data or wish to update your contact preferences, please reach out to our privacy desk at {siteConfig.contact.email} or call {siteConfig.contact.phone}.
            </p>
          </div>
        </Container>
      </div>
    </PageContainer>
  );
};

export default Privacy;
