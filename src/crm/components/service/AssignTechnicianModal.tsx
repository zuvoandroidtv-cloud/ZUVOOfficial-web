import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';
import { User, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface AssignTechnicianModalProps {
  ticket: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignTechnicianModal: React.FC<AssignTechnicianModalProps> = ({
  ticket,
  onClose,
  onSuccess
}) => {
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [territoryEvaluation, setTerritoryEvaluation] = useState<any | null>(null);
  const [evaluatingTerritory, setEvaluatingTerritory] = useState(false);

  useEffect(() => {
    const fetchTechnicians = async () => {
      setLoading(true);
      try {
        // Query users with technician role or profiles in service_center_technicians
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone, employee_code, roles(name)')
          .order('full_name', { ascending: true });

        if (error) throw error;
        setTechnicians(data || []);
        if (ticket?.assigned_to) {
          setSelectedTechId(ticket.assigned_to);
        }
      } catch (err: any) {
        console.error('Error fetching technicians:', err);
        setErrorMsg('Failed to load technician profiles.');
      } finally {
        setLoading(false);
      }
    };
    fetchTechnicians();
  }, [ticket]);

  // Evaluate territory fit whenever selected technician changes
  useEffect(() => {
    if (!selectedTechId || !ticket?.id) {
      setTerritoryEvaluation(null);
      return;
    }

    const checkTerritory = async () => {
      setEvaluatingTerritory(true);
      try {
        const { data, error } = await (supabase.rpc as any)('fn_evaluate_service_ticket_territory', {
          p_ticket_id: ticket.id,
          p_technician_id: selectedTechId
        });
        if (!error && data) {
          setTerritoryEvaluation(data);
        }
      } catch (e) {
        console.warn('Territory evaluation skipped:', e);
      } finally {
        setEvaluatingTerritory(false);
      }
    };

    checkTerritory();
  }, [selectedTechId, ticket?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId) {
      setErrorMsg('Please select a technician.');
      return;
    }

    // Check if BLOCK policy applies
    if (territoryEvaluation && territoryEvaluation.allowed === false && territoryEvaluation.policy === 'BLOCK') {
      setErrorMsg(`Dispatch Blocked: ${territoryEvaluation.message}`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      const { data, error } = await supabase.rpc('fn_assign_technician_to_ticket', {
        p_ticket_id: ticket.id,
        p_technician_id: selectedTechId,
        p_assigned_by: currentUser?.id || null
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign technician.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <User className="w-4 h-4 text-blue-400" />
            <span>Assign Technician - Ticket #{ticket?.ticket_number}</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {errorMsg && (
            <div className="bg-red-950/80 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Select Field Technician</label>
            {loading ? (
              <div className="text-slate-400 py-2">Loading technicians...</div>
            ) : (
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                required
              >
                <option value="">-- Choose Field Technician --</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.full_name || 'Technician'} ({tech.employee_code || 'EMP'}) - {tech.phone || 'No Phone'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Phase 7.9: Territory Optimization Signal */}
          {evaluatingTerritory && (
            <div className="text-slate-400 py-1 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Checking service territory optimization...</span>
            </div>
          )}

          {territoryEvaluation && !evaluatingTerritory && (
            <div
              className={`p-3 rounded-lg border flex flex-col space-y-1.5 ${
                territoryEvaluation.in_territory
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : territoryEvaluation.policy === 'BLOCK'
                  ? 'bg-red-950/80 border-red-500/50 text-red-200'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center space-x-1.5">
                  {territoryEvaluation.in_territory ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    {territoryEvaluation.in_territory
                      ? `In-Territory Match: ${territoryEvaluation.territory_name}`
                      : `Out-of-Territory Dispatch (${territoryEvaluation.policy})`}
                  </span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 uppercase">
                  {territoryEvaluation.policy || 'ALLOW'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 leading-tight">
                {territoryEvaluation.message}
              </p>
            </div>
          )}

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
              <span>Assign Technician</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
