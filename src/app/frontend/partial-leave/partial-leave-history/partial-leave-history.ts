import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../../services/leave.service';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';

@Component({
  selector: 'app-partial-leave-history',
  standalone: true,
  imports: [CommonModule, FormsModule, StaffSidebar],
  templateUrl: './partial-leave-history.html',
  styleUrl: './partial-leave-history.css',
})
export class PartialLeaveHistory implements OnInit {

  empCode = '';
  staffData = signal<any>({});
  leaves = signal<any[]>([]);
  userName = signal<string>('');

  constructor(
    private leaveService: LeaveService,
    // @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    // if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const user = JSON.parse(savedUser)?.user;

        this.userName.set(user.name);
        this.empCode = user.empCode;   // ✅ store empCode
        this.loadLeaves(this.empCode);
      }
    // }
  }

  loadLeaves(empCode: string) {
    if (!empCode) return;

    this.leaveService.getFacultyLeaves(empCode)
      .subscribe({
        next: (data: any) => {
          this.leaves.set(data);  // ✅ reactive update
        },
        error: (err) => {
          console.error('Error fetching leave history:', err);
        }
      });
  }
}