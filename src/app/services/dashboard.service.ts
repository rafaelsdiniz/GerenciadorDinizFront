import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardResponseDTO } from '../models/dashboard-response.dto';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {

  private readonly API = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  porEmpresa(idEmpresa: number): Observable<DashboardResponseDTO> {
    return this.http.get<DashboardResponseDTO>(`${this.API}/empresa/${idEmpresa}`);
  }
}
