import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Wrench,
  Search,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  User,
  Tv,
  Barcode,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  Navigation,
  CheckSquare,
  FileText,
  Package,
  Plus,
  Send,
  Camera,
  X,
  RefreshCw,
  Award,
  DollarSign,
  Wifi,
  WifiOff,
  PenTool,
  Printer,
  ChevronRight,
  Sliders,
  Check,
  Truck,
  RotateCcw,
  AlertOctagon,
  ClipboardCheck,
  History,
  CheckCheck,
  ArrowRightLeft
} from 'lucide-react';
import { BarcodeLookupModal } from '../components/common/BarcodeLookupModal';
import { technicianOfflineService, QueuedVisitAction } from '../lib/technicianOfflineService';
import { captureEventGeolocation } from '../lib/geolocationService';
import { SignaturePadGlass } from '../components/service/SignaturePadGlass';
import { ServiceCompletionSheetModal, ServiceCompletionSheetData } from '../components/service/ServiceCompletionSheetModal';

// 12-point structured diagnostic workflow steps
const STRUCTURED_DIAGNOSTIC_STEPS = [
  { id: 'visual_inspection', label: '1. Visual Cabinet / Frame Inspection' },
  { id: 'power_test', label: '2. Main Power Supply & Standby Test' },
  { id: 'display_check', label: '3. Display Panel / Backlight / T-Con Check' },
  { id: 'audio_check', label: '4. Speaker / Internal Audio DAC Check' },
  { id: 'connectivity_check', label: '5. Wi-Fi / Bluetooth / HDMI Input Check' },
  { id: 'software_check', label: '6. Android TV OS & Firmware Health Check' },
  { id: 'accessories_check', label: '7. Remote Control & Cables Verification' },
  { id: 'action_performed', label: '8. Technical Action / Calibration Completed' }
];

