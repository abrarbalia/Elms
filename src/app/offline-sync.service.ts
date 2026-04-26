import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import Dexie, { Table } from 'dexie';
import { firstValueFrom, Observable, BehaviorSubject } from 'rxjs';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'online' | 'offline' | 'syncing';

/** Serialized form entry — IndexedDB cannot store File objects directly in all cases,
 *  so we keep Blob (which IDB supports) + metadata. */
export interface SerializedFormEntry {
  key: string;
  value: string | Blob;
  fileName?: string;
  fileType?: string;
}

export interface OfflineRequest {
  id?: number;
  url: string;
  method: string;        // POST | PUT | DELETE
  body: any;             // plain object OR SerializedFormEntry[]
  headers: Record<string, string>;
  isFormData: boolean;
  retryCount: number;
  timestamp: number;
}

// ── Database ──────────────────────────────────────────────────────────────────

class ElmsDatabase extends Dexie {
  offline_requests!: Table<OfflineRequest, number>;
  cached_data!: Table<{ key: string; data: any; updatedAt: number }, string>;

  constructor() {
    super('ELMS_OfflineDB');
    this.version(2).stores({
      offline_requests: '++id, timestamp, url',
      cached_data: 'key'
    });
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {

  private db!: ElmsDatabase;
  private isBrowser: boolean;
  private isSyncing = false;

  /** Public reactive state that UI components can subscribe to */
  readonly status$ = new BehaviorSubject<SyncStatus>('online');
  readonly queueCount$ = new BehaviorSubject<number>(0);

  // Retry config
  private readonly MAX_RETRIES = 5;
  private readonly BASE_BACKOFF_MS = 1000;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.db = new ElmsDatabase();

      // Seed initial status & count
      this.refreshStatus();

      // Listen for network changes
      window.addEventListener('online', () => {
        console.log('[ELMS Sync] Network restored — starting sync.');
        this.status$.next('online');
        this.syncNow();
      });

      window.addEventListener('offline', () => {
        console.log('[ELMS Sync] Network lost — entering offline mode.');
        this.status$.next('offline');
      });

      // Initial sync attempt 3s after app boot
      setTimeout(() => this.syncNow(), 3000);
    }
  }

  // ── Public: Queue a request ────────────────────────────────────────────────

  async queueRequest(
    url: string,
    method: string,
    body: any,
    headers: Record<string, string>,
    isFormData: boolean
  ): Promise<void> {
    if (!this.isBrowser) return;

    const serializedBody = isFormData
      ? await this.serializeFormData(body as FormData)
      : body;

    const record: OfflineRequest = {
      url,
      method,
      body: serializedBody,
      headers,
      isFormData,
      retryCount: 0,
      timestamp: Date.now()
    };

    await this.db.offline_requests.add(record);
    await this.refreshCount();

    console.log(`[ELMS Sync] Queued offline request → ${method} ${url}`);
    this.showNotification('ELMS: Request Queued', `Your request has been saved and will sync when you reconnect.`);
  }

  // ── Public: Sync all queued requests ─────────────────────────────────────

  async syncNow(): Promise<void> {
    if (!this.isBrowser) return;
    if (!navigator.onLine) return;
    if (this.isSyncing) return;

    const pending = await this.db.offline_requests.orderBy('timestamp').toArray();
    if (pending.length === 0) {
      this.status$.next('online');
      return;
    }

    this.isSyncing = true;
    this.status$.next('syncing');
    console.log(`[ELMS Sync] Starting sync of ${pending.length} queued requests.`);

    for (const record of pending) {
      const success = await this.dispatchRequest(record);

      if (success) {
        await this.db.offline_requests.delete(record.id!);
        console.log(`[ELMS Sync] ✅ Synced and removed record id=${record.id}`);
      } else {
        const newRetryCount = (record.retryCount || 0) + 1;
        if (newRetryCount >= this.MAX_RETRIES) {
          console.error(`[ELMS Sync] ❌ Max retries reached for record id=${record.id} — dropping.`);
          await this.db.offline_requests.delete(record.id!);
        } else {
          await this.db.offline_requests.update(record.id!, { retryCount: newRetryCount });
          console.warn(`[ELMS Sync] ⚠️ Retry ${newRetryCount}/${this.MAX_RETRIES} queued for record id=${record.id}`);
        }
      }
    }

    this.isSyncing = false;
    await this.refreshCount();
    this.status$.next(navigator.onLine ? 'online' : 'offline');

    const remaining = await this.db.offline_requests.count();
    if (remaining === 0) {
      this.showNotification('ELMS: Sync Complete', 'All offline requests have been successfully sent.');
    }
  }

