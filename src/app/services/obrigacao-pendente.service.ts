import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ObrigacaoPendenteResponseDTO } from '../models/obrigacao-pendente-response.dto';

@Injectable({ providedIn: 'root' })
export class ObrigacaoPendenteService {

  private readonly API = 'http://localhost:8080/obrigacoes-pendentes';

  constructor(private http: HttpClient) {}

  listar(): Observable<ObrigacaoPendenteResponseDTO[]> {
    return this.http.get<ObrigacaoPendenteResponseDTO[]>(this.API);
  }

  buscarPorId(id: number): Observable<ObrigacaoPendenteResponseDTO> {
    return this.http.get<ObrigacaoPendenteResponseDTO>(`${this.API}/${id}`);
  }

  buscarPorEmpresa(idEmpresa: number): Observable<ObrigacaoPendenteResponseDTO[]> {
    return this.http.get<ObrigacaoPendenteResponseDTO[]>(`${this.API}/empresa/${idEmpresa}`);
  }

  pendentesPorEmpresa(idEmpresa: number): Observable<ObrigacaoPendenteResponseDTO[]> {
    return this.http.get<ObrigacaoPendenteResponseDTO[]>(`${this.API}/empresa/${idEmpresa}/pendentes`);
  }

  vencidas(): Observable<ObrigacaoPendenteResponseDTO[]> {
    return this.http.get<ObrigacaoPendenteResponseDTO[]>(`${this.API}/vencidas`);
  }

  vencendoEm(dias: number = 7): Observable<ObrigacaoPendenteResponseDTO[]> {
    return this.http.get<ObrigacaoPendenteResponseDTO[]>(`${this.API}/vencendo?dias=${dias}`);
  }

  gerarPendentes(): Observable<{ criadas: number }> {
    return this.http.post<{ criadas: number }>(`${this.API}/gerar`, null);
  }

  marcarEntregue(id: number): Observable<ObrigacaoPendenteResponseDTO> {
    return this.http.patch<ObrigacaoPendenteResponseDTO>(`${this.API}/${id}/entregar`, null);
  }

  atualizarVencimento(id: number, dataVencimento: string): Observable<ObrigacaoPendenteResponseDTO> {
    return this.http.patch<ObrigacaoPendenteResponseDTO>(
      `${this.API}/${id}/vencimento?dataVencimento=${dataVencimento}`,
      null
    );
  }
}