export const TechnicianPage: React.FC = () => {
  const { user, profile, currentRole } = useAuth();
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'in_progress' | 'completed' | 'trunk' | 'all'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected visit for detail/actions
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);

  // Modals state
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showBarcodeLookup, setShowBarcodeLookup] = useState(false);
  const [showCompletionSheet, setShowCompletionSheet] = useState(false);
  const [completionSheetData, setCompletionSheetData] = useState<ServiceCompletionSheetData | null>(null);

  // Phase 7.4: Trunk Stock & Reconciliation state
  const [trunkInventory, setTrunkInventory] = useState<any[]>([]);
  const [trunkMovements, setTrunkMovements] = useState<any[]>([]);
  const [loadingTrunk, setLoadingTrunk] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDamagedLostModal, setShowDamagedLostModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [selectedTrunkItem, setSelectedTrunkItem] = useState<any | null>(null);

  // Return & Damaged/Lost forms
  const [returnForm, setReturnForm] = useState({
    warehouseId: '',
    quantity: 1,
    reason: 'Unused part returned to main warehouse'
  });
  const [damagedLostForm, setDamagedLostForm] = useState({
    statusType: 'PART_DAMAGED' as 'PART_DAMAGED' | 'PART_LOST',
    quantity: 1,
    reason: ''
  });
  const [submittingTrunkAction, setSubmittingTrunkAction] = useState(false);

  // Reconciliation form state
  const [reconciliationCounts, setReconciliationCounts] = useState<Record<string, { count: number; reason: string }>>({});
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [submittingReconciliation, setSubmittingReconciliation] = useState(false);

  // Phase 7.5: Defective Cores & RMA Reverse Logistics state
  const [defectiveCores, setDefectiveCores] = useState<any[]>([]);
  const [loadingCores, setLoadingCores] = useState(false);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [showDispatchManifestModal, setShowDispatchManifestModal] = useState(false);
  const [selectedCoreIdsForManifest, setSelectedCoreIdsForManifest] = useState<string[]>([]);
  const [harvestForm, setHarvestForm] = useState({
    itemType: 'SPARE_PART_CORE' as 'SPARE_PART_CORE' | 'WHOLE_TV_UNIT',
    sparePartId: '',
    serialNumber: '',
    barcode: '',
    defectSymptom: '',
    coreCreditEligible: true,
    estimatedCoreValue: 0,
    technicianNotes: ''
  });
  const [manifestForm, setManifestForm] = useState({
    destinationWarehouseId: '',
    carrierTrackingNumber: '',
    technicianNotes: ''
  });
  const [submittingHarvest, setSubmittingHarvest] = useState(false);
  const [submittingManifest, setSubmittingManifest] = useState(false);

  // Form states
  const [diagnosisForm, setDiagnosisForm] = useState({
    faultCategory: 'Display / Panel',
    rootCause: '',
    findings: '',
    actionTaken: '',
    technicianNotes: ''
  });

  // Diagnostic Checklist State
  const [diagnosticChecklist, setDiagnosticChecklist] = useState<Record<string, 'passed' | 'failed' | 'pending'>>({
    visual_inspection: 'passed',
    power_test: 'passed',
    display_check: 'passed',
    audio_check: 'passed',
    connectivity_check: 'passed',
    software_check: 'passed',
    accessories_check: 'passed',
    action_performed: 'passed'
  });

  // Spare parts state
  const [sparePartsList, setSparePartsList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [partForm, setPartForm] = useState({
    sparePartId: '',
    warehouseId: '',
    quantity: 1,
    warrantyCovered: true
  });
  const [submittingPart, setSubmittingPart] = useState(false);

  // Customer signature data url state
  const [capturedSignature, setCapturedSignature] = useState<string | null>(null);
  const [submittingSignature, setSubmittingSignature] = useState(false);

  // OTP state
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Location tracking notification
  const [gpsStatusNotice, setGpsStatusNotice] = useState<string | null>(null);

  // General action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch technician visits
  const fetchVisits = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('service_visits')
        .select(`
          *,
          service_tickets!inner (
            id,
            ticket_number,
            service_type,
            priority,
            status,
            sla_status,
            escalation_level,
            sla_resolution_due_at,
            issue_category,
            issue_description,
            opened_at,
            customers!inner (
              id,
              customer_code,
              full_name,
              phone,
              address_line1,
              address_line2,
              city,
              state,
              postal_code
            ),
            product_units!inner (
              id,
              serial_number,
              barcode,
              status,
              product_variants!inner (
                product_name,
                product_code,
                tv_type,
                screen_size
              )
            ),
            warranties (
              id,
              warranty_card_number,
              start_date,
              end_date,
              status
            )
          ),
          technician_profile:profiles!service_visits_technician_id_fkey (
            id,
            full_name,
            phone,
            employee_code
          )
        `)
        .order('scheduled_at', { ascending: true });

      // Filter by technician if role is technician or not admin
      if (currentRole === 'technician' && user?.id) {
        query = query.eq('technician_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      const fetched = data || [];
      setVisits(fetched);
      technicianOfflineService.cacheVisits(fetched);
    } catch (err: any) {
      console.warn('Network issue fetching technician visits, attempting local cache fallback:', err);
      const cached = technicianOfflineService.getCachedVisits();
      if (cached.length > 0) {
        setVisits(cached);
        setErrorMsg('Operating in offline mode. Displaying locally cached visits.');
      } else {
        setErrorMsg(err.message || 'Failed to load technician visits.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sync pending offline queue when online
  useEffect(() => {
    const handleOnline = async () => {
      const queue = technicianOfflineService.getQueue();
      if (queue.length > 0) {
        setSuccessMsg(`Connection restored. Synchronizing ${queue.length} pending service update(s)...`);
        const { succeeded, failed } = await technicianOfflineService.processQueue(async (item: QueuedVisitAction) => {
          if (item.type === 'STATUS_TRANSITION') {
            const { error } = await supabase.rpc('fn_update_visit_status', {
              p_visit_id: item.visitId,
              p_new_status: item.payload?.toStatus,
              p_technician_notes: item.payload?.technicianNotes,
              p_updated_by: user?.id || null
            });
            return { success: !error, error: error?.message };
          } else if (item.type === 'LOCATION_EVENT') {
            const { error } = await supabase.rpc('fn_record_visit_location', {
              p_visit_id: item.visitId,
              p_event_type: item.payload?.eventType || 'ARRIVAL',
              p_latitude: item.payload?.latitude || null,
              p_longitude: item.payload?.longitude || null,
              p_accuracy: item.payload?.accuracy || null,
              p_is_gps_available: item.payload?.isGpsAvailable ?? true,
              p_gps_error_reason: item.payload?.gpsErrorReason || null
            });
            return { success: !error, error: error?.message };
          } else if (item.type === 'CUSTOMER_SIGNATURE') {
            const { error } = await supabase.rpc('fn_submit_visit_customer_signature', {
              p_visit_id: item.visitId,
              p_signature_data: item.payload?.signatureData || ''
            });
            return { success: !error, error: error?.message };
          } else if (item.type === 'PART_CONSUMPTION') {
            const { error } = await supabase.rpc('fn_consume_technician_trunk_part', {
              p_ticket_id: item.ticketId!,
              p_visit_id: item.visitId!,
              p_spare_part_id: item.payload?.sparePartId!,
              p_quantity: item.payload?.quantity || 1,
              p_warranty_covered: item.payload?.warrantyCovered ?? true,
              p_technician_notes: item.payload?.technicianNotes || 'Consumed via offline sync',
              p_idempotency_key: item.id
            });
            return { success: !error, error: error?.message };
          } else if (item.type === 'PART_RETURN') {
            const { error } = await supabase.rpc('fn_return_technician_part', {
              p_technician_id: item.payload?.technicianId || user?.id,
              p_warehouse_id: item.payload?.warehouseId!,
              p_spare_part_id: item.payload?.sparePartId!,
              p_quantity: item.payload?.quantity || 1,
              p_reason: item.payload?.reason || 'Returned via offline sync',
              p_idempotency_key: item.id
            });
            return { success: !error, error: error?.message };
          } else if (item.type === 'RECONCILIATION_SUBMISSION') {
            const { error } = await supabase.rpc('fn_submit_van_reconciliation', {
              p_technician_id: item.payload?.technicianId || user?.id,
              p_items: item.payload?.reconciliationItems || [],
              p_technician_notes: item.payload?.technicianNotes || 'Submitted via offline sync'
            });
            return { success: !error, error: error?.message };
          } else if (item.type === 'HARVEST_DEFECTIVE_CORE') {
            const { error } = await supabase.rpc('fn_harvest_defective_core', {
              p_technician_id: item.payload?.technicianId || user?.id,
              p_ticket_id: item.ticketId || null,
              p_visit_id: item.visitId || null,
              p_item_type: item.payload?.itemType || 'SPARE_PART_CORE',
              p_spare_part_id: item.payload?.sparePartId || null,
              p_product_unit_id: item.payload?.productUnitId || null,
              p_serial_number: item.payload?.serialNumber || null,
              p_barcode: item.payload?.barcode || null,
              p_defect_symptom: item.payload?.defectSymptom || 'Harvested via offline sync',
              p_core_credit_eligible: item.payload?.coreCreditEligible !== false,
              p_estimated_core_value: item.payload?.estimatedCoreValue || 0,
              p_notes: item.payload?.technicianNotes || null
            });
            return { success: !error, error: error?.message };
          } else if (item.type === 'DISPATCH_RMA_MANIFEST') {
            const { error } = await supabase.rpc('fn_create_rma_reverse_manifest', {
              p_technician_id: item.payload?.technicianId || user?.id,
              p_destination_warehouse_id: item.payload?.destinationWarehouseId!,
              p_defective_core_ids: item.payload?.defectiveCoreIds || [],
              p_carrier_tracking_number: item.payload?.carrierTrackingNumber || null,
              p_technician_notes: item.payload?.technicianNotes || null
            });
            return { success: !error, error: error?.message };
          }
          return { success: true };
        });

        if (succeeded > 0) {
          setSuccessMsg(`Successfully synchronized ${succeeded} offline update(s).`);
          fetchVisits();
          fetchTrunkInventory();
        }
        if (failed > 0) {
          setErrorMsg(`${failed} offline update(s) could not be synchronized.`);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

  // Phase 7.4: Fetch technician trunk inventory
  const fetchTrunkInventory = async () => {
    if (!user?.id) return;
    setLoadingTrunk(true);
    try {
      const { data, error } = await supabase
        .from('technician_trunk_inventory')
        .select(`
          id,
          technician_id,
          spare_part_id,
          quantity_on_hand,
          quantity_reserved,
          min_trunk_threshold,
          last_reconciled_at,
          updated_at,
          spare_parts (
            id,
            part_name,
            part_code,
            category,
            selling_price,
            standard_cost,
            is_active
          )
        `)
        .eq('technician_id', user.id);

      if (error) {
        console.warn('Could not query technician_trunk_inventory:', error.message);
        setTrunkInventory([]);
      } else {
        setTrunkInventory(data || []);
      }
    } catch (err: any) {
      console.warn('Error fetching trunk inventory:', err);
    } finally {
      setLoadingTrunk(false);
    }
  };

  // Phase 7.4: Fetch technician trunk movement ledger
  const fetchTrunkMovements = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('technician_trunk_movements')
        .select(`
          id,
          movement_type,
          quantity,
          balance_before,
          balance_after,
          reason,
          created_at,
          spare_parts (
            part_name,
            part_code
          ),
          warehouses (
            warehouse_name
          ),
          service_tickets (
            ticket_number
          )
        `)
        .eq('technician_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setTrunkMovements(data);
      }
    } catch (err) {
      console.warn('Error fetching trunk movements:', err);
    }
  };

  // Phase 7.5: Fetch defective cores held by technician
  const fetchDefectiveCores = async () => {
    if (!user?.id) return;
    setLoadingCores(true);
    try {
      const { data, error } = await supabase
        .from('technician_defective_cores')
        .select(`
          id,
          core_tag_number,
          technician_id,
          service_ticket_id,
          service_visit_id,
          item_type,
          spare_part_id,
          product_unit_id,
          serial_number,
          barcode,
          defect_symptom,
          core_credit_eligible,
          estimated_core_value,
          custody_status,
          reverse_manifest_id,
          harvested_at,
          spare_parts (
            part_name,
            part_code,
            category
          ),
          product_units (
            serial_number,
            barcode,
            product_variants (
              product_name,
              screen_size
            )
          ),
          service_tickets (
            ticket_number
          )
        `)
        .eq('technician_id', user.id)
        .order('harvested_at', { ascending: false });

      if (!error && data) {
        setDefectiveCores(data);
      }
    } catch (err) {
      console.warn('Error fetching technician defective cores:', err);
    } finally {
      setLoadingCores(false);
    }
  };

  // Fetch spare parts & warehouses for parts usage
  const fetchPartsDependencies = async () => {
    try {
      const [partsRes, whRes] = await Promise.all([
        supabase.from('spare_parts').select('id, part_name, part_code, selling_price, standard_cost').eq('is_active', true),
        supabase.from('warehouses').select('id, warehouse_name, warehouse_code').eq('is_active', true)
      ]);
      setSparePartsList(partsRes.data || []);
      setWarehousesList(whRes.data || []);
      if (whRes.data && whRes.data.length > 0) {
        setPartForm(prev => ({ ...prev, warehouseId: whRes.data[0].id }));
        setReturnForm(prev => ({ ...prev, warehouseId: whRes.data[0].id }));
        setManifestForm(prev => ({ ...prev, destinationWarehouseId: whRes.data[0].id }));
      }
    } catch (err) {
      console.error('Error fetching parts dependencies:', err);
    }
  };

  useEffect(() => {
    fetchVisits();
    fetchPartsDependencies();
    fetchTrunkInventory();
    fetchTrunkMovements();
    fetchDefectiveCores();
  }, [user, currentRole]);

  // Phase 7.3: Handle Arrival with Event-based GPS
  const handleMarkArrival = async (visitId: string) => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setGpsStatusNotice('Capturing arrival coordinates via device GPS...');

    // 1. Capture discrete event location
    const geo = await captureEventGeolocation();
    if (!geo.isAvailable) {
      setGpsStatusNotice(`Arrival GPS Note: ${geo.errorMessage} (Visit proceeding)`);
    } else {
      setGpsStatusNotice(`Arrival Location Captured: Lat ${geo.latitude?.toFixed(4)}, Lng ${geo.longitude?.toFixed(4)} (Acc: ±${Math.round(geo.accuracy || 0)}m)`);
    }

    // 2. Check offline state
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      // Queue location event
      technicianOfflineService.enqueueLocationEvent(visitId, 'ARRIVAL', {
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy,
        isGpsAvailable: geo.isAvailable,
        gpsErrorReason: geo.errorMessage
      });

      // Queue status transition
      technicianOfflineService.enqueueTransition(
        visitId,
        selectedVisit?.service_ticket_id || '',
        'en_route',
        'arrived',
        `Arrived on-site. GPS: ${geo.isAvailable ? 'captured' : 'unavailable'}`
      );

      setSuccessMsg('Arrival recorded & queued locally for synchronization.');
      setVisits(technicianOfflineService.getCachedVisits());
      if (selectedVisit && selectedVisit.id === visitId) {
        setSelectedVisit((prev: any) => ({ ...prev, status: 'arrived' }));
      }
      setActionLoading(false);
      return;
    }

    try {
      // Record location event in database
      await supabase.rpc('fn_record_visit_location', {
        p_visit_id: visitId,
        p_event_type: 'ARRIVAL',
        p_latitude: geo.latitude,
        p_longitude: geo.longitude,
        p_accuracy: geo.accuracy,
        p_is_gps_available: geo.isAvailable,
        p_gps_error_reason: geo.errorMessage || null
      });

      // Update visit status
      const { error } = await supabase.rpc('fn_update_visit_status', {
        p_visit_id: visitId,
        p_new_status: 'arrived',
        p_technician_notes: `Arrived on-site at customer location. GPS: ${geo.isAvailable ? 'captured' : 'unavailable'}`,
        p_latitude: geo.latitude,
        p_longitude: geo.longitude,
        p_updated_by: user?.id || null
      });

      if (error) throw error;

      setSuccessMsg('Arrival recorded and verified successfully!');
      fetchVisits();
      if (selectedVisit && selectedVisit.id === visitId) {
        setSelectedVisit((prev: any) => ({ ...prev, status: 'arrived' }));
      }
    } catch (err: any) {
      // If network dropped mid-call, fall back to offline queue
      technicianOfflineService.enqueueLocationEvent(visitId, 'ARRIVAL', {
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy,
        isGpsAvailable: geo.isAvailable,
        gpsErrorReason: geo.errorMessage
      });
      technicianOfflineService.enqueueTransition(
        visitId,
        selectedVisit?.service_ticket_id || '',
        'en_route',
        'arrived',
        'Offline arrival transition'
      );
      setSuccessMsg('Network drop detected. Arrival saved in local offline queue.');
      setVisits(technicianOfflineService.getCachedVisits());
    } finally {
      setActionLoading(false);
    }
  };

  // Status transitions
  const handleUpdateStatus = async (visitId: string, newStatus: string, notes?: string) => {
    if (newStatus === 'arrived') {
      return handleMarkArrival(visitId);
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // If client is offline, queue transition locally
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      technicianOfflineService.enqueueTransition(
        visitId,
        selectedVisit?.service_ticket_id || '',
        selectedVisit?.status || '',
        newStatus,
        notes || 'Offline mobile status update'
      );
      setSuccessMsg(`Status queued offline: ${newStatus.replace('_', ' ').toUpperCase()}. Will sync automatically upon reconnection.`);
      setVisits(technicianOfflineService.getCachedVisits());
      if (selectedVisit && selectedVisit.id === visitId) {
        setSelectedVisit((prev: any) => ({ ...prev, status: newStatus }));
      }
      setActionLoading(false);
      return;
    }

    try {
      const { error } = await supabase.rpc('fn_update_visit_status', {
        p_visit_id: visitId,
        p_new_status: newStatus,
        p_technician_notes: notes || 'Status updated via Mobile Technician Portal',
        p_updated_by: user?.id || null
      });

      if (error) {
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          technicianOfflineService.enqueueTransition(
            visitId,
            selectedVisit?.service_ticket_id || '',
            selectedVisit?.status || '',
            newStatus,
            notes || 'Offline mobile status update'
          );
          setSuccessMsg(`Network drop detected. Status queued locally: ${newStatus.replace('_', ' ').toUpperCase()}`);
          setVisits(technicianOfflineService.getCachedVisits());
          return;
        }
        throw error;
      }

      setSuccessMsg(`Visit status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
      fetchVisits();
      if (selectedVisit && selectedVisit.id === visitId) {
        setSelectedVisit((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update visit status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Diagnosis submission
  const handleSaveDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Combine checklist results with findings
    const passedChecklistCount = Object.values(diagnosticChecklist).filter(v => v === 'passed').length;
    const checklistSummary = `Checklist (${passedChecklistCount}/${STRUCTURED_DIAGNOSTIC_STEPS.length} items verified)`;

    try {
      const { error } = await supabase.from('service_diagnosis').insert({
        service_ticket_id: selectedVisit.service_ticket_id,
        diagnosis: `${diagnosisForm.faultCategory} [${checklistSummary}]: ${diagnosisForm.findings}`,
        fault_found: diagnosisForm.faultCategory,
        action_taken: diagnosisForm.actionTaken,
        technician_notes: diagnosisForm.technicianNotes,
        diagnosed_by: user?.id || null,
        diagnosed_at: new Date().toISOString()
      });

      if (error) throw error;

      setSuccessMsg('Service diagnostics and checklist recorded successfully.');
      setShowDiagnosisModal(false);
      fetchVisits();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save service diagnosis.');
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 7.4: Service Part Usage from Technician Trunk Stock
  const handleUsePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit || !partForm.sparePartId) {
      setErrorMsg('Please select a spare part to consume from your trunk.');
      return;
    }

    setSubmittingPart(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      technicianOfflineService.enqueuePartConsumption(
        selectedVisit.service_ticket_id,
        selectedVisit.id,
        partForm.sparePartId,
        Number(partForm.quantity),
        partForm.warrantyCovered,
        'Consumed from mobile trunk stock (offline)'
      );
      setSuccessMsg('Trunk part consumption queued locally. Stock will synchronize automatically.');
      setShowPartsModal(false);
      setPartForm(prev => ({ ...prev, sparePartId: '', quantity: 1 }));
      setSubmittingPart(false);
      return;
    }

    try {
      // 1. Try atomic Phase 7.4 trunk consumption RPC
      const { data: trunkConsumed, error: trunkErr } = await supabase.rpc('fn_consume_technician_trunk_part', {
        p_ticket_id: selectedVisit.service_ticket_id,
        p_visit_id: selectedVisit.id,
        p_spare_part_id: partForm.sparePartId,
        p_quantity: Number(partForm.quantity),
        p_warranty_covered: partForm.warrantyCovered,
        p_technician_notes: 'Part installed from technician van trunk during service',
        p_idempotency_key: `USE-${selectedVisit.id}-${partForm.sparePartId}-${Date.now()}`
      });

      if (trunkErr) {
        // Fallback to warehouse request RPC if trunk inventory row not yet seeded
        if (partForm.warehouseId && (trunkErr.message?.includes('Insufficient stock') || trunkErr.message?.includes('not found') || trunkErr.message?.includes('schema cache'))) {
          const { error: whErr } = await supabase.rpc('fn_request_service_part_usage', {
            p_ticket_id: selectedVisit.service_ticket_id,
            p_spare_part_id: partForm.sparePartId,
            p_warehouse_id: partForm.warehouseId,
            p_quantity: Number(partForm.quantity),
            p_warranty_covered: partForm.warrantyCovered,
            p_performed_by: user?.id || null
          });
          if (whErr) throw whErr;
        } else {
          throw trunkErr;
        }
      }

      setSuccessMsg('Spare part logged & trunk stock deducted successfully!');
      setShowPartsModal(false);
      setPartForm(prev => ({ ...prev, sparePartId: '', quantity: 1 }));
      fetchTrunkInventory();
      fetchTrunkMovements();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record spare part usage.');
    } finally {
      setSubmittingPart(false);
    }
  };

  // Phase 7.4: Return Part to Warehouse
  const handleReturnPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrunkItem || !returnForm.warehouseId) {
      setErrorMsg('Please select a destination warehouse.');
      return;
    }

    setSubmittingTrunkAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      technicianOfflineService.enqueuePartReturn(
        user?.id || '',
        returnForm.warehouseId,
        selectedTrunkItem.spare_part_id,
        Number(returnForm.quantity),
        returnForm.reason
      );
      setSuccessMsg('Part return queued locally. Will sync upon reconnection.');
      setShowReturnModal(false);
      setSubmittingTrunkAction(false);
      return;
    }

    try {
      const { error } = await supabase.rpc('fn_return_technician_part', {
        p_technician_id: user?.id || '',
        p_warehouse_id: returnForm.warehouseId,
        p_spare_part_id: selectedTrunkItem.spare_part_id,
        p_quantity: Number(returnForm.quantity),
        p_reason: returnForm.reason,
        p_idempotency_key: `RET-${user?.id}-${selectedTrunkItem.spare_part_id}-${Date.now()}`
      });

      if (error) throw error;

      setSuccessMsg('Part returned to warehouse successfully. Trunk stock updated.');
      setShowReturnModal(false);
      fetchTrunkInventory();
      fetchTrunkMovements();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to return spare part.');
    } finally {
      setSubmittingTrunkAction(false);
    }
  };

  // Phase 7.4: Report Damaged or Lost Part
  const handleRecordDamagedLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrunkItem) return;
    if (!damagedLostForm.reason || damagedLostForm.reason.trim().length < 5) {
      setErrorMsg('A detailed explanation (at least 5 characters) is required for damaged or lost parts.');
      return;
    }

    setSubmittingTrunkAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.rpc('fn_record_damaged_or_lost_part', {
        p_technician_id: user?.id || '',
        p_spare_part_id: selectedTrunkItem.spare_part_id,
        p_quantity: Number(damagedLostForm.quantity),
        p_status_type: damagedLostForm.statusType,
        p_reason: damagedLostForm.reason,
        p_idempotency_key: `DMG-${user?.id}-${selectedTrunkItem.spare_part_id}-${Date.now()}`
      });

      if (error) throw error;

      setSuccessMsg(`Reported ${damagedLostForm.statusType === 'PART_DAMAGED' ? 'damaged' : 'lost'} part. Movement logged in audit ledger.`);
      setShowDamagedLostModal(false);
      setDamagedLostForm({ statusType: 'PART_DAMAGED', quantity: 1, reason: '' });
      fetchTrunkInventory();
      fetchTrunkMovements();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record damaged/lost part.');
    } finally {
      setSubmittingTrunkAction(false);
    }
  };

  // Phase 7.4: Submit Van Inventory Reconciliation
  const handleSubmitReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trunkInventory.length === 0) {
      setErrorMsg('No items in trunk inventory to reconcile.');
      return;
    }

    setSubmittingReconciliation(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const itemsPayload = trunkInventory.map(item => {
      const state = reconciliationCounts[item.spare_part_id] || { count: item.quantity_on_hand, reason: '' };
      return {
        spare_part_id: item.spare_part_id,
        physical_count: Number(state.count),
        reason: state.reason || null
      };
    });

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      technicianOfflineService.enqueueReconciliation(
        user?.id || '',
        itemsPayload,
        reconciliationNotes
      );
      setSuccessMsg('Van inventory reconciliation queued locally. Will be submitted once back online.');
      setShowReconcileModal(false);
      setSubmittingReconciliation(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('fn_submit_van_reconciliation', {
        p_technician_id: user?.id || '',
        p_items: itemsPayload,
        p_technician_notes: reconciliationNotes || 'Field van physical count audit'
      });

      if (error) throw error;

      const rec = data as any;
      if (rec?.status === 'COMPLETED') {
        setSuccessMsg('Physical count matched perfectly! Van stock reconciliation completed automatically.');
      } else {
        setSuccessMsg(`Reconciliation submitted with discrepancies (${rec?.discrepancy_count || 'non-zero'} items). Sent for manager review.`);
      }

      setShowReconcileModal(false);
      setReconciliationNotes('');
      fetchTrunkInventory();
      fetchTrunkMovements();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit van reconciliation.');
    } finally {
      setSubmittingReconciliation(false);
    }
  };

  // Phase 7.5: Harvest Defective Part Core or Whole TV Swap
  const handleHarvestDefectiveCore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!harvestForm.defectSymptom || harvestForm.defectSymptom.trim().length < 3) {
      setErrorMsg('Please enter a valid defect symptom.');
      return;
    }

    if (harvestForm.itemType === 'SPARE_PART_CORE' && !harvestForm.sparePartId) {
      setErrorMsg('Please select the harvested spare part component.');
      return;
    }

    setSubmittingHarvest(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const unit = selectedVisit?.service_tickets?.product_units;

    if (isOffline) {
      technicianOfflineService.enqueueHarvestDefectiveCore(user?.id || '', {
        visitId: selectedVisit?.id,
        ticketId: selectedVisit?.service_ticket_id,
        itemType: harvestForm.itemType,
        sparePartId: harvestForm.itemType === 'SPARE_PART_CORE' ? harvestForm.sparePartId : undefined,
        productUnitId: harvestForm.itemType === 'WHOLE_TV_UNIT' ? unit?.id : undefined,
        serialNumber: harvestForm.serialNumber || unit?.serial_number,
        barcode: harvestForm.barcode || unit?.barcode,
        defectSymptom: harvestForm.defectSymptom,
        coreCreditEligible: harvestForm.coreCreditEligible,
        estimatedCoreValue: Number(harvestForm.estimatedCoreValue) || 0,
        notes: harvestForm.technicianNotes
      });
      setSuccessMsg('Defective core harvest queued locally. Chain-of-custody will synchronize once back online.');
      setShowHarvestModal(false);
      setSubmittingHarvest(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('fn_harvest_defective_core', {
        p_technician_id: user?.id || '',
        p_ticket_id: selectedVisit?.service_ticket_id || null,
        p_visit_id: selectedVisit?.id || null,
        p_item_type: harvestForm.itemType,
        p_spare_part_id: harvestForm.itemType === 'SPARE_PART_CORE' ? harvestForm.sparePartId : null,
        p_product_unit_id: harvestForm.itemType === 'WHOLE_TV_UNIT' ? unit?.id || null : null,
        p_serial_number: harvestForm.serialNumber || unit?.serial_number || null,
        p_barcode: harvestForm.barcode || unit?.barcode || null,
        p_defect_symptom: harvestForm.defectSymptom,
        p_core_credit_eligible: harvestForm.coreCreditEligible,
        p_estimated_core_value: Number(harvestForm.estimatedCoreValue) || 0,
        p_notes: harvestForm.technicianNotes || null
      });

      if (error) throw error;

      const tag = (data as any)?.core_tag_number || 'CORE';
      setSuccessMsg(`Defective core harvested successfully! Chain-of-custody tag generated: ${tag}`);
      setShowHarvestModal(false);
      setHarvestForm({
        itemType: 'SPARE_PART_CORE',
        sparePartId: '',
        serialNumber: '',
        barcode: '',
        defectSymptom: '',
        coreCreditEligible: true,
        estimatedCoreValue: 0,
        technicianNotes: ''
      });
      fetchDefectiveCores();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to harvest defective core.');
    } finally {
      setSubmittingHarvest(false);
    }
  };

  // Phase 7.5: Dispatch RMA Reverse Logistics Manifest
  const handleDispatchRmaManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCoreIdsForManifest.length === 0) {
      setErrorMsg('Please select at least one defective core to include in the RMA reverse manifest.');
      return;
    }

    if (!manifestForm.destinationWarehouseId) {
      setErrorMsg('Please choose the destination warehouse / quarantine facility.');
      return;
    }

    setSubmittingManifest(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      technicianOfflineService.enqueueDispatchRmaManifest(
        user?.id || '',
        manifestForm.destinationWarehouseId,
        selectedCoreIdsForManifest,
        manifestForm.carrierTrackingNumber,
        manifestForm.technicianNotes
      );
      setSuccessMsg('RMA Reverse Manifest queued locally. Will be transmitted to central depot once back online.');
      setShowDispatchManifestModal(false);
      setSelectedCoreIdsForManifest([]);
      setSubmittingManifest(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('fn_create_rma_reverse_manifest', {
        p_technician_id: user?.id || '',
        p_destination_warehouse_id: manifestForm.destinationWarehouseId,
        p_defective_core_ids: selectedCoreIdsForManifest,
        p_carrier_tracking_number: manifestForm.carrierTrackingNumber || null,
        p_technician_notes: manifestForm.technicianNotes || null
      });

      if (error) throw error;

      const manifestNo = (data as any)?.manifest_number || 'RLM';
      setSuccessMsg(`RMA Reverse Manifest created and dispatched: ${manifestNo} with ${selectedCoreIdsForManifest.length} item(s).`);
      setShowDispatchManifestModal(false);
      setSelectedCoreIdsForManifest([]);
      setManifestForm({
        destinationWarehouseId: warehousesList[0]?.id || '',
        carrierTrackingNumber: '',
        technicianNotes: ''
      });
      fetchDefectiveCores();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create RMA reverse manifest.');
    } finally {
      setSubmittingManifest(false);
    }
  };

  // Phase 7.3: Submit Digital Customer Signature
  const handleSaveSignature = async (signatureDataUrl: string) => {
    if (!selectedVisit) return;
    setSubmittingSignature(true);
    setErrorMsg(null);
    setCapturedSignature(signatureDataUrl);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      technicianOfflineService.enqueueCustomerSignature(selectedVisit.id, signatureDataUrl);
      setSuccessMsg('Customer signature captured & queued locally.');
      setShowSignOffModal(false);
      setSubmittingSignature(false);
      // Proceed to OTP confirmation
      handleRequestOtp();
      return;
    }

    try {
      const { error } = await supabase.rpc('fn_submit_visit_customer_signature', {
        p_visit_id: selectedVisit.id,
        p_signature_data: signatureDataUrl
      });

      if (error) throw error;

      setSuccessMsg('Customer signature recorded cleanly on glass!');
      setShowSignOffModal(false);
      // Automatically prompt OTP verification for two-factor sign-off
      handleRequestOtp();
    } catch (err: any) {
      // If error is network related, queue locally
      technicianOfflineService.enqueueCustomerSignature(selectedVisit.id, signatureDataUrl);
      setSuccessMsg('Signature stored in offline queue. Proceeding with OTP.');
      setShowSignOffModal(false);
      handleRequestOtp();
    } finally {
      setSubmittingSignature(false);
    }
  };

  // Generate OTP
  const handleRequestOtp = async () => {
    if (!selectedVisit) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc('fn_generate_visit_otp', {
        p_visit_id: selectedVisit.id
      });

      if (error) throw error;

      const resObj = data as any;
      setSimulatedOtp(resObj?.otp_simulated || '');
      setShowOtpModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate customer confirmation OTP.');
    } finally {
      setActionLoading(false);
    }
  };

  // Verify OTP and Complete Service Visit
  const handleVerifyOtpAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit || !enteredOtp) return;
    setVerifyingOtp(true);
    setErrorMsg(null);

    // Capture departure GPS event
    const depGeo = await captureEventGeolocation();

    try {
      // Record departure location if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await supabase.rpc('fn_record_visit_location', {
          p_visit_id: selectedVisit.id,
          p_event_type: 'DEPARTURE',
          p_latitude: depGeo.latitude,
          p_longitude: depGeo.longitude,
          p_accuracy: depGeo.accuracy,
          p_is_gps_available: depGeo.isAvailable,
          p_gps_error_reason: depGeo.errorMessage || null
        });
      } else {
        technicianOfflineService.enqueueLocationEvent(selectedVisit.id, 'DEPARTURE', {
          latitude: depGeo.latitude,
          longitude: depGeo.longitude,
          accuracy: depGeo.accuracy,
          isGpsAvailable: depGeo.isAvailable,
          gpsErrorReason: depGeo.errorMessage
        });
      }

      // Verify OTP & complete
      const { data, error } = await supabase.rpc('fn_verify_visit_otp_and_complete', {
        p_visit_id: selectedVisit.id,
        p_entered_otp: enteredOtp,
        p_technician_id: user?.id || null
      });

      if (error) throw error;

      const visitRes = data as any;
      if (visitRes && visitRes.status !== 'completed') {
        if (visitRes.otp_attempts >= 5) {
          throw new Error('Maximum verification attempts exceeded (5). Please generate a new OTP.');
        }
        throw new Error(`Customer confirmation failed. Invalid OTP. (Attempt ${visitRes.otp_attempts || 1}/5)`);
      }

      setSuccessMsg('Service completed & Customer sign-off verified successfully!');
      setShowOtpModal(false);
      setEnteredOtp('');

      // Build completion sheet document data
      const ticket = selectedVisit.service_tickets;
      const cust = ticket?.customers;
      const unit = ticket?.product_units;
      const variant = unit?.product_variants;
      const warranty = ticket?.warranties?.[0];

      setCompletionSheetData({
        jobTicketNumber: ticket?.ticket_number || 'JOB-UNKNOWN',
        visitDate: new Date().toLocaleDateString(),
        visitType: selectedVisit.visit_type || 'Field Service',
        technicianName: profile?.full_name || user?.email || 'Certified Field Technician',
        technicianCode: profile?.employee_code || 'ZUVO-TECH',
        customerName: cust?.full_name || 'Valued Customer',
        customerPhone: cust?.phone || '',
        customerAddress: `${cust?.address_line1 || ''}, ${cust?.city || ''} ${cust?.postal_code || ''}`,
        tvModel: variant?.product_name || 'ZUVO Android TV',
        screenSize: variant?.screen_size || '',
        serialNumber: unit?.serial_number || '',
        barcode: unit?.barcode || '',
        warrantyStatus: warranty && warranty.status === 'active' ? 'active' : 'expired',
        reportedIssue: ticket?.issue_description || 'Field service inspection',
        diagnosisSummary: {
          faultCategory: diagnosisForm.faultCategory,
          findings: diagnosisForm.findings || 'All display, audio & firmware subsystems tested',
          actionTaken: diagnosisForm.actionTaken || 'Service inspection completed & calibrated'
        },
        arrivalTime: selectedVisit.arrived_at ? new Date(selectedVisit.arrived_at).toLocaleTimeString() : new Date().toLocaleTimeString(),
        departureTime: new Date().toLocaleTimeString(),
        completionResult: 'repaired',
        customerSignatureUrl: capturedSignature || selectedVisit.customer_signature_data || undefined,
        customerConfirmedAt: new Date().toISOString()
      });

      setShowCompletionSheet(true);
      fetchVisits();
    } catch (err: any) {
      setErrorMsg(err.message || 'Customer confirmation failed. Invalid OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Open Completion Sheet for an already completed visit
  const handleOpenCompletedSheet = (visit: any) => {
    const ticket = visit.service_tickets;
    const cust = ticket?.customers;
    const unit = ticket?.product_units;
    const variant = unit?.product_variants;
    const warranty = ticket?.warranties?.[0];

    setCompletionSheetData({
      jobTicketNumber: ticket?.ticket_number || 'JOB-UNKNOWN',
      visitDate: new Date(visit.scheduled_at || visit.created_at).toLocaleDateString(),
      visitType: visit.visit_type || 'Field Service',
      technicianName: visit.technician_profile?.full_name || profile?.full_name || 'Field Technician',
      technicianCode: visit.technician_profile?.employee_code || 'ZUVO-TECH',
      customerName: cust?.full_name || 'Customer',
      customerPhone: cust?.phone || '',
      customerAddress: `${cust?.address_line1 || ''}, ${cust?.city || ''} ${cust?.postal_code || ''}`,
      tvModel: variant?.product_name || 'ZUVO Android TV',
      screenSize: variant?.screen_size || '',
      serialNumber: unit?.serial_number || '',
      barcode: unit?.barcode || '',
      warrantyStatus: warranty && warranty.status === 'active' ? 'active' : 'expired',
      reportedIssue: ticket?.issue_description || 'General inspection',
      diagnosisSummary: {
        faultCategory: 'Display / System',
        findings: 'Technical field diagnostics verified',
        actionTaken: 'Service repair completed cleanly'
      },
      arrivalTime: visit.arrived_at ? new Date(visit.arrived_at).toLocaleTimeString() : undefined,
      departureTime: visit.departed_at ? new Date(visit.departed_at).toLocaleTimeString() : undefined,
      completionResult: 'resolved',
      customerSignatureUrl: visit.customer_signature_data || undefined,
      customerConfirmedAt: visit.customer_confirmed_at || visit.completed_at
    });
    setShowCompletionSheet(true);
  };

  // Filter visits
  const filteredVisits = visits.filter(v => {
    if (activeTab === 'upcoming' && !['scheduled', 'assigned', 'en_route'].includes(v.status)) return false;
    if (activeTab === 'in_progress' && !['arrived', 'in_progress'].includes(v.status)) return false;
    if (activeTab === 'completed' && !['completed', 'closed'].includes(v.status)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const ticket = v.service_tickets;
      const cust = ticket?.customers;
      const unit = ticket?.product_units;

      const matchTicket = ticket?.ticket_number?.toLowerCase().includes(q);
      const matchCust = cust?.full_name?.toLowerCase().includes(q) || cust?.phone?.includes(q);
      const matchBarcode = unit?.barcode?.toLowerCase().includes(q);
      const matchSerial = unit?.serial_number?.toLowerCase().includes(q);

      return matchTicket || matchCust || matchBarcode || matchSerial;
    }

    return true;
  });

  // Statistics
  const upcomingCount = visits.filter(v => ['scheduled', 'assigned', 'en_route'].includes(v.status)).length;
  const inProgressCount = visits.filter(v => ['arrived', 'in_progress'].includes(v.status)).length;
  const completedCount = visits.filter(v => ['completed', 'closed'].includes(v.status)).length;

  return (
    <div className="technician-view">
      {/* Top Mobile Bar Header */}
      <div className="technician-header">
        <div className="technician-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', borderRadius: 'var(--radius-md)' }}>
              <Wrench size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Field Technician Portal</h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {profile?.full_name || user?.email || 'Technician'} • {currentRole?.toUpperCase()}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {typeof navigator !== 'undefined' && !navigator.onLine ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                <WifiOff size={14} /> Offline Mode
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                <Wifi size={14} /> Live Sync
              </span>
            )}
            <button
              onClick={() => setShowBarcodeLookup(true)}
              className="technician-btn-touch btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.875rem' }}
            >
              <Barcode size={16} />
              <span>Scan TV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="technician-content">
        {/* GPS Status Notice */}
        {gpsStatusNotice && (
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem', marginBottom: '0.75rem', fontSize: '0.775rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={16} />
              <span>{gpsStatusNotice}</span>
            </div>
            <button onClick={() => setGpsStatusNotice(null)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Notifications / Alerts */}
        {errorMsg && (
          <div className="technician-alert-box technician-alert-error">
            <AlertTriangle size={18} style={{ color: 'var(--accent-rose)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="btn-icon" style={{ color: 'var(--accent-rose)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="technician-alert-box technician-alert-success">
            <CheckCircle size={18} style={{ color: 'var(--accent-emerald)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="btn-icon" style={{ color: 'var(--accent-emerald)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stats Summary Tabs */}
        <div className="technician-tabs-grid">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`technician-tab-btn ${activeTab === 'upcoming' ? 'active-upcoming' : ''}`}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{upcomingCount}</div>
            <div style={{ fontSize: '0.75rem' }}>Upcoming</div>
          </button>

          <button
            onClick={() => setActiveTab('in_progress')}
            className={`technician-tab-btn ${activeTab === 'in_progress' ? 'active-in-progress' : ''}`}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{inProgressCount}</div>
            <div style={{ fontSize: '0.75rem' }}>In Progress</div>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`technician-tab-btn ${activeTab === 'completed' ? 'active-completed' : ''}`}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{completedCount}</div>
            <div style={{ fontSize: '0.75rem' }}>Completed</div>
          </button>

          <button
            onClick={() => setActiveTab('trunk')}
            className={`technician-tab-btn ${activeTab === 'trunk' ? 'active-in-progress' : ''}`}
            style={{
              borderColor: activeTab === 'trunk' ? 'var(--accent-cyan)' : 'var(--border-subtle)',
              background: activeTab === 'trunk' ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-glass)'
            }}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: activeTab === 'trunk' ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
              {trunkInventory.reduce((acc, item) => acc + (item.quantity_on_hand || 0), 0)}
            </div>
            <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
              <Truck size={12} />
              <span>Trunk Stock</span>
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="technician-search-bar">
          <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search barcode, serial, ticket # or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="technician-search-input"
          />
        </div>

        {/* Main Content: Field Visits vs My Trunk Stock */}
        {activeTab === 'trunk' ? (
          <div>
            {/* Trunk Top Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Truck size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <span>My Van Trunk Stock</span>
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Live physical inventory assigned to vehicle / field trunk.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowMovementsModal(true)}
                  className="technician-btn-touch btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                >
                  <History size={15} />
                  <span>Audit History</span>
                </button>

                <button
                  onClick={() => {
                    const counts: Record<string, { count: number; reason: string }> = {};
                    trunkInventory.forEach(item => {
                      counts[item.spare_part_id] = { count: item.quantity_on_hand, reason: '' };
                    });
                    setReconciliationCounts(counts);
                    setShowReconcileModal(true);
                  }}
                  className="technician-btn-touch btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                >
                  <ClipboardCheck size={15} />
                  <span>Reconcile Stock</span>
                </button>
              </div>
            </div>

            {loadingTrunk ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--accent-cyan)' }} />
                <p style={{ fontSize: '0.875rem' }}>Loading assigned trunk parts...</p>
              </div>
            ) : trunkInventory.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <Truck size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Trunk is empty</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                  No spare parts currently assigned to your vehicle trunk. Parts can be issued by inventory management or received from the central warehouse.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {trunkInventory
                  .filter(item => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    const part = item.spare_parts;
                    return (
                      part?.part_name?.toLowerCase().includes(q) ||
                      part?.part_code?.toLowerCase().includes(q) ||
                      part?.category?.toLowerCase().includes(q)
                    );
                  })
                  .map(item => {
                    const part = item.spare_parts;
                    const isLow = item.quantity_on_hand <= (item.min_trunk_threshold || 1);

                    return (
                      <div
                        key={item.id}
                        className="glass-card"
                        style={{
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          border: isLow ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                {part?.part_code || 'PART-CODE'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                {part?.category || 'Spare Part'}
                              </span>
                            </div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                              {part?.part_name || 'Component'}
                            </h3>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isLow ? 'var(--accent-amber)' : 'var(--accent-emerald)', lineHeight: 1 }}>
                              {item.quantity_on_hand}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Available
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <span>Reserved: </span>
                            <strong style={{ color: 'var(--text-secondary)' }}>{item.quantity_reserved || 0}</strong>
                            <span style={{ margin: '0 0.5rem' }}>•</span>
                            <span>Min Buffer: </span>
                            <strong style={{ color: 'var(--text-secondary)' }}>{item.min_trunk_threshold || 1}</strong>
                          </div>

                          <div>
                            <span>Last Reconciled: </span>
                            <strong style={{ color: 'var(--text-secondary)' }}>
                              {item.last_reconciled_at ? new Date(item.last_reconciled_at).toLocaleDateString() : 'Never'}
                            </strong>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          <button
                            onClick={() => {
                              setSelectedTrunkItem(item);
                              setReturnForm(prev => ({ ...prev, quantity: 1 }));
                              setShowReturnModal(true);
                            }}
                            className="technician-btn-touch btn-secondary"
                            style={{ flex: 1, minHeight: '38px', fontSize: '0.775rem' }}
                          >
                            <RotateCcw size={14} />
                            <span>Return to Warehouse</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedTrunkItem(item);
                              setDamagedLostForm({ statusType: 'PART_DAMAGED', quantity: 1, reason: '' });
                              setShowDamagedLostModal(true);
                            }}
                            className="technician-btn-touch btn-secondary"
                            style={{ flex: 1, minHeight: '38px', fontSize: '0.775rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--accent-rose)' }}
                          >
                            <AlertOctagon size={14} />
                            <span>Report Damaged / Lost</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* PHASE 7.5: DEFECTIVE CORES & RMA REVERSE LOGISTICS SECTION */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <ArrowRightLeft size={18} style={{ color: 'var(--accent-amber)' }} />
                    <span>Harvested Defective Cores & Swapped Chassis</span>
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                    Defective components and whole units in your custody awaiting return dispatch to depot.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      const pendingCores = defectiveCores.filter(c => c.custody_status === 'WITH_TECHNICIAN').map(c => c.id);
                      setSelectedCoreIdsForManifest(pendingCores);
                      setShowDispatchManifestModal(true);
                    }}
                    disabled={defectiveCores.filter(c => c.custody_status === 'WITH_TECHNICIAN').length === 0}
                    className="technician-btn-touch btn-primary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.45rem 0.85rem',
                      background: 'linear-gradient(135deg, #F59E0B, #D97706)'
                    }}
                  >
                    <Truck size={15} />
                    <span>Dispatch RMA Manifest ({defectiveCores.filter(c => c.custody_status === 'WITH_TECHNICIAN').length})</span>
                  </button>
                </div>
              </div>

              {loadingCores ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: 'var(--accent-amber)' }} />
                  <p style={{ fontSize: '0.8rem' }}>Loading defective cores...</p>
                </div>
              ) : defectiveCores.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <CheckCircle size={28} style={{ margin: '0 auto 0.5rem', color: 'var(--accent-emerald)', opacity: 0.7 }} />
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>No Defective Cores in Custody</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>All harvested boards and swapped TV units have been dispatched or settled.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {defectiveCores.map((core) => {
                    const isWithTech = core.custody_status === 'WITH_TECHNICIAN';
                    const isSelected = selectedCoreIdsForManifest.includes(core.id);

                    return (
                      <div
                        key={core.id}
                        className="glass-card"
                        style={{
                          padding: '0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: isWithTech ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)',
                          background: isWithTech ? 'rgba(245, 158, 11, 0.04)' : 'var(--bg-glass)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isWithTech && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCoreIdsForManifest(prev => [...prev, core.id]);
                                  } else {
                                    setSelectedCoreIdsForManifest(prev => prev.filter(id => id !== core.id));
                                  }
                                }}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            )}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                                  {core.core_tag_number}
                                </span>
                                <span style={{
                                  fontSize: '0.675rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '3px',
                                  background:
                                    core.custody_status === 'WITH_TECHNICIAN' ? 'rgba(245, 158, 11, 0.2)' :
                                    core.custody_status === 'DISPATCHED_TO_DEPOT' ? 'rgba(59, 130, 246, 0.2)' :
                                    core.custody_status === 'RECEIVED_AT_DEPOT' ? 'rgba(6, 182, 212, 0.2)' :
                                    core.custody_status === 'REFURB_APPROVED' ? 'rgba(16, 185, 129, 0.2)' :
                                    'rgba(239, 68, 68, 0.2)',
                                  color:
                                    core.custody_status === 'WITH_TECHNICIAN' ? 'var(--accent-amber)' :
                                    core.custody_status === 'DISPATCHED_TO_DEPOT' ? 'var(--accent-blue)' :
                                    core.custody_status === 'RECEIVED_AT_DEPOT' ? 'var(--accent-cyan)' :
                                    core.custody_status === 'REFURB_APPROVED' ? 'var(--accent-emerald)' :
                                    'var(--accent-rose)'
                                }}>
                                  {core.custody_status}
                                </span>
                                <span className="badge" style={{ fontSize: '0.675rem', background: 'rgba(255, 255, 255, 0.08)' }}>
                                  {core.item_type === 'WHOLE_TV_UNIT' ? 'Whole TV Swap' : 'Spare Part Core'}
                                </span>
                              </div>

                              <div style={{ marginTop: '0.3rem', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {core.item_type === 'WHOLE_TV_UNIT' ? (
                                  core.product_units?.product_variants?.product_name || 'ZUVO TV Unit'
                                ) : (
                                  core.spare_parts?.part_name || 'Harvested Component'
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <div>Harvested: {new Date(core.harvested_at).toLocaleDateString()}</div>
                            {core.service_tickets?.ticket_number && (
                              <div style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                                #{core.service_tickets.ticket_number}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', fontSize: '0.75rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Defect Symptom: </span>
                            <span style={{ color: 'var(--text-primary)' }}>{core.defect_symptom}</span>
                          </div>
                          {(core.serial_number || core.barcode) && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Serial/Barcode: </span>
                              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                {core.serial_number || core.barcode}
                              </span>
                            </div>
                          )}
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Core Credit: </span>
                            <span style={{ color: core.core_credit_eligible ? 'var(--accent-emerald)' : 'var(--text-muted)', fontWeight: 600 }}>
                              {core.core_credit_eligible ? `Eligible (Est. ₹${core.estimated_core_value || 0})` : 'Ineligible'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
        /* Visit Cards List */
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--accent-cyan)' }} />
              <p style={{ fontSize: '0.875rem' }}>Loading field visits...</p>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              <Wrench size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No field visits found</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>There are no visits matching your selected filter.</p>
            </div>
          ) : (
            filteredVisits.map((visit) => {
              const ticket = visit.service_tickets;
              const cust = ticket?.customers;
              const unit = ticket?.product_units;
              const variant = unit?.product_variants;
              const warranty = ticket?.warranties?.[0];

              const isWarrantyActive = warranty && warranty.status === 'active' && new Date(warranty.end_date) > new Date();

              return (
                <div
                  key={visit.id}
                  className={`technician-visit-card ${selectedVisit?.id === visit.id ? 'selected' : ''}`}
                >
                  {/* Visit Header */}
                  <div className="technician-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        #{ticket?.ticket_number}
                      </span>
                      <span
                        className={`badge ${
                          visit.status === 'completed'
                            ? 'badge-emerald'
                            : visit.status === 'in_progress' || visit.status === 'arrived'
                            ? 'badge-amber'
                            : 'badge-cyan'
                        }`}
                      >
                        {visit.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {ticket?.sla_status && (
                        <span
                          className={`badge ${
                            ticket.sla_status === 'BREACHED'
                              ? 'badge-rose'
                              : ticket.sla_status === 'WARNING_APPROACHING'
                              ? 'badge-amber'
                              : 'badge-cyan'
                          }`}
                          style={{ fontSize: '0.675rem' }}
                        >
                          SLA: {ticket.sla_status}
                        </span>
                      )}
                      {(ticket?.escalation_level || 0) > 0 && (
                        <span
                          className="badge badge-rose"
                          style={{ fontSize: '0.675rem', fontWeight: 700 }}
                        >
                          ESC LEVEL {ticket.escalation_level}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Clock size={14} />
                      <span>{new Date(visit.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="technician-card-body">
                    {/* Customer Info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '0.975rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0 }}>
                          <User size={16} style={{ color: 'var(--accent-blue)' }} />
                          <span>{cust?.full_name || 'Unknown Customer'}</span>
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          <MapPin size={14} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                          <span>
                            {cust?.address_line1}, {cust?.city} {cust?.postal_code}
                          </span>
                        </div>
                      </div>

                      {cust?.phone && (
                        <a
                          href={`tel:${cust.phone}`}
                          className="technician-btn-touch"
                          style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#34D399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '0.5rem 0.75rem',
                            minHeight: '44px',
                            minWidth: '44px',
                          }}
                        >
                          <Phone size={16} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Call</span>
                        </a>
                      )}
                    </div>

                    {/* TV & Warranty details */}
                    <div className="technician-unit-box">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          <Tv size={16} style={{ color: 'var(--accent-purple)' }} />
                          <span>{variant?.product_name || 'ZUVO TV Unit'}</span>
                        </div>

                        {isWarrantyActive ? (
                          <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                            <ShieldCheck size={12} />
                            <span>Warranty Active</span>
                          </span>
                        ) : (
                          <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>
                            <ShieldAlert size={12} />
                            <span>Warranty Expired</span>
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', paddingTop: '0.375rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Barcode: </span>
                          <span style={{ color: 'var(--text-primary)' }}>{unit?.barcode || 'N/A'}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Serial: </span>
                          <span style={{ color: 'var(--text-primary)' }}>{unit?.serial_number || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Issue Description */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Issue Description
                      </div>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-primary)', background: 'var(--bg-input)', padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', margin: 0, lineHeight: 1.4 }}>
                        {ticket?.issue_description || 'No description provided.'}
                      </p>
                    </div>

                    {/* Visit Actions Flow Buttons */}
                    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {visit.status === 'scheduled' && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(visit.id, 'en_route')}
                          className="technician-btn-touch btn-primary"
                          style={{ flex: 1, minWidth: '160px' }}
                        >
                          <Navigation size={16} />
                          <span>Start Visit (En Route)</span>
                        </button>
                      )}

                      {visit.status === 'en_route' && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleMarkArrival(visit.id)}
                          className="technician-btn-touch"
                          style={{ flex: 1, minWidth: '160px', background: 'var(--accent-amber)', color: '#000' }}
                        >
                          <MapPin size={16} />
                          <span>Arrived (Record GPS)</span>
                        </button>
                      )}

                      {(visit.status === 'arrived' || visit.status === 'assigned') && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(visit.id, 'in_progress')}
                          className="technician-btn-touch"
                          style={{ flex: 1, minWidth: '160px', background: 'var(--accent-purple)', color: '#fff' }}
                        >
                          <Play size={16} />
                          <span>Start Diagnostic Check</span>
                        </button>
                      )}

                      {visit.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedVisit(visit);
                              setShowDiagnosisModal(true);
                            }}
                            className="technician-btn-touch btn-secondary"
                            style={{ flex: '1 1 120px' }}
                          >
                            <FileText size={16} style={{ color: 'var(--accent-cyan)' }} />
                            <span>Diagnostics</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedVisit(visit);
                              setShowPartsModal(true);
                            }}
                            className="technician-btn-touch btn-secondary"
                            style={{ flex: '1 1 120px' }}
                          >
                            <Package size={16} style={{ color: 'var(--accent-amber)' }} />
                            <span>Request Parts</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedVisit(visit);
                              const u = visit.service_tickets?.product_units;
                              setHarvestForm({
                                itemType: 'SPARE_PART_CORE',
                                sparePartId: '',
                                serialNumber: u?.serial_number || '',
                                barcode: u?.barcode || '',
                                defectSymptom: visit.service_tickets?.issue_description || '',
                                coreCreditEligible: true,
                                estimatedCoreValue: 0,
                                technicianNotes: ''
                              });
                              setShowHarvestModal(true);
                            }}
                            className="technician-btn-touch btn-secondary"
                            style={{ flex: '1 1 140px', borderColor: 'rgba(245, 158, 11, 0.4)', color: 'var(--accent-amber)' }}
                          >
                            <ArrowRightLeft size={16} />
                            <span>Harvest Core / Swap</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedVisit(visit);
                              setShowSignOffModal(true);
                            }}
                            className="technician-btn-touch btn-primary"
                            style={{ flex: '2 1 180px', background: 'linear-gradient(135deg, #06B6D4, #10B981)' }}
                          >
                            <PenTool size={16} />
                            <span>Sign-Off & Complete</span>
                          </button>
                        </>
                      )}

                      {visit.status === 'completed' && (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', borderRadius: 'var(--radius-md)', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={16} />
                            <span>Visit Completed & Customer Confirmed</span>
                          </div>
                          <button
                            onClick={() => handleOpenCompletedSheet(visit)}
                            className="technician-btn-touch btn-secondary"
                            style={{ width: '100%', fontSize: '0.8rem', minHeight: '38px', borderColor: 'rgba(6, 182, 212, 0.4)' }}
                          >
                            <Printer size={16} style={{ color: 'var(--accent-cyan)' }} />
                            <span>View / Print Completion Document</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        )}
      </div>

      {/* DIAGNOSIS & REPAIR MODAL WITH STRUCTURED CHECKLIST */}
      {showDiagnosisModal && selectedVisit && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Structured Mobile Field Diagnostics</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowDiagnosisModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDiagnosis}>
              <div className="modal-body">
                {/* 12-Point Structured Checklist */}
                <div style={{ marginBottom: '1rem' }}>
                  <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                    Diagnostic Inspection Checklist
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {STRUCTURED_DIAGNOSTIC_STEPS.map(step => {
                      const state = diagnosticChecklist[step.id] || 'pending';
                      return (
                        <div
                          key={step.id}
                          className={`diagnostic-checklist-step ${state}`}
                          onClick={() => {
                            setDiagnosticChecklist(prev => ({
                              ...prev,
                              [step.id]: prev[step.id] === 'passed' ? 'failed' : 'passed'
                            }));
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <span>{step.label}</span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: state === 'passed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                              color: state === 'passed' ? '#34D399' : '#FDA4AF'
                            }}
                          >
                            {state === 'passed' ? '✓ OK' : '✕ Fault'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Fault Category</label>
                  <select
                    value={diagnosisForm.faultCategory}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, faultCategory: e.target.value })}
                    className="form-input"
                  >
                    <option value="Display / Panel">Display / Panel</option>
                    <option value="Power Supply">Power Supply Unit (PSU)</option>
                    <option value="Mainboard / Motherboard">Mainboard / Motherboard</option>
                    <option value="Audio / Speaker">Audio / Speaker</option>
                    <option value="Software / OS">Software / OS Firmware</option>
                    <option value="Remote / Connectivity">Remote / Connectivity</option>
                    <option value="Other">Other Fault</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Findings & Root Cause *</label>
                  <textarea
                    rows={2}
                    value={diagnosisForm.findings}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, findings: e.target.value })}
                    placeholder="Describe detailed technical findings..."
                    className="form-input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Repair Action Taken *</label>
                  <textarea
                    rows={2}
                    value={diagnosisForm.actionTaken}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, actionTaken: e.target.value })}
                    placeholder="Describe repair performed..."
                    className="form-input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Technician Notes</label>
                  <input
                    type="text"
                    value={diagnosisForm.technicianNotes}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, technicianNotes: e.target.value })}
                    placeholder="Additional service notes..."
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowDiagnosisModal(false)}
                  className="technician-btn-touch btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="technician-btn-touch btn-primary"
                >
                  <CheckCircle size={16} />
                  <span>Save Diagnostics</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SPARE PARTS USAGE MODAL */}
      {showPartsModal && selectedVisit && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={18} style={{ color: 'var(--accent-amber)' }} />
                <span>Spare Part Usage & Stock Request</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowPartsModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUsePart}>
              <div className="modal-body">
                <div className="input-group">
                  <label className="input-label">Select Spare Part from Trunk Stock *</label>
                  <select
                    value={partForm.sparePartId}
                    onChange={(e) => setPartForm({ ...partForm, sparePartId: e.target.value })}
                    className="form-input"
                    required
                  >
                    <option value="">-- Choose Spare Part --</option>
                    {trunkInventory.length > 0 ? (
                      trunkInventory.map((item) => (
                        <option key={item.spare_part_id} value={item.spare_part_id}>
                          {item.spare_parts?.part_name} ({item.spare_parts?.part_code}) — In Trunk: {item.quantity_on_hand}
                        </option>
                      ))
                    ) : (
                      sparePartsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.part_name} ({p.part_code})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {trunkInventory.length === 0 && (
                  <div className="input-group">
                    <label className="input-label">Source Warehouse (Trunk Stock Empty) *</label>
                    <select
                      value={partForm.warehouseId}
                      onChange={(e) => setPartForm({ ...partForm, warehouseId: e.target.value })}
                      className="form-input"
                    >
                      {warehousesList.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.warehouse_name} ({w.warehouse_code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="input-group">
                    <label className="input-label">Quantity to Install *</label>
                    <input
                      type="number"
                      min={1}
                      value={partForm.quantity}
                      onChange={(e) => setPartForm({ ...partForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Warranty Covered</label>
                    <select
                      value={partForm.warrantyCovered ? 'yes' : 'no'}
                      onChange={(e) => setPartForm({ ...partForm, warrantyCovered: e.target.value === 'yes' })}
                      className="form-input"
                    >
                      <option value="yes">Yes (Under Warranty)</option>
                      <option value="no">No (Customer Payable)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowPartsModal(false)}
                  className="technician-btn-touch btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPart}
                  className="technician-btn-touch btn-primary"
                  style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
                >
                  <Package size={16} />
                  <span>Install from Trunk Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIGITAL SIGNATURE MODAL (SIGN-OFF GLASS) */}
      {showSignOffModal && selectedVisit && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PenTool size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Customer Digital Sign-Off</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowSignOffModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                Please invite the customer to sign directly on the touchscreen to certify satisfactory TV inspection and service completion.
              </p>

              <SignaturePadGlass
                onCapture={handleSaveSignature}
                disabled={submittingSignature}
              />
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER CONFIRMATION OTP MODAL */}
      {showOtpModal && selectedVisit && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={18} style={{ color: 'var(--accent-emerald)' }} />
                <span>Customer Service Confirmation</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowOtpModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyOtpAndComplete}>
              <div className="modal-body">
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '0.875rem', borderRadius: 'var(--radius-md)', color: '#FCD34D', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={16} />
                    <span>Simulation / Test Mode Active</span>
                  </div>
                  <p style={{ margin: 0 }}>No SMS provider configured. Use test OTP code below:</p>
                  <div style={{ marginTop: '0.5rem', textAlign: 'center', background: 'var(--bg-main)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)', border: '1px solid var(--border-subtle)', letterSpacing: '0.2em' }}>
                    {simulatedOtp || '------'}
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Enter Customer 6-Digit OTP *</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="form-input"
                    style={{ textAlign: 'center', fontSize: '1.25rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.25em', padding: '0.75rem' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="technician-btn-touch btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="technician-btn-touch btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                >
                  <CheckCircle size={16} />
                  <span>Verify OTP & Finalize</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SERVICE COMPLETION SHEET DOCUMENT MODAL */}
      {showCompletionSheet && completionSheetData && (
        <ServiceCompletionSheetModal
          isOpen={showCompletionSheet}
          onClose={() => {
            setShowCompletionSheet(false);
            setSelectedVisit(null);
          }}
          data={completionSheetData}
        />
      )}

      {/* Barcode Lookup Modal */}
      {showBarcodeLookup && (
        <BarcodeLookupModal
          isOpen={showBarcodeLookup}
          onClose={() => setShowBarcodeLookup(false)}
        />
      )}

      {/* PHASE 7.4: RETURN PART MODAL */}
      {showReturnModal && selectedTrunkItem && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Return Spare Part to Warehouse</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowReturnModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReturnPart}>
              <div className="modal-body">
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selected Part:</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedTrunkItem.spare_parts?.part_name} ({selectedTrunkItem.spare_parts?.part_code})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', marginTop: '0.25rem' }}>
                    Current Trunk Balance: <strong>{selectedTrunkItem.quantity_on_hand}</strong>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Destination Warehouse *</label>
                  <select
                    value={returnForm.warehouseId}
                    onChange={(e) => setReturnForm({ ...returnForm, warehouseId: e.target.value })}
                    className="form-input"
                    required
                  >
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_name} ({w.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Return Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedTrunkItem.quantity_on_hand}
                    value={returnForm.quantity}
                    onChange={(e) => setReturnForm({ ...returnForm, quantity: Math.min(selectedTrunkItem.quantity_on_hand, Math.max(1, parseInt(e.target.value) || 1)) })}
                    className="form-input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Return Reason / Notes *</label>
                  <input
                    type="text"
                    value={returnForm.reason}
                    onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                    placeholder="e.g., Unused surplus returned to central depot"
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="technician-btn-touch btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTrunkAction}
                  className="technician-btn-touch btn-primary"
                  style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
                >
                  <RotateCcw size={16} />
                  <span>Confirm Return</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 7.4: REPORT DAMAGED OR LOST PART MODAL */}
      {showDamagedLostModal && selectedTrunkItem && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertOctagon size={18} style={{ color: 'var(--accent-rose)' }} />
                <span>Report Damaged or Lost Part</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowDamagedLostModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordDamagedLost}>
              <div className="modal-body">
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1rem', color: '#FDA4AF', fontSize: '0.8rem' }}>
                  <strong>Mandatory Audit Trail Notice:</strong> All damaged or lost part reports trigger an immutable ledger entry. A detailed justification reason is required.
                </div>

                <div className="input-group">
                  <label className="input-label">Report Status Type *</label>
                  <select
                    value={damagedLostForm.statusType}
                    onChange={(e) => setDamagedLostForm({ ...damagedLostForm, statusType: e.target.value as any })}
                    className="form-input"
                    required
                  >
                    <option value="PART_DAMAGED">Damaged (Defective / Transit / Installation Damage)</option>
                    <option value="PART_LOST">Lost (Missing from vehicle trunk count)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Quantity Affected *</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedTrunkItem.quantity_on_hand}
                    value={damagedLostForm.quantity}
                    onChange={(e) => setDamagedLostForm({ ...damagedLostForm, quantity: Math.min(selectedTrunkItem.quantity_on_hand, Math.max(1, parseInt(e.target.value) || 1)) })}
                    className="form-input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Detailed Reason & Description *</label>
                  <textarea
                    rows={3}
                    value={damagedLostForm.reason}
                    onChange={(e) => setDamagedLostForm({ ...damagedLostForm, reason: e.target.value })}
                    placeholder="Provide specific details (e.g., Cracked connector during transport / Physical drop)"
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowDamagedLostModal(false)}
                  className="technician-btn-touch btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTrunkAction}
                  className="technician-btn-touch btn-primary"
                  style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                >
                  <AlertOctagon size={16} />
                  <span>Submit Incident Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 7.4: VAN INVENTORY RECONCILIATION MODAL */}
      {showReconcileModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardCheck size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Van Inventory Physical Reconciliation</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowReconcileModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReconciliation}>
              <div className="modal-body">
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Perform physical count of all spare parts in your service vehicle. The system automatically computes variances and logs an auditable reconciliation.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
                  {trunkInventory.map((item) => {
                    const part = item.spare_parts;
                    const state = reconciliationCounts[item.spare_part_id] || { count: item.quantity_on_hand, reason: '' };
                    const variance = Number(state.count) - item.quantity_on_hand;

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: variance !== 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {part?.part_name}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {part?.part_code}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>System</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {item.quantity_on_hand}
                              </div>
                            </div>

                            <div style={{ width: '80px' }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Count</label>
                              <input
                                type="number"
                                min={0}
                                value={state.count}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setReconciliationCounts(prev => ({
                                    ...prev,
                                    [item.spare_part_id]: { ...state, count: val }
                                  }));
                                }}
                                className="form-input"
                                style={{ padding: '0.35rem 0.5rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: 700 }}
                                required
                              />
                            </div>

                            <div style={{ width: '70px', textAlign: 'right' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Variance</div>
                              <div style={{
                                fontSize: '0.95rem',
                                fontWeight: 800,
                                color: variance === 0 ? 'var(--accent-emerald)' : variance > 0 ? 'var(--accent-cyan)' : 'var(--accent-rose)'
                              }}>
                                {variance > 0 ? `+${variance}` : variance}
                              </div>
                            </div>
                          </div>
                        </div>

                        {variance !== 0 && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="Explanation for discrepancy (required for review)..."
                              value={state.reason}
                              onChange={(e) => {
                                setReconciliationCounts(prev => ({
                                  ...prev,
                                  [item.spare_part_id]: { ...state, reason: e.target.value }
                                }));
                              }}
                              className="form-input"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                              required
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="input-group">
                  <label className="input-label">General Reconciliation Notes</label>
                  <textarea
                    rows={2}
                    value={reconciliationNotes}
                    onChange={(e) => setReconciliationNotes(e.target.value)}
                    placeholder="Optional notes regarding vehicle condition, tools, or audit circumstances..."
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="technician-btn-touch btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReconciliation}
                  className="technician-btn-touch btn-primary"
                  style={{ background: 'linear-gradient(135deg, #06B6D4, #10B981)' }}
                >
                  <CheckCheck size={16} />
                  <span>Submit Physical Count</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 7.4: AUDIT HISTORY MODAL */}
      {showMovementsModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Trunk Inventory Custody & Audit Ledger</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowMovementsModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {trunkMovements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  No historical movements recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {trunkMovements.map((mov) => (
                    <div
                      key={mov.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.625rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        fontSize: '0.775rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.675rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '3px',
                            background:
                              mov.movement_type === 'STOCK_ISSUED' ? 'rgba(16, 185, 129, 0.15)' :
                              mov.movement_type === 'PART_CONSUMED' ? 'rgba(59, 130, 246, 0.15)' :
                              mov.movement_type === 'PART_RETURNED' ? 'rgba(6, 182, 212, 0.15)' :
                              mov.movement_type === 'PART_DAMAGED' || mov.movement_type === 'PART_LOST' ? 'rgba(239, 68, 68, 0.15)' :
                              'rgba(245, 158, 11, 0.15)',
                            color:
                              mov.movement_type === 'STOCK_ISSUED' ? 'var(--accent-emerald)' :
                              mov.movement_type === 'PART_CONSUMED' ? 'var(--accent-blue)' :
                              mov.movement_type === 'PART_RETURNED' ? 'var(--accent-cyan)' :
                              mov.movement_type === 'PART_DAMAGED' || mov.movement_type === 'PART_LOST' ? 'var(--accent-rose)' :
                              'var(--accent-amber)'
                          }}>
                            {mov.movement_type}
                          </span>
                          <strong style={{ color: 'var(--text-primary)' }}>{mov.spare_parts?.part_name}</strong>
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            ({mov.spare_parts?.part_code})
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem', fontSize: '0.725rem' }}>
                          {mov.reason}
                          {mov.service_tickets?.ticket_number && (
                            <span style={{ marginLeft: '0.5rem', color: 'var(--accent-cyan)' }}>
                              • Ticket: #{mov.service_tickets.ticket_number}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          Qty: {mov.quantity}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {mov.balance_before} → {mov.balance_after}
                        </div>
                        <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {new Date(mov.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowMovementsModal(false)}
                className="technician-btn-touch btn-secondary"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 7.5: HARVEST DEFECTIVE CORE / TV SWAP MODAL */}
      {showHarvestModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowRightLeft size={18} style={{ color: 'var(--accent-amber)' }} />
                <span>Defective Core Harvest & Unit Swap</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowHarvestModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleHarvestDefectiveCore}>
              <div className="modal-body">
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Harvesting records defective components or whole TV swaps into your field custody with an immutable chain-of-custody tag.
                </p>

                <div className="input-group">
                  <label className="input-label">Harvest Item Type *</label>
                  <select
                    className="form-input"
                    value={harvestForm.itemType}
                    onChange={(e) => setHarvestForm({ ...harvestForm, itemType: e.target.value as any })}
                  >
                    <option value="SPARE_PART_CORE">Spare Part Defective Board / Core (Motherboard, Power Board, T-Con)</option>
                    <option value="WHOLE_TV_UNIT">Whole TV Unit Swap (Chassis Replacement)</option>
                  </select>
                </div>

                {harvestForm.itemType === 'SPARE_PART_CORE' ? (
                  <div className="input-group">
                    <label className="input-label">Defective Spare Part Component *</label>
                    <select
                      className="form-input"
                      value={harvestForm.sparePartId}
                      onChange={(e) => setHarvestForm({ ...harvestForm, sparePartId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Spare Part --</option>
                      {sparePartsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.part_name} ({p.part_code})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-amber)' }}>
                      Whole TV Unit Swap Selected
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Unit: {selectedVisit?.service_tickets?.product_units?.serial_number || 'N/A'} (Barcode: {selectedVisit?.service_tickets?.product_units?.barcode || 'N/A'})
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="input-group">
                    <label className="input-label">Defective Unit Serial #</label>
                    <input
                      type="text"
                      className="form-input"
                      value={harvestForm.serialNumber}
                      onChange={(e) => setHarvestForm({ ...harvestForm, serialNumber: e.target.value })}
                      placeholder="e.g. SN-ZUV-2026-991"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Defective Unit Barcode</label>
                    <input
                      type="text"
                      className="form-input"
                      value={harvestForm.barcode}
                      onChange={(e) => setHarvestForm({ ...harvestForm, barcode: e.target.value })}
                      placeholder="e.g. 890123456789"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Observed Defect Symptom / Failure Mode *</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={harvestForm.defectSymptom}
                    onChange={(e) => setHarvestForm({ ...harvestForm, defectSymptom: e.target.value })}
                    placeholder="e.g. Blown backlight MOSFET, no display, audio normal"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="input-group">
                    <label className="input-label">Core Credit Eligible</label>
                    <select
                      className="form-input"
                      value={harvestForm.coreCreditEligible ? 'yes' : 'no'}
                      onChange={(e) => setHarvestForm({ ...harvestForm, coreCreditEligible: e.target.value === 'yes' })}
                    >
                      <option value="yes">Yes (Eligible for Refurb)</option>
                      <option value="no">No (Physical Damage / Scrap)</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Estimated Core Value (₹)</label>
                    <input
                      type="number"
                      min={0}
                      className="form-input"
                      value={harvestForm.estimatedCoreValue}
                      onChange={(e) => setHarvestForm({ ...harvestForm, estimatedCoreValue: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Technician Harvesting Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    value={harvestForm.technicianNotes}
                    onChange={(e) => setHarvestForm({ ...harvestForm, technicianNotes: e.target.value })}
                    placeholder="e.g. Extracted from customer home visit #VIS-1002"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowHarvestModal(false)}
                  className="technician-btn-touch btn-secondary"
                  disabled={submittingHarvest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingHarvest}
                  className="technician-btn-touch btn-primary"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                >
                  {submittingHarvest ? 'Harvesting...' : 'Confirm Defective Harvest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 7.5: DISPATCH RMA REVERSE LOGISTICS MANIFEST MODAL */}
      {showDispatchManifestModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Dispatch RMA Reverse Manifest</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowDispatchManifestModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDispatchRmaManifest}>
              <div className="modal-body">
                <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8rem' }}>
                  <strong>Selected Defective Cores for Dispatch:</strong> {selectedCoreIdsForManifest.length} item(s)
                </div>

                <div className="input-group">
                  <label className="input-label">Destination Central Depot / Quarantine Warehouse *</label>
                  <select
                    className="form-input"
                    value={manifestForm.destinationWarehouseId}
                    onChange={(e) => setManifestForm({ ...manifestForm, destinationWarehouseId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Warehouse --</option>
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_name} ({w.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Courier / Logistics Tracking Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={manifestForm.carrierTrackingNumber}
                    onChange={(e) => setManifestForm({ ...manifestForm, carrierTrackingNumber: e.target.value })}
                    placeholder="e.g. DELHIVERY-992144810 or VAN-RETURN-DIRECT"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Technician Dispatch Notes</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={manifestForm.technicianNotes}
                    onChange={(e) => setManifestForm({ ...manifestForm, technicianNotes: e.target.value })}
                    placeholder="e.g. Dispatched 2 motherboards & 1 chassis via regional courier"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowDispatchManifestModal(false)}
                  className="technician-btn-touch btn-secondary"
                  disabled={submittingManifest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManifest}
                  className="technician-btn-touch btn-primary"
                  style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
                >
                  {submittingManifest ? 'Dispatching...' : 'Dispatch RMA Manifest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
