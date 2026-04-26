import {
  Component, OnInit, Inject, PLATFORM_ID,
  ChangeDetectionStrategy,ChangeDetectorRef
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';
import { Router } from '@angular/router';
import { API_BASE } from '../../../api-config';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule, StaffSidebar],
  templateUrl: './staff-dashbored.html',
  styleUrls: ['./staff-dashbored.css'],
  changeDetection: ChangeDetectionStrategy.OnPush   // ✅ ADD THIS
})
export class StaffDashbored implements OnInit {

  user: any = null;

  leaveStats = {
    approved: 0,
    pending: 0,
    rejected: 0
  };

  totalHours: string = '0';
  approvalRate = 0;
  todayLeave = false;
  recentLeaves: any[] = [];

  loading = true;
constructor(
  private http: HttpClient,
  @Inject(PLATFORM_ID) private platformId: Object,
  private router: Router,
  private cdr: ChangeDetectorRef   // ✅ ADD THIS
) {}

  // ================= INIT =================
  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadUser();
    }
  }

  // ================= NAVIGATION =================

  // 👉 Go to history page
  goToHistory() {
    this.router.navigate(['/partial-leave-history']);
  }

  // 👉 Go to apply leave page
  goToAddLeave() {
    this.router.navigate(['/partial-leave']);
  }

  // 👉 Refresh dashboard manually
  refreshDashboard() {
    if (this.user?.empCode) {
      this.loading = true;
      this.loadDashboard(this.user.empCode);
    }
  }

  // ================= USER =================
  loadUser() {
    const saved = localStorage.getItem('user');

    if (!saved) {
      this.loading = false;
      return;
    }

    const parsed = JSON.parse(saved)?.user ?? JSON.parse(saved);
    this.user = parsed;

    console.log("USER:", this.user);

    this.loadDashboard(parsed.empCode);
  }

  // ================= API =================
  loadDashboard(empCode: number) {

    this.http.get<any[]>(`${API_BASE}/api/partial-leaves/my/${empCode}`)
      .subscribe({next: (data) => {
  console.log("API RESPONSE:", data);

  if (!data || data.length === 0) {
    this.resetData();
    this.loading = false;
    this.cdr.markForCheck();   // ✅ IMPORTANT
    return;
  }

  this.processData(data);
  this.loading = false;

  this.cdr.markForCheck();   // ✅ IMPORTANT
},
       error: (err) => {
  console.error("API ERROR:", err);
  this.resetData();
  this.loading = false;

  this.cdr.markForCheck();   // ✅ IMPORTANT
}
      });
  }

  // ================= PROCESS =================
  processData(data: any[]) {

    const normalize = (s: string) => s?.toLowerCase().trim();

    this.leaveStats.approved = data.filter(l => normalize(l.status) === 'approved').length;
    this.leaveStats.pending  = data.filter(l => normalize(l.status) === 'pending').length;
    this.leaveStats.rejected = data.filter(l => normalize(l.status) === 'rejected').length;

    // ✅ Total Hours
    const totalMinutes = data
      .filter(l => normalize(l.status) === 'approved')
      .reduce((sum, l) => sum + Number(l.totalMinutes || 0), 0);

    this.totalHours = (totalMinutes / 60).toFixed(1);

    // ✅ Approval %
    const total = data.length;
    this.approvalRate = total
      ? Math.round((this.leaveStats.approved / total) * 100)
      : 0;

    // ✅ Today Leave
    const today = new Date();

    this.todayLeave = data.some(l => {
      const d = new Date(l.date);
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    });

    // ✅ Recent (latest 5)
    this.recentLeaves = [...data]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }

  // ================= RESET =================
  resetData() {
    this.leaveStats = { approved: 0, pending: 0, rejected: 0 };
    this.totalHours = '0';
    this.approvalRate = 0;
    this.todayLeave = false;
    this.recentLeaves = [];
  }

  // ================= HELPERS =================
  getTotal() {
    return this.leaveStats.approved +
           this.leaveStats.pending +
           this.leaveStats.rejected;
  }
}