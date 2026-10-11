import React, { useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SEO } from '../components/common/SEO';
import { CheckCircle2, Building2, Store, Truck, ShieldCheck, MessageSquare, Phone, Mail, MapPin } from 'lucide-react';
import { siteConfig } from '../data/siteConfig';
import { createWhatsAppUrl } from '../utils/whatsapp';
import { trackEvent } from '../utils/analytics';
import { getBreadcrumbSchema } from '../utils/schema';

export const Dealership: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    contactPerson: '',
    phone: '',
    email: '',
    cityState: '',
    businessType: 'Retail Store' as 'Retail Store' | 'Regional Distributor' | 'Commercial Bulk Buyer' | 'Electronics Showroom',
    enquiryMessage: '',
  });

  const handleFormStart = () => {
    trackEvent('dealer_form_start', { businessType: formData.businessType });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName || !formData.contactPerson || !formData.phone || !formData.cityState) return;

    trackEvent('dealer_form_submit', {
      businessName: formData.businessName,
      businessType: formData.businessType,
      cityState: formData.cityState,
    });

    const lines = [
      `*ZUVO DEALERSHIP & DISTRIBUTOR ENQUIRY*`,
      `--------------------------------------------------`,
      `*Business / Firm Name:* ${formData.businessName}`,
      `*Contact Person:* ${formData.contactPerson}`,
      `*Phone Number:* ${formData.phone}`,
      formData.email ? `*Email:* ${formData.email}` : '',
      `*City & State:* ${formData.cityState}`,
      `*Business Category:* ${formData.businessType}`,
      `*Details & Quantity:* ${formData.enquiryMessage || 'Interested in ZUVO TV dealership partnership and wholesale price lists.'}`,
      `--------------------------------------------------`,
      `Sent directly to ZUVO Commercial Desk (+91 8056666653)`,
    ].filter(Boolean);

    const url = createWhatsAppUrl(lines.join('\n'));
    window.open(url, '_blank', 'noopener,noreferrer');
    setSubmitted(true);
  };

  const dealerSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'ZUVO TV Dealership & Distribution Partnership in India',
    description: 'Partner with ZUVO Android TV. Official dealership, retail showroom placement, and wholesale distributor opportunities across India.',
    url: 'https://www.zuvoandroidtv.com/dealership',
  };

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Become a Dealer', url: '/dealership' },
  ]);

  return (
    <PageContainer>
      <SEO
        title="Become a ZUVO TV Dealer & Distributor in India | Official Partnership"
        description="Join the ZUVO Android TV retail and dealership network. High-margin smart TV models from 24 inch to 55 inch with direct brand warranty and owner support."
        canonicalPath="/dealership"
        keywords="ZUVO TV dealer enquiry, TV distributor enquiry, smart TV dealership opportunities, wholesale LED TV India, TV retail partnership"
        schema={[dealerSchema, breadcrumbs]}
      />

      <div className="py-16 bg-black">
        <Container>
          <SectionHeading
            badge="BUSINESS PARTNERSHIPS"
            title="BECOME A ZUVO"
            highlightTitle="DEALER & DISTRIBUTOR"
            subtitle="Expand your electronics business with fast-growing ZUVO Smart TVs. High-margin lineups, robust build quality, direct manufacturer warranty, and direct owner assistance."
          />

          {/* Partnership Advantage Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16 max-w-6xl mx-auto">
            <div className="p-6 rounded-2xl bg-[#090a0d] border border-white/10 space-y-3">
              <Store className="text-cyan-400" size={28} />
              <h3 className="text-base font-bold text-white uppercase">Complete Range</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                From budget 24" Normal LED to high-demand 32", 43", 50", and 55" 4K Smart TVs with Voice & Bluetooth.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#090a0d] border border-white/10 space-y-3">
              <ShieldCheck className="text-emerald-400" size={28} />
              <h3 className="text-base font-bold text-white uppercase">Brand Warranty</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Official ZUVO warranty backing and responsive technical service hub protecting your customer reputation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#090a0d] border border-white/10 space-y-3">
              <Building2 className="text-purple-400" size={28} />
              <h3 className="text-base font-bold text-white uppercase">Attractive Margins</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Direct wholesale pricing models engineered to maximize profit margins for local retailers and distributors.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#090a0d] border border-white/10 space-y-3">
              <Truck className="text-blue-400" size={28} />
              <h3 className="text-base font-bold text-white uppercase">Swift Logistics</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Prompt dispatch, reliable transport support, and direct communication with our regional commercial desk.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto items-start">
            {/* Left Column: Requirements & Contact */}
            <div className="lg:col-span-5 space-y-8">
              <div className="p-8 rounded-3xl bg-[#09090c] border border-white/10 space-y-6">
                <h3 className="text-xl font-extrabold text-white uppercase">WHO CAN APPLY?</h3>
                <ul className="space-y-4 text-xs text-neutral-300">
                  <li className="flex items-start space-x-3">
                    <CheckCircle2 size={18} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>Consumer electronics showrooms & home appliance retail stores.</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <CheckCircle2 size={18} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>Regional TV distributors & multi-brand retail chains across Tamil Nadu & India.</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <CheckCircle2 size={18} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>Commercial procurement specialists (Hotels, hostels, offices, hospitals).</span>
                  </li>
                </ul>

                <div className="pt-6 border-t border-white/10 space-y-4 text-xs">
                  <div className="flex items-center space-x-3 text-neutral-300">
                    <Phone size={16} className="text-cyan-400" />
                    <span>Direct Dealer Helpline: <strong className="text-white">{siteConfig.contact.phone}</strong></span>
                  </div>
                  <div className="flex items-center space-x-3 text-neutral-300">
                    <Mail size={16} className="text-cyan-400" />
                    <span>Commercial Email: <strong className="text-white">{siteConfig.contact.email}</strong></span>
                  </div>
                  <div className="flex items-center space-x-3 text-neutral-300">
                    <MapPin size={16} className="text-cyan-400" />
                    <span>Commercial Hub: <strong className="text-white">{siteConfig.contact.address}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Dealership Form */}
            <div className="lg:col-span-7">
              <div className="p-8 sm:p-10 rounded-3xl bg-[#0a0a0d] border border-white/10">
                {submitted ? (
                  <div className="py-12 text-center space-y-4">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
                    <h3 className="text-2xl font-bold text-white uppercase">DEALERSHIP ENQUIRY SUBMITTED</h3>
                    <p className="text-neutral-400 text-xs sm:text-sm">
                      Your details have been forwarded to the ZUVO Commercial Desk on WhatsApp (+91 8056666653). Our team will review your requirement and share wholesale catalogues shortly.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="mt-4 px-6 py-2.5 rounded-full bg-white/10 text-white text-xs font-bold uppercase hover:bg-white/20"
                    >
                      SUBMIT ANOTHER ENQUIRY
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <h3 className="text-xl font-extrabold text-white uppercase mb-2">DEALER & DISTRIBUTOR ENQUIRY FORM</h3>
                    <p className="text-neutral-400 text-xs mb-6">
                      Fill out this form to receive our official dealer price list and regional distribution details.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">BUSINESS / FIRM NAME *</label>
                        <input
                          type="text"
                          required
                          value={formData.businessName}
                          onFocus={handleFormStart}
                          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                          placeholder="e.g. Sri Krishna Electronics"
                          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">CONTACT PERSON NAME *</label>
                        <input
                          type="text"
                          required
                          value={formData.contactPerson}
                          onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                          placeholder="Your full name"
                          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">PHONE / WHATSAPP NUMBER *</label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+91 9876543210"
                          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">EMAIL ADDRESS</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="contact@yourbusiness.com"
                          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">CITY & STATE *</label>
                        <input
                          type="text"
                          required
                          value={formData.cityState}
                          onChange={(e) => setFormData({ ...formData, cityState: e.target.value })}
                          placeholder="e.g. Vellore, Tamil Nadu"
                          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">BUSINESS TYPE</label>
                        <select
                          value={formData.businessType}
                          onChange={(e) => setFormData({ ...formData, businessType: e.target.value as any })}
                          className="w-full px-4 py-3.5 rounded-xl bg-[#12141c] border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                        >
                          <option value="Retail Store">Retail Electronics Store</option>
                          <option value="Regional Distributor">Regional TV Distributor</option>
                          <option value="Electronics Showroom">Showroom Chain</option>
                          <option value="Commercial Bulk Buyer">Commercial Bulk Buyer (Hotels/Institutions)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">ENQUIRY DETAILS / EXPECTED MONTHLY VOLUME</label>
                      <textarea
                        rows={3}
                        value={formData.enquiryMessage}
                        onChange={(e) => setFormData({ ...formData, enquiryMessage: e.target.value })}
                        placeholder="Mention your estimated quantity requirement, preferred screen sizes (e.g. 32-inch, 43-inch, 55-inch), or store location..."
                        className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs tracking-widest uppercase shadow-lg transition flex items-center justify-center space-x-2"
                    >
                      <MessageSquare size={16} />
                      <span>SUBMIT DEALER ENQUIRY VIA WHATSAPP</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </Container>
      </div>
    </PageContainer>
  );
};

export default Dealership;
