import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_BASE } from '../../api-config';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  api = `${API_BASE}/api/partialadmin`;

  constructor(private http: HttpClient) {}

  // ── Apply ────────────────────────────────────────────────
  applyLeave(data: any) {
    return this.http.post(`${this.api}/apply`, data);
  }

  // ── Get All (active, non-deleted) ────────────────────────
  getAllLeaves() {
    return this.http.get(`${this.api}/all`);
  }

  // ── Faculty Leaves ───────────────────────────────────────
  getFacultyLeaves(empCode: string) {
    return this.http.get(`${this.api}/faculty/${empCode}`);
  }

  // ── Approve ──────────────────────────────────────────────
  approveLeave(id: string, data: any) {
    return this.http.put(`${this.api}/approve/${id}`, data);
  }

  // ── Reject ───────────────────────────────────────────────
  rejectLeave(id: string) {
    return this.http.put(`${this.api}/reject/${id}`, {});
  }

  // ── Stats ────────────────────────────────────────────────
  getStats() {
    return this.http.get(`${this.api}/stats`);
  }

  // ── Update (edit date/hours) ─────────────────────────────
  updateLeave(id: string, data: any) {
    return this.http.put(`${this.api}/update/${id}`, data);
  }

  // ── Pending ──────────────────────────────────────────────
  getPendingLeaves() {
    return this.http.get(`${this.api}/pending`);
  }

  // ── Admin Add ────────────────────────────────────────────
  adminAddLeave(data: any) {
    return this.http.post(`${this.api}/admin-add`, data);
  }

  // ── Soft Delete ──────────────────────────────────────────
  deleteLeave(id: string) {
    return this.http.delete(`${this.api}/delete/${id}`);
  }

  // ── User Lookup ──────────────────────────────────────────
  getUserByEmpCode(empCode: number) {
    return this.http.get(`${this.api}/user/${empCode}`);
  }

  // ── Leave Types ──────────────────────────────────────────
  getLeaveTypes() {
    return this.http.get(`${API_BASE}/api/partial-leave-types/`);
  }

  // ── Consolidated Report ──────────────────────────────────
  getConsolidatedReport(filters: {
    fromDate?: string;
    toDate?: string;
    empCode?: string;
    name?: string;
    department?: string;
  }) {
    let params = new HttpParams();
    if (filters.fromDate)   params = params.set('fromDate',   filters.fromDate);
    if (filters.toDate)     params = params.set('toDate',     filters.toDate);
    if (filters.empCode)    params = params.set('empCode',    filters.empCode);
    if (filters.name)       params = params.set('name',       filters.name);
    if (filters.department) params = params.set('department', filters.department);
    return this.http.get(`${this.api}/consolidated`, { params });
  }

  // ── Recycle Bin — Get Deleted Records ───────────────────
  getDeletedLeaves() {
    return this.http.get(`${this.api}/recycle-bin`);
  }

  // ── Recycle Bin — Restore a Record ──────────────────────
  restoreLeave(id: string) {
    return this.http.put(`${this.api}/restore/${id}`, {});
  }
}