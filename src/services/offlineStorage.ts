const DB_NAME = "AuraOfflineDB";
const DB_VERSION = 1;
const QUEUE_STORE = "sync_queue";
const KEY_STORE = "crypto_keys";
const MASTER_KEY_ID = "master_sync_key";

export interface SyncRecord {
  id: string;
  participantId: string;
  encryptedPayload: ArrayBuffer;
  iv: Uint8Array;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  createdAt: string;
  error?: string;
}

class OfflineStorageEngine {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB not supported"));
        return;
      }
      
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(KEY_STORE)) {
          db.createObjectStore(KEY_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async getOrCreateEncryptionKey(): Promise<CryptoKey> {
    const db = await this.dbPromise;
    
    // Check if key exists
    const existingKey = await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, "readonly");
      const store = tx.objectStore(KEY_STORE);
      const req = store.get(MASTER_KEY_ID);
      req.onsuccess = () => resolve(req.result ? req.result.key : null);
      req.onerror = () => reject(req.error);
    });

    if (existingKey) {
      return existingKey;
    }

    // Generate new non-exportable AES-GCM key
    const newKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // non-exportable
      ["encrypt", "decrypt"]
    );

    // Save key to IDB
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, "readwrite");
      const store = tx.objectStore(KEY_STORE);
      const req = store.put({ id: MASTER_KEY_ID, key: newKey });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return newKey;
  }

  async enqueueCheckIn(participantId: string, payload: any): Promise<void> {
    const key = await this.getOrCreateEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Serialize and Encrypt
    const encoder = new TextEncoder();
    const dataToEncrypt = encoder.encode(JSON.stringify(payload));
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      dataToEncrypt
    );

    const record: SyncRecord = {
      id: payload.id, // Idempotency key must be in payload
      participantId,
      encryptedPayload: encryptedBuffer,
      iv,
      status: "pending",
      retryCount: 0,
      createdAt: new Date().toISOString()
    };

    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingRecords(): Promise<(SyncRecord & { decryptedPayload: any })[]> {
    const db = await this.dbPromise;
    const records = await new Promise<SyncRecord[]>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const key = await this.getOrCreateEncryptionKey();
    const pending = records.filter(r => r.status === "pending" || r.status === "failed");
    
    const results = [];
    for (const r of pending) {
      try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: r.iv },
          key,
          r.encryptedPayload
        );
        const decoder = new TextDecoder();
        const json = decoder.decode(decryptedBuffer);
        results.push({ ...r, decryptedPayload: JSON.parse(json) });
      } catch (e) {
        console.error("Failed to decrypt offline record", r.id, e);
      }
    }
    
    // Sort oldest first
    return results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async markStatus(id: string, status: "pending" | "syncing" | "failed", error?: string): Promise<void> {
    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.status = status;
          if (status === "failed") {
            record.retryCount = (record.retryCount || 0) + 1;
          }
          if (error) record.error = error;
          store.put(record);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async removeRecord(id: string): Promise<void> {
    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineStorage = new OfflineStorageEngine();
