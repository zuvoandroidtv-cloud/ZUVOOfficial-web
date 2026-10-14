import React from 'react';
import { AlertTriangle, Building2 } from 'lucide-react';

export const UnlinkedDealerAlert: React.FC = () => {
  return (
    <div
      className="card"
      style={{
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        margin: '2rem auto',
        maxWidth: '640px',
        borderColor: 'var(--accent-amber, #f59e0b)',
        background: 'rgba(245, 158, 11, 0.04)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          padding: '1rem',
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.12)',
          color: 'var(--accent-amber, #f59e0b)',
          marginBottom: '1.25rem',
        }}
      >
        <AlertTriangle size={36} />
      </div>

      <h2
        style={{
          fontSize: '1.35rem',
          fontWeight: 700,
          marginBottom: '0.625rem',
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        Dealer Profile Not Linked
      </h2>

      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.925rem',
          lineHeight: '1.6',
          maxWidth: '480px',
          margin: '0 auto 1.5rem',
        }}
      >
        Your user account has the authorized Dealer role, but has not yet been linked to a specific dealer outlet or business entity in the system.
      </p>

      <div
        style={{
          background: 'var(--bg-main)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '0.875rem 1.25rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <Building2 size={16} style={{ color: 'var(--accent-cyan)' }} />
        <span>Please contact your ZUVO System Administrator to associate your profile with your authorized dealership record.</span>
      </div>
    </div>
  );
};
