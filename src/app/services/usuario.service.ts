import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UsuarioRequestDTO } from '../models/usuario-request.dto';
import { UsuarioResponseDTO } from '../models/usuario-response.dto';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

  private readonly API = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  listar(): Observable<UsuarioResponseDTO[]> {
    return this.http.get<UsuarioResponseDTO[]>(this.API);
  }

  buscarPorId(id: number): Observable<UsuarioResponseDTO> {
    return this.http.get<UsuarioResponseDTO>(`${this.API}/${id}`);
  }

  buscarPorEmpresa(idEmpresa: number): Observable<UsuarioResponseDTO[]> {
    return this.http.get<UsuarioResponseDTO[]>(`${this.API}/empresa/${idEmpresa}`);
  }

  salvar(dto: UsuarioRequestDTO): Observable<UsuarioResponseDTO> {
    return this.http.post<UsuarioResponseDTO>(this.API, dto);
  }

  atualizar(id: number, dto: UsuarioRequestDTO): Observable<UsuarioResponseDTO> {
    return this.http.put<UsuarioResponseDTO>(`${this.API}/${id}`, dto);
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  // ---------- conta do usuário logado ----------
  meuPerfil(): Observable<UsuarioResponseDTO> {
    return this.http.get<UsuarioResponseDTO>(`${this.API}/me`);
  }

  atualizarMeuNome(nome: string): Observable<UsuarioResponseDTO> {
    return this.http.put<UsuarioResponseDTO>(`${this.API}/me`, { nome });
  }

  alterarMinhaSenha(senhaAtual: string, novaSenha: string): Observable<void> {
    return this.http.put<void>(`${this.API}/me/senha`, { senhaAtual, novaSenha });
  }
}