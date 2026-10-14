import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';
import { History, ShieldCheck, Clock, UserCheck, X, RefreshCw } from 'lucide-react';

interface WarrantyTimelineModalProps {
  warranty: any;
  onClose: () => void;
}

export const WarrantyTimelineModal: React.FC<WarrantyTimelineModalProps> = ({
  warranty,
  onClose
}) => {
  const [extensions, setExtensions] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true);
      try {
        const [extRes, trfRes] = await Promise.all([
          supabase.from('vw_warranty_extensions_summary').select('*').eq('warranty_id', warranty.id).order('requested_at', { ascending: false }),
          supabase.from('vw_warranty_transfers_summary').select('*').eq('warranty_id', warranty.id).order('requested_at', { ascending: false })
        ]);
        setExtensions(extRes.data || []);
        setTransfers(trfRes.data || []);
      } catch (err) {
        console.error('Error fetching warranty timeline:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [warranty]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <History className="w-4 h-4 text-purple-400" />
            <span>Warranty Lifecycle & History Timeline</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Original Registration Card */}
          <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-400 flex items-center space-x-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Original Warranty Registration</span>
              </span>
              <span className="text-slate-400">{new Date(warranty.registered_at || warranty.created_at).toLocaleDateString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1 border-t border-slate-800">
              <div><span className="text-slate-500">Start Date: </span>{new Date(warranty.warranty_start_date).toLocaleDateString()}</div>
              <div><span className="text-slate-500">End Date: </span>{new Date(warranty.warranty_end_date).toLocaleDateString()}</div>
              <div><span className="text-slate-500">Duration: </span>{warranty.warranty_period_months} Months</div>
              <div><span className="text-slate-500">Registration Method: </span>{warranty.registration_method}</div>
            </div>
          </div>

          {/* Timeline Events */}
          {loading ? (
            <div className="text-center py-6 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-1" />
              <span>Loading lifecycle timeline...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-300 border-b border-slate-700 pb-1">Warranty Extension History ({extensions.length})</h3>
              {extensions.length === 0 ? (
                <p className="text-slate-500 italic">No warranty extensions recorded.</p>
              ) : (
                extensions.map((ext) => (
                  <div key={ext.extension_id} className="bg-slate-900/60 border border-slate-700/80 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-blue-300 font-bold">{ext.extension_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        ext.approval_status === 'approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                        ext.approval_status === 'rejected' ? 'bg-rose-950 text-rose-300 border border-rose-700' :
                        'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}>
                        {ext.approval_status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      Extended by <span className="font-bold text-white">{ext.extension_days} days</span> ({ext.previous_end_date} &rarr; <span className="text-emerald-400 font-bold">{ext.new_end_date}</span>)
                    </div>
                    <div className="text-slate-400">Reason: {ext.extension_reason}</div>
                    <div className="text-slate-500 text-[11px] pt-1">
                      Requested: {new Date(ext.requested_at).toLocaleString()} by {ext.requested_by_name || 'System'}
                    </div>
                  </div>
                ))
              )}

              <h3 className="font-semibold text-slate-300 border-b border-slate-700 pb-1 pt-2">Ownership Transfer History ({transfers.length})</h3>
              {transfers.length === 0 ? (
                <p className="text-slate-500 italic">No ownership transfers recorded.</p>
              ) : (
                transfers.map((trf) => (
                  <div key={trf.transfer_id} className="bg-slate-900/60 border border-slate-700/80 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-emerald-300 font-bold">{trf.transfer_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        trf.transfer_status === 'approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                        trf.transfer_status === 'rejected' ? 'bg-rose-950 text-rose-300 border border-rose-700' :
                        'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}>
                        {trf.transfer_status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      From: <span className="font-bold text-white">{trf.from_customer_name}</span> &rarr; To: <span className="font-bold text-emerald-400">{trf.to_customer_name}</span>
                    </div>
                    <div className="text-slate-400">Reason: {trf.transfer_reason}</div>
                    <div className="text-slate-500 text-[11px] pt-1">
                      Requested: {new Date(trf.requested_at).toLocaleString()} by {trf.requested_by_name || 'Staff'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
