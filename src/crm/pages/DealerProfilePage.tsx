import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { Building2, User, Phone, Mail, MapPin, CreditCard, FileText, ShieldCheck } from 'lucide-react';

export const DealerProfilePage: React.FC = () => {
  const { profile } = useAuth();
  const dealerId = profile?.dealer_id;

  const [dealer, setDealer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealerId) {
      setLoading(false);
      return;
    }
    const fetchDealer = async () => {
      try {
        const { data, error } = await supabase
          .from('dealers')
          .select('*')
          .eq('id', dealerId)
          .single();

        if (error) throw error;
        setDealer(data);
      } catch (err) {
        console.error('Error fetching dealer profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDealer();
  }, [dealerId]);

  if (loading) {
    return (
      <div className="module-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
        <p className="text-muted">Loading dealer account profile...</p>
      </div>
    );
  }

  if (!dealer) {
    return (
      <div className="module-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <Building2 size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
        <h2 className="title-md">Dealer Profile Not Found</h2>
      </div>
    );
  }

  return (
    <div className="module-container" style={{ maxWidth: '840px' }}>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 style={{ color: 'var(--brand-primary)' }} /> Dealer Account Profile
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Official registered business information, contact details, and partnership credit status
          </p>
        </div>
        <span className={`badge ${dealer.is_active ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}>
          {dealer.is_active ? 'Active Dealer' : 'Inactive'}
        </span>
      </div>

      {/* Main Profile Card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '0.5rem', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
            <Building2 size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{dealer.dealer_name}</h2>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              <span>Code: <strong style={{ fontFamily: 'monospace' }}>{dealer.dealer_code}</strong></span>
              <span>•</span>
              <span style={{ textTransform: 'capitalize' }}>Type: <strong>{dealer.dealer_type}</strong></span>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <User size={14} /> CONTACT PERSON
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginTop: '0.25rem' }}>
              {dealer.contact_person || '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Phone size={14} /> PHONE NUMBER
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginTop: '0.25rem' }}>
              {dealer.phone || '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Mail size={14} /> EMAIL ADDRESS
            </div>
            <div style={{ fontSize: '0.9375rem', marginTop: '0.25rem' }}>
              {dealer.email || '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <FileText size={14} /> GSTIN NUMBER
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.9375rem', marginTop: '0.25rem' }}>
              {dealer.gst_number || '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <CreditCard size={14} /> CREDIT LIMIT
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--brand-primary)', marginTop: '0.25rem' }}>
              ₹{(dealer.credit_limit || 0).toLocaleString()}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <MapPin size={14} /> LOCATION / ADDRESS
            </div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {[dealer.address, dealer.city, dealer.state, dealer.pincode].filter(Boolean).join(', ') || '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
