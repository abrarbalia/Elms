import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { AdminService } from '../../services/admin.service'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
// import html2pdf from 'html2pdf.js';
import { API_BASE } from '../../../api-config';
declare var bootstrap: any

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './admin-report.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminReport implements OnInit {


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

  constructor(private adminService: AdminService, private cdr: ChangeDetectorRef) { }

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

  // ❌ REMOVE this line (not needed)
  // this.cdr.markForCheck();
}
async getHtml2Pdf() {
  const module = await import('html2pdf.js');
  return module.default;
}

  // ── Load Departments from API ─────────────────────────────
  loadDepartments() {
    fetch(`${API_BASE}/api/departments`)
      .then(res => res.json())
      .then((data: any[]) => {

        this.departments = data.map(d => (typeof d === 'string' ? d : d.name));

        this.cdr.markForCheck();   // ✅ PUT HERE

      })
      .catch(err => {

        console.error(err);
        this.departments = [];

        this.cdr.markForCheck();   // ✅ PUT HERE

      });
  }
  // ── Load Leave Types from API ─────────────────────────────
  loadLeaveTypes() {
    fetch(`${API_BASE}/api/partialLeaveType`)
      .then(res => res.json())
      .then((data: any[]) => {

        this.leaveTypes = data.map(d => (typeof d === 'string' ? d : d.name));

        this.cdr.markForCheck();   // ✅ PUT HERE

      })
      .catch(err => {

        console.error(err);
        this.leaveTypes = [];

        this.cdr.markForCheck();   // ✅ PUT HERE

      });
  }

  // ── Load Data ────────────────────────────────────────────
  loadLeaves() {
    this.adminService.getAllLeaves()
      .subscribe((data: any) => {
        this.leaves = data;
        this.applyFilters()
        this.cdr.markForCheck();
      })
  }

  getHours(minutes: number) {

    if (!minutes || minutes <= 0) return "0 hr";

    // rounding same as backend
    let rounded = Math.round(minutes / 30) * 30;

    if (rounded < 30) rounded = 30;
    if (rounded > 180) rounded = 180;

    const h = Math.floor(rounded / 60);
    const m = rounded % 60;

    return m === 0 ? `${h} hr` : `${h}.${m === 30 ? 5 : 0} hr`;
  }

  // ── Stats Helpers ────────────────────────────────────────
  countByStatus(status: string): number {
    return this.leaves.filter(l => l.status === status).length
  }

  // ── Filter & Sort ────────────────────────────────────────
  onFilterChange() {
    this.currentPage = 1
    this.applyFilters()
  }

  applyFilters() {
    let data = [...this.leaves]

    // Search by name or empCode
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase()

      data = data.filter(l =>
        l.name?.toLowerCase().includes(term) ||
        l.empCode?.toString().includes(term)
      )
    }
    // Department filter
    if (this.filterDepartment) {
      data = data.filter(l => l.department === this.filterDepartment)
    }
    // Type filter
    if (this.filterType)
      data = data.filter(l => l.type === this.filterType)

    // Status filter
    if (this.filterStatus)
      data = data.filter(l => l.status === this.filterStatus)

    // Date range filter
    if (this.filterDateFrom)
      data = data.filter(l => new Date(l.date) >= new Date(this.filterDateFrom))
    if (this.filterDateTo)
      data = data.filter(l => new Date(l.date) <= new Date(this.filterDateTo))

    // Sorting
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

    // ✅ FIX: Removed cdr.detectChanges() — it was causing unnecessary
    // re-renders on every filter interaction (including status dropdown clicks).
    // Angular's default change detection handles this correctly on its own.

    this.updatePagination()
  }

  getNotWorkedTime(empCode: string) {

    const userLeaves = this.leaves.filter(
      l => l.empCode === empCode && l.status === 'Approved'
    );

    let totalMinutes = 0;

    userLeaves.forEach(l => {
      totalMinutes += Number(l.totalMinutes);
    });

    // ✅ FIXED rounding (NO LIMIT)
    let rounded = Math.round(totalMinutes / 30) * 30;

    const h = Math.floor(rounded / 60);
    const m = rounded % 60;

    return m === 0 ? `${h} hr` : `${h}.5 hr`;
  }

  // ── Sorting ──────────────────────────────────────────────
  sort(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      this.sortColumn = column
      this.sortDirection = 'asc'
    }
    this.applyFilters()
  }

  sortIcon(column: string): string {
    if (this.sortColumn !== column) return 'bi-arrow-down-up text-muted'
    return this.sortDirection === 'asc' ? 'bi-sort-up' : 'bi-sort-down'
  }

  // ── Pagination ───────────────────────────────────────────
  updatePagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredLeaves.length / this.pageSize))
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages

    const start = (this.currentPage - 1) * this.pageSize
    const end = Math.min(start + this.pageSize, this.filteredLeaves.length)
    this.pagedLeaves = this.filteredLeaves.slice(start, end)
    this.pageStart = this.filteredLeaves.length ? start + 1 : 0
    this.pageEnd = end

    // Show up to 5 page numbers around current page
    const pages: number[] = []
    for (
      let i = Math.max(1, this.currentPage - 2);
      i <= Math.min(this.totalPages, this.currentPage + 2);
      i++
    ) { pages.push(i) }
    this.pageNumbers = pages
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return
    this.currentPage = page
    this.updatePagination()
  }

  onPageSizeChange() {
    this.currentPage = 1
    this.updatePagination()
  }

  // ── Row Selection ────────────────────────────────────────
  toggleSelect(id: string) {
    this.selectedIds.has(id)
      ? this.selectedIds.delete(id)
      : this.selectedIds.add(id)
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked
    if (checked) {
      this.pagedLeaves.forEach(l => this.selectedIds.add(l._id))
    } else {
      this.pagedLeaves.forEach(l => this.selectedIds.delete(l._id))
    }
  }

  isAllSelected(): boolean {
    return this.pagedLeaves.length > 0 &&
      this.pagedLeaves.every(l => this.selectedIds.has(l._id))
  }

  clearSelection() {
    this.selectedIds.clear()
  }

  // ── Approve / Reject ─────────────────────────────────────
  approve(id: string) {
    this.adminService.approveLeave(id, {})
      .subscribe(() => {
        this.loadLeaves()
      })
  }

  reject(id: string) {
    this.adminService.rejectLeave(id)
      .subscribe(() => {
        this.loadLeaves()
      })
  }

  // ── Bulk Actions ─────────────────────────────────────────
  bulkApprove() {
    const ids = Array.from(this.selectedIds)
    const calls = ids.map(id => this.adminService.approveLeave(id, {}).toPromise())
    Promise.all(calls).then(() => {
      this.clearSelection()
      this.loadLeaves()
    })
  }

  bulkReject() {
    const ids = Array.from(this.selectedIds)
    const calls = ids.map(id => this.adminService.rejectLeave(id).toPromise())
    Promise.all(calls).then(() => {
      this.clearSelection()
      this.loadLeaves()
    })
  }

  // ── Detail Modal ─────────────────────────────────────────
  viewDetail(leave: any) {
    this.selectedLeave = leave
    const modal = new bootstrap.Modal(document.getElementById('leaveDetailModal'))
    modal.show()
  }

  closeModal() {
    const el = document.getElementById('leaveDetailModal')
    const modal = bootstrap.Modal.getInstance(el)
    modal?.hide()
  }

  // ── Export CSV ───────────────────────────────────────────
  exportCSV() {
    const headers = ['EmpCode', 'Name', 'Date', 'Type', 'Minutes', 'Hours', 'Status']
    const rows = this.filteredLeaves.map(l => [
      l.srNo,
      l.empCode,
      l.name,
      new Date(l.date).toLocaleDateString(),
      l.type,
      l.totalMinutes,
      l.totalHours,
      l.status
    ])

    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `leave_requests_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  printSelected() {

    const selectedLeaves = this.leaves.filter(leave =>
      this.selectedIds.has(leave._id)
    );

    if (selectedLeaves.length === 0) {
      alert("Please select at least one record to print.");
      return;
    }

    // 👉 Group by empCode
    const grouped: any = {};
    selectedLeaves.forEach(leave => {
      if (!grouped[leave.empCode]) {
        grouped[leave.empCode] = [];
      }
      grouped[leave.empCode].push(leave);
    });

    let printContent = `
    <html>
    <head>
      <title>Leave Slip</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        h2 { text-align: center; margin-bottom: 30px; }
        .emp-block { margin-bottom: 40px; }
        .summary {
          margin-bottom: 10px;
          padding: 10px;
          border: 1px solid #000;
          background: #f9f9f9;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          border: 1px solid #000;
          padding: 8px;
          text-align: center;
        }
        th { background: #eee; }
      </style>
    </head>
    <body>
      <h2>Employee Leave Slip</h2>
  `;

    // 👉 Loop each employee group
    Object.keys(grouped).forEach(empCode => {

      const empLeaves = grouped[empCode];
      const empName = empLeaves[0].name;

      // ✅ FIXED SUMMARY (ONLY SELECTED + APPROVED)
      let totalMinutes = 0;

      empLeaves.forEach((l: any) => {
        if (l.status === 'Approved') {
          totalMinutes += Number(l.totalMinutes);
        }
      });

      // ✅ Apply rounding
      let rounded = Math.round(totalMinutes / 30) * 30;

      if (rounded < 30) rounded = 30;
      if (rounded > 180) rounded = 180;

      const hours = Math.floor(rounded / 60);
      const minutes = rounded % 60;

      const totalNotWorked = minutes === 0
        ? `${hours} hr`
        : `${hours}.5 hr`;

      printContent += `
      <div class="emp-block">
        <div class="summary">
          <strong>Employee Code:</strong> ${empCode} <br>
          <strong>Name:</strong> ${empName} <br>
          <strong>Total Not Worked Time:</strong> ${totalNotWorked}
        </div>

        <table>
          <thead>
            <tr>
              <th>SrNo</th>
              <th>Date</th>
              <th>Type</th>
              <th>Minutes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

      // ✅ CORRECT LOOP (per employee)
      empLeaves.forEach((leave: any, index: number) => {
        printContent += `
        <tr>
          <td>${index + 1}</td>
          <td>${new Date(leave.date).toLocaleDateString()}</td>
          <td>${leave.type}</td>
          <td>${leave.totalMinutes}</td>
          <td>${leave.status}</td>
        </tr>
      `;
      });

      printContent += `
          </tbody>
        </table>
      </div>
    `;
    });

    printContent += `
    </body>
    </html>
  `;

    const printWindow = window.open('', '', 'width=900,height=700');

    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }

  }

  downloadSlip(empCode: number, name: string) {

    const userLeaves = this.leaves.filter(l => l.empCode === empCode)

    const department = userLeaves.length ? userLeaves[0].department : ''

    let rows = ''

    userLeaves.forEach((l, i) => {
      rows += `
      <tr>
  <td>${l.srNo}</td>
  <td>${new Date(l.date).toLocaleDateString()}</td>
  <td>${l.type}</td>
  <td>${l.totalMinutes}</td>
  <td>${(l.totalMinutes / 60).toFixed(2)}</td>
  <td>${l.status}</td>
</tr>
    `
    })

    const html = `
  <html>
  <head>
  <title>Leave Slip</title>

  <style>

  body{
    font-family: Arial;
    padding:40px;
  }

  h2{
    text-align:center;
    margin-bottom:30px;
  }

  .header{
    display:flex;
    justify-content:space-between;
    margin-bottom:10px;
    font-size:16px;
  }

  table{
    width:100%;
    border-collapse:collapse;
    margin-top:20px;
  }

  table, th, td{
    border:1px solid black;
  }

  th, td{
    padding:8px;
    text-align:center;
  }

  .footer{
    margin-top:40px;
    font-size:14px;
  }

  </style>
  </head>

  <body>

  <h2>Leave Slip</h2>

  <div class="header">
    <div><b>Emp Code:</b> ${empCode}</div>
    <div><b>Name:</b> ${name}</div>
  </div>

  <div class="header">
    <div><b>Department:</b> ${department}</div>
  </div>

  <table>

  <tr>
  <th>Sr No</th>
  <th>Date</th>
  <th>Type</th>
  <th>Minutes</th>
  <th>Hours</th>
  <th>Status</th>
  </tr>

  ${rows}

  </table>

  <div class="footer">
  <p><b>Generated By:</b> Admin</p>
  <p><b>Generated On:</b> ${new Date().toLocaleDateString()}</p>
  </div>

  </body>
  </html>
  `

    const win = window.open('', '', 'width=900,height=700')
    win?.document.write(html)
    win?.document.close()
    win?.print()
  }

async downloadDepartmentReport() {

  const deptLeaves = this.leaves.filter(
    l => l.department === this.filterDepartment
  );

  if (deptLeaves.length === 0) {
    alert("No records found for this department.");
    return;
  }

  const element = document.createElement('div');
  element.innerHTML = `<h2>Department Report</h2>`; // your full HTML here

  const html2pdf = await this.getHtml2Pdf();

  html2pdf()
    .from(element)
    .set({
      margin: 10,
      filename: `${this.filterDepartment}_Dept_Report.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .save();
}

  getDepartmentStats() {

    const stats: any = {}

    this.leaves.forEach(l => {

      if (!stats[l.department]) {
        stats[l.department] = 0
      }

      stats[l.department] += Number(l.totalMinutes)

    })

    return Object.entries(stats)
      .map(([dept, minutes]: any) => {

        const h = Math.floor(minutes / 60)
        const m = minutes % 60

        return {
          department: dept,
          total: h + " hr " + m + " min",
          minutes: minutes
        }

      })
      .sort((a, b) => b.minutes - a.minutes)

  }

  editLeave: any = {};

  openEdit(leave: any) {
    this.editLeave = { ...leave };
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    modal.show();
  }

  saveEdit() {
    this.adminService.updateLeave(this.editLeave._id, this.editLeave)
      .subscribe(() => {

        this.loadLeaves();

        const modal = bootstrap.Modal.getInstance(
          document.getElementById('editModal')
        );
        modal?.hide();

       this.cdr.markForCheck(); // ✅ correct  // ⚡ OPTIONAL

      });
  }

 async downloadSelectedPDF() {

  const selectedLeaves = this.leaves.filter(leave =>
    this.selectedIds.has(leave._id)
  );

  if (selectedLeaves.length === 0) {
    alert("Please select at least one record.");
    return;
  }

  const grouped: any = {};
  selectedLeaves.forEach(leave => {
    if (!grouped[leave.empCode]) {
      grouped[leave.empCode] = [];
    }
    grouped[leave.empCode].push(leave);
  });

  let content = `...`; // (your same HTML — keep it as is)

  const element = document.createElement('div');
  element.innerHTML = content;

  const html2pdf = await this.getHtml2Pdf();

  html2pdf()
    .from(element)
    .set({
      margin: 10,
      filename: `Selected_Leaves_Report_${new Date().getTime()}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .save();
}

  async downloadFullUserReport(empCode: number, name: string) {

  const userLeaves = this.leaves.filter(l => l.empCode === empCode);

  if (userLeaves.length === 0) {
    alert("No records found");
    return;
  }

  const element = document.createElement('div');
  element.innerHTML = `<h2>${name} Full Report</h2>`; // your full HTML here

  const html2pdf = await this.getHtml2Pdf();

  html2pdf()
    .from(element)
    .set({
      margin: 10,
      filename: `${name}_Full_Report.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .save();
}
}