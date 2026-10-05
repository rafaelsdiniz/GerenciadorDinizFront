import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CertidaoRequestDTO, CertidaoResponseDTO, CertidaoResumoDTO } from '../models/certidao.dto';

/** Leitura inteligente de documento (POST /ia/analisar) — campos usados para pré-preencher a certidão. */
export interface LeituraDocumento {
  validade?: string | null;
  numeroDocumento?: string | null;
  tipoDocumento?: string | null;
  descricao?: string | null;
  [campo: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class CertidaoService {

  private readonly API = `${environment.apiUrl}/certidoes`;

  constructor(private http: HttpClient) {}

  /** Certidões visíveis ao usuário (ADMIN: todas; cliente: só da própria empresa). */
  listar(): Observable<CertidaoResponseDTO[]> {
    return this.http.get<CertidaoResponseDTO[]>(this.API);
  }

  porEmpresa(idEmpresa: number): Observable<CertidaoResponseDTO[]> {
    return this.http.get<CertidaoResponseDTO[]>(`${this.API}/empresa/${idEmpresa}`);
  }

  buscarPorId(id: number): Observable<CertidaoResponseDTO> {
    return this.http.get<CertidaoResponseDTO>(`${this.API}/${id}`);
  }

  resumo(idEmpresa?: number | null): Observable<CertidaoResumoDTO> {
    let params = new HttpParams();
    if (idEmpresa != null) params = params.set('empresa', idEmpresa.toString());
    return this.http.get<CertidaoResumoDTO>(`${this.API}/resumo`, { params });
  }

  criar(dto: CertidaoRequestDTO): Observable<CertidaoResponseDTO> {
    return this.http.post<CertidaoResponseDTO>(this.API, dto);
  }

  atualizar(id: number, dto: CertidaoRequestDTO): Observable<CertidaoResponseDTO> {
    return this.http.put<CertidaoResponseDTO>(`${this.API}/${id}`, dto);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  /** Envia o PDF para o Drive da empresa (pasta Certidões) e vincula à certidão. */
  anexar(id: number, arquivo: File): Observable<CertidaoResponseDTO> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    return this.http.post<CertidaoResponseDTO>(`${this.API}/${id}/anexo`, form);
  }

  /** Leitura inteligente (módulo de IA). Pode não existir: quem chama ignora falhas. */
  lerDocumento(arquivo: File): Observable<LeituraDocumento> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    return this.http.post<LeituraDocumento>(`${environment.apiUrl}/ia/analisar`, form);
  }
}
