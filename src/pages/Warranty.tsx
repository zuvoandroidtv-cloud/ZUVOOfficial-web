import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SEO } from '../components/common/SEO';
import { ShieldCheck, Wrench, FileCheck, PhoneCall, MessageSquare, AlertCircle } from 'lucide-react';
import { siteConfig } from '../data/siteConfig';
import { getQuickServiceUrl } from '../utils/whatsapp';
import { getBreadcrumbSchema, getFaqSchema } from '../utils/schema';
import { CTASection } from '../components/sections/CTASection';

export const Warranty: React.FC = () => {
  const warrantyFaqs = [
    {
      q: 'What does the official ZUVO TV warranty cover?',
      a: 'All ZUVO televisions include comprehensive brand warranty coverage covering the display panel, main motherboards, power boards, internal audio modules, and remote controls against manufacturing defects.',
    },
    {
      q: 'How do I register or claim warranty for my ZUVO TV?',
      a: 'Keep your purchase invoice and warranty card safe. To lodge a service or warranty claim, contact our direct customer support desk on WhatsApp at +91 8056666653 or email zuvoandroidtv@gmail.com with your TV model and issue description.',
    },
    {
      q: 'Where is the official ZUVO service center located?',
      a: 'Our primary customer care, assembly, and service hub is located in Aarani, Tamil Nadu, with doorstep technical service support available across surrounding regional centers.',
    },
    {
      q: 'What is excluded from standard warranty coverage?',
      a: 'Physical panel damage caused by accidental drops, liquid seepage, unauthorized third-party tampering, and severe voltage fluctuations without surge protection are excluded from standard defect warranty.',
    },
  ];

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Warranty Policy & Support', url: '/warranty' },
  ]);

  const faqSchema = getFaqSchema(warrantyFaqs);

  return (
    <PageContainer>
      <SEO
        title="Official ZUVO TV Warranty Terms & Service Support | ZUVO Android TV"
        description="Official ZUVO TV warranty terms, claim procedures, service center assistance, and customer support. Learn how to verify and claim your smart TV warranty."
        canonicalPath="/warranty"
        keywords="ZUVO TV warranty, ZUVO customer support, ZUVO TV service center, smart TV warranty claim India, ZUVO repair Aarani"
        schema={[breadcrumbs, faqSchema]}
      />

      <div className="py-16 bg-black">
        <Container>
          <SectionHeading
            badge="BRAND PROTECTION"
            title="OFFICIAL ZUVO"
            highlightTitle="WARRANTY & SERVICE"
            subtitle="Understand our transparent warranty guidelines, doorstep technical assistance, and simple warranty claim process."
          />

          {/* Pillars of Service */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-5xl mx-auto">
            <div className="p-8 rounded-3xl bg-[#090a0d] border border-white/10 space-y-4">
              <ShieldCheck className="text-cyan-400" size={32} />
              <h3 className="text-lg font-bold text-white uppercase">Brand Warranty</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                Every ZUVO TV purchased through authorized retail partners or direct sales channels is backed by official brand warranty protection against hardware defects.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-[#090a0d] border border-white/10 space-y-4">
              <Wrench className="text-emerald-400" size={32} />
              <h3 className="text-lg font-bold text-white uppercase">Certified Technicians</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                Skilled display technicians handle wall mounting, display panel diagnostics, audio tuning, and firmware updates for worry-free ownership.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-[#090a0d] border border-white/10 space-y-4">
              <FileCheck className="text-purple-400" size={32} />
              <h3 className="text-lg font-bold text-white uppercase">Hassle-Free Claims</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                No complicated paperwork. Simply message our service line on WhatsApp with your invoice photo and TV serial number to initiate support.
              </p>
            </div>
          </div>

          {/* Claim Instructions Banner */}
          <div className="max-w-4xl mx-auto p-8 rounded-3xl bg-[#0a0a0e] border border-white/10 mb-16">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">NEED IMMEDIATE SERVICE?</span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white uppercase">BOOK SERVICE OR LODGE A WARRANTY CLAIM</h3>
                <p className="text-neutral-400 text-xs sm:text-sm max-w-xl">
                  Contact our dedicated technical service helpline directly on WhatsApp or call our support owner desk.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                <a
                  href={getQuickServiceUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2"
                >
                  <MessageSquare size={16} />
                  <span>WHATSAPP SERVICE DESK</span>
                </a>
                <a
                  href={`tel:${siteConfig.contact.phone}`}
                  className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2"
                >
                  <PhoneCall size={16} />
                  <span>CALL {siteConfig.contact.phone}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Warranty Terms & Conditions */}
          <div className="max-w-4xl mx-auto p-8 sm:p-12 rounded-3xl bg-[#08080a] border border-white/10 mb-16 space-y-6">
            <h3 className="text-xl font-bold text-white uppercase border-b border-white/10 pb-4">
              WARRANTY GUIDELINES & POLICY OVERVIEW
            </h3>
            <div className="space-y-4 text-xs sm:text-sm text-neutral-300 leading-relaxed">
              <p>
                <strong>1. Warranty Coverage Period:</strong> All ZUVO normal and Android smart LED televisions carry manufacturer defect coverage commencing from the date of purchase mentioned on the tax invoice.
              </p>
              <p>
                <strong>2. Proof of Purchase:</strong> Customers must present a valid purchase invoice issued by an authorized retailer, distributor, or ZUVO direct sales desk to validate warranty claims.
              </p>
              <p>
                <strong>3. Service Scope:</strong> In case of defect, ZUVO service technicians will inspect, repair, or replace eligible functional components using original parts.
              </p>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start space-x-3">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>Important Notice:</strong> Physical panel breakage, liquid spills, damage from non-standard power surges or lightning strikes, and repairs attempted by unauthorized third parties void the warranty.
                </span>
              </div>
            </div>
          </div>

          {/* FAQ Accordion */}
          <div className="max-w-4xl mx-auto space-y-4">
            <h3 className="text-xl font-bold text-white uppercase mb-6 text-center">WARRANTY FREQUENTLY ASKED QUESTIONS</h3>
            {warrantyFaqs.map((faq, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-[#0a0a0d] border border-white/10">
                <h4 className="text-base font-bold text-white mb-2">{faq.q}</h4>
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

export default Warranty;