  // ── Public: Get pending count ──────────────────────────────────────────────

  async getPendingCount(): Promise<number> {
    if (!this.isBrowser || !this.db) return 0;
    return this.db.offline_requests.count();
  }

  // ── Public: Get failed log ─────────────────────────────────────────────────

  async getFailedLog(): Promise<OfflineRequest[]> {
    if (!this.isBrowser || !this.db) return [];
    return this.db.offline_requests
      .filter(r => r.retryCount > 0)
      .toArray();
  }

  // ── Public: Clear entire queue ─────────────────────────────────────────────

  async clearQueue(): Promise<void> {
    if (!this.isBrowser || !this.db) return;
    await this.db.offline_requests.clear();
    this.queueCount$.next(0);
  }

  // ── View Caching ───────────────────────────────────────────────────────────

  async saveToCache(key: string, data: any): Promise<void> {
    if (!this.isBrowser) return;
    await this.db.cached_data.put({ key, data, updatedAt: Date.now() });
  }

  async getFromCache<T = any>(key: string): Promise<T | null> {
    if (!this.isBrowser) return null;
    const record = await this.db.cached_data.get(key);
    return record ? (record.data as T) : null;
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private async dispatchRequest(record: OfflineRequest): Promise<boolean> {
    // Exponential backoff delay
    if (record.retryCount > 0) {
      const delay = this.BASE_BACKOFF_MS * Math.pow(2, record.retryCount - 1);
      await this.sleep(Math.min(delay, 30000));
    }

    try {
      const body = record.isFormData
        ? await this.deserializeFormData(record.body as SerializedFormEntry[])
        : record.body;

      const headers = new HttpHeaders(record.headers);

      await firstValueFrom(
        this.http.request(record.method, record.url, {
          body,
          headers: record.isFormData ? undefined : headers  // Let browser set FormData boundary
        })
      );
      return true;
    } catch (err: any) {
      // 4xx errors (validation errors, conflicts) are permanent failures — drop them
      if (err?.status >= 400 && err?.status < 500) {
        console.error(`[ELMS Sync] Permanent failure (${err.status}) for ${record.url} — dropping.`);
        return true; // Return true to trigger delete from queue
      }
      // 5xx or network errors → retry
      console.warn(`[ELMS Sync] Transient failure for ${record.url}: ${err.message}`);
      return false;
    }
  }

  private async serializeFormData(formData: FormData): Promise<SerializedFormEntry[]> {
    const entries: SerializedFormEntry[] = [];
    const promises: Promise<void>[] = [];

    formData.forEach((value, key) => {
      if (value instanceof File) {
        // Read file into Blob for IDB storage
        const p = new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            entries.push({
              key,
              value: new Blob([reader.result as ArrayBuffer], { type: value.type }),
              fileName: value.name,
              fileType: value.type
            });
            resolve();
          };
          reader.readAsArrayBuffer(value);
        });
        promises.push(p);
      } else {
        entries.push({ key, value: value as string });
      }
    });

    await Promise.all(promises);
    return entries;
  }

  private async deserializeFormData(entries: SerializedFormEntry[]): Promise<FormData> {
    const fd = new FormData();
    for (const entry of entries) {
      if (entry.fileName && entry.value instanceof Blob) {
        fd.append(entry.key, new File([entry.value], entry.fileName, { type: entry.fileType }));
      } else {
        fd.append(entry.key, entry.value as string);
      }
    }
    return fd;
  }

  private async refreshStatus() {
    if (!this.isBrowser) return;
    this.status$.next(navigator.onLine ? 'online' : 'offline');
    await this.refreshCount();
  }

  private async refreshCount() {
    if (!this.isBrowser || !this.db) return;
    const count = await this.db.offline_requests.count();
    this.queueCount$.next(count);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private showNotification(title: string, body: string) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
}
