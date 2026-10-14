/**
 * Phase 7.0 Test Suite: Technician Offline Queue, Caching & Reconnect Resiliency
 */

console.log('======================================================');
console.log('ZUVO TV CRM — TECHNICIAN OFFLINE & SYNC RESILIENCY');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

class MemoryLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// Standalone offline service harness using memory storage
class TechnicianOfflineServiceTestHarness {
  constructor(storage) {
    this.storage = storage;
    this.STORAGE_KEY_VISITS = 'zuvo_technician_cached_visits';
    this.STORAGE_KEY_QUEUE = 'zuvo_technician_sync_queue';
  }

  cacheVisits(visits) {
    this.storage.setItem(this.STORAGE_KEY_VISITS, JSON.stringify({
      timestamp: new Date().toISOString(),
      visits
    }));
  }

  getCachedVisits() {
    const item = this.storage.getItem(this.STORAGE_KEY_VISITS);
    if (!item) return [];
    return JSON.parse(item).visits || [];
  }

  getQueue() {
    const item = this.storage.getItem(this.STORAGE_KEY_QUEUE);
    if (!item) return [];
    return JSON.parse(item) || [];
  }

  enqueueTransition(visitId, ticketId, fromStatus, toStatus, notes) {
    const queue = this.getQueue();
    // Duplicate protection
    const existing = queue.find(q => q.visitId === visitId && q.toStatus === toStatus && q.status === 'pending');
    if (existing) return existing;

    const item = {
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
    this.storage.setItem(this.STORAGE_KEY_QUEUE, JSON.stringify(queue));

    // Optimistic cache update
    const cached = this.getCachedVisits();
    const updated = cached.map(v => v.id === visitId ? { ...v, status: toStatus } : v);
    this.cacheVisits(updated);

    return item;
  }

  async processQueue(syncFn) {
    const queue = this.getQueue();
    let succeeded = 0;
    let failed = 0;
    const remaining = [];

    for (const item of queue) {
      item.attempts += 1;
      const res = await syncFn(item);
      if (res.success) {
        succeeded++;
      } else {
        failed++;
        item.status = 'failed';
        remaining.push(item);
      }
    }
    this.storage.setItem(this.STORAGE_KEY_QUEUE, JSON.stringify(remaining));
    return { succeeded, failed };
  }
}

async function runTechnicianOfflineTests() {
  const storage = new MemoryLocalStorage();
  const service = new TechnicianOfflineServiceTestHarness(storage);

  // Test 1: Local visit caching
  console.log('[TEST 1: Local Visit Caching]');
  const mockVisits = [
    { id: 'VISIT-001', service_ticket_id: 'TKT-101', status: 'scheduled' },
    { id: 'VISIT-002', service_ticket_id: 'TKT-102', status: 'en_route' }
  ];
  service.cacheVisits(mockVisits);
  const retrieved = service.getCachedVisits();
  assert(retrieved.length === 2, '2 visits cached and retrieved successfully');
  assert(retrieved[0].id === 'VISIT-001', 'Visit 001 preserved in cache');

  // Test 2: Status transition queueing during offline network loss
  console.log('\n[TEST 2: Offline Status Transition Queueing]');
  const queued1 = service.enqueueTransition('VISIT-001', 'TKT-101', 'scheduled', 'arrived', 'Arrived at customer premises');
  assert(queued1.status === 'pending', 'Status update queued as pending');
  assert(service.getQueue().length === 1, 'Queue length is 1');
  const cacheAfterQueue = service.getCachedVisits();
  assert(cacheAfterQueue[0].status === 'arrived', 'Visit status optimistically updated to arrived in local cache');

  // Test 3: Duplicate transition rejection
  console.log('\n[TEST 3: Duplicate Transition Rejection]');
  const duplicateAttempt = service.enqueueTransition('VISIT-001', 'TKT-101', 'scheduled', 'arrived', 'Duplicate attempt');
  assert(duplicateAttempt.id === queued1.id, 'Duplicate transition returned existing queued item without duplicating');
  assert(service.getQueue().length === 1, 'Queue length remains 1 (no duplicate row)');

  // Test 4: Reconnect synchronization and queue purge
  console.log('\n[TEST 4: Reconnection Queue Processing]');
  const syncResults = await service.processQueue(async (item) => {
    // Simulated server RPC sync
    return { success: true };
  });
  assert(syncResults.succeeded === 1, 'Successfully processed 1 queued transition on reconnect');
  assert(syncResults.failed === 0, 'Zero failed items');
  assert(service.getQueue().length === 0, 'Queue successfully drained after synchronization');

  console.log(`\n======================================================`);
  console.log(`TECHNICIAN OFFLINE RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================`);

  if (failed > 0) process.exit(1);
}

runTechnicianOfflineTests().catch(err => {
  console.error('Unhandled technician offline test error:', err);
  process.exit(1);
});
