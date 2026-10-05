import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CompetenciaDTO, FechamentoMensalDTO, FechamentoResumoDTO, FechamentoUpdateDTO
} from '../models/fechamento.dto';

/** Fechamento mensal (quadro do escritório). Endpoints exclusivos do ADMIN. */
@Injectable({ providedIn: 'root' })
export class FechamentoService {

  private readonly API = `${environment.apiUrl}/fechamentos`;

  constructor(private http: HttpClient) {}

  /** Fechamentos de todas as empresas na competência "MM/aaaa" (o backend cria as linhas que faltam). */
  listar(competencia?: string | null): Observable<FechamentoMensalDTO[]> {
    const params = competencia ? new HttpParams().set('competencia', competencia) : undefined;
    return this.http.get<FechamentoMensalDTO[]>(this.API, { params });
  }

  competencias(): Observable<CompetenciaDTO[]> {
    return this.http.get<CompetenciaDTO[]>(`${this.API}/competencias`);
  }

  resumo(competencia?: string | null): Observable<FechamentoResumoDTO> {
    const params = competencia ? new HttpParams().set('competencia', competencia) : undefined;
    return this.http.get<FechamentoResumoDTO>(`${this.API}/resumo`, { params });
  }

  atualizar(id: number, dto: FechamentoUpdateDTO): Observable<FechamentoMensalDTO> {
    return this.http.patch<FechamentoMensalDTO>(`${this.API}/${id}`, dto);
  }
}
