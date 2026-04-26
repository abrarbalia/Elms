import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { OfflineSyncService, SyncStatus } from './offline-sync.service';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="offline-badge" [class]="badgeClass" [class.hidden]="status === 'online' && queueCount === 0">
      <span class="pulse-dot" [class]="dotClass"></span>
      <span class="badge-label">{{ label }}</span>

      @if (queueCount > 0) {
        <span class="queue-pill">{{ queueCount }}</span>
      }

      @if (status === 'offline' || (status === 'online' && queueCount > 0)) {
        <button class="sync-btn" (click)="triggerSync()" [disabled]="isSyncing">
          <i class="bi bi-arrow-repeat" [class.spin]="isSyncing"></i>
        </button>
      }
    </div>
  `,
  styles: [`
    .offline-badge {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      backdrop-filter: blur(10px);
      transition: all 0.35s ease;
      cursor: default;
      user-select: none;
    }

    .offline-badge.hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px);
    }

    /* Status colors */
    .offline-badge.status-online  { background: rgba(25, 135, 84, 0.9); color: #fff; }
    .offline-badge.status-offline { background: rgba(220, 53, 69, 0.95); color: #fff; }
    .offline-badge.status-syncing { background: rgba(255, 193, 7, 0.95); color: #222; }

    /* Pulsing dot */
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .pulse-dot.dot-online  { background: #a8ffcb; }
    .pulse-dot.dot-offline { background: #ffc5cb; animation: pulse-red 1.4s infinite; }
    .pulse-dot.dot-syncing { background: #fff; animation: pulse-yellow 0.8s infinite; }

    @keyframes pulse-red {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.4); }
    }
    @keyframes pulse-yellow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }

    /* Queue count pill */
    .queue-pill {
      background: rgba(255,255,255,0.25);
      border-radius: 999px;
      padding: 1px 7px;
      font-size: 11px;
      font-weight: 700;
    }

    /* Sync button */
    .sync-btn {
      background: rgba(255,255,255,0.25);
      border: none;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: inherit;
      padding: 0;
      transition: background 0.2s;
    }
    .sync-btn:hover { background: rgba(255,255,255,0.4); }
    .sync-btn:disabled { opacity: 0.5; cursor: default; }

    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `]
})
export class OfflineIndicatorComponent implements OnInit, OnDestroy {

  status: SyncStatus = 'online';
  queueCount = 0;
  private subs = new Subscription();

  constructor(
    private sync: OfflineSyncService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.subs.add(
      this.sync.status$.subscribe(s => {
        this.status = s;
        this.cdr.markForCheck();
      })
    );
    this.subs.add(
      this.sync.queueCount$.subscribe(n => {
        this.queueCount = n;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  triggerSync() { this.sync.syncNow(); }

  get badgeClass(): string { return `status-${this.status}`; }
  get dotClass(): string    { return `dot-${this.status}`; }
  get isSyncing(): boolean  { return this.status === 'syncing'; }

  get label(): string {
    switch (this.status) {
      case 'offline':  return '🔴 Offline';
      case 'syncing':  return '🟡 Syncing…';
      default:
        return this.queueCount > 0 ? '🟡 Pending' : '🟢 Online';
    }
  }
}
