import React, { useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Calendar, Clock, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface RequestExtensionModalProps {
  warranty: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const RequestExtensionModal: React.FC<RequestExtensionModalProps> = ({
  warranty,
  onClose,
  onSuccess
}) => {
  const [extensionDays, setExtensionDays] = useState(90);
  const [reason, setReason] = useState('Customer Goodwill / Extended Service Pack');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const prevEndDate = new Date(warranty.warranty_end_date);
  const proposedEndDate = new Date(prevEndDate.getTime() + extensionDays * 24 * 60 * 60 * 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (extensionDays <= 0) {
      setErrorMsg('Extension days must be greater than zero.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      const { data, error } = await supabase.rpc('fn_request_warranty_extension', {
        p_warranty_id: warranty.id,
        p_extension_days: Number(extensionDays),
        p_reason: reason,
        p_notes: notes,
        p_requested_by: currentUser?.id || null
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request warranty extension.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Extend Warranty - Card #{warranty.warranty_number || warranty.warranty_card_number}</span>
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

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700 space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Current End Date:</span>
              <span className="font-semibold text-slate-200">{new Date(warranty.warranty_end_date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-emerald-400 font-semibold pt-1 border-t border-slate-800">
              <span>Proposed New End Date:</span>
              <span>{proposedEndDate.toLocaleDateString()}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Extension Duration (Days)</label>
            <select
              value={extensionDays}
              onChange={(e) => setExtensionDays(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
            >
              <option value={30}>30 Days (+1 Month)</option>
              <option value={90}>90 Days (+3 Months)</option>
              <option value={180}>180 Days (+6 Months)</option>
              <option value={365}>365 Days (+1 Year)</option>
              <option value={730}>730 Days (+2 Years)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Extension Reason *</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Service delay compensation, Extended Care Pack..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Notes / Justification</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional internal notes..."
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center space-x-1"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Submit Extension</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
