import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { ProviderAdapterFactory, CommChannel } from '../../lib/communication/providerAdapter';
import {
  Send,
  MessageSquare,
  Mail,
  Smartphone,
  AlertTriangle,
  CheckCircle,
  Eye,
  X,
  Lock,
  FileText
} from 'lucide-react';

interface SendCustomerMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    id: string;
    full_name: string;
    phone: string;
    email?: string;
  } | null;
  onSuccess?: () => void;
}

export const SendCustomerMessageModal: React.FC<SendCustomerMessageModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess
}) => {
  const [channel, setChannel] = useState<CommChannel>('whatsapp');
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [messageBody, setMessageBody] = useState<string>('');
  const [isSimulation, setIsSimulation] = useState<boolean>(true);
  const [preferences, setPreferences] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && customer) {
      loadInitialData();
    }
  }, [isOpen, customer, channel]);

  const loadInitialData = async () => {
    if (!customer?.id) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      // 1. Fetch Customer Communication Preferences
      const { data: prefData } = await supabase.rpc('get_or_create_customer_comm_preferences', {
        p_customer_id: customer.id
      });
      setPreferences(prefData || {
        sms_enabled: true,
        whatsapp_enabled: true,
        email_enabled: true,
      });

      // 2. Fetch active templates for selected channel
      const { data: tmplData } = await supabase
        .from('communication_templates')
        .select('*')
        .eq('channel', channel)
        .eq('is_active', true);

      setTemplates(tmplData || []);
      if (tmplData && tmplData.length > 0) {
        const first = tmplData[0] as any;
        setSelectedTemplateKey(first.template_key);
        setCustomSubject(first.subject || '');
        renderTemplateContent(first.message_body);
      } else {
        setSelectedTemplateKey('');
        setMessageBody('');
      }
    } catch (err) {
      console.error('Error loading modal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTemplateContent = (rawBody: string) => {
    let rendered = rawBody || '';
    rendered = rendered.replace(/{{customer_name}}/g, customer?.full_name || 'Customer');
    rendered = rendered.replace(/{{customer_phone}}/g, customer?.phone || '');
    rendered = rendered.replace(/{{customer_email}}/g, customer?.email || '');
    rendered = rendered.replace(/{{company_name}}/g, 'ZUVO TV');
    setMessageBody(rendered);
  };

  const handleTemplateChange = (tmplKey: string) => {
    setSelectedTemplateKey(tmplKey);
    const found = templates.find(t => t.template_key === tmplKey);
    if (found) {
      setCustomSubject(found.subject || '');
      renderTemplateContent(found.message_body);
    }
  };

  const isChannelAllowed = () => {
    if (!preferences) return true;
    if (channel === 'whatsapp') return preferences.whatsapp_enabled;
    if (channel === 'sms') return preferences.sms_enabled;
    if (channel === 'email') return preferences.email_enabled;
    return true;
  };

  const getRecipientAddress = () => {
    if (channel === 'email') return customer?.email || 'No Email';
    return customer?.phone || 'No Phone';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.id) return;
    if (!isChannelAllowed()) {
      setFeedback({ type: 'error', text: `Customer has disabled ${channel.toUpperCase()} communications.` });
      return;
    }

    setIsSending(true);
    setFeedback(null);

    try {
      const adapter = ProviderAdapterFactory.getAdapter(channel);
      const selTmpl = templates.find(t => t.template_key === selectedTemplateKey);

      const result = await adapter.send({
        customerId: customer.id,
        recipient: getRecipientAddress(),
        channel: channel,
        templateKey: selectedTemplateKey,
        templateId: selTmpl?.id,
        subject: customSubject,
        messageBody: messageBody,
        messageType: selTmpl?.event_type || 'manual_dispatch',
        isSimulation: isSimulation
      });

      if (result.success) {
        setFeedback({
          type: 'success',
          text: `Message dispatched! Status: ${result.status.toUpperCase()} (${result.message})`
        });
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to dispatch message.' });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '620px',
        padding: '24px',
        background: '#0F172A',
        borderColor: 'var(--border-subtle)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Send size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Send Customer Communication
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Recipient: <strong style={{ color: '#fff' }}>{customer.full_name}</strong> ({customer.phone})
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            color: feedback.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            fontSize: '0.875rem'
          }}>
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Channel Selector */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Select Communication Channel
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  background: channel === 'whatsapp' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${channel === 'whatsapp' ? 'var(--accent-emerald)' : 'var(--border-subtle)'}`,
                  color: channel === 'whatsapp' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <MessageSquare size={16} /> WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setChannel('sms')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  background: channel === 'sms' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${channel === 'sms' ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                  color: channel === 'sms' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <Smartphone size={16} /> SMS
              </button>

              <button
                type="button"
                onClick={() => setChannel('email')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  background: channel === 'email' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${channel === 'email' ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                  color: channel === 'email' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <Mail size={16} /> Email
              </button>
            </div>
          </div>

          {/* Opt-Out Warning if channel disabled */}
          {!isChannelAllowed() && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--accent-rose)',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Lock size={16} />
              <span>Customer has disabled <strong>{channel.toUpperCase()}</strong> communication channel. Send button is blocked.</span>
            </div>
          )}

          {/* Template Selection */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Message Template
            </label>
            <select
              value={selectedTemplateKey}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="input"
              style={{ width: '100%', fontSize: '0.875rem', background: '#111827' }}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.template_key}>
                  {t.template_name} ({t.event_type})
                </option>
              ))}
            </select>
          </div>

          {/* Subject (for Email) */}
          {channel === 'email' && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Email Subject
              </label>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="input"
                style={{ width: '100%', fontSize: '0.875rem' }}
              />
            </div>
          )}

          {/* Message Body Rendered Preview */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Rendered Message Preview
              </label>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>Variables Substituted</span>
            </div>
            <textarea
              rows={4}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="input"
              style={{ width: '100%', fontSize: '0.85rem', fontFamily: 'monospace', lineHeight: 1.4 }}
            />
          </div>

          {/* Mode Indicator Switcher */}
          <div style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                {isSimulation ? 'Simulation / Test Mode' : 'Live Provider Mode'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isSimulation ? 'No external message will be sent. Log status will be saved as SENT (Simulated).' : 'Requires server-side API keys.'}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isSimulation}
                onChange={(e) => setIsSimulation(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Simulate</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending || !isChannelAllowed() || !messageBody.trim()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={15} /> {isSending ? 'Dispatching...' : 'Dispatch Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
