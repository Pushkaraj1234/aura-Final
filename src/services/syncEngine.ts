import { offlineStorage } from "./offlineStorage";
import { apiService } from "./apiService";

export type SyncState = "online" | "offline" | "syncing" | "error";

type Listener = (state: SyncState, queueCount: number) => void;

class SyncEngine {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private listeners: Set<Listener> = new Set();
  private simulatedOffline: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.isOnline = navigator.onLine;
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  private handleOnline = () => {
    if (this.simulatedOffline) return;
    this.isOnline = true;
    this.processQueue();
  };

  private handleOffline = () => {
    if (this.simulatedOffline) return;
    this.isOnline = false;
    this.notify();
  };

  public setSimulatedOffline(offline: boolean) {
    this.simulatedOffline = offline;
    this.isOnline = !offline && navigator.onLine;
    if (this.isOnline) {
      this.processQueue();
    } else {
      this.notify();
    }
  }

  public getIsOnline() {
    return this.isOnline;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private async notify() {
    try {
      const records = await offlineStorage.getPendingRecords();
      let state: SyncState = this.isOnline ? "online" : "offline";
      if (this.isSyncing) state = "syncing";
      else if (records.some(r => r.status === "failed")) state = "error";
      
      this.listeners.forEach(l => l(state, records.length));
    } catch (e) {
      // ignore
    }
  }

  async queueCheckIn(participantId: string, payload: any) {
    await offlineStorage.enqueueCheckIn(participantId, payload);
    this.notify();
    if (this.isOnline) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (!this.isOnline || this.isSyncing) return;
    
    const pending = await offlineStorage.getPendingRecords();
    if (pending.length === 0) {
      this.notify();
      return;
    }

    this.isSyncing = true;
    this.notify();

    for (const record of pending) {
      // Don't retry more than 5 times for now
      if (record.retryCount >= 5) continue;

      try {
        await offlineStorage.markStatus(record.id, "syncing");
        
        // Ensure idempotency ID is part of the payload
        const payload = record.decryptedPayload;
        payload.id = record.id; 

        // Send to API
        await apiService.checkIns.create(payload);

        // Success - remove from local queue
        await offlineStorage.removeRecord(record.id);

      } catch (err: any) {
        console.error("Sync failed for record", record.id, err);
        // Authentication or Bad Request errors should probably not be retried infinitely
        // but for now, we just mark failed and increment retry
        await offlineStorage.markStatus(record.id, "failed", err.message || "Unknown error");
      }
    }

    this.isSyncing = false;
    this.notify();
  }
}

export const syncEngine = new SyncEngine();
