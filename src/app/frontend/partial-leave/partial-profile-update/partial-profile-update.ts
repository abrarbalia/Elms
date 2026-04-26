import { Component, OnInit, Inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { StaffSidebar } from '../../staff/staff-sidebar/staff-sidebar';
import { API_BASE } from '../../../api-config';

@Component({
  selector: 'app-partial-profile-update',
  standalone: true,
  imports: [CommonModule, FormsModule, StaffSidebar],
  templateUrl: './partial-profile-update.html',
  styleUrl: './partial-profile-update.css'
})
export class PartialProfileUpdate implements OnInit {
  // Signals for state management
  user = signal<any>(null);
  loading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  
  // Data signals
  email = signal('');
  password = signal('');



  constructor(
    private router: Router,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const fullPayload = JSON.parse(savedUser);
        const userData = fullPayload.user || fullPayload;
        this.user.set(userData);
        // Prefill email from session storage, never prefill password
        this.email.set(userData.email || userData.Email || '');
      } else {
        this.router.navigate(['/login']);
      }
    }
  }

  updateProfile() {
    if (!this.email() || !this.password()) {
      this.errorMessage.set('Email and Password are required.');
      return;
    }

    this.loading.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    const body = {
      Email: this.email(),
      Password: this.password()
    };

    // Correct backend route for faculty profile updates
    this.http.put<any>(`${API_BASE}/api/staff/profile/${this.user().empCode}`, body).subscribe({
      next: (res) => {
        if (res.message) {
          this.successMessage.set('Password updated successfully!');
          
          // DO NOT blindly overwrite localStorage 'user' because it contains the JWT token!
          // Since the email is readonly, we really don't even need to sync local storage, but just in case:
          const fullPayload = JSON.parse(localStorage.getItem('user') || '{}');
          if (fullPayload.user) {
             fullPayload.user.email = this.email();
             localStorage.setItem('user', JSON.stringify(fullPayload));
          }
          
          // Clear password field after successful update
          this.password.set('');
        } else {
          this.errorMessage.set(res.message || 'Failed to update profile.');
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'An error occurred while updating profile.');
        this.loading.set(false);
      }
    });
  }
}
