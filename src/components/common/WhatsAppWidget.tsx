import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ShoppingCart, Wrench, PhoneCall, ShieldCheck } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { products } from '../../data/products';
import {
  createWhatsAppUrl,
  formatInquiryMessage,
  getGeneralWhatsAppUrl,
  getQuickSalesUrl,
  getQuickServiceUrl,
  getDealershipWhatsAppUrl,
} from '../../utils/whatsapp';
import { trackWhatsAppClick, trackEvent } from '../../utils/analytics';

export const WhatsAppWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'form'>('quick');

  const [formState, setFormState] = useState({
    name: '',
    phone: '',
    inquiryType: 'Sales Inquiry' as 'Sales Inquiry' | 'Service & Repair' | 'Dealership Inquiry' | 'General Query',
    tvModel: products[0]?.name || '',
    message: '',
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.phone) return;

    const formattedPayload = formatInquiryMessage({
      name: formState.name,
      phone: formState.phone,
      inquiryType: formState.inquiryType,
      tvModel: formState.tvModel,
      message: formState.message || 'I would like to get more information on sales & service options.',
    });

    trackWhatsAppClick('widget_custom_form', formState.inquiryType);
    trackEvent('product_enquiry_submit', {
      source: 'whatsapp_widget',
      tvModel: formState.tvModel,
      inquiryType: formState.inquiryType,
    });

    const whatsappUrl = createWhatsAppUrl(formattedPayload);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto">
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="flex items-center space-x-3"
          >
            <span className="hidden sm:inline-block bg-[#0c0d12] text-white text-xs font-semibold px-3 py-2 rounded-xl border border-white/10 shadow-2xl">
              Chat for Sales & Service
            </span>
            <button
              onClick={() => setIsOpen(true)}
              className="relative group p-4 rounded-full bg-emerald-500 text-white shadow-2xl hover:bg-emerald-400 hover:scale-110 transition-all duration-300 flex items-center justify-center border border-emerald-300/30"
              aria-label="Open ZUVO WhatsApp Connect Drawer"
            >
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
              </span>
              <WhatsAppIcon size={26} className="w-6.5 h-6.5 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ZUVO WhatsApp Connect Drawer Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-80 sm:w-96 rounded-3xl bg-[#0b0c10] border border-emerald-500/30 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Top Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-3">
                <div className="relative p-2.5 rounded-full bg-white/10 border border-white/20">
                  <WhatsAppIcon size={20} className="w-5 h-5 text-white" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-300 rounded-full border-2 border-emerald-700"></span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm uppercase tracking-wide">ZUVO WHATSAPP CONNECT</h4>
                  <p className="text-[11px] text-emerald-100 font-medium">Sales & Service Owner: +91 8056666653</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Clean Tab Selector Bar (No Emojis) */}
            <div className="flex border-b border-white/10 bg-[#07080a]">
              <button
                onClick={() => setActiveTab('quick')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeTab === 'quick' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5' : 'text-neutral-400 hover:text-white'
                }`}
              >
                QUICK OPTIONS
              </button>
              <button
                onClick={() => setActiveTab('form')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeTab === 'form' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5' : 'text-neutral-400 hover:text-white'
                }`}
              >
                SUBMIT INQUIRY
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
              {activeTab === 'quick' ? (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                    Click any option below to launch WhatsApp. All models and service choices will be prompted directly in your chat:
                  </p>

                  {/* General Chat Card */}
                  <a
                    href={getGeneralWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-400/50 hover:bg-emerald-500/10 transition-all group"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                      <WhatsAppIcon size={18} className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <div className="text-left flex-1">
                      <h5 className="text-xs font-bold text-white uppercase">GENERAL SALES & SERVICE CHAT</h5>
                      <p className="text-[11px] text-neutral-400">Asks all models, pricing & service options upon chat entry</p>
                    </div>
                  </a>

                  {/* New TV Purchase Card */}
                  <a
                    href={getQuickSalesUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-400/50 hover:bg-emerald-500/10 transition-all group"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                      <ShoppingCart size={18} />
                    </div>
                    <div className="text-left flex-1">
                      <h5 className="text-xs font-bold text-white uppercase">NEW TV PURCHASE & PRICING</h5>
                      <p className="text-[11px] text-neutral-400">Prompts 24" to 55" models & Aarani home delivery</p>
                    </div>
                  </a>

                  {/* Technical Service & Repair Card */}
                  <a
                    href={getQuickServiceUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-400/50 hover:bg-emerald-500/10 transition-all group"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                      <Wrench size={18} className="text-emerald-400" />
                    </div>
                    <div className="text-left flex-1">
                      <h5 className="text-xs font-bold text-white uppercase">TECHNICAL SERVICE & REPAIR</h5>
                      <p className="text-[11px] text-neutral-400">Prompts installation, wall mount & repair options</p>
                    </div>
                  </a>

                  {/* Dealership & Bulk Orders Card */}
                  <a
                    href={getDealershipWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-400/50 hover:bg-emerald-500/10 transition-all group"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                      <ShieldCheck size={18} className="text-emerald-400" />
                    </div>
                    <div className="text-left flex-1">
                      <h5 className="text-xs font-bold text-white uppercase">DEALERSHIP & BULK ORDERS</h5>
                      <p className="text-[11px] text-neutral-400">Prompts authorized dealership & wholesale options</p>
                    </div>
                  </a>

                  {/* Footer Line */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="flex items-center space-x-1">
                      <PhoneCall size={12} className="text-emerald-400" />
                      <span>Direct Line: +91 8056666653</span>
                    </span>
                    <span className="text-emerald-400 font-semibold">Aarani HQ</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={formState.phone}
                      onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Inquiry Type</label>
                    <select
                      value={formState.inquiryType}
                      onChange={(e) => setFormState({ ...formState, inquiryType: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-[#14161f] border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                    >
                      <option value="Sales Inquiry">New TV Sales & Purchase</option>
                      <option value="Service & Repair">TV Service / Repair / Installation</option>
                      <option value="Dealership Inquiry">Dealership & Bulk Inquiry</option>
                      <option value="General Query">General Customer Support</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Select TV Variety</label>
                    <select
                      value={formState.tvModel}
                      onChange={(e) => setFormState({ ...formState, tvModel: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#14161f] border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Message / Details</label>
                    <textarea
                      rows={2}
                      value={formState.message}
                      onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                      placeholder="Write your requirement..."
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2"
                  >
                    <span>SEND TO OWNER VIA WHATSAPP</span>
                    <Send size={14} />
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
