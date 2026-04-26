import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { AdminService } from '../../services/admin.service';
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';
import { API_BASE } from '../../../api-config';
declare var bootstrap: any

@Component({
  selector: 'app-admin-dashboard',
  imports: [FormsModule, CommonModule, StaffSidebar],
  templateUrl: './partial-report.html',
  styleUrl: './partial-report.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PartialReport implements OnInit {

  // ── Raw Data ──────────────────────────────────────────────
  leaves: any[] = []

  // ── Filtered & Paged ─────────────────────────────────────
  filteredLeaves: any[] = []
  pagedLeaves: any[] = []

  // ── Departments (from API) ────────────────────────────────
  departments: string[] = []

  // ── Leave types (from API) ────────────────────────────────
  leaveTypes: string[] = []

  // ── Filters ──────────────────────────────────────────────
  searchTerm = ''
  filterType = ''
  filterStatus = ''
  filterDateFrom = ''
  filterDateTo = ''
  filterDepartment = ''

  // ── Sorting ──────────────────────────────────────────────
  sortColumn = ''
  sortDirection: 'asc' | 'desc' = 'asc'

  // ── Pagination ───────────────────────────────────────────
  currentPage = 1
  pageSize = 10
  totalPages = 1
  pageNumbers: number[] = []
  pageStart = 0
  pageEnd = 0

  // ── Bulk Selection ───────────────────────────────────────
  selectedIds = new Set<string>()

  // ── Detail Modal ─────────────────────────────────────────
  selectedLeave: any = null

  // ── Edit Modal ───────────────────────────────────────────
  editLeave: any = {}

  // ── Employee Summary Table ───────────────────────────────
  employeeSummary: any[] = []

  // ── Employee Search Summary (NEW) ────────────────────────
  empSearchTerm = ''
  searchedEmployee: any = null

  // ── Delete Confirm Modal ─────────────────────────────────
  deleteTarget: any = null

  // ── Toast Notifications ──────────────────────────────────
  toastMessage = ''
  toastType: 'success' | 'danger' = 'success'

  constructor(private adminSercive: AdminService, private cdr: ChangeDetectorRef) { }

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────
  ngOnInit() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    let startYear = month < 5 ? year - 1 : year;
    let endYear = month < 5 ? year : year + 1;

    this.filterDateFrom = `${startYear}-06-01`;
    this.filterDateTo = `${endYear}-04-30`;

    this.loadDepartments();
    this.loadLeaveTypes();
    this.loadLeaves();
  }

  // ─────────────────────────────────────────────────────────
  // LOAD DEPARTMENTS
  // ─────────────────────────────────────────────────────────
  loadDepartments() {
    fetch(`${API_BASE}/api/departments`)
      .then(res => res.json())
      .then((data: any[]) => {
        this.departments = data.map(d => (typeof d === 'string' ? d : d.name));
        this.cdr.markForCheck();
      })
      .catch(err => {
        console.error(err);
        this.departments = [];
        this.cdr.markForCheck();
      });
  }

  // ─────────────────────────────────────────────────────────
  // LOAD LEAVE TYPES
  // ─────────────────────────────────────────────────────────
  loadLeaveTypes() {
    fetch(`${API_BASE}/api/partial-leave-types`)
      .then(res => res.json())
      .then((data: any[]) => {
        this.leaveTypes = data.map(d => d.name);
        this.cdr.markForCheck();
      })
      .catch(err => {
        console.error(err);
        this.leaveTypes = [];
        this.cdr.markForCheck();
      });
  }

  // ─────────────────────────────────────────────────────────
  // LOAD LEAVES
  // ─────────────────────────────────────────────────────────
  loadLeaves() {
    this.adminSercive.getAllLeaves()
      .subscribe((data: any) => {
        this.leaves = data;
        this.applyFilters();
        this.computeEmployeeSummary();
        this.cdr.markForCheck();
      });
  }

  // ─────────────────────────────────────────────────────────
  // EMPLOYEE SEARCH SUMMARY (NEW)
  // ─────────────────────────────────────────────────────────

  /**
   * Called on every keystroke in the employee search input.
   * Finds the employee and computes their summary on the fly.
   */
  onEmpSearch() {
    const q = this.empSearchTerm.trim().toLowerCase();

    if (!q) {
      this.searchedEmployee = null;
      this.cdr.markForCheck();
      return;
    }

    // Find first matching leave record by name or empCode
    const match = this.leaves.find(l =>
      l.name?.toLowerCase().includes(q) ||
      l.empCode?.toString().toLowerCase().includes(q)
    );

    if (!match) {
      this.searchedEmployee = null;
      this.cdr.markForCheck();
      return;
    }

    // Gather ALL leaves for this employee
    const empLeaves = this.leaves.filter(l => l.empCode === match.empCode);

    // Total minutes only from Approved leaves
    const approvedMinutes = empLeaves
      .filter(l => l.status === 'Approved')
      .reduce((sum, l) => sum + Number(l.totalMinutes || 0), 0);

    this.searchedEmployee = {
      name: match.name,
      empCode: match.empCode,
      department: match.department,
      totalRequests: empLeaves.length,
      totalMinutes: approvedMinutes,
      totalHours: this.getHours(approvedMinutes),
      notWorkedTime: this.getNotWorkedTime(match.empCode)
    };

    this.cdr.markForCheck();
  }

  /** Clear the employee search box and result */
  clearEmpSearch() {
    this.empSearchTerm = '';
    this.searchedEmployee = null;
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────────────────
  // EMPLOYEE SUMMARY TABLE
  // ─────────────────────────────────────────────────────────
  computeEmployeeSummary() {
    const map = new Map<string, any>();

    this.leaves.forEach(leave => {
      if (!map.has(leave.empCode)) {
        map.set(leave.empCode, {
          name: leave.name,
          empCode: leave.empCode,
          totalRequests: 0,
          totalMinutes: 0,
        });
      }
      const emp = map.get(leave.empCode);
      emp.totalRequests += 1;
      // Only count approved minutes in summary
      if (leave.status === 'Approved') {
        emp.totalMinutes += Number(leave.totalMinutes || 0);
      }
    });

    this.employeeSummary = Array.from(map.values()).map(emp => ({
      ...emp,
      totalHours: this.getHours(emp.totalMinutes),
      notWorkedTime: this.getNotWorkedTime(emp.empCode)
    }));
  }

  // ─────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────

  /** Converts raw minutes to a readable hours string e.g. "1.5 hr" */
  getHours(minutes: number): string {
    if (!minutes || minutes <= 0) return '0 hr';

    // ✅ Apply 30 min rounding (Ceil)
    let rounded = Math.ceil(minutes / 30) * 30;

    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m === 0 ? `${h} hr` : `${h}.5 hr`;
  }

  /** Total not-worked time for an employee (Approved leaves only, with rounding) */
  getNotWorkedTime(empCode: string): string {
    const userLeaves = this.leaves.filter(
      l => l.empCode === empCode && l.status === 'Approved'
    );

    let totalMinutes = 0;
    userLeaves.forEach(l => {
      totalMinutes += Number(l.totalMinutes);
    });

    // Round to nearest 30 min (Ceil)
    let rounded = Math.ceil(totalMinutes / 30) * 30;
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m === 0 ? `${h} hr` : `${h}.5 hr`;
  }

  formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }

  // ─────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────
  countByStatus(status: string): number {
    return this.leaves.filter(l => l.status === status).length;
  }

  // ─────────────────────────────────────────────────────────
  // FILTER & SORT
  // ─────────────────────────────────────────────────────────
  onFilterChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  // applyFilters() {

  //   let data = [...this.leaves];

  //   if (this.searchTerm.trim()) {
  //     const term = this.searchTerm.toLowerCase();
  //     data = data.filter(l =>
  //       l.name?.toLowerCase().includes(term) ||
  //       l.empCode?.toString().includes(term)
  //     );
  //   }

  //   if (this.filterDepartment)
  //     data = data.filter(l => l.department === this.filterDepartment);

  //   if (this.filterType)
  //     data = data.filter(l => l.type === this.filterType);

  //   if (this.filterStatus)
  //     data = data.filter(l => l.status === this.filterStatus);

  //   if (this.filterDateFrom)
  //     data = data.filter(l => new Date(l.date) >= new Date(this.filterDateFrom));

  //   if (this.filterDateTo)
  //     data = data.filter(l => new Date(l.date) <= new Date(this.filterDateTo));

  //   if (this.sortColumn) {
  //     data.sort((a: any, b: any) => {
  //       let av = a[this.sortColumn];
  //       let bv = b[this.sortColumn];
  //       if (typeof av === 'string') av = av.toLowerCase();
  //       if (typeof bv === 'string') bv = bv.toLowerCase();
  //       if (av < bv) return this.sortDirection === 'asc' ? -1 : 1;
  //       if (av > bv) return this.sortDirection === 'asc' ? 1 : -1;
  //       return 0;
  //     });
  //   }

  //   this.filteredLeaves = data;
  //   this.updatePagination();
  // }

  // ─────────────────────────────────────────────────────────
  // SORTING
  // ─────────────────────────────────────────────────────────
 applyFilters() {
  let data = [...this.leaves]

  if (this.searchTerm.trim()) {
    const term = this.searchTerm.toLowerCase()
    data = data.filter(l =>
      l.name?.toLowerCase().includes(term) ||
      l.empCode?.toString().includes(term)
    )
  }

  if (this.filterDepartment)
    data = data.filter(l => l.department === this.filterDepartment)
  if (this.filterType)
    data = data.filter(l => l.type === this.filterType)
  if (this.filterStatus)
    data = data.filter(l => l.status === this.filterStatus)
  if (this.filterDateFrom)
    data = data.filter(l => new Date(l.date) >= new Date(this.filterDateFrom))
  if (this.filterDateTo)
    data = data.filter(l => new Date(l.date) <= new Date(this.filterDateTo))

  if (this.sortColumn) {
    data.sort((a: any, b: any) => {
      let av = a[this.sortColumn]
      let bv = b[this.sortColumn]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return this.sortDirection === 'asc' ? -1 : 1
      if (av > bv) return this.sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  this.filteredLeaves = data

  // ✅ AUTO SUMMARY — detect if all filtered rows belong to one employee
  const uniqueCodes = [...new Set(data.map(l => l.empCode))]
  if (uniqueCodes.length === 1) {
    const empCode = uniqueCodes[0]
    const empLeaves = this.leaves.filter(l => l.empCode === empCode)
    const approvedMinutes = empLeaves
      .filter(l => l.status === 'Approved')
      .reduce((sum, l) => sum + Number(l.totalMinutes || 0), 0)
    const first = empLeaves[0]
    this.searchedEmployee = {
      name: first.name,
      empCode: first.empCode,
      department: first.department,
      totalRequests: empLeaves.length,
      totalMinutes: approvedMinutes,
      notWorkedTime: this.getNotWorkedTime(empCode)
    }
  } else {
    this.searchedEmployee = null
  }

  this.updatePagination()
}
  sort(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  sortIcon(column: string): string {
    if (this.sortColumn !== column) return 'bi-arrow-down-up text-muted';
    return this.sortDirection === 'asc' ? 'bi-sort-up' : 'bi-sort-down';
  }

  // ─────────────────────────────────────────────────────────
  // PAGINATION
  // ─────────────────────────────────────────────────────────
  updatePagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredLeaves.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, this.filteredLeaves.length);
    this.pagedLeaves = this.filteredLeaves.slice(start, end);
    this.pageStart = this.filteredLeaves.length ? start + 1 : 0;
    this.pageEnd = end;

    const pages: number[] = [];
    for (
      let i = Math.max(1, this.currentPage - 2);
      i <= Math.min(this.totalPages, this.currentPage + 2);
      i++
    ) { pages.push(i); }
    this.pageNumbers = pages;
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  // ─────────────────────────────────────────────────────────
  // ROW SELECTION
  // ─────────────────────────────────────────────────────────
  toggleSelect(id: string) {
    this.selectedIds.has(id)
      ? this.selectedIds.delete(id)
      : this.selectedIds.add(id);
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.pagedLeaves.forEach(l => this.selectedIds.add(l._id));
    } else {
      this.pagedLeaves.forEach(l => this.selectedIds.delete(l._id));
    }
  }

  isAllSelected(): boolean {
    return this.pagedLeaves.length > 0 &&
      this.pagedLeaves.every(l => this.selectedIds.has(l._id));
  }

  clearSelection() {
    this.selectedIds.clear();
  }

  // ─────────────────────────────────────────────────────────
  // APPROVE / REJECT
  // ─────────────────────────────────────────────────────────
  approve(recordOrId: any) {
    let id: string;
    let record: any;

    if (typeof recordOrId === 'string') {
      id = recordOrId;
      record = this.leaves.find(l => l._id === id);
    } else {
      id = recordOrId._id;
      record = recordOrId;
    }

    if (!record) return;

    if (!record.officialIn || !record.officialOut) {
      alert("Please fill Official Start & End time ❌");
      return;
    }

    this.adminSercive.approveLeave(id, {
      officialIn: record.officialIn,
      officialOut: record.officialOut
    }).subscribe({
      next: () => {
        this.loadLeaves();
        this.showToast('Request approved successfully ✅', 'success');
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Approval failed ❌', 'danger')
    });
  }

  reject(id: string) {
    this.adminSercive.rejectLeave(id)
      .subscribe(() => { this.loadLeaves(); });
  }

  // bulkApprove() {
  //   const ids = Array.from(this.selectedIds);
  //   const calls = ids.map(id => this.adminSercive.approveLeave(id).toPromise());
  //   Promise.all(calls).then(() => {
  //     this.clearSelection();
  //     this.loadLeaves();
  //   });
  // }

  bulkReject() {
    const ids = Array.from(this.selectedIds);
    const calls = ids.map(id => this.adminSercive.rejectLeave(id).toPromise());
    Promise.all(calls).then(() => {
      this.clearSelection();
      this.loadLeaves();
    });
  }

  // ─────────────────────────────────────────────────────────
  // DETAIL MODAL
  // ─────────────────────────────────────────────────────────
  viewDetail(leave: any) {
    this.selectedLeave = leave;
    const modal = new bootstrap.Modal(document.getElementById('leaveDetailModal'));
    modal.show();
  }

  closeModal() {
    const el = document.getElementById('leaveDetailModal');
    const modal = bootstrap.Modal.getInstance(el);
    modal?.hide();
  }

  // ─────────────────────────────────────────────────────────
  // EDIT MODAL
  // ─────────────────────────────────────────────────────────
  openEdit(leave: any) {
    this.editLeave = { ...leave };
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    modal.show();
  }

  saveEdit() {
    this.adminSercive.updateLeave(this.editLeave._id, this.editLeave)
      .subscribe(() => {
        this.loadLeaves();
        const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
        modal?.hide();
        this.showToast('Record updated successfully ✅', 'success');
        this.cdr.markForCheck();
      });
  }

  // ── Soft Delete with Confirm Modal ───────────────────────
  openDeleteConfirm(leave: any) {
    this.deleteTarget = leave;
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
  }

  confirmDelete() {
    if (!this.deleteTarget) return;
    this.adminSercive.deleteLeave(this.deleteTarget._id).subscribe({
      next: () => {
        // Remove from local arrays immediately
        this.leaves = this.leaves.filter(l => l._id !== this.deleteTarget._id);
        this.applyFilters();
        this.deleteTarget = null;
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal'));
        modal?.hide();
        this.showToast('Record moved to Recycle Bin 🗑️', 'success');
        this.cdr.markForCheck();
      },
      error: () => {
        this.showToast('Failed to delete record ❌', 'danger');
        this.cdr.markForCheck();
      }
    });
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

  // ─────────────────────────────────────────────────────────
  // EXPORT CSV
  // ─────────────────────────────────────────────────────────
  exportCSV() {
    const headers = ['EmpCode', 'Name', 'Date', 'Type', 'Minutes', 'Hours', 'Status'];
    const rows = this.filteredLeaves.map(l => [
      l.srNo,
      l.empCode,
      l.name,
      new Date(l.date).toLocaleDateString(),
      l.type,
      l.totalMinutes,
      l.totalHours,
      l.status
    ]);

    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leave_requests_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────────────
  // DEPARTMENT STATS
  // ─────────────────────────────────────────────────────────
  getDepartmentStats() {
    const stats: any = {};
    this.leaves.forEach(l => {
      if (!stats[l.department]) stats[l.department] = 0;
      stats[l.department] += Number(l.totalMinutes);
    });

    return Object.entries(stats)
      .map(([dept, minutes]: any) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return { department: dept, total: h + ' hr ' + m + ' min', minutes };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }

  // ─────────────────────────────────────────────────────────
  // PDF — DEPARTMENT REPORT
  // ─────────────────────────────────────────────────────────
  downloadDepartmentReport() {
    const deptLeaves = this.leaves.filter(l => l.department === this.filterDepartment);

    if (deptLeaves.length === 0) {
      alert('No records found for this department.');
      return;
    }

    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();

    const formatDuration = (totalMinutes: number) => {
      const rounded = Math.round(totalMinutes / 30) * 30;
      const h = Math.floor(rounded / 60);
      const m = rounded % 60;
      return m === 0 ? `${h} hr` : `${h}.5 hr`;
    };

    const totalRequests = deptLeaves.length;
    const approved = deptLeaves.filter(l => l.status === 'Approved').length;
    const rejected = deptLeaves.filter(l => l.status === 'Rejected').length;
    const pending = totalRequests - (approved + rejected);

    const totalMinutes = deptLeaves
      .filter(l => l.status === 'Approved')
      .reduce((sum, l) => sum + Number(l.totalMinutes || 0), 0);

    let y = 20;

    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text('Departmental Leave Report', 14, y);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${timestamp}`, 196, y, { align: 'right' });

    y += 10;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(1);
    doc.line(14, y, 50, y);

    y += 12;
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.setFont('helvetica', 'bold');
    doc.text(`DEPARTMENT: ${this.filterDepartment.toUpperCase()}`, 14, y);

    y += 10;

    const drawBox = (x: number, title: string, value: string, bgColor: number[], textColor: number[]) => {
      const boxW = 44;
      const boxH = 22;
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.roundedRect(x, y, boxW, boxH, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(title.toUpperCase(), x + 4, y + 7);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(value, x + 4, y + 16);
    };

    drawBox(14, 'Total Requests', `${totalRequests}`, [241, 245, 249], [30, 41, 59]);
    drawBox(62, 'Approved', `${approved}`, [240, 253, 244], [22, 163, 74]);
    drawBox(110, 'Rejected', `${rejected}`, [254, 242, 242], [220, 38, 38]);
    drawBox(158, 'Total Approved Time', formatDuration(totalMinutes), [238, 242, 255], [79, 70, 229]);

    y += 35;

    const tableData = deptLeaves.map((l: any) => [
      l.srNo,
      `${l.name}\n(${l.empCode})`,
      new Date(l.date).toLocaleDateString('en-GB'),
      l.type,
      `${l.totalMinutes} min`,
      formatDuration(l.totalMinutes),
      l.status
    ]);

    autoTable(doc, {
      startY: y,
      head: [['ID', 'Employee Details', 'Date', 'Leave Type', 'Min.', 'Formatted', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { fontSize: 9, cellPadding: 4, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { fontStyle: 'bold', halign: 'center' }
      },
      didParseCell: function (data) {
        if (data.column.index === 6 && data.section === 'body') {
          const status = data.cell.raw;
          if (status === 'Approved') data.cell.styles.textColor = [22, 163, 74];
          else if (status === 'Rejected') data.cell.styles.textColor = [220, 38, 38];
          else data.cell.styles.textColor = [234, 88, 12];
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 30;
    if (finalY < 250) {
      doc.setDrawColor(200);
      doc.line(14, finalY, 70, finalY);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'normal');
      doc.text('Department Head Signature', 14, finalY + 7);
      doc.line(140, finalY, 196, finalY);
      doc.text('HR Administration', 140, finalY + 7);
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160);
      doc.text(
        `Confidential - ${this.filterDepartment} Departmental Report | Page ${i} of ${pageCount}`,
        105, 288, { align: 'center' }
      );
    }

    doc.save(`${this.filterDepartment}_Report_${new Date().getTime()}.pdf`);
  }

  // ─────────────────────────────────────────────────────────
  // PDF — SELECTED ROWS
  // ─────────────────────────────────────────────────────────
  downloadSelectedPDF() {
    const selectedLeaves = this.leaves.filter(leave => this.selectedIds.has(leave._id));

    if (selectedLeaves.length === 0) {
      alert('Please select at least one record.');
      return;
    }

    const doc = new jsPDF();
    const grouped: any = {};

    selectedLeaves.forEach(leave => {
      if (!grouped[leave.empCode]) grouped[leave.empCode] = [];
      grouped[leave.empCode].push(leave);
    });

    let y = 20;

    const drawHeader = () => {
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text('Leave Summary Report', 14, 15);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Academic Period: 2025-2026`, 14, 20);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 196, 15, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 25, 196, 25);
    };

    drawHeader();
    y = 35;

    Object.keys(grouped).forEach((empCode) => {
      const empLeaves = grouped[empCode];
      const empName = empLeaves[0].name;
      const dept = empLeaves[0].department;

      let totalMinutes = 0;
      empLeaves.forEach((l: any) => {
        if (l.status === 'Approved') totalMinutes += Number(l.totalMinutes);
      });
      let rounded = Math.ceil(totalMinutes / 30) * 30;
      const h = Math.floor(rounded / 60);
      const m = rounded % 60;
      const totalNotWorked = m === 0 ? `${h} hr` : `${h}.5 hr`;

      if (y > 240) {
        doc.addPage();
        drawHeader();
        y = 35;
      }

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, y, 182, 16, 1, 1, 'F');
      doc.setFillColor(79, 70, 229);
      doc.rect(14, y, 1.5, 16, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(`${empName.toUpperCase()}`, 19, y + 7);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Emp Code: ${empCode} | Dept: ${dept}`, 19, y + 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(`Approved: ${totalNotWorked}`, 192, y + 10, { align: 'right' });

      y += 20;

      const tableData = empLeaves.map((l: any) => {
        let r = Math.ceil(l.totalMinutes / 30) * 30;
        if (r > 180) r = 180;
        const rowHours = (r % 60 === 0) ? `${Math.floor(r / 60)} hr` : `${Math.floor(r / 60)}.5 hr`;
        return [l.srNo, new Date(l.date).toLocaleDateString('en-GB'), l.type, `${l.totalMinutes} min`, rowHours, l.status.toUpperCase()];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Sr.', 'Date', 'Type', 'Total Min', 'Total Hour', 'Status']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
        didParseCell: function (data) {
          if (data.column.index === 5) {
            const status = data.cell.raw;
            if (status === 'APPROVED') data.cell.styles.textColor = [16, 185, 129];
            if (status === 'REJECTED') data.cell.styles.textColor = [239, 68, 68];
            if (status === 'PENDING') data.cell.styles.textColor = [245, 158, 11];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      y = (doc as any).lastAutoTable.finalY + 15;
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Dolat-Usha Institute - Confidential Document`, 14, 285);
      doc.text(`Page ${i} of ${totalPages}`, 196, 285, { align: 'right' });
    }

    doc.save(`Bulk_Leave_Report_${new Date().getTime()}.pdf`);
  }

  // ─────────────────────────────────────────────────────────
  // PDF — ALL DATA (Whole User Data)
  // ─────────────────────────────────────────────────────────
  downloadAllLeavesPDF() {
    if (this.filteredLeaves.length === 0) {
      alert('No records available to download.');
      return;
    }

    const doc = new jsPDF();
    const grouped: any = {};

    this.filteredLeaves.forEach(leave => {
      if (!grouped[leave.empCode]) grouped[leave.empCode] = [];
      grouped[leave.empCode].push(leave);
    });

    let y = 20;

    const drawHeader = () => {
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text('Complete Leave Report (All Users)', 14, 15);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 196, 15, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 20, 196, 20);
    };

    drawHeader();
    y = 30;

    Object.keys(grouped).forEach((empCode) => {
      const empLeaves = grouped[empCode];
      const empName = empLeaves[0].name;
      const dept = empLeaves[0].department;

      let totalMinutes = 0;
      empLeaves.forEach((l: any) => {
        if (l.status === 'Approved') totalMinutes += Number(l.totalMinutes);
      });
      let rounded = Math.ceil(totalMinutes / 30) * 30;
      const h = Math.floor(rounded / 60);
      const m = rounded % 60;
      const totalNotWorked = m === 0 ? `${h} hr` : `${h}.5 hr`;

      if (y > 240) {
        doc.addPage();
        drawHeader();
        y = 30;
      }

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, y, 182, 16, 1, 1, 'F');
      doc.setFillColor(79, 70, 229);
      doc.rect(14, y, 1.5, 16, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(`${empName.toUpperCase()}`, 19, y + 7);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Emp Code: ${empCode} | Dept: ${dept}`, 19, y + 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(`Approved: ${totalNotWorked}`, 192, y + 10, { align: 'right' });

      y += 20;

      const tableData = empLeaves.map((l: any) => {
        let r = Math.ceil(l.totalMinutes / 30) * 30;
        if (r > 180) r = 180;
        const rowHours = (r % 60 === 0) ? `${Math.floor(r / 60)} hr` : `${Math.floor(r / 60)}.5 hr`;
        return [l.srNo, new Date(l.date).toLocaleDateString('en-GB'), l.type, `${l.totalMinutes} min`, rowHours, l.status.toUpperCase()];
      });

      autoTable(doc, {
        startY: y,
        head: [['ID', 'Date', 'Type', 'Minutes', 'Hours', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: [100, 116, 139], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 15 },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { fontStyle: 'bold' }
        },
        didParseCell: function (data) {
          if (data.column.index === 5 && data.section === 'body') {
            const status = data.cell.raw;
            if (status === 'APPROVED') data.cell.styles.textColor = [22, 163, 74];
            else if (status === 'REJECTED') data.cell.styles.textColor = [220, 38, 38];
            else data.cell.styles.textColor = [234, 88, 12];
          }
        }
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save(`All_Users_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ─────────────────────────────────────────────────────────
  // PDF — INDIVIDUAL USER
  // ─────────────────────────────────────────────────────────
  downloadFullUserReport(empCode: string, name: string) {
    const userLeaves = this.leaves.filter(l => l.empCode === empCode);

    if (userLeaves.length === 0) {
      alert('No records found');
      return;
    }

    const doc = new jsPDF();
    const department = userLeaves[0].department;

    let totalMinutes = 0;
    userLeaves.forEach(l => {
      if (l.status === 'Approved') totalMinutes += Number(l.totalMinutes);
    });

    let rounded = Math.ceil(totalMinutes / 30) * 30;
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    const totalNotWorked = minutes === 0 ? `${hours} hr` : `${hours}.5 hr`;

    let y = 0;

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 15, 'F');

    y = 25;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text('Leave Report Slip', 14, y);

    doc.setFontSize(12);
    doc.text('Dolat-Usha Institute', 196, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Academic Year 2025-26', 196, y + 5, { align: 'right' });

    y += 15;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 85, 35, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text('EMPLOYEE DETAILS', 20, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.setFontSize(10);
    doc.text(`Name:`, 20, y + 16);
    doc.text(`Emp Code:`, 20, y + 22);
    doc.text(`Dept:`, 20, y + 28);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(`${name}`, 45, y + 16);
    doc.text(`${empCode}`, 45, y + 22);
    doc.text(`${department}`, 45, y + 28);

    doc.setFillColor(79, 70, 229);
    doc.roundedRect(110, y, 86, 35, 2, 2, 'F');

    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.text('TOTAL APPROVED LEAVE', 116, y + 10);
    doc.setFontSize(26);
    doc.text(totalNotWorked, 153, y + 25, { align: 'center' });

    y += 50;

    doc.setDrawColor(226, 232, 240);
    doc.line(14, y - 5, 196, y - 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text('Leave Breakdown', 14, y);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 196, y, { align: 'right' });

    y += 8;

    const tableData = userLeaves.map((l: any) => {
      let r = Math.ceil(l.totalMinutes / 30) * 30;
      if (r > 180) r = 180;
      const h = Math.floor(r / 60);
      const m = r % 60;
      const rowHours = m === 0 ? `${h} hr` : `${h}.5 hr`;
      return [l.srNo, new Date(l.date).toLocaleDateString('en-GB'), l.type, `${l.totalMinutes} min`, rowHours, l.status.toUpperCase()];
    });

    autoTable(doc, {
      startY: y,
      head: [['Sr.', 'Date', 'Type', 'Total Min', 'Total Hour', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      didParseCell: function (data) {
        if (data.column.index === 5) {
          const status = data.cell.raw;
          if (status === 'APPROVED') data.cell.styles.textColor = [16, 185, 129];
          if (status === 'REJECTED') data.cell.styles.textColor = [239, 68, 68];
        }
      }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160);
      doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
      doc.text('Official Academic Document - Dolat-Usha Institute', 14, 285);
    }

    doc.save(`${name.replace(/\s+/g, '_')}_Leave_Report.pdf`);
  }
}