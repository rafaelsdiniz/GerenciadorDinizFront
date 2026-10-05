import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DocumentoAnalisado, ResultadoLeituraArquivo, StatusIa } from '../models/documento-analisado.dto';

/** Leitura inteligente de documentos (IA DeepSeek + leitura automática por padrões). */
@Injectable({ providedIn: 'root' })
export class IaService {
  private readonly API = `${environment.apiUrl}/ia`;
  private status$?: Observable<StatusIa>;

  constructor(private http: HttpClient) {}

  /** IA configurada no servidor? (resultado em cache durante a sessão) */
  status(): Observable<StatusIa> {
    this.status$ ??= this.http.get<StatusIa>(`${this.API}/status`).pipe(
      catchError(() => of({ configurada: false, provedor: 'DeepSeek', modelo: null, leituraPorPadroes: true } as StatusIa)),
      shareReplay(1)
    );
    return this.status$;
  }

  /** Lê um arquivo ANTES do envio (nada é gravado). Empresa/obrigação são usadas nas conferências. */
  analisar(arquivo: File, opcoes: { idObrigacaoPendente?: number | null; idEmpresa?: number | null } = {}): Observable<DocumentoAnalisado> {
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    if (opcoes.idObrigacaoPendente != null) fd.append('idObrigacaoPendente', String(opcoes.idObrigacaoPendente));
    if (opcoes.idEmpresa != null) fd.append('idEmpresa', String(opcoes.idEmpresa));
    return this.http.post<DocumentoAnalisado>(`${this.API}/analisar`, fd);
  }

  /** Lê um arquivo já armazenado e grava valor, linha digitável, competência... */
  analisarArquivo(idArquivo: number): Observable<ResultadoLeituraArquivo> {
    return this.http.post<ResultadoLeituraArquivo>(`${this.API}/arquivos/${idArquivo}/analisar`, null);
  }

  /** Guia fictícia (DAS ou FGTS) para demonstrar a leitura, montada para a empresa/obrigação informada. */
  baixarExemplo(tipo: 'das' | 'fgts', opcoes: { idObrigacaoPendente?: number | null; idEmpresa?: number | null } = {}): Observable<Blob> {
    let params = new HttpParams();
    if (opcoes.idObrigacaoPendente != null) params = params.set('idObrigacaoPendente', opcoes.idObrigacaoPendente);
    if (opcoes.idEmpresa != null) params = params.set('idEmpresa', opcoes.idEmpresa);
    return this.http.get(`${this.API}/exemplos/guia-${tipo}-exemplo.pdf`, { params, responseType: 'blob' });
  }
}
