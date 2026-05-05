import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SocioRequestDTO } from '../models/socio-request.dto';
import { SocioResponseDTO } from '../models/socio-response.dto';


@Injectable({
  providedIn: 'root'
})
export class SocioService {

  private readonly API = 'http://localhost:8080/socios';

  constructor(private http: HttpClient) {}

  listar(): Observable<SocioResponseDTO[]> {
    return this.http.get<SocioResponseDTO[]>(this.API);
  }

  buscarPorId(id: number): Observable<SocioResponseDTO> {
    return this.http.get<SocioResponseDTO>(`${this.API}/${id}`);
  }

  buscarPorEmpresa(idEmpresa: number): Observable<SocioResponseDTO[]> {
    return this.http.get<SocioResponseDTO[]>(`${this.API}/empresa/${idEmpresa}`);
  }

  salvar(dto: SocioRequestDTO): Observable<SocioResponseDTO> {
    return this.http.post<SocioResponseDTO>(this.API, dto);
  }

  atualizar(id: number, dto: SocioRequestDTO): Observable<SocioResponseDTO> {
    return this.http.put<SocioResponseDTO>(`${this.API}/${id}`, dto);
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}