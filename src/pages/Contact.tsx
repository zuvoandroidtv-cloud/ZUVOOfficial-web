import React, { useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Mail, Phone, MapPin, CheckCircle2, MessageSquare } from 'lucide-react';
import { siteConfig } from '../data/siteConfig';
import { createWhatsAppUrl, formatInquiryMessage } from '../utils/whatsapp';
import { SEO } from '../components/common/SEO';
import { getLocalBusinessSchema, getBreadcrumbSchema } from '../utils/schema';
import { trackWhatsAppClick, trackPhoneClick, trackEvent } from '../utils/analytics';

export const Contact: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    inquiryType: 'Sales Inquiry' as 'Sales Inquiry' | 'Service & Repair' | 'Dealership Inquiry' | 'General Query',
    message: '',
  });

  const handleWhatsAppSubmit = () => {
    if (!formData.name || !formData.phone) return;

    trackWhatsAppClick('contact_form', formData.inquiryType);
    trackEvent('product_enquiry_submit', {
      inquiryType: formData.inquiryType,
      hasEmail: Boolean(formData.email),
    });

    const payload = formatInquiryMessage({
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      inquiryType: formData.inquiryType,
      message: formData.message || 'I would like to inquire regarding ZUVO TV sales & service.',
    });

    const url = createWhatsAppUrl(payload);
    window.open(url, '_blank', 'noopener,noreferrer');
    setSubmitted(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.message) return;
    handleWhatsAppSubmit();
  };

  const schemas = [
    getLocalBusinessSchema(),
    getBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Contact Us', url: '/contact' },
    ]),
  ];

  return (
    <PageContainer>
      <SEO
        title="Contact ZUVO TV — Sales Desk, Service Hub & WhatsApp Support"
        description="Reach the official ZUVO Android TV sales desk and service hub. Connect via WhatsApp (+91 8056666653), phone, email, or visit our headquarters in Aarani, Tamil Nadu."
        canonicalPath="/contact"
        keywords="Contact ZUVO TV, ZUVO customer care number, TV service Aarani, ZUVO WhatsApp support, smart TV repair enquiry"
        schema={schemas}
      />
      <div className="py-16 bg-black">
        <Container>
          <SectionHeading
            as="h1"
            badge="GET IN TOUCH"
            title="CONTACT ZUVO"
            highlightTitle="OFFICIAL BRAND"
            subtitle="Have questions about product specifications, dealership inquiries, or service assistance? Connect directly with our sales and service owner."
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto">
            {/* Left Contact Details */}
            <div className="lg:col-span-5 space-y-8">
              <div className="p-8 rounded-3xl bg-[#09090c] border border-white/10 space-y-6">
                <h2 className="text-xl font-extrabold text-white uppercase">OFFICIAL CONTACT</h2>

                <div className="flex items-start space-x-4 text-xs">
                  <Mail className="text-cyan-400 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <span className="text-neutral-500 uppercase font-bold block">EMAIL SUPPORT</span>
                    <a href={`mailto:${siteConfig.contact.email}`} className="text-white font-medium text-sm hover:text-cyan-400 transition-colors">
                      {siteConfig.contact.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-4 text-xs">
                  <Phone className="text-cyan-400 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <span className="text-neutral-500 uppercase font-bold block">CUSTOMER & SALES CARE</span>
                    <a
                      href={`tel:${siteConfig.contact.phone}`}
                      onClick={() => trackPhoneClick('contact_page')}
                      className="text-white font-medium text-sm hover:text-cyan-400 transition-colors"
                    >
                      {siteConfig.contact.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-4 text-xs">
                  <MapPin className="text-cyan-400 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <span className="text-neutral-500 uppercase font-bold block">HEADQUARTERS & SERVICE HUB</span>
                    <span className="text-white font-medium text-sm">{siteConfig.contact.address}</span>
                  </div>
                </div>

                {/* Instant WhatsApp Quick Button */}
                <div className="pt-4 border-t border-white/10">
                  <a
                    href={`https://wa.me/918056666653?text=${encodeURIComponent('👋 Hi ZUVO Team, I want to inquire about TV Sales & Service.')}`}
                    onClick={() => trackWhatsAppClick('instant_button', 'Header Quick Button')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2"
                  >
                    <MessageSquare size={16} />
                    <span>INSTANT WHATSAPP CHAT (+91 8056666653)</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Right Contact Form */}
            <div className="lg:col-span-7">
              <div className="p-8 sm:p-10 rounded-3xl bg-[#0a0a0d] border border-white/10">
                {submitted ? (
                  <div className="py-12 text-center space-y-4">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
                    <h3 className="text-2xl font-bold text-white uppercase">INQUIRY AUTOMATED TO OWNER WHATSAPP</h3>
                    <p className="text-neutral-400 text-xs sm:text-sm">
                      Your structured inquiry has been pre-filled for direct transmission to the ZUVO sales & service owner on WhatsApp (+91 8056666653).
                    </p>
                    <button
                      onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', phone: '', inquiryType: 'Sales Inquiry', message: '' }); }}
                      className="mt-4 px-6 py-2.5 rounded-full bg-white/10 text-white text-xs font-bold uppercase hover:bg-white/20"
                    >
                      SUBMIT ANOTHER INQUIRY
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <h2 className="text-xl font-extrabold text-white uppercase mb-6">SEND SALES & SERVICE INQUIRY</h2>

                    <div>
                      <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">FULL NAME *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter your name"
                        className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">PHONE NUMBER *</label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+91 8056666653"
                          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">EMAIL ADDRESS</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="zuvoandroidtv@gmail.com"
                          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">INQUIRY CATEGORY</label>
                      <select
                        value={formData.inquiryType}
                        onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value as any })}
                        className="w-full px-4 py-3.5 rounded-xl bg-[#12141c] border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                      >
                        <option value="Sales Inquiry">🛒 New TV Purchase / Sales Inquiry</option>
                        <option value="Service & Repair">🛠️ TV Installation / Repair & Technical Service</option>
                        <option value="Dealership Inquiry">💼 Dealership & Bulk Business Inquiry</option>
                        <option value="General Query">💬 General Customer Query</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-neutral-400 uppercase block mb-2">REQUIREMENT DETAILS *</label>
                      <textarea
                        required
                        rows={4}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Specify your TV model, size preference, or service requirement details..."
                        className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 transition"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs tracking-widest uppercase shadow-lg transition flex items-center justify-center space-x-2"
                      >
                        <MessageSquare size={16} />
                        <span>SUBMIT VIA WHATSAPP (+91 8056666653)</span>
                      </button>
                    </div>
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
export default Contact;
