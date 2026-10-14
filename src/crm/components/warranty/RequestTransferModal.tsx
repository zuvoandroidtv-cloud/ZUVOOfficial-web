import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';
import { UserCheck, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface RequestTransferModalProps {
  warranty: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const RequestTransferModal: React.FC<RequestTransferModalProps> = ({
  warranty,
  onClose,
  onSuccess
}) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [toCustomerId, setToCustomerId] = useState('');
  const [reason, setReason] = useState('Resale / Gift / Change of Household');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, full_name, phone, customer_code')
          .eq('is_active', true)
          .order('full_name', { ascending: true });

        if (error) throw error;
        // Filter out current owner
        setCustomers((data || []).filter(c => c.id !== warranty.customer_id));
      } catch (err: any) {
        console.error('Error fetching customers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [warranty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toCustomerId) {
      setErrorMsg('Please select a destination customer.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      const { data, error } = await supabase.rpc('fn_request_warranty_transfer', {
        p_warranty_id: warranty.id,
        p_to_customer_id: toCustomerId,
        p_reason: reason,
        p_notes: notes,
        p_requested_by: currentUser?.id || null
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request warranty transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Transfer Warranty Ownership</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          {errorMsg && (
            <div className="bg-red-950/80 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700 space-y-1 text-slate-300">
            <div>
              <span className="text-slate-400">Warranty Card: </span>
              <span className="font-mono text-white">{warranty.warranty_number || warranty.warranty_card_number}</span>
            </div>
            <div>
              <span className="text-slate-400">Current Owner: </span>
              <span className="font-semibold text-white">{warranty.customers?.full_name || 'Current Customer'}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">New Owner (Destination Customer) *</label>
            {loading ? (
              <div className="text-slate-400 py-2">Loading customer database...</div>
            ) : (
              <select
                value={toCustomerId}
                onChange={(e) => setToCustomerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                required
              >
                <option value="">-- Select Destination Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.phone || c.customer_code})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Transfer Reason *</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Resale, Gift, Ownership transfer..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Notes / Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional transfer notes..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center space-x-1"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Submit Ownership Transfer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
