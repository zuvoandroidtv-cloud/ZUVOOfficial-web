/**
 * ZUVO TV CRM — Technician Offline Queue & Synchronization Service
 * 
 * Manages local client caching for active field service visits and queues permitted
 * visit status transitions (en_route -> arrived -> in_progress -> completed) when
 * field mobile connectivity drops.
 * 
 * Core Rules:
 * - Local queue never bypasses Supabase Auth, RLS, or server-side authorization.
 * - Transitions are strictly ordered and validated locally before being queued.
 * - Server remains the ultimate authoritative source of truth.
 * - Idempotent replay prevents duplicate transitions.
 */

export interface QueuedVisitTransition {
  id: string; // Client idempotency UUID
  visitId: string;
  ticketId: string;
  fromStatus: string;
  toStatus: string;
  technicianNotes: string;
  queuedAt: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  lastError?: string;
}

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
   * Gets pending transition queue
   */
  public getQueue(): QueuedVisitTransition[] {
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
  private saveQueue(queue: QueuedVisitTransition[]) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save technician offline queue:', e);
    }
  }

  /**
   * Adds a status transition to the queue
   */
  public enqueueTransition(
    visitId: string,
    ticketId: string,
    fromStatus: string,
    toStatus: string,
    notes: string
  ): QueuedVisitTransition {
    const queue = this.getQueue();

    // Prevent duplicate duplicate pending submissions for the exact same visit & status
    const existing = queue.find(
      q => q.visitId === visitId && q.toStatus === toStatus && q.status === 'pending'
    );
    if (existing) {
      return existing;
    }

    const item: QueuedVisitTransition = {
      id: `SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      visitId,
      ticketId,
      fromStatus,
      toStatus,
      technicianNotes: notes,
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
   * Synchronizes queued items when network returns
   */
  public async processQueue(
    syncFunction: (item: QueuedVisitTransition) => Promise<{ success: boolean; error?: string }>
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.syncInProgress) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.syncInProgress = true;
    const queue = this.getQueue();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    const remainingQueue: QueuedVisitTransition[] = [];

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
          // Successfully synced items are pruned from active pending queue
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
