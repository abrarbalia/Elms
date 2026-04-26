import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../services/admin.service';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';
import { API_BASE } from '../../../api-config';

@Component({
  selector: 'app-consolidated-report',
  imports: [FormsModule, CommonModule, StaffSidebar],
  templateUrl: './consolidated-report.html',
  styleUrl: './consolidated-report.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsolidatedReport implements OnInit {

  // ── Filters ──────────────────────────────────────────────
  filterName       = '';
  filterEmpCode    = '';
  filterDepartment = '';
  filterDateFrom   = '';
  filterDateTo     = '';

  // ── Data ─────────────────────────────────────────────────
  records: any[]   = [];
  departments: string[] = [];

  // ── Summary ───────────────────────────────────────────────
  grandTotalHours  = '0 hr';
  grandTotalMinutes = 0;
  loading          = false;
  hasSearched      = false;

  // ── Sorting ───────────────────────────────────────────────
  sortColumn    = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Default to current academic year
    const today = new Date();
    const year  = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    const startYear = month < 5 ? year - 1 : year;
    const endYear   = month < 5 ? year : year + 1;

    this.filterDateFrom = `${startYear}-06-01`;
    this.filterDateTo   = `${endYear}-04-30`;

    this.loadDepartments();
    this.fetchReport();
  }

  loadDepartments() {
    fetch(`${API_BASE}/api/departments`)
      .then(r => r.json())
      .then((data: any[]) => {
        this.departments = data.map(d => typeof d === 'string' ? d : d.name);
        this.cdr.markForCheck();
      })
      .catch(() => { this.departments = []; this.cdr.markForCheck(); });
  }

  fetchReport() {
    this.loading = true;
    this.hasSearched = true;
    this.cdr.markForCheck();

    const filters: any = {};
    if (this.filterDateFrom)   filters.fromDate   = this.filterDateFrom;
    if (this.filterDateTo)     filters.toDate     = this.filterDateTo;
    if (this.filterEmpCode.trim()) filters.empCode = this.filterEmpCode.trim();
    if (this.filterName.trim())    filters.name    = this.filterName.trim();
    if (this.filterDepartment)     filters.department = this.filterDepartment;

    this.adminService.getConsolidatedReport(filters).subscribe({
      next: (res: any) => {
        this.records          = res.records || [];
        this.grandTotalHours  = res.grandTotalHours || '0 hr';
        this.grandTotalMinutes = res.grandTotalMinutes || 0;
        this.loading          = false;
        this.applySorting();
        this.cdr.markForCheck();
      },
      error: () => {
        this.records = [];
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onFilterChange() {
    this.fetchReport();
  }

  clearFilters() {
    this.filterName       = '';
    this.filterEmpCode    = '';
    this.filterDepartment = '';
    const today = new Date();
    const year  = today.getFullYear();
    const month = today.getMonth();
    const startYear = month < 5 ? year - 1 : year;
    const endYear   = month < 5 ? year : year + 1;
    this.filterDateFrom = `${startYear}-06-01`;
    this.filterDateTo   = `${endYear}-04-30`;
    this.fetchReport();
  }

  // ── Sorting ───────────────────────────────────────────────
  sort(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn    = column;
      this.sortDirection = 'asc';
    }
    this.applySorting();
  }

  applySorting() {
    this.records.sort((a: any, b: any) => {
      let av = a[this.sortColumn];
      let bv = b[this.sortColumn];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return this.sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return this.sortDirection === 'asc' ? 1  : -1;
      return 0;
    });
  }

  sortIcon(column: string): string {
    if (this.sortColumn !== column) return 'bi-arrow-down-up text-muted';
    return this.sortDirection === 'asc' ? 'bi-sort-up text-primary' : 'bi-sort-down text-primary';
  }

  // ── Helpers ───────────────────────────────────────────────
  formatHours(minutes: number): string {
    if (!minutes || minutes <= 0) return '0 hr';

    // ✅ Apply 30 min rounding (Ceil)
    const rounded = Math.ceil(minutes / 30) * 30;

    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m === 0 ? `${h} hr` : `${h}.5 hr`;
  }

  formatDateRange(): string {
    const from = this.filterDateFrom
      ? new Date(this.filterDateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'All time';
    const to = this.filterDateTo
      ? new Date(this.filterDateTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Today';
    return `${from} → ${to}`;
  }
}
