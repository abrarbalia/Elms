import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Inject, PLATFORM_ID, NgZone, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import { AdminService } from '../../services/admin.service';
import { API_BASE } from '../../../api-config';
import { RouterLink } from '@angular/router';
import { StaffSidebar } from "../../staff/staff-sidebar/staff-sidebar";

Chart.register(...registerables);

@Component({
  selector: 'app-partial-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, StaffSidebar],
  templateUrl: './partial-admin-dashboard.html',
  styleUrls: ['./partial-admin-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PartialAdminDashboard implements OnInit, OnDestroy {
  loading = true;
  stats: any = {
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0
  };

  recentRequests: any[] = [];
  todayLate = 0;
  todayEarly = 0;

  chart: Chart | null = null;

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    this.fetchData();
  }

  fetchData() {
    this.loading = true;

    forkJoin({
      stats: this.adminService.getStats().pipe(catchError(() => of({ total: 0, approved: 0, pending: 0, rejected: 0 }))),
      recent: this.adminService.getAllLeaves().pipe(catchError(() => of([])))
    }).subscribe(({ stats, recent }: any) => {
      this.stats = stats;
      this.recentRequests = (recent as any[]).slice(0, 5);

      // Calculate today's activity
      const today = new Date().toISOString().split('T')[0];
      const todaysLeaves = (recent as any[]).filter(l => l.date === today);
      this.todayLate = todaysLeaves.filter(l => l.type === 'Late').length;
      this.todayEarly = todaysLeaves.filter(l => l.type === 'Early').length;

      this.loading = false;
      this.cdr.markForCheck();

      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => this.initCharts(recent as any[]), 100);
      }
    });
  }

  initCharts(data: any[]) {
    this.ngZone.runOutsideAngular(() => {
      const canvas = document.getElementById('leaveTrendChart') as HTMLCanvasElement;
      if (!canvas) return;

      if (this.chart) this.chart.destroy();

      // Simple aggregation by type
      const typeCounts = {
        Late: data.filter(l => l.type === 'Late').length,
        Early: data.filter(l => l.type === 'Early').length,
        Inbetween: data.filter(l => l.type === 'Inbetween').length
      };

      this.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Late Arrival', 'Early Departure', 'Inbetween'],
          datasets: [{
            data: [typeCounts.Late, typeCounts.Early, typeCounts.Inbetween],
            backgroundColor: ['#4f46e5', '#06b6d4', '#64748b'],
            borderWidth: 0,
            hoverOffset: 15
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
          },
          cutout: '75%'
        }
      });
    });
  }

  ngOnDestroy() {
    if (this.chart) this.chart.destroy();
  }
}
