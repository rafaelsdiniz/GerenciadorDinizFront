import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PastaRequestDTO } from '../models/pasta-request.dto';
import { PastaResponseDTO } from '../models/pasta-response.dto';

@Injectable({
  providedIn: 'root'
})
export class PastaService {

  private readonly API = 'http://localhost:8080/pastas';

  constructor(private http: HttpClient) {}

  listar(): Observable<PastaResponseDTO[]> {
    return this.http.get<PastaResponseDTO[]>(this.API);
  }

  buscarPorId(id: number): Observable<PastaResponseDTO> {
    return this.http.get<PastaResponseDTO>(`${this.API}/${id}`);
  }

  buscarPorEmpresa(idEmpresa: number): Observable<PastaResponseDTO[]> {
    return this.http.get<PastaResponseDTO[]>(`${this.API}/empresa/${idEmpresa}`);
  }

  buscarPastasRaiz(idEmpresa: number): Observable<PastaResponseDTO[]> {
    return this.http.get<PastaResponseDTO[]>(`${this.API}/empresa/${idEmpresa}/raiz`);
  }

  buscarSubpastas(idPastaPai: number): Observable<PastaResponseDTO[]> {
    return this.http.get<PastaResponseDTO[]>(`${this.API}/${idPastaPai}/subpastas`);
  }

  salvar(dto: PastaRequestDTO): Observable<PastaResponseDTO> {
    return this.http.post<PastaResponseDTO>(this.API, dto);
  }

  atualizar(id: number, dto: PastaRequestDTO): Observable<PastaResponseDTO> {
    return this.http.put<PastaResponseDTO>(`${this.API}/${id}`, dto);
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}