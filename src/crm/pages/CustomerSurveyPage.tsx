import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import {
  Tv,
  Star,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  ShieldCheck,
  PhoneCall,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface CustomerSurveyPageProps {
  token?: string | null;
  onExit?: () => void;
}

interface SurveyContext {
  valid: boolean;
  ticket_number?: string;
  service_type?: string;
  product_model?: string;
  service_date?: string;
  expires_at?: string;
  error?: string;
  submitted_at?: string;
  rating?: number;
}

export const CustomerSurveyPage: React.FC<CustomerSurveyPageProps> = ({ token: propToken, onExit }) => {
  const [token, setToken] = useState<string>('');
  const [surveyData, setSurveyData] = useState<SurveyContext | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [followupPreferred, setFollowupPreferred] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Extract token from prop or URL
  useEffect(() => {
    let resolvedToken = propToken;
    if (!resolvedToken && typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''
      );
      resolvedToken =
        searchParams.get('survey') ||
        searchParams.get('token') ||
        hashParams.get('survey') ||
        hashParams.get('token') ||
        '';
    }

    setToken(resolvedToken || '');
  }, [propToken]);

  // Load survey context by token
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const loadSurvey = async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase.rpc as any)('fn_get_survey_by_token', {
          p_raw_token: token.trim(),
        });

        if (error) {
          setSurveyData({ valid: false, error: error.message });
        } else if (data) {
          const res = data as any;
          setSurveyData(res);
          if (res.error === 'ALREADY_SUBMITTED') {
            setSubmitted(true);
          }
        }
      } catch (err: any) {
        setSurveyData({ valid: false, error: err.message || 'Failed to connect to survey system' });
      } finally {
        setLoading(false);
      }
    };

    loadSurvey();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      setSubmitError('Please select a star rating from 1 to 5 before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error } = await (supabase.rpc as any)('fn_submit_csat_feedback', {
        p_raw_token: token.trim(),
        p_rating: rating,
        p_feedback: feedback.trim() || null,
        p_followup_preferred: followupPreferred,
      });

      if (error) {
        setSubmitError(error.message);
      } else if (data) {
        const res = data as any;
        if (!res.success) {
          setSubmitError(res.message || res.error || 'Failed to submit feedback.');
        } else {
          setSubmitted(true);
        }
      }
    } catch (err: any) {
      setSubmitError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const ratingDescriptions: Record<number, { label: string; desc: string; color: string }> = {
    1: { label: 'Very Unsatisfied', desc: 'Major issues encountered during service', color: '#ef4444' },
    2: { label: 'Unsatisfied', desc: 'Service did not meet expectations', color: '#f97316' },
    3: { label: 'Neutral', desc: 'Average experience with minor room for improvement', color: '#eab308' },
    4: { label: 'Satisfied', desc: 'Good prompt service, issues resolved', color: '#3b82f6' },
    5: { label: 'Very Satisfied', desc: 'Exceptional service, fully delighted!', color: '#10b981' },
  };

  const activeRating = hoverRating || rating;

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #1e1b4b 0%, #09090b 100%)', color: '#f4f4f5', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
              <Tv size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.025em', color: '#fff' }}>ZUVO Television</div>
              <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Customer Care & Service Experience</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', padding: '0.35rem 0.75rem', borderRadius: 999 }}>
            <ShieldCheck size={14} color="#818cf8" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c7d2fe' }}>Verified Service Survey</span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ background: 'rgba(24,24,27,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '3rem 2rem', textAlign: 'center', backdropFilter: 'blur(12px)' }}>
            <div className="animate-spin" style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto 1.25rem' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#fff' }}>Verifying Survey Invitation...</h3>
            <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginTop: '0.5rem' }}>Please wait while we validate your secure service token.</p>
          </div>
        )}

        {/* Missing or Invalid Token State */}
        {!loading && (!token || (surveyData && surveyData.error === 'TOKEN_NOT_FOUND')) && (
          <div style={{ background: 'rgba(24,24,27,0.85)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#ef4444' }}>
              <AlertTriangle size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>Invalid or Expired Survey Link</h3>
            <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginTop: '0.5rem', lineHeight: 1.6 }}>
              The survey link you accessed is invalid or has already been used. Please check the SMS or WhatsApp message sent by ZUVO TV Customer Support.
            </p>
            {onExit && (
              <button
                onClick={onExit}
                style={{ marginTop: '1.5rem', background: '#27272a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.625rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Return to Home
              </button>
            )}
          </div>
        )}

        {/* Expired Token State */}
        {!loading && surveyData && surveyData.error === 'SURVEY_EXPIRED' && (
          <div style={{ background: 'rgba(24,24,27,0.85)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(234,179,8,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#eab308' }}>
              <Clock size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>Survey Link Has Expired</h3>
            <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginTop: '0.5rem', lineHeight: 1.6 }}>
              Feedback links are valid for 7 days following service completion. For any queries regarding your television or warranty, our support team is available 24/7.
            </p>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <a href="tel:18001239886" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#4f46e5', color: '#fff', padding: '0.625rem 1.25rem', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
                <PhoneCall size={16} /> Contact Support
              </a>
            </div>
          </div>
        )}

        {/* Already Submitted or Success Confirmation */}
        {!loading && submitted && (
          <div style={{ background: 'rgba(24,24,27,0.85)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16, padding: '3rem 2rem', textAlign: 'center', backdropFilter: 'blur(12px)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.3) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#10b981', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Thank You for Your Feedback!</h3>
            <p style={{ fontSize: '0.925rem', color: '#a1a1aa', marginTop: '0.5rem', lineHeight: 1.6 }}>
              Your rating and response have been successfully logged in our quality assurance system. We appreciate you taking the time to help us enhance the ZUVO TV ownership experience.
            </p>

            {surveyData?.ticket_number && (
              <div style={{ margin: '1.5rem auto', maxWidth: 360, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'left', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#71717a' }}>Service Ticket:</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>#{surveyData.ticket_number}</span>
                </div>
                {surveyData.product_model && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#71717a' }}>Product:</span>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{surveyData.product_model}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717a' }}>Status:</span>
                  <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> Feedback Recorded
                  </span>
                </div>
              </div>
            )}

            {onExit && (
              <button
                onClick={onExit}
                style={{ marginTop: '1rem', background: '#27272a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.625rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
              >
                Close Survey
              </button>
            )}
          </div>
        )}

        {/* Survey Form State */}
        {!loading && !submitted && surveyData && surveyData.valid && (
          <form onSubmit={handleSubmit} style={{ background: 'rgba(24,24,27,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem', backdropFilter: 'blur(16px)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            {/* Service Interaction Context Card (Minimal Privacy Compliant) */}
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a5b4fc', fontWeight: 700 }}>
                    Completed Service
                  </span>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: '0.2rem 0 0 0' }}>
                    {surveyData.product_model || 'ZUVO Smart TV'}
                  </h4>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Ticket Reference</span>
                  <div style={{ fontWeight: 700, color: '#e0e7ff', fontSize: '0.9rem' }}>
                    #{surveyData.ticket_number}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(99,102,241,0.15)', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Service Type: </span>
                  <strong style={{ textTransform: 'capitalize' }}>{surveyData.service_type || 'General Service'}</strong>
                </div>
                {surveyData.service_date && (
                  <div>
                    <span style={{ color: '#94a3b8' }}>Completion Date: </span>
                    <strong>{new Date(surveyData.service_date).toLocaleDateString()}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {submitError && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#fca5a5', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Rating Question */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '1.125rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                How would you rate your overall service experience?
              </label>
              <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: '0 0 1.25rem 0' }}>
                Select a star rating from 1 (Very Unsatisfied) to 5 (Very Satisfied)
              </p>

              {/* Star Rating Selector */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = activeRating >= starVal;
                  return (
                    <button
                      type="button"
                      key={starVal}
                      onClick={() => setRating(starVal)}
                      onMouseEnter={() => setHoverRating(starVal)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        transition: 'transform 0.15s ease',
                        transform: activeRating === starVal ? 'scale(1.2)' : 'scale(1)',
                      }}
                      title={`${starVal} Star`}
                    >
                      <Star
                        size={40}
                        fill={isFilled ? '#fbbf24' : 'transparent'}
                        color={isFilled ? '#fbbf24' : '#52525b'}
                        style={{ filter: isFilled ? 'drop-shadow(0 0 8px rgba(251,191,36,0.5))' : 'none', transition: 'all 0.2s ease' }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Rating Label */}
              {activeRating > 0 && (
                <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.06)', border: `1px solid ${ratingDescriptions[activeRating].color}40`, padding: '0.4rem 1rem', borderRadius: 999, transition: 'all 0.2s ease' }}>
                  <span style={{ fontWeight: 700, color: ratingDescriptions[activeRating].color, marginRight: '0.5rem' }}>
                    {activeRating} / 5 — {ratingDescriptions[activeRating].label}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
                    ({ratingDescriptions[activeRating].desc})
                  </span>
                </div>
              )}
            </div>

            {/* Detailed Feedback Textarea */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.5rem' }}>
                <MessageSquare size={16} color="#818cf8" />
                Additional Comments or Suggestions (Optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What went well? Any issues with technician punctuality, diagnosis, or television performance?"
                rows={4}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Follow-up Permission Checkbox */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '2rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={followupPreferred}
                  onChange={(e) => setFollowupPreferred(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: '#6366f1', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', color: '#d4d4d8', lineHeight: 1.5 }}>
                  <strong style={{ color: '#fff' }}>Request Specialist Callback:</strong> Check here if you experienced any unresolved concerns and would like our senior service management team to contact you.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || rating === 0}
              style={{
                width: '100%',
                background: rating > 0 ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : '#3f3f46',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '0.875rem',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: rating > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: rating > 0 ? '0 4px 14px rgba(79,70,229,0.4)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {submitting ? (
                <>
                  <div className="animate-spin" style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Submitting Feedback...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Submit Feedback
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#71717a' }}>
          <p>© {new Date().getFullYear()} ZUVO Television. All rights reserved. Customer satisfaction data is protected in accordance with ZUVO TV Privacy Standards.</p>
        </div>
      </div>
    </div>
  );
};
