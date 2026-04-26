import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Required for ngModel
import { CommonModule } from '@angular/common'; // Required for @if
import { API_BASE } from '../../api-config';

@Component({
  selector: 'app-login',
  standalone: true, // Ensure this is a standalone component
  imports: [FormsModule, CommonModule], // Import these modules here
  templateUrl: './login.html'
})
export class Login implements OnInit {
  loginForm = { email: '', password: '' };
  rememberMe: boolean = false;
  errorMsg = '';
  isLoading: boolean = false;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.checkAutoLogin();
  }

  checkAutoLogin() {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const res = JSON.parse(savedUser);
      if (res.role === 'Admin') {
        this.router.navigate(['/partial-admin-dashboard']);
      } else {
        this.router.navigate(['/staff-dashboard']);
      }
    }
  }

  onLogin() {
    this.isLoading = true;
    this.errorMsg = '';
    this.http.post(`${API_BASE}/api/auth/login`, this.loginForm).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        
        if (this.rememberMe) {
          localStorage.setItem('user', JSON.stringify(res));
          localStorage.setItem('elms_remember_me', 'true');
        } else {
          // Store session data only if needed or keep it in service state
          // For now, if "remember me" is not checked, we still might need the token for session.
          // In standard practice we might use sessionStorage instead. To maintain current behavior we'll just save it to local storage
          localStorage.setItem('user', JSON.stringify(res)); 
        }

        if (res.role === 'Admin') {
          this.router.navigate(['/partial-admin-dashboard']);
        } else {
          this.router.navigate(['/staff-dashboard']);
        }
      },
      error: () => {
        this.isLoading = false;
        this.errorMsg = "Login Failed. Check your email/password.";
      }
    });
  }
}