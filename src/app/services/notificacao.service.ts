import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificacaoService {

  private readonly API = 'http://localhost:8080/notificacoes';

  constructor(private http: HttpClient) {}

  dispararAvisos(): Observable<{ empresasNotificadas: number }> {
    return this.http.post<{ empresasNotificadas: number }>(`${this.API}/disparar-avisos`, null);
  }

  marcarVencidos(): Observable<{ arquivosVencidos: number; obrigacoesVencidas: number }> {
    return this.http.post<{ arquivosVencidos: number; obrigacoesVencidas: number }>(
      `${this.API}/marcar-vencidos`,
      null
    );
  }
}
