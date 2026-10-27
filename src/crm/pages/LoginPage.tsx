import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  Tv,
  AlertCircle,
  CheckCircle,
  KeyRound,
  UserPlus,
  LogIn
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { session, signIn, signUp, bootstrapRootAdmin } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bootstrap state
  const [bootstrapEmail, setBootstrapEmail] = useState('');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = password.trim();

      // Direct Super Admin Login Handler
      if (cleanEmail === 'dravidd580@gmail.com' && cleanPass === 'dravid@1202') {
        const { error } = await signIn(cleanEmail, cleanPass);
        if (error) throw error;
        return;
      }

      if (isSignUp) {
        const { error } = await signUp(cleanEmail, password, fullName.trim() || undefined);
        if (error) throw error;
        setSuccessMsg('Account registered successfully! If email confirmation is enabled in your Supabase project, check your inbox to confirm before logging in.');
        setIsSignUp(false);
      } else {
        const { error } = await signIn(cleanEmail, password);
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootstrapEmail.trim()) return;

    if (!session) {
      setBootstrapResult({
        success: false,
        error: 'You must be signed in to invoke Root Admin Bootstrap. Please register and log in first.'
      });
      return;
    }

    setBootstrapping(true);
    setBootstrapResult(null);
    try {
      const res = await bootstrapRootAdmin(bootstrapEmail.trim());
      setBootstrapResult(res);
    } catch (err: any) {
      setBootstrapResult({ success: false, error: err.message });
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/zuvo-official-logo.png"
            alt="ZUVO Android TV"
            style={{
              height: '52px',
              maxWidth: '240px',
              objectFit: 'contain',
              margin: '0 auto 1rem',
              filter: 'drop-shadow(0 4px 16px rgba(20, 241, 196, 0.35))'
            }}
          />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#FFFFFF' }}>
            Enterprise Command Center
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
            Serialized TV Lifecycle, Warranty & Service Network
          </p>
        </div>

        {/* Login / Sign Up Card */}
        <div className="card" style={{ padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                justifyContent: 'center',
                background: !isSignUp ? 'var(--bg-card)' : 'transparent',
                boxShadow: !isSignUp ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontWeight: !isSignUp ? 600 : 500
              }}
              onClick={() => { setIsSignUp(false); setErrorMsg(null); }}
            >
              <LogIn size={16} /> Sign In
            </button>
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                justifyContent: 'center',
                background: isSignUp ? 'var(--bg-card)' : 'transparent',
                boxShadow: isSignUp ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontWeight: isSignUp ? 600 : 500
              }}
              onClick={() => { setIsSignUp(true); setErrorMsg(null); }}
            >
              <UserPlus size={16} /> Register
            </button>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem', color: 'var(--status-danger)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--status-success)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem', color: 'var(--status-success)' }}>
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <div>{successMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Vikram Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  className="input-field"
                  placeholder="name@zuvotv.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  className="input-field"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
              disabled={loading}
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Staff Account' : 'Sign In to CRM'}
            </button>
          </form>
        </div>

        {/* Phase 4.1 Root Admin Onboarding Bootstrap Card */}
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <KeyRound size={16} style={{ color: 'var(--brand-accent)' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Phase 4.1 Root Admin Bootstrap
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
            Promotes an authenticated user to <strong>super_admin</strong> when 0 super admins exist in the database.
          </p>

          <form onSubmit={handleBootstrap} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="email"
              required
              className="input-field"
              placeholder="admin@zuvotv.com"
              value={bootstrapEmail}
              onChange={(e) => setBootstrapEmail(e.target.value)}
              style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              style={{ whiteSpace: 'nowrap' }}
              disabled={bootstrapping}
            >
              {bootstrapping ? 'Bootstrapping...' : 'Bootstrap'}
            </button>
          </form>

          {bootstrapResult && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: bootstrapResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: bootstrapResult.success ? 'var(--status-success)' : 'var(--status-danger)' }}>
              {bootstrapResult.success ? (
                <>Bootstrap successful: User promoted to super_admin.</>
              ) : (
                <>Bootstrap result: {bootstrapResult.error || JSON.stringify(bootstrapResult)}</>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
