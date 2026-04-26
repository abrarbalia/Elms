import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { API_BASE } from '../../api-config'

@Injectable({
  providedIn: 'root'
})
export class LeaveService {

  api = `${API_BASE}/api`

  constructor(private http: HttpClient) {}

  applyLeave(data:any){
    return this.http.post(`${this.api}/leave/apply`, data)
  }

  getAllLeaves(){
    return this.http.get(`${this.api}/leave/all`)
  }

  getFacultyLeaves(empCode:string){
    return this.http.get(`${this.api}/partial-leaves/my/${empCode}`)
  }

  approveLeave(id:string){
    return this.http.put(`${this.api}/leave/approve/${id}`, {})
  }

  rejectLeave(id:string){
    return this.http.put(`${this.api}/leave/reject/${id}`, {})
  }

  getStats(){
    return this.http.get(`${this.api}/leave/stats`)
  }

  getDepartments(){
     return this.http.get(`${this.api}/departments`)
  }
createDepartment(data: any) {
  return this.http.post(`${this.api}/departments`, data);
}

updateDepartment(id: string, data: any) {
  return this.http.put(`${this.api}/departments/${id}`, data);
}

deleteDepartment(id: string) {
  return this.http.delete(`${this.api}/departments/${id}`);
}


  getPendingLeaves() {
    return this.http.get(`${this.api}/leave/pending`);
  }

  adminAddLeave(data: any) {
    return this.http.post(`${this.api}/leave/admin-add`, data);
  }

  deleteLeave(id: string) {
    return this.http.delete(`${this.api}/leave/delete/${id}`);
  }


  getUserByEmpCode(empCode: number) {
    return this.http.get<any>(`${this.api}/faculty/${empCode}`);
  }
  
}