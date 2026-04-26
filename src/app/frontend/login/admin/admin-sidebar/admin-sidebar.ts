import { Component, Input, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { OfflineSyncService } from '../../../../offline-sync.service';
import { ToastService } from '../../../../shared/toast.service';
import { signal } from '@angular/core';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.css',
})
export class AdminSidebar {
  isCollapsed = false;
  offlineCount = signal(0);

  constructor(
    private router: Router,
    private offlineSync: OfflineSyncService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      // Subscribe to live queue count from the real OfflineSyncService
      this.offlineSync.queueCount$.subscribe(count => this.offlineCount.set(count));
    }
  }

  async viewOfflineQueue() {
    if (!isPlatformBrowser(this.platformId)) return;
    const count = await this.offlineSync.getPendingCount();
    if (count === 0) {
      this.toast.success('Queue Empty', 'All data is perfectly synced with MongoDB!');
    } else {
      const items = await this.offlineSync.getFailedLog();
      const detail = items.length > 0
        ? `${items.length} request(s) have failed previously and are pending retry.`
        : `${count} request(s) are waiting to be synced.`;
      this.toast.warning(`${count} Offline Request(s)`, detail);
    }
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }

  logout() {
    console.log("Admin logged out");
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem('user');
    }
    this.router.navigate(['/login']);
  }
}