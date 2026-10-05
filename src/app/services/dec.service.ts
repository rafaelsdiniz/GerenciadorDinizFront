import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ComunicacaoDecDTO, ResultadoSincronizacaoDec, StatusIntegracaoDec } from '../models/comunicacao-dec.dto';
import { environment } from '../../environments/environment';

/** Comunicações do DEC sincronizadas no backend (somente leitura). */
@Injectable({ providedIn: 'root' })
export class DecService {

  private readonly API = `${environment.apiUrl}/dec`;

  constructor(private http: HttpClient) {}

  status(): Observable<StatusIntegracaoDec> {
    return this.http.get<StatusIntegracaoDec>(`${this.API}/status`);
  }

  listar(): Observable<ComunicacaoDecDTO[]> {
    return this.http.get<ComunicacaoDecDTO[]>(`${this.API}/comunicacoes`);
  }

  porEmpresa(idEmpresa: number): Observable<ComunicacaoDecDTO[]> {
    return this.http.get<ComunicacaoDecDTO[]>(`${this.API}/comunicacoes/empresa/${idEmpresa}`);
  }

  sincronizar(): Observable<ResultadoSincronizacaoDec> {
    return this.http.post<ResultadoSincronizacaoDec>(`${this.API}/sincronizar`, null);
  }
}
