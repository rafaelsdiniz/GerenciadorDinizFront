import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ObrigacaoRecorrenteRequestDTO } from '../models/obrigacao-recorrente-request.dto';
import { ObrigacaoRecorrenteResponseDTO } from '../models/obrigacao-recorrente-response.dto';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ObrigacaoRecorrenteService {

  private readonly API = `${environment.apiUrl}/obrigacoes-recorrentes`;

  constructor(private http: HttpClient) {}

  listar(): Observable<ObrigacaoRecorrenteResponseDTO[]> {
    return this.http.get<ObrigacaoRecorrenteResponseDTO[]>(this.API);
  }

  buscarPorId(id: number): Observable<ObrigacaoRecorrenteResponseDTO> {
    return this.http.get<ObrigacaoRecorrenteResponseDTO>(`${this.API}/${id}`);
  }

  buscarPorEmpresa(idEmpresa: number): Observable<ObrigacaoRecorrenteResponseDTO[]> {
    return this.http.get<ObrigacaoRecorrenteResponseDTO[]>(`${this.API}/empresa/${idEmpresa}`);
  }

  salvar(dto: ObrigacaoRecorrenteRequestDTO): Observable<ObrigacaoRecorrenteResponseDTO> {
    return this.http.post<ObrigacaoRecorrenteResponseDTO>(this.API, dto);
  }

  atualizar(id: number, dto: ObrigacaoRecorrenteRequestDTO): Observable<ObrigacaoRecorrenteResponseDTO> {
    return this.http.put<ObrigacaoRecorrenteResponseDTO>(`${this.API}/${id}`, dto);
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}
