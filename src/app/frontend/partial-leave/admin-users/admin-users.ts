import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { AdminUserService } from '../../services/admin-user.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';
import { ToastService } from '../../../shared/toast.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [FormsModule, CommonModule, StaffSidebar],
  templateUrl: './admin-users.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsers implements OnInit {

  users: any[] = [];
  filteredUsers: any[] = [];
  departments: any[] = [];

  searchText = '';
  alertMessage = '';
  alertType: 'success' | 'danger' | 'warning' | '' = '';

  // Initial Form State
  userForm: any = {
    "Employee Code": '',
    "Name": '',
    "Email": '',
    "Password": '',
    role: 'Employee',
    department: '',
    leaveBalance: 30,
    dept_code: ''
  };

  editId: string | null = null;
  isSubmitting = false;

  constructor(
    private userService: AdminUserService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.loadDepartments();
  }

  // =============== ALERT HELPER ===============
  showAlert(message: string, type: 'success' | 'danger' | 'warning') {
    this.alertMessage = message;
    this.alertType = type;
    this.cdr.markForCheck();

    setTimeout(() => {
      this.alertMessage = '';
      this.alertType = '';
      this.cdr.markForCheck();
    }, 2500);
  }

  // =============== DATA LOADING ===============
  loadUsers() {
    this.userService.getUsers().subscribe({
      next: (res) => {
        this.users = res;
        this.filteredUsers = res;
        this.cdr.markForCheck();
      },
      error: () => this.showAlert('Failed to load users', 'danger')
    });
  }

  loadDepartments() {
    this.userService.getDepartments().subscribe({
      next: (res: any) => {
        this.departments = res;
        this.cdr.markForCheck();
      }
    });
  }

  // =============== SEARCH & FILTER ===============
  filterUsers() {
    const text = this.searchText.toLowerCase().trim();

    if (!text) {
      this.filteredUsers = [...this.users];
    } else {
      this.filteredUsers = this.users.filter(u =>
        String(u['Employee Code']).includes(text) ||
        (u['Name']?.toLowerCase().includes(text)) ||
        (u['Email']?.toLowerCase().includes(text))
      );
    }
    this.cdr.markForCheck();
  }

  // =============== CRUD OPERATIONS ===============
  
  // Single click fix: Use object spreading and explicit detection
  editUser(user: any) {
    this.editId = user._id;
    // Create a new object reference to trigger OnPush detection
    this.userForm = { ...user };
    
    // UI improvement: Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    this.cdr.markForCheck();
  }

  saveUser() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.cdr.markForCheck();

    if (this.editId) {
      // UPDATE EXISTING
      this.userService.updateUser(this.editId, this.userForm).subscribe({
        next: () => {
          this.toast.success('User Updated', 'The staff directory has been updated successfully.');
          this.loadUsers();
          this.resetForm();
          this.isSubmitting = false;
        },
        error: (err) => {
          this.toast.error('Update Failed', err?.error?.message || 'Server error while updating user.');
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      // ADD NEW
      this.userService.addUser(this.userForm).subscribe({
        next: () => {
          this.toast.success('User Added', 'New staff member registered successfully.');
          this.loadUsers();
          this.resetForm();
          this.isSubmitting = false;
        },
        error: (err) => {
          this.toast.error('Add Failed', err?.error?.message || 'Check Email/Employee Code uniqueness.');
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  deleteUser(id: string) {
    if (confirm('Are you sure you want to delete this user?')) {
      this.userService.deleteUser(id).subscribe({
        next: () => {
          this.showAlert('User removed from directory', 'warning');
          this.loadUsers();
        },
        error: () => this.showAlert('Delete failed', 'danger')
      });
    }
  }

  // =============== RESET FORM ===============
  resetForm() {
    this.editId = null;
    this.userForm = {
      "Employee Code": '',
      "Name": '',
      "Email": '',
      "Password": '',
      role: 'Employee',
      department: '',
      leaveBalance: 30,
      dept_code: ''
    };
    this.cdr.markForCheck();
  }

  // =============== PDF REPORT ===============
  exportFullReport() {
    this.userService.getAllPartialLeaves().subscribe({
      next: (leavesData: any[]) => {
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text('Advanced System Report: Staff directory & leaves', 14, 20);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
        
        let startY = 35;
        
        this.users.forEach((user, index) => {
          if (index !== 0) {
            doc.addPage();
            startY = 20;
          }
          
          doc.setFontSize(14);
          doc.setTextColor(20, 20, 20);
          doc.text(`User: ${user.Name} (${user['Employee Code']})`, 14, startY);
          
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 80);
          doc.text(`Department: ${user.department || 'N/A'} (Code: ${user.dept_code || 'N/A'})`, 14, startY + 6);
          doc.text(`Email: ${user.Email}`, 14, startY + 12);
          
          const userLeaves = leavesData.filter(l => l.employeeCode === user['Employee Code']);
          const totalReqs = userLeaves.length;
          
          let totalApprovedMins = 0;
          userLeaves.forEach(l => {
            if (l.hodApproval === 'Approved') {
              // Calculate difference
              const d1 = new Date(`1970-01-01T${l.startTime}:00Z`).getTime();
              const d2 = new Date(`1970-01-01T${l.endTime}:00Z`).getTime();
              if(!isNaN(d1) && !isNaN(d2)) {
                 totalApprovedMins += (d2 - d1) / 60000;
              }
            }
          });
          
          const totalHours = (totalApprovedMins / 60).toFixed(2);
          
          doc.text(`Total Requests: ${totalReqs}`, 14, startY + 18);
          doc.text(`Total Approved Minutes: ${totalApprovedMins} mins`, 14, startY + 24);
          doc.text(`Total Approved Hours: ${totalHours} hrs`, 14, startY + 30);
          
          startY += 36;
          
          if (userLeaves.length > 0) {
            const tableRows = userLeaves.map(l => [
              l.sr_no || '-',
              l.date ? new Date(l.date).toLocaleDateString() : 'N/A',
              `${l.startTime} - ${l.endTime}`,
              l.Type_of_Leave || 'N/A',
              l.hodApproval || 'Pending'
            ]);
            
            autoTable(doc, {
              startY: startY,
              head: [['Sr No', 'Date', 'Time', 'Leave Type', 'Status']],
              body: tableRows,
              theme: 'grid',
              styles: { fontSize: 9 },
              headStyles: { fillColor: [13, 110, 253] }
            });
            
            startY = (doc as any).lastAutoTable.finalY + 15;
          } else {
            doc.text('No leave requests found for this user.', 14, startY);
            startY += 10;
          }
        });
        
        doc.save('ELMS_Full_Users_Report.pdf');
        this.showAlert('Report generated successfully', 'success');
      },
      error: () => this.showAlert('Failed to fetch leave data for report', 'danger')
    });
  }
}