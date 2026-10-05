import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConversaRecenteDTO, MensagemDTO, MensagemRequestDTO, MensagensNaoLidasDTO } from '../models/mensagem.dto';

/**
 * Mensagens entre escritório e cliente dentro de cada obrigação.
 *
 * `naoLidas$` guarda a última contagem de não lidas do usuário logado: a lista de pendências,
 * a conversa e o painel de notificações ficam sincronizados sem novas chamadas a cada tela.
 */
@Injectable({ providedIn: 'root' })
export class MensagemService {

  private readonly API = `${environment.apiUrl}/mensagens`;
  private readonly naoLidasSubject = new BehaviorSubject<MensagensNaoLidasDTO>({ total: 0, porObrigacao: {} });

  /** Última contagem conhecida de mensagens não lidas. */
  readonly naoLidas$ = this.naoLidasSubject.asObservable();

  constructor(private http: HttpClient) {}

  /** Conversa da obrigação (mais antiga primeiro). Abrir marca como lidas as mensagens do outro lado. */
  conversa(idObrigacao: number): Observable<MensagemDTO[]> {
    return this.http.get<MensagemDTO[]>(`${this.API}/obrigacao/${idObrigacao}`).pipe(
      tap(() => this.zerarLocal(idObrigacao))
    );
  }

  enviar(idObrigacao: number, dto: MensagemRequestDTO): Observable<MensagemDTO> {
    return this.http.post<MensagemDTO>(`${this.API}/obrigacao/${idObrigacao}`, dto);
  }

  /** Busca as não lidas e atualiza `naoLidas$`. */
  naoLidas(): Observable<MensagensNaoLidasDTO> {
    return this.http.get<MensagensNaoLidasDTO>(`${this.API}/nao-lidas`).pipe(
      tap(r => this.naoLidasSubject.next({ total: r?.total ?? 0, porObrigacao: r?.porObrigacao ?? {} }))
    );
  }

  /** Atualiza `naoLidas$` em segundo plano (erros são ignorados). */
  atualizarNaoLidas(): void {
    this.naoLidas().subscribe({ error: () => {} });
  }

  recentes(limite = 10): Observable<ConversaRecenteDTO[]> {
    return this.http.get<ConversaRecenteDTO[]>(`${this.API}/recentes?limite=${limite}`);
  }

  /** A conversa foi aberta: zera o contador local daquela obrigação na hora. */
  private zerarLocal(idObrigacao: number): void {
    const atual = this.naoLidasSubject.value;
    const n = atual.porObrigacao[idObrigacao];
    if (!n) return;
    const porObrigacao = { ...atual.porObrigacao };
    delete porObrigacao[idObrigacao];
    this.naoLidasSubject.next({ total: Math.max(0, atual.total - n), porObrigacao });
  }
}
