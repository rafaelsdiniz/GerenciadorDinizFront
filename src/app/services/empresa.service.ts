// service/empresa.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EmpresaResponseDTO } from '../models/empresa-response.dto';
import { EmpresaRequestDTO } from '../models/empresa-request.dto';

@Injectable({
  providedIn: 'root'
})
export class EmpresaService {

  private readonly API = 'http://localhost:8080/empresas';

  constructor(private http: HttpClient) {}

  listar(): Observable<EmpresaResponseDTO[]> {
    return this.http.get<EmpresaResponseDTO[]>(this.API);
  }

  buscarPorId(id: number): Observable<EmpresaResponseDTO> {
    return this.http.get<EmpresaResponseDTO>(`${this.API}/${id}`);
  }

  salvar(dto: EmpresaRequestDTO): Observable<EmpresaResponseDTO> {
    return this.http.post<EmpresaResponseDTO>(this.API, dto);
  }

  atualizar(id: number, dto: EmpresaRequestDTO): Observable<EmpresaResponseDTO> {
    return this.http.put<EmpresaResponseDTO>(`${this.API}/${id}`, dto);
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}