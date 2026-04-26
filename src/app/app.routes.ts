import { Routes } from '@angular/router';
import { Login } from './frontend/login/login';
import { AdminDashbored } from './frontend/login/admin/admin-dashbored/admin-dashbored';
import { StaffDashbored } from './frontend/staff/staff-dashbored/staff-dashbored';
import { AdminManagedStaff } from './frontend/login/admin/admin-managed-staff/admin-managed-staff';
import { AdminLeave } from './frontend/login/admin/admin-leave/admin-leave';
import { AdminLeaveType } from './frontend/login/admin/admin-leave-type/admin-leave-type';
import { ApplyLeave } from './frontend/staff/apply-leave/apply-leave';
import { HodLeaveApproved } from './frontend/staff/hod-leave-approved/hod-leave-approved';
import { StaffViewStatus } from './frontend/staff/staff-view-status/staff-view-status';
import { Report } from './frontend/login/admin/report/report';
import { AdminLeaveApplication } from './frontend/login/admin/admin-leave-application/admin-leave-application';
import { PartialLeaveApply } from './frontend/partial-leave/partial-leave-apply/partial-leave-apply';
import { PartialLeaveHistory } from './frontend/partial-leave/partial-leave-history/partial-leave-history';
import { Department } from './frontend/masters/department/department';
import { PartialLeaveType } from './frontend/masters/partial-leave-type/partial-leave-type';
import { PartialReport } from './frontend/partial-leave/partial-report/partial-report';
import { AdminRequests } from './frontend/partial-leave/admin-requests/admin-requests';
import { AdminUsers } from './frontend/partial-leave/admin-users/admin-users';
import { PartialProfileUpdate } from './frontend/partial-leave/partial-profile-update/partial-profile-update';
import { PartialAdminDashboard } from './frontend/partial-leave/partial-admin-dashboard/partial-admin-dashboard';
import { ConsolidatedReport } from './frontend/partial-leave/consolidated-report/consolidated-report';
import { RecycleBin } from './frontend/partial-leave/recycle-bin/recycle-bin';

export const routes: Routes = [
  // 1. Default Route
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // 2. Auth Route
  { path: 'login', component: Login },

  // // 3. Admin Routes
  { path: 'admin-dashboard', component: AdminDashbored },
  { path: 'partial-admin-dashboard', component: PartialAdminDashboard },
  { path: 'admin-managed-staff', component: AdminManagedStaff },
  { path: 'admin-leave', component: AdminLeave },
  { path: 'admin-leave-type', component: AdminLeaveType },
  { path: 'admin-report', component: Report },
  { path: 'admin-leave-application', component: AdminLeaveApplication },
  { path: 'admin-requests', component: AdminRequests },
  // // 4. Staff/HOD Dashboard
  { path: 'staff-dashboard', component: StaffDashbored },
  { path: 'apply-leave', component: ApplyLeave },
  { path: 'hod-leave-approved', component: HodLeaveApproved },
  { path: 'staff-view-status', component: StaffViewStatus },
  
  // 5. Partial Leave
  { path: 'partial-report', component: PartialReport },
  { path: 'partial-leave', component: PartialLeaveApply },
  { path: 'partial-leave-history', component: PartialLeaveHistory },
  {path:'add-user',component:AdminUsers},

  // 6.Department master
  { path: 'department', component: Department },

  // 6.Partial Leave Type master
  { path: 'partial-leave-type', component: PartialLeaveType },

  // Profile Update
  { path: 'partial-profile-update', component: PartialProfileUpdate },

  // Consolidated Report (Admin Only)
  { path: 'consolidated-report', component: ConsolidatedReport },

  // Recycle Bin (Admin Only)
  { path: 'recycle-bin', component: RecycleBin },

  // 7. Wildcard Redirect
  { path: '**', redirectTo: 'login' }
];