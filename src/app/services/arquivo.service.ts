import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ArquivoResponseDTO } from '../models/arquivo-response.dto';
import { StatusArquivo } from '../models/enums/status-arquivo.enum';
import { CategoriaFiscal } from '../models/enums/categoria-fiscal.enum';

export interface UploadArquivoParams {
  arquivo: File;
  idEmpresa: number;
  idUsuario: number;
  idPasta: number;
  descricao?: string | null;
  dataVencimento?: string | null;
  idObrigacaoPendente?: number | null;
  categoriaFiscal?: CategoriaFiscal | null;
}

@Injectable({
  providedIn: 'root'
})
export class ArquivoService {

  private readonly API = 'http://localhost:8080/arquivos';

  constructor(private http: HttpClient) {}

  listar(): Observable<ArquivoResponseDTO[]> {
    return this.http.get<ArquivoResponseDTO[]>(this.API);
  }

  buscarPorId(id: number): Observable<ArquivoResponseDTO> {
    return this.http.get<ArquivoResponseDTO>(`${this.API}/${id}`);
  }

  buscarPorEmpresa(idEmpresa: number): Observable<ArquivoResponseDTO[]> {
    return this.http.get<ArquivoResponseDTO[]>(`${this.API}/empresa/${idEmpresa}`);
  }

  vencendoEm(dias: number = 7): Observable<ArquivoResponseDTO[]> {
    return this.http.get<ArquivoResponseDTO[]>(`${this.API}/vencendo?dias=${dias}`);
  }

  vencidos(): Observable<ArquivoResponseDTO[]> {
    return this.http.get<ArquivoResponseDTO[]>(`${this.API}/vencidos`);
  }

  porStatus(status: StatusArquivo): Observable<ArquivoResponseDTO[]> {
    return this.http.get<ArquivoResponseDTO[]>(`${this.API}/por-status?status=${status}`);
  }

  porCategoria(categoria: CategoriaFiscal): Observable<ArquivoResponseDTO[]> {
    return this.http.get<ArquivoResponseDTO[]>(`${this.API}/por-categoria?categoria=${categoria}`);
  }

  listarLixeira(): Observable<ArquivoResponseDTO[]> {
    return this.http.get<ArquivoResponseDTO[]>(`${this.API}/lixeira`);
  }

  atualizarStatus(id: number, status: StatusArquivo): Observable<ArquivoResponseDTO> {
    return this.http.patch<ArquivoResponseDTO>(`${this.API}/${id}/status?status=${status}`, null);
  }

  atualizarVencimento(id: number, dataVencimento: string): Observable<ArquivoResponseDTO> {
    return this.http.patch<ArquivoResponseDTO>(
      `${this.API}/${id}/vencimento?dataVencimento=${dataVencimento}`,
      null
    );
  }

  restaurar(id: number): Observable<ArquivoResponseDTO> {
    return this.http.post<ArquivoResponseDTO>(`${this.API}/${id}/restaurar`, null);
  }

  moverParaPasta(id: number, idPasta: number): Observable<ArquivoResponseDTO> {
    return this.http.patch<ArquivoResponseDTO>(
      `${this.API}/${id}/pasta?idPasta=${idPasta}`,
      null
    );
  }

  upload(params: UploadArquivoParams): Observable<ArquivoResponseDTO> {
    const formData = new FormData();
    formData.append('arquivo', params.arquivo);
    formData.append('idEmpresa', params.idEmpresa.toString());
    formData.append('idUsuario', params.idUsuario.toString());
    formData.append('idPasta', params.idPasta.toString());

    if (params.descricao) formData.append('descricao', params.descricao);
    if (params.dataVencimento) formData.append('dataVencimento', params.dataVencimento);
    if (params.idObrigacaoPendente != null) {
      formData.append('idObrigacaoPendente', params.idObrigacaoPendente.toString());
    }
    if (params.categoriaFiscal) formData.append('categoriaFiscal', params.categoriaFiscal);

    return this.http.post<ArquivoResponseDTO>(this.API, formData);
  }

  download(id: number): Observable<Blob> {
    return this.http.get(`${this.API}/${id}/download`, { responseType: 'blob' });
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  excluirPermanente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}/permanente`);
  }
}
