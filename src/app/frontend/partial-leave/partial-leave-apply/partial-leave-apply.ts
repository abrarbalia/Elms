import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';
import { API_BASE } from '../../../api-config';
import { ToastService } from '../../../shared/toast.service';

@Component({
  selector: 'app-partial-leave-apply',
  standalone: true,
  imports: [CommonModule, FormsModule, StaffSidebar],
  templateUrl: './partial-leave-apply.html',
  styleUrl: './partial-leave-apply.css',
})
export class PartialLeaveApply implements OnInit {

  leave: any = { empCode: '', type: '', date: '', timeIn: '', timeOut: '', reason: '' };
  leaveTypes: any[] = [];
  users: any = { empCode: '', name: '', role: '' };
  staffLeaves: any[] = [];
  staffLoading = true;
  staffError = false;
  isSubmitting = false;

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.loadUserFromStorage();
    this.loadStaffLeaves();
    this.loadLeaveTypes();
  }

  loadLeaveTypes() {
    this.http.get<any[]>(`${API_BASE}/api/partial-leave-types/`)
      .subscribe({ next: (d) => this.leaveTypes = d || [], error: () => this.leaveTypes = [] });
  }

  loadUserFromStorage() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('user');
      if (saved) {
        const parsed = JSON.parse(saved)?.user ?? JSON.parse(saved);
        this.users = { empCode: parsed?.empCode || '', name: parsed?.name || '', role: parsed?.role || 'Staff' };
        this.leave.empCode = this.users.empCode;
      }
    }
    this.staffLoading = false;
  }

  loadStaffLeaves() {
    const empCode = this.users.empCode || this.leave.empCode;
    if (!empCode) return;
    this.http.get<any[]>(`${API_BASE}/api/partial-leaves/${empCode}`)
      .subscribe({ next: (d) => this.staffLeaves = d || [], error: () => this.staffLeaves = [] });
  }

  onTypeChange() { this.leave.timeIn = ''; this.leave.timeOut = ''; }

  convertToMinutes(time: string): number {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return (h * 60) + m;
  }

  roundToThirty(minutes: number): number {
    const steps = [30, 60, 90, 120, 150, 180];
    for (const s of steps) { if (minutes <= s) return s; }
    return minutes;
  }

  calculatedHours = '0 hr';

  onTimeChange() {
    let totalMinutes = 0;
    const ti = this.convertToMinutes(this.leave.timeIn);
    const to = this.convertToMinutes(this.leave.timeOut);

    if (this.leave.type === 'Late') {
      const diff = ti - this.convertToMinutes('10:45');
      if (diff > 0) totalMinutes = this.roundToThirty(diff);
    } else if (this.leave.type === 'Early') {
      const diff = this.convertToMinutes('18:00') - to;
      if (diff > 0) totalMinutes = this.roundToThirty(diff);
    } else if (this.leave.type === 'Inbetween') {
      const diff = to - ti;
      if (diff > 0) totalMinutes = this.roundToThirty(diff);
    }

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    this.calculatedHours = m === 0 ? `${h} hr` : `${h}.5 hr`;
  }

  submitLeave() {
    let totalMinutes = 0;
    const ti = this.convertToMinutes(this.leave.timeIn);
    const to = this.convertToMinutes(this.leave.timeOut);

    if (this.leave.type === 'Late') {
      const diff = ti - this.convertToMinutes('10:45');
      if (diff <= 0) { this.toast.warning('Not Late', 'Office starts at 10:45 AM — you are on time.'); return; }
      totalMinutes = this.roundToThirty(diff);
    }

    if (this.leave.type === 'Early') {
      const diff = this.convertToMinutes('18:00') - to;
      if (diff <= 0) { this.toast.warning('Not Early', 'Departure is after office closing time.'); return; }
      totalMinutes = this.roundToThirty(diff);
    }

    if (this.leave.type === 'Inbetween') {
      if (to <= ti) { this.toast.warning('Invalid Time', 'Return time must be after departure time.'); return; }
      const diff = to - ti;
      totalMinutes = this.roundToThirty(diff);
    }

    if (!this.leave.date) { this.toast.warning('Date Required', 'Please select the leave date.'); return; }
    if (!this.leave.reason.trim()) { this.toast.warning('Reason Required', 'Please provide a reason for the leave.'); return; }

    const totalHours = this.calculatedHours;
    const payload = { ...this.leave, totalMinutes, totalHours };

    this.isSubmitting = true;

    this.http.post(`${API_BASE}/api/partial-leaves/apply`, payload).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;

        if (res?.offlineQueued) {
          this.toast.offline('Saved Offline', 'Partial leave queued — will auto-sync when reconnected.');
        } else {
          this.toast.success('Leave Applied', 'Your partial leave has been submitted successfully.');

          if (res?.redirect) {
            this.toast.info('Redirecting', res.message);
            setTimeout(() => window.location.href = res.redirect, 1500);
            return;
          }
        }

        this.leave = { empCode: this.users.empCode, type: '', date: '', timeIn: '', timeOut: '', reason: '' };
        this.calculatedHours = '0 hr';
        this.loadStaffLeaves();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toast.error('Submission Failed', err.error?.message || 'Something went wrong. Please try again.');
      }
    });
  }
}