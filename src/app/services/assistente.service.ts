import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Botão de navegação sugerido pelo assistente. */
export interface AssistenteAcao {
  rotulo: string;
  rota: string;
  queryParams?: Record<string, string>;
}

export interface AssistenteResposta {
  resposta: string;
  fonte: 'IA' | 'AUTOMATICA';
  acoes: AssistenteAcao[];
  dados?: Record<string, number>;
}

export interface AssistenteStatus {
  iaConfigurada: boolean;
  nome: string;
  escritorio: boolean;
  sugestoes: string[];
}

export interface AssistenteItemHistorico {
  papel: 'usuario' | 'assistente';
  texto: string;
}

/** Assistente Diniz: chat com IA que responde com os dados da conta do usuário. */
@Injectable({ providedIn: 'root' })
export class AssistenteService {

  private readonly API = `${environment.apiUrl}/assistente`;

  /** Tamanho máximo da pergunta (igual ao backend). */
  static readonly MAX = 1000;

  constructor(private http: HttpClient) {}

  status(): Observable<AssistenteStatus> {
    return this.http.get<AssistenteStatus>(`${this.API}/status`);
  }

  perguntar(mensagem: string, historico: AssistenteItemHistorico[]): Observable<AssistenteResposta> {
    return this.http.post<AssistenteResposta>(`${this.API}/mensagem`, {
      mensagem,
      historico: historico.slice(-8)
    });
  }
}
