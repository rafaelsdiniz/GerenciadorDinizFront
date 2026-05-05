import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { PerfilUsuario } from '../models/enums/tipo-usuario.enum';
import { JwtPayload } from '../models/jwt-payload.model';
import { LoginRequestDTO } from '../models/login-request.dto';
import { TokenResponseDTO } from '../models/token-response.dto';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly API = 'http://localhost:8080/auth';
  private readonly TOKEN_KEY = 'token';

  constructor(private http: HttpClient) {}

  login(dto: LoginRequestDTO): Observable<TokenResponseDTO> {
    return this.http.post<TokenResponseDTO>(`${this.API}/login`, dto).pipe(
      tap(response => localStorage.setItem(this.TOKEN_KEY, response.token))
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLogado(): boolean {
    const token = this.getToken();
    if (!token) return false;

    const payload = this.getPayload();
    if (!payload) return false;

    // verifica se o token expirou
    return payload.exp * 1000 > Date.now();
  }

  getPayload(): JwtPayload | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const base64 = token.split('.')[1];
      return JSON.parse(atob(base64)) as JwtPayload;
    } catch {
      return null;
    }
  }

  getUsuarioId(): number | null {
    return this.getPayload()?.usuarioId ?? null;
  }

  getEmpresaId(): number | null {
    return this.getPayload()?.empresaId ?? null;
  }

  getPerfil(): PerfilUsuario | null {
    return this.getPayload()?.groups[0] ?? null;
  }

  isAdmin(): boolean {
    return this.getPerfil() === PerfilUsuario.ADMIN;
  }
}