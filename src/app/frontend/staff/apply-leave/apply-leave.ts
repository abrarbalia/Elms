import { Component, OnInit, signal, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaffSidebar } from '../staff-sidebar/staff-sidebar';
import { API_BASE } from '../../../api-config';
import { ToastService } from '../../../shared/toast.service';

@Component({
  selector: 'app-apply-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, StaffSidebar],
  templateUrl: './apply-leave.html',
  styleUrl: './apply-leave.css'
})
export class ApplyLeave implements OnInit {
  staffData = signal<any>({});
  remainingBalance = signal<number>(0);
  selectedFile = signal<File | null>(null);
  isSubmitting = false;

  leaveForm = {
    Emp_CODE: null as any,
    Name: '',
    Dept_Code: null as any,
    Type_of_Leave: 'CL',
    From: '',
    To: '',
    Total_Days: signal(0),
    Role: ''
  };

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const user = JSON.parse(savedUser)?.user;
        this.staffData.set(user);
        this.leaveForm.Emp_CODE = user.empCode;
        this.leaveForm.Name = user.name;
        this.leaveForm.Dept_Code = user.dept_code || 1;
        this.leaveForm.Role = user.role;
        this.fetchBalance();
      }
    }
  }

  fetchBalance() {
    this.http.get<any>(`${API_BASE}/api/staff/${this.leaveForm.Emp_CODE}`).subscribe(me => {
      if (me) this.remainingBalance.set(me.leaveBalance ?? 30);
    });
  }

  onFileSelected(event: any) { this.selectedFile.set(event.target.files[0]); }

  calculateDays() {
    if (this.leaveForm.From && this.leaveForm.To) {
      const start = new Date(this.leaveForm.From);
      const end   = new Date(this.leaveForm.To);
      if (end < start) { this.leaveForm.Total_Days.set(0); return; }
      const diffTime = Math.abs(end.getTime() - start.getTime());
      this.leaveForm.Total_Days.set(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }
  }

  onSubmit() {
    if (this.leaveForm.Type_of_Leave === 'SL' && !this.selectedFile()) {
      this.toast.warning('Document Required', 'Medical certificate is mandatory for Sick Leave (SL).');
      return;
    }
    if (this.leaveForm.Total_Days() > this.remainingBalance()) {
      this.toast.error('Insufficient Balance', `You only have ${this.remainingBalance()} days remaining.`);
      return;
    }
    if (!this.leaveForm.From || !this.leaveForm.To) {
      this.toast.warning('Missing Dates', 'Please select both From and To dates.');
      return;
    }

    this.isSubmitting = true;

    const formData = new FormData();
    formData.append('Emp_CODE',      String(this.leaveForm.Emp_CODE));
    formData.append('Name',          this.leaveForm.Name);
    formData.append('Dept_Code',     String(this.leaveForm.Dept_Code));
    formData.append('Type_of_Leave', this.leaveForm.Type_of_Leave);
    formData.append('From',          this.leaveForm.From);
    formData.append('To',            this.leaveForm.To);
    formData.append('Total_Days',    String(this.leaveForm.Total_Days()));
    formData.append('Role',          this.leaveForm.Role);
    if (this.selectedFile()) formData.append('document', this.selectedFile()!);

    this.http.post(`${API_BASE}/api/leaves/apply`, formData).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        if (res?.offlineQueued) {
          this.toast.offline('Saved Offline', 'Your leave request is queued and will sync when you reconnect.');
        } else {
          this.toast.success('Leave Submitted', 'Your application has been submitted successfully.');
        }
        this.resetForm();
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err?.error?.message || 'Something went wrong. Please try again.';
        this.toast.error('Submission Failed', msg);
      }
    });
  }

  resetForm() {
    this.leaveForm.From = '';
    this.leaveForm.To = '';
    this.leaveForm.Total_Days.set(0);
    this.selectedFile.set(null);
    this.fetchBalance();
  }
}
