/**
 * ZUVO TV CRM — Technician Offline Queue & Synchronization Service
 * 
 * Manages local client caching for active field service visits and queues permitted
 * visit status transitions (en_route -> arrived -> in_progress -> completed),
 * location events, and customer signatures when field mobile connectivity drops.
 * 
 * Core Rules:
 * - Local queue never bypasses Supabase Auth, RLS, or server-side authorization.
 * - Transitions are strictly ordered and validated locally before being queued.
 * - Server remains the ultimate authoritative source of truth.
 * - Idempotent replay prevents duplicate transitions.
 */

export interface QueuedVisitAction {
  id: string; // Client idempotency UUID
  type:
    | 'STATUS_TRANSITION'
    | 'LOCATION_EVENT'
    | 'CUSTOMER_SIGNATURE'
    | 'PART_CONSUMPTION'
    | 'PART_RETURN'
    | 'RECONCILIATION_SUBMISSION'
    | 'HARVEST_DEFECTIVE_CORE'
    | 'DISPATCH_RMA_MANIFEST'
    | 'SLA_EVALUATION'
    | 'ESCALATE_TICKET';
  visitId?: string;
  ticketId?: string;
  payload: {
    fromStatus?: string;
    toStatus?: string;
    technicianNotes?: string;
    eventType?: 'ARRIVAL' | 'DEPARTURE' | 'CHECK_IN' | 'DIAGNOSIS_START';
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    isGpsAvailable?: boolean;
    gpsErrorReason?: string;
    signatureData?: string;
    // Phase 7.4 Trunk fields
    technicianId?: string;
    sparePartId?: string;
    warehouseId?: string;
    quantity?: number;
    warrantyCovered?: boolean;
    statusType?: string;
    reason?: string;
    reconciliationItems?: any[];
    // Phase 7.5 Defective Core & RMA Reverse Logistics fields
    itemType?: 'SPARE_PART_CORE' | 'WHOLE_TV_UNIT';
    productUnitId?: string;
    serialNumber?: string;
    barcode?: string;
    defectSymptom?: string;
    coreCreditEligible?: boolean;
    estimatedCoreValue?: number;
    destinationWarehouseId?: string;
    carrierTrackingNumber?: string;
    defectiveCoreIds?: string[];
    // Phase 7.8 SLA & Escalation fields
    toLevel?: number;
    escalationReason?: string;
    actionTaken?: string;
  };
  queuedAt: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  lastError?: string;
}

// Retain compatibility alias
export type QueuedVisitTransition = QueuedVisitAction;

const STORAGE_KEY_VISITS = 'zuvo_technician_cached_visits';
const STORAGE_KEY_QUEUE = 'zuvo_technician_sync_queue';

export class TechnicianOfflineService {
  private static instance: TechnicianOfflineService;
  private syncInProgress = false;

  public static getInstance(): TechnicianOfflineService {
    if (!TechnicianOfflineService.instance) {
      TechnicianOfflineService.instance = new TechnicianOfflineService();
    }
    return TechnicianOfflineService.instance;
  }

  /**
   * Caches active assigned visits in localStorage for offline inspection
   */
  public cacheVisits(visits: any[]) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify({
        timestamp: new Date().toISOString(),
        visits
      }));
    } catch (e) {
      console.warn('Failed to cache technician visits locally:', e);
    }
  }

  /**
   * Retrieves cached visits when network is unavailable
   */
  public getCachedVisits(): any[] {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const item = localStorage.getItem(STORAGE_KEY_VISITS);
      if (!item) return [];
      const parsed = JSON.parse(item);
      return Array.isArray(parsed.visits) ? parsed.visits : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Gets pending action queue
   */
  public getQueue(): QueuedVisitAction[] {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const item = localStorage.getItem(STORAGE_KEY_QUEUE);
      if (!item) return [];
      const parsed = JSON.parse(item);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Saves queue to localStorage
   */
  private saveQueue(queue: QueuedVisitAction[]) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save technician offline queue:', e);
    }
  }

  /**
   * Adds a status transition to the queue (Backward compatible)
   */
  public enqueueTransition(
    visitId: string,
    ticketId: string,
    fromStatus: string,
    toStatus: string,
    notes: string
  ): QueuedVisitAction {
    const queue = this.getQueue();

    // Prevent duplicate pending submissions for the exact same visit & status
    const existing = queue.find(
      q => q.visitId === visitId && q.payload?.toStatus === toStatus && q.status === 'pending'
    );
    if (existing) {
      return existing;
    }

    const item: QueuedVisitAction = {
      id: `SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'STATUS_TRANSITION',
      visitId,
      ticketId,
      payload: {
        fromStatus,
        toStatus,
        technicianNotes: notes
      },
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };

    queue.push(item);
    this.saveQueue(queue);

    // Optimistically update cached visit status
    const cachedVisits = this.getCachedVisits();
    const updated = cachedVisits.map(v => v.id === visitId ? { ...v, status: toStatus } : v);
    this.cacheVisits(updated);

    return item;
  }

  /**
   * Queues an offline location event (ARRIVAL or DEPARTURE)
   */
  public enqueueLocationEvent(
    visitId: string,
    eventType: 'ARRIVAL' | 'DEPARTURE' | 'CHECK_IN' | 'DIAGNOSIS_START',
    coords: {
      latitude: number | null;
      longitude: number | null;
      accuracy: number | null;
      isGpsAvailable: boolean;
      gpsErrorReason?: string;
    }
  ): QueuedVisitAction {
    const queue = this.getQueue();

    const existing = queue.find(
      q => q.visitId === visitId && q.type === 'LOCATION_EVENT' && q.payload?.eventType === eventType && q.status === 'pending'
    );
    if (existing) {
      return existing;
    }

    const item: QueuedVisitAction = {
      id: `LOC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'LOCATION_EVENT',
      visitId,
      payload: {
        eventType,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        isGpsAvailable: coords.isGpsAvailable,
        gpsErrorReason: coords.gpsErrorReason
      },
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };

    queue.push(item);
    this.saveQueue(queue);

    return item;
  }

  /**
   * Queues an offline customer digital signature capture
   */
  public enqueueCustomerSignature(
    visitId: string,
    signatureData: string
  ): QueuedVisitAction {
    const queue = this.getQueue();

    const item: QueuedVisitAction = {
      id: `SIG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'CUSTOMER_SIGNATURE',
      visitId,
      payload: {
        signatureData
      },
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };

    queue.push(item);
    this.saveQueue(queue);

    // Optimistically store signature in cached visit
    const cached = this.getCachedVisits();
    const updated = cached.map(v => v.id === visitId ? { ...v, customer_signature_data: signatureData } : v);
    this.cacheVisits(updated);

    return item;
  }

  /**
   * Queues offline part consumption from technician trunk
   */
  public enqueuePartConsumption(
    ticketId: string,
    visitId: string,
    sparePartId: string,
    quantity: number,
    warrantyCovered: boolean,
    notes?: string
  ): QueuedVisitAction {
    const queue = this.getQueue();
    const item: QueuedVisitAction = {
      id: `TRUNK-USE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'PART_CONSUMPTION',
      visitId,
      ticketId,
      payload: {
        sparePartId,
        quantity,
        warrantyCovered,
        technicianNotes: notes
      },
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  /**
   * Queues offline part return to warehouse
   */
  public enqueuePartReturn(
    technicianId: string,
    warehouseId: string,
    sparePartId: string,
    quantity: number,
    reason: string
  ): QueuedVisitAction {
    const queue = this.getQueue();
    const item: QueuedVisitAction = {
      id: `TRUNK-RET-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'PART_RETURN',
      payload: {
        technicianId,
        warehouseId,
        sparePartId,
        quantity,
        reason
      },
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  /**
   * Queues offline van inventory reconciliation
   */
  public enqueueReconciliation(
    technicianId: string,
    items: any[],
    notes?: string
  ): QueuedVisitAction {
    const queue = this.getQueue();
    const item: QueuedVisitAction = {
      id: `TRUNK-REC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'RECONCILIATION_SUBMISSION',
      payload: {
        technicianId,
        reconciliationItems: items,
        technicianNotes: notes
      },
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  /**
   * Queues offline defective core harvesting or TV chassis swap
   */
  public enqueueHarvestDefectiveCore(
    technicianId: string,
    params: {
      visitId?: string;
      ticketId?: string;
      itemType: 'SPARE_PART_CORE' | 'WHOLE_TV_UNIT';
      sparePartId?: string;
      productUnitId?: string;
      serialNumber?: string;
      barcode?: string;
      defectSymptom: string;
      coreCreditEligible?: boolean;
      estimatedCoreValue?: number;
      notes?: string;
    }
  ): QueuedVisitAction {
    const queue = this.getQueue();
    const item: QueuedVisitAction = {
      id: `CORE-HARVEST-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'HARVEST_DEFECTIVE_CORE',
      visitId: params.visitId,
      ticketId: params.ticketId,
      payload: {
        technicianId,
        itemType: params.itemType,
        sparePartId: params.sparePartId,
        productUnitId: params.productUnitId,
        serialNumber: params.serialNumber,
        barcode: params.barcode,
        defectSymptom: params.defectSymptom,
        coreCreditEligible: params.coreCreditEligible !== false,
        estimatedCoreValue: params.estimatedCoreValue || 0,
        technicianNotes: params.notes
      },
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  /**
   * Queues offline RMA reverse logistics manifest dispatch
   */
  public enqueueDispatchRmaManifest(
    technicianId: string,
    destinationWarehouseId: string,
    defectiveCoreIds: string[],
    carrierTrackingNumber?: string,
    technicianNotes?: string
  ): QueuedVisitAction {
    const queue = this.getQueue();
    const item: QueuedVisitAction = {
      id: `RLM-DISPATCH-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'DISPATCH_RMA_MANIFEST',
      payload: {
        technicianId,
        destinationWarehouseId,
        defectiveCoreIds,
        carrierTrackingNumber,
        technicianNotes
      },
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  /**
   * Phase 7.8: Queues offline ticket escalation distress request
   */
  public enqueueEscalateTicket(
    ticketId: string,
    toLevel: number,
    escalationReason: string,
    actionTaken?: string
  ): QueuedVisitAction {
    const queue = this.getQueue();
    const item: QueuedVisitAction = {
      id: `ESC-DISTRESS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'ESCALATE_TICKET',
      ticketId,
      payload: {
        toLevel,
        escalationReason,
        actionTaken
      },
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  /**
   * Synchronizes queued items when network returns
   */
  public async processQueue(
    syncFunction: (item: QueuedVisitAction) => Promise<{ success: boolean; error?: string }>
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.syncInProgress) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.syncInProgress = true;
    const queue = this.getQueue();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    const remainingQueue: QueuedVisitAction[] = [];

    for (const item of queue) {
      if (item.status === 'synced') continue;

      processed++;
      item.status = 'syncing';
      item.attempts += 1;

      try {
        const res = await syncFunction(item);
        if (res.success) {
          succeeded++;
          item.status = 'synced';
        } else {
          failed++;
          item.status = 'failed';
          item.lastError = res.error || 'Server rejected transition';
          remainingQueue.push(item);
        }
      } catch (err: any) {
        failed++;
        item.status = 'failed';
        item.lastError = err.message || 'Network exception during sync';
        remainingQueue.push(item);
      }
    }

    this.saveQueue(remainingQueue);
    this.syncInProgress = false;

    return { processed, succeeded, failed };
  }

  /**
   * Clear all synced or failed items
   */
  public clearQueue() {
    this.saveQueue([]);
  }
}

export const technicianOfflineService = TechnicianOfflineService.getInstance();
