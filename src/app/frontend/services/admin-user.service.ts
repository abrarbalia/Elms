import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../../api-config';

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {

  private apiUrl = `${API_BASE}/api/users`;

  constructor(private http: HttpClient) {}

  // GET all users
  getUsers(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  // ADD user
  addUser(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  // UPDATE user
  updateUser(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  // DELETE user
  deleteUser(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
  getDepartments() {
    return this.http.get(`${API_BASE}/api/departments/`);
  }

  // GET all partial leaves for reporting
  getAllPartialLeaves(): Observable<any> {
    return this.http.get(`${API_BASE}/api/partial-leaves/all`);
  }
}