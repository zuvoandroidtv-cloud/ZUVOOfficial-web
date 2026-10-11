import React from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { HelpCircle, FileText, Shield, PhoneCall, ArrowRight } from 'lucide-react';
import { CTASection } from '../components/sections/CTASection';
import { SEO } from '../components/common/SEO';
import { getFaqSchema, getBreadcrumbSchema } from '../utils/schema';
import { siteConfig } from '../data/siteConfig';

export const Support: React.FC = () => {
  const faqs = [
    {
      q: 'Does ZUVO TV run official Android TV OS?',
      a: 'Yes. All ZUVO Smart TV models (32", 43", 50", 55") run official Google Android TV with Google Play Store, Google Assistant voice remote, and Chromecast built-in. (Note: The compact 24" model is a standard HD multimedia LED TV).',
    },
    {
      q: 'How do I check warranty coverage for my ZUVO TV?',
      a: 'All ZUVO TVs come with official brand warranty coverage. Keep your purchase invoice or reach out to customer support with your TV serial number.',
    },
    {
      q: 'Can I connect Bluetooth headphones or external soundbars?',
      a: 'Yes. ZUVO Voice & Bluetooth series TVs feature Bluetooth wireless connectivity as well as HDMI eARC and Optical Audio outputs.',
    },
    {
      q: 'How do I update the software on my ZUVO TV?',
      a: 'System software updates are delivered automatically via Over-The-Air (OTA) when your TV is connected to Wi-Fi.',
    },
  ];

  const schemas = [
    getFaqSchema(faqs),
    getBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Customer Support', url: '/support' },
    ]),
  ];

  return (
    <PageContainer>
      <SEO
        title="ZUVO TV Customer Support, Help Center & FAQs"
        description="Official ZUVO TV customer support hub. Find setup guides, frequently asked questions, warranty assistance, and service contacts for your smart TV."
        canonicalPath="/support"
        keywords="ZUVO TV support, ZUVO customer care, smart TV troubleshooting, Android TV help, ZUVO TV FAQs"
        schema={schemas}
      />
      <div className="py-16 bg-black">
        <Container>
          <SectionHeading
            as="h1"
            badge="CUSTOMER SUPPORT & HELP CENTER"
            title="PRODUCT SUPPORT &"
            highlightTitle="RESOURCES"
            subtitle="Find user manuals, warranty registration information, setup FAQs, and contact technical support specialists."
          />

          {/* Support Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
            <div className="p-6 rounded-2xl bg-[#090a0d] border border-white/10 text-center">
              <HelpCircle size={32} className="mx-auto text-cyan-400 mb-4" />
              <h2 className="text-base font-bold text-white mb-2">FAQs</h2>
              <p className="text-neutral-400 text-xs">Common setup & usage answers.</p>
            </div>
            <div className="p-6 rounded-2xl bg-[#090a0d] border border-white/10 text-center">
              <FileText size={32} className="mx-auto text-cyan-400 mb-4" />
              <h2 className="text-base font-bold text-white mb-2">User Manuals</h2>
              <p className="text-neutral-400 text-xs">Setup guides & remote pairing.</p>
            </div>
            <Link to="/warranty" className="p-6 rounded-2xl bg-[#090a0d] border border-white/10 text-center hover:border-cyan-400/40 transition group">
              <Shield size={32} className="mx-auto text-cyan-400 mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-base font-bold text-white mb-2 flex items-center justify-center space-x-1">
                <span>Warranty Policy</span>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
              <p className="text-neutral-400 text-xs">Official brand coverage details.</p>
            </Link>
            <Link to="/contact" className="p-6 rounded-2xl bg-[#090a0d] border border-white/10 text-center hover:border-cyan-400/40 transition group">
              <PhoneCall size={32} className="mx-auto text-cyan-400 mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-base font-bold text-white mb-2 flex items-center justify-center space-x-1">
                <span>Direct Helpline</span>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
              <p className="text-neutral-400 text-xs">Call {siteConfig.contact.phone}.</p>
            </Link>
          </div>

          {/* FAQ Accordion Section */}
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-xl font-bold text-white uppercase mb-6 text-center">FREQUENTLY ASKED QUESTIONS</h2>
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-[#0a0a0d] border border-white/10">
                <h3 className="text-base font-bold text-white mb-2">{faq.q}</h3>
                <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </Container>
      </div>

      <CTASection />
    </PageContainer>
  );
};
export default Support;
