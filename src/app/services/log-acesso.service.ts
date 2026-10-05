import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LogAcessoResponseDTO } from '../models/log-acesso-response.dto';
import { AcaoLog } from '../models/enums/acao-log.enum';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LogAcessoService {

  private readonly API = `${environment.apiUrl}/logs`;

  constructor(private http: HttpClient) {}

  listarRecentes(limite: number = 100): Observable<LogAcessoResponseDTO[]> {
    return this.http.get<LogAcessoResponseDTO[]>(`${this.API}?limite=${limite}`);
  }

  porEntidade(tipo: string, id: number): Observable<LogAcessoResponseDTO[]> {
    return this.http.get<LogAcessoResponseDTO[]>(`${this.API}/entidade/${tipo}/${id}`);
  }

  porAcao(acao: AcaoLog): Observable<LogAcessoResponseDTO[]> {
    return this.http.get<LogAcessoResponseDTO[]>(`${this.API}/acao/${acao}`);
  }

  porPeriodo(inicio: string, fim: string): Observable<LogAcessoResponseDTO[]> {
    return this.http.get<LogAcessoResponseDTO[]>(`${this.API}/periodo?inicio=${inicio}&fim=${fim}`);
  }
}
