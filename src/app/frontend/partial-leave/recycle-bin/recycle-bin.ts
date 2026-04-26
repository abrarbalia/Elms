import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../services/admin.service';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';
declare var bootstrap: any;

@Component({
  selector: 'app-recycle-bin',
  imports: [FormsModule, CommonModule, StaffSidebar],
  templateUrl: './recycle-bin.html',
  styleUrl: './recycle-bin.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecycleBin implements OnInit {

  records: any[]         = [];
  filteredRecords: any[] = [];
  loading                = true;
  searchTerm             = '';
  restoreTarget: any     = null;

  // Toast
  toastMessage = '';
  toastType: 'success' | 'danger' = 'success';

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadDeletedRecords();
  }

  loadDeletedRecords() {
    this.loading = true;
    this.cdr.markForCheck();

    this.adminService.getDeletedLeaves().subscribe({
      next: (data: any) => {
        this.records         = data || [];
        this.filteredRecords = [...this.records];
        this.loading         = false;
        this.applySearch();
        this.cdr.markForCheck();
      },
      error: () => {
        this.records = [];
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applySearch() {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) {
      this.filteredRecords = [...this.records];
    } else {
      this.filteredRecords = this.records.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.empCode?.toString().includes(q) ||
        r.department?.toLowerCase().includes(q)
      );
    }
    this.cdr.markForCheck();
  }

  openRestoreConfirm(record: any) {
    this.restoreTarget = record;
    const modal = new bootstrap.Modal(document.getElementById('restoreModal'));
    modal.show();
  }

  confirmRestore() {
    if (!this.restoreTarget) return;

    this.adminService.restoreLeave(this.restoreTarget._id).subscribe({
      next: () => {
        this.records         = this.records.filter(r => r._id !== this.restoreTarget._id);
        this.filteredRecords = this.filteredRecords.filter(r => r._id !== this.restoreTarget._id);
        this.restoreTarget   = null;
        const modal = bootstrap.Modal.getInstance(document.getElementById('restoreModal'));
        modal?.hide();
        this.showToast('Record restored successfully ✅', 'success');
        this.cdr.markForCheck();
      },
      error: () => {
        this.showToast('Failed to restore record ❌', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  // Days until permanent deletion
  daysLeft(deletedAt: string): number {
    const d = new Date(deletedAt).getTime();
    const diff = d + 90 * 24 * 60 * 60 * 1000 - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }

  getDaysLeftClass(days: number): string {
    if (days <= 7)  return 'danger';
    if (days <= 30) return 'warning';
    return 'safe';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatHours(minutes: number): string {
    if (!minutes || minutes <= 0) return '0 hr';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} hr` : `${h}.5 hr`;
  }

  showToast(message: string, type: 'success' | 'danger') {
    this.toastMessage = message;
    this.toastType    = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 3500);
  }
}
