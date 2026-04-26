import { Component, OnInit, ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, Inject, PLATFORM_ID, NgZone, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
import { API_BASE } from '../../../../api-config';
import { AdminService } from '../../../services/admin.service';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashbored',
  standalone: true,
  imports: [CommonModule, AdminSidebar],
  templateUrl: './admin-dashbored.html',
  styleUrls: ['./admin-dashbored.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashbored implements OnInit, OnDestroy {
  activeLeaves: any[] = [];
  recentLeaves: any[] = []; // NEW: Last 5 Leaves
  loading = true;

  stats = {
    total: 0,
    approved: 0,
    pending: 0,
    partial: 0,
    full: 0
  };

  @ViewChild('deptChartCanvas') deptChartCanvas!: ElementRef;
  @ViewChild('typeChartCanvas') typeChartCanvas!: ElementRef;

  deptChart: Chart | null = null;
  typeChart: Chart | null = null;

  constructor(
    private http: HttpClient,
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.fetchDashboardData();
  }

  fetchDashboardData() {
    this.loading = true;
    
    // 1. Fetch Standard Leaves
    const standardReq = this.http.get<any[]>(`${API_BASE}/api/admin/leaves`).pipe(catchError(() => of([])));
    // 2. Fetch Partial Leaves
    const partialReq = this.adminService.getAllLeaves().pipe(catchError(() => of([])));

    forkJoin({
      standardLeaves: standardReq,
      partialLeaves: partialReq
    }).subscribe(({ standardLeaves, partialLeaves }) => {
      this.processData(standardLeaves || [], (partialLeaves as any[]) || []);
    });
  }

  processData(standardLeaves: any[], partialLeaves: any[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activeList: any[] = [];
    const allChronological: any[] = [];

    // Process Standard Leaves
    standardLeaves.forEach(l => {
      const fromDate = this.parseDateString(l.from || l.From_Date);
      const toDate = this.parseDateString(l.to || l.To_Date || l.from || l.From_Date);
      
      const normalizedRecord = {
        id: l._id,
        empCode: l.Emp_CODE,
        name: l.Name || 'Unknown',
        department: l.Dept_Code || 'General',
        type: "Full-Day " + (l.leaveType || l.Type_of_Leave || 'N/A'),
        rawType: l.leaveType || l.Type_of_Leave || 'Other',
        status: l.status || 'Pending',
        category: 'Full-Day',
        timestamp: l.createdAt ? new Date(l.createdAt).getTime() : (fromDate ? fromDate.getTime() : 0),
        displayDate: l.from || l.From_Date
      };

      allChronological.push(normalizedRecord);

      // Check if absent today
      if (fromDate && toDate && today >= fromDate && today <= toDate) {
        activeList.push(normalizedRecord);
      }
    });

    // Process Partial Leaves
    partialLeaves.forEach(l => {
      const pDate = this.parseDateString(l.date);
      
      const normalizedRecord = {
        id: l._id,
        empCode: l.empCode,
        name: l.name || 'Unknown',
        department: l.department || 'General',
        type: "Partial " + (l.type || 'Leave'),
        rawType: "Partial",
        status: l.status || 'Pending',
        category: 'Partial',
        timestamp: l.createdAt ? new Date(l.createdAt).getTime() : (pDate ? pDate.getTime() : 0),
        displayDate: l.date
      };

      allChronological.push(normalizedRecord);

      if (pDate && pDate.getTime() === today.getTime()) {
        activeList.push(normalizedRecord);
      }
    });

    // Top 5 Most Recently Added Leaves
    this.recentLeaves = allChronological
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    // Today's Live Active Absences
    this.activeLeaves = activeList.sort((a, b) => a.name.localeCompare(b.name));
    
    this.calculateStats();
    this.loading = false;
    this.cdr.markForCheck();

    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.drawCharts(), 100);
    }
  }

  calculateStats() {
    // We only base stats on TODAY's absences
    this.stats.total = this.activeLeaves.length;
    this.stats.approved = this.activeLeaves.filter(l => ['approved', 'final approved', 'hod approved'].includes(l.status.toLowerCase())).length;
    this.stats.pending = this.activeLeaves.filter(l => l.status.toLowerCase() === 'pending').length;
    this.stats.full = this.activeLeaves.filter(l => l.category === 'Full-Day').length;
    this.stats.partial = this.activeLeaves.filter(l => l.category === 'Partial').length;
  }

  drawCharts() {
    this.ngZone.runOutsideAngular(() => {
      if (this.deptChart) this.deptChart.destroy();
      if (this.typeChart) this.typeChart.destroy();

      if (!this.deptChartCanvas || !this.typeChartCanvas) return;

      const deptCounts: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};

      this.activeLeaves.forEach(l => {
        deptCounts[l.department] = (deptCounts[l.department] || 0) + 1;
        typeCounts[l.rawType] = (typeCounts[l.rawType] || 0) + 1;
      });

      const rootStyles = getComputedStyle(document.body);
      const primaryColor = rootStyles.getPropertyValue('--bs-primary') || '#0d6efd';

      this.deptChart = new Chart(this.deptChartCanvas.nativeElement.getContext('2d'), {
        type: 'bar',
        data: {
          labels: Object.keys(deptCounts),
          datasets: [{
            label: 'Absent Staff',
            data: Object.values(deptCounts),
            backgroundColor: primaryColor,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });

      const typeColors = ['#ffc107', '#17a2b8', '#198754', '#dc3545', '#6610f2', '#fd7e14'];
      this.typeChart = new Chart(this.typeChartCanvas.nativeElement.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: Object.keys(typeCounts),
          datasets: [{
            data: Object.values(typeCounts),
            backgroundColor: typeColors.slice(0, Object.keys(typeCounts).length)
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right' } },
          cutout: '70%'
        }
      });
    });
  }

  parseDateString(dateStr: any): Date | null {
    if (!dateStr) return null;
    const s = String(dateStr);
    if (s.includes("-")) {
      const parts = s.split("T")[0].split("-").map(Number);
      if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    if (s.includes("/")) {
      const parts = s.split("/").map(Number);
      if (parts.length === 3) return new Date(parts[2], parts[0] - 1, parts[1]);
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      d.setHours(0,0,0,0);
      return d;
    }
    return null;
  }

  isApproved(status: string): boolean {
    return ['approved', 'final approved', 'hod approved'].includes(status.toLowerCase());
  }

  isRejected(status: string): boolean {
    return status.toLowerCase() === 'rejected';
  }

  ngOnDestroy() {
    if (this.deptChart) this.deptChart.destroy();
    if (this.typeChart) this.typeChart.destroy();
  }
}
