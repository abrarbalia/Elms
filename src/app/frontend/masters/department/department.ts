import {
  Component, signal, OnInit, OnDestroy,
  ChangeDetectorRef, Inject, PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  FormsModule, ReactiveFormsModule,
  FormBuilder, FormGroup, Validators
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';
import { API_BASE } from '../../../api-config';

@Component({
  selector: 'app-department',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, StaffSidebar],
  templateUrl: './department.html',
  styleUrls: ['./department.css']
})
export class Department implements OnInit, OnDestroy {

  // ✅ API (your backend)
  private apiUrl = `${API_BASE}/api/departments`;

  // ✅ DATA
  departments = signal<any[]>([]);

  // ✅ SEARCH + SORT
  searchTerm = '';
  sortColumn = '';
  sortDir: 'asc' | 'desc' = 'asc';

  // ✅ PAGINATION
  currentPage = 1;
  pageSize = 5;

  // ✅ FORM
  form!: FormGroup;
  modalMode: 'add' | 'edit' = 'add';
  selectedItem: any = null;

  // ✅ TOAST
  toastMsg = '';
  toastType = '';
  private toastTimer: any;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.buildForm(null);
  }

  // ================= INIT =================
  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.getDepartments();
    }
  }

  // ================= API =================
  getDepartments() {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (res) => {
        const formatted = res.map((d, i) => ({
          ...d,
          srNo: i + 1
        }));

        this.departments.set(formatted);
        this.cdr.markForCheck();
      },
      error: () => {
        this.showToast('Failed to load departments', 'danger');
      }
    });
  }

  // ================= FILTER =================
  get filtered(): any[] {
    let list = this.departments().filter(d =>
      d.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );

    if (this.sortColumn) {
      list = [...list].sort((a, b) => {
        const av = a[this.sortColumn] || '';
        const bv = b[this.sortColumn] || '';
        return this.sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    return list;
  }

  get paged(): any[] {
    return this.filtered.slice(
      (this.currentPage - 1) * this.pageSize,
      this.currentPage * this.pageSize
    );
  }

  get totalPages() {
    return Math.ceil(this.filtered.length / this.pageSize) || 1;
  }

  get pages() {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // ================= SORT =================
  sort(col: string) {
    this.sortColumn === col
      ? this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc'
      : (this.sortColumn = col, this.sortDir = 'asc');
  }

  // ================= PAGINATION =================
  goToPage(p: number) {
    if (p >= 1 && p <= this.totalPages) this.currentPage = p;
  }

  // ================= FORM =================
  buildForm(item: any) {
    this.form = this.fb.group({
      name: [item?.name || '', Validators.required],
      dept_code: [item?.dept_code || '', Validators.required],
      startTime: [item?.startTime || '', Validators.required],
      endTime: [item?.endTime || '', Validators.required]
    });
  }

  openAdd() {
    this.modalMode = 'add';
    this.selectedItem = null;
    this.buildForm(null);
  }

  openEdit(item: any) {
    this.modalMode = 'edit';
    this.selectedItem = item;
    this.buildForm(item);
  }

  // ================= SAVE =================
  submitForm() {
    if (this.form.invalid) return;

    const payload = this.form.value;

    if (this.modalMode === 'add') {

      this.http.post(this.apiUrl, payload).subscribe({
        next: () => {
          this.getDepartments();
          this.showToast('Added successfully', 'success');
          this.closeModal('departmentModal');
        }
      });

    } else {

      this.http.put(`${this.apiUrl}/${this.selectedItem._id}`, payload)
        .subscribe({
          next: () => {
            this.getDepartments();
            this.showToast('Updated successfully', 'success');
            this.closeModal('departmentModal');
          }
        });
    }
  }

  // ================= DELETE =================
  confirmDelete() {
    this.http.delete(`${this.apiUrl}/${this.selectedItem._id}`)
      .subscribe({
        next: () => {
          this.getDepartments();
          this.showToast('Deleted successfully', 'danger');
          this.closeModal('deleteModal');
        }
      });
  }

  openDelete(item: any) {
    this.selectedItem = item;
  }

  // ================= CSV =================
  exportCSV() {

    const rows = [['Sr No', 'Name', 'Code', 'Start Time', 'End Time']];

    this.filtered.forEach(d => {
      rows.push([
        d.srNo,
        d.name,
        d.dept_code,
        d.startTime,
        d.endTime
      ]);
    });

    const csv = rows.map(r => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'departments.csv';
    a.click();
  }

  // ================= TOAST =================
  showToast(msg: string, type: string) {
    clearTimeout(this.toastTimer);
    this.toastMsg = msg;
    this.toastType = type;

    this.toastTimer = setTimeout(() => this.toastMsg = '', 3000);
  }

  // ================= MODAL =================
  closeModal(id: string) {
    if (isPlatformBrowser(this.platformId)) {
      const modal = (window as any).bootstrap?.Modal.getInstance(
        document.getElementById(id)
      );
      modal?.hide();
    }
  }

  ngOnDestroy() {
    clearTimeout(this.toastTimer);
  }
}