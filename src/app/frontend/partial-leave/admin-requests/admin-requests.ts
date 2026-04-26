import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';
// const Department = require("../models/Department");
declare var bootstrap: any; // Needed for Bootstrap modals

@Component({
  selector: 'app-admin-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, StaffSidebar],
  templateUrl: './admin-requests.html',
  styleUrls: ['./admin-requests.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminRequests implements OnInit {

  requests: any[] = [];
  showForm = false;
  lookupStatus: 'idle' | 'searching' | 'found' | 'error' = 'idle';

  newLeave: any = this.getEmptyForm();
  departments: string[] = [];
  // ── NEW USER OBJECT ──────────────────────────────────────
  newUser = {
    name: '',
    empCode: '',
    email: '',
    department: '',
    role: 'user',
    password: ''
  };
  leaveTypes: any[] = [];

  // ── TOAST NOTIFICATIONS ──────────────────────────────────
  toastMessage = '';
  toastType: 'success' | 'danger' | 'warning' = 'success';
  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadPending();
    this.loadLeaveTypes(); // 🔥 NEW
  }
  loadLeaveTypes() {
    this.adminService.getLeaveTypes().subscribe({
      next: (data: any) => {
        this.leaveTypes = data || [];
        this.cdr.markForCheck();
      },
      error: () => this.leaveTypes = []
    });
  }

  // ================= HELPER =================
  getEmptyForm() {
    return {
      empCode: '',
      name: '',
      department: '',
      type: '',
      date: '',
      timeIn: '',
      timeOut: '',
      officialIn: '10:45',   // Default official start
      officialOut: '16:30',  // Default official end
      reason: ''
    };
  }

  toMinutes(time: string): number {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  calculateMinutes(record?: any): number {
    const leave = record || this.newLeave;

    const type = leave.type;
    const officialIn = this.toMinutes(leave.officialIn);
    const officialOut = this.toMinutes(leave.officialOut);
    const actualIn = this.toMinutes(leave.timeIn);
    const actualOut = this.toMinutes(leave.timeOut);

    let minutes = 0;

    if (type === 'Late') minutes = actualIn - officialIn;
    else if (type === 'Early') minutes = officialOut - actualOut;
    else minutes = actualOut - actualIn;

    if (minutes < 0) minutes = 0;
    if (minutes > 180) minutes = 180;

    return minutes;
  }

  getHours(minutes: number) {
    if (!minutes || minutes <= 0) return '0 hr';
    let rounded = Math.ceil(minutes / 30) * 30;
    if (rounded < 30) rounded = 30;
    if (rounded > 180) rounded = 180;
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m === 0 ? `${h} hr` : `${h}.5 hr`;
  }

  // ================= LOAD =================
  loadPending() {
    this.adminService.getPendingLeaves().subscribe((data: any) => {
      this.requests = (data || []).map((r: any) => ({
        ...r,
        officialIn: r.officialIn || '10:45',
        officialOut: r.officialOut || '16:30'
      }));
      this.cdr.markForCheck();
    });
  }

  // ================= APPROVE =================
  approve(record: any) {

    if (!record.officialIn || !record.officialOut) {
      this.showToast("Please fill Official Start & End time ❌", 'warning');
      return;
    }

    const payload = {
      officialIn: record.officialIn,
      officialOut: record.officialOut
    };

    this.adminService.approveLeave(record._id, payload).subscribe(() => {
      this.requests = this.requests.filter(r => r._id !== record._id);
      this.cdr.markForCheck();
    });
  }

  // ── OPEN MODAL ──────────────────────────────────────────
  openAddUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
  }

  // ── SAVE NEW USER ───────────────────────────────────────
  saveNewUser() {
    // Basic validation
    if (!this.newUser.name || !this.newUser.empCode || !this.newUser.email || !this.newUser.password) {
      this.showToast('Please fill all required fields.', 'warning');
      return;
    }


  }

  // ================= REJECT =================
  reject(id: string) {
    this.adminService.rejectLeave(id).subscribe(() => {
      this.requests = this.requests.filter(r => r._id !== id);
      this.cdr.markForCheck();
    });
  }

  // ================= DELETE =================
  delete(id: string) {
    if (confirm("Delete this record?")) {
      this.adminService.deleteLeave(id).subscribe(() => {
        this.requests = this.requests.filter(r => r._id !== id);
        this.cdr.markForCheck();
      });
    }
  }

  // ================= FORM =================
  toggleForm() {
    this.showForm = !this.showForm;
    if (this.showForm) this.newLeave = this.getEmptyForm(); // reset with defaults
    this.cdr.markForCheck();
  }

  // ================= TOAST =================
  showToast(message: string, type: 'success' | 'danger' | 'warning') {
    this.toastMessage = message;
    this.toastType = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 4000);
  }

  validateForm(): boolean {
    if (!this.newLeave.empCode) {
      this.showToast("Employee ID required ❌", 'warning');
      return false;
    }
    if (!this.newLeave.officialIn || !this.newLeave.officialOut) {
      this.showToast("Official timings required ❌", 'warning');
      return false;
    }
    if (this.newLeave.type === 'Late' && !this.newLeave.timeIn) {
      this.showToast("Time In required ❌", 'warning');
      return false;
    }
    if (this.newLeave.type === 'Early' && !this.newLeave.timeOut) {
      this.showToast("Time Out required ❌", 'warning');
      return false;
    }
    if (this.newLeave.type === 'Inbetween' && (!this.newLeave.timeIn || !this.newLeave.timeOut)) {
      this.showToast("Both times required ❌", 'warning');
      return false;
    }
    return true;
  }

  addLeave() {
    if (!this.validateForm()) return;

    const totalMinutes = this.calculateMinutes();
    const totalHours = this.getHours(totalMinutes);

    this.newLeave.totalMinutes = totalMinutes;
    this.newLeave.totalHours = totalHours;

    this.adminService.adminAddLeave(this.newLeave).subscribe({
      next: (res: any) => {
        // Do not add to 'requests' (pending list) as it is auto-approved
        this.cdr.markForCheck();
        this.showToast(`Partial Leave Added Successfully ✅\nSR NO: ${res.leave.srNo}\nStatus: Approved`, 'success');
        this.showForm = false;
        this.newLeave = this.getEmptyForm();
      },
      error: (err) => this.showToast(err.error?.message || "Error ❌", 'danger')
    });
  }

  // ================= FETCH USER =================
  fetchUser() {
    const code = this.newLeave.empCode;
    
    // Reset state and clear fields if code is too short
    if (!code || code.length < 3) {
      this.lookupStatus = 'idle';
      this.newLeave.name = '';
      this.newLeave.department = '';
      this.cdr.markForCheck();
      return;
    }

    if (isNaN(Number(code))) return;

    this.lookupStatus = 'searching';
    this.cdr.markForCheck();

    this.adminService.getUserByEmpCode(code).subscribe({
      next: (res: any) => {
        this.newLeave.name = res.name || '';
        this.newLeave.department = res.department || '';
        this.lookupStatus = 'found';
        this.cdr.markForCheck();
      },
      error: () => {
        this.newLeave.name = '';
        this.newLeave.department = '';
        this.lookupStatus = 'error';
        this.cdr.markForCheck();
      }
    });
  }
}