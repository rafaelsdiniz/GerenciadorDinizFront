import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EventoCalendarioDTO } from '../models/evento-calendario.dto';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CalendarioService {

  private readonly API = `${environment.apiUrl}/calendario`;

  constructor(private http: HttpClient) {}

  porMes(idEmpresa: number, ano?: number, mes?: number): Observable<EventoCalendarioDTO[]> {
    let params = new HttpParams();
    if (ano != null) params = params.set('ano', ano.toString());
    if (mes != null) params = params.set('mes', mes.toString());
    return this.http.get<EventoCalendarioDTO[]>(`${this.API}/empresa/${idEmpresa}`, { params });
  }
}
