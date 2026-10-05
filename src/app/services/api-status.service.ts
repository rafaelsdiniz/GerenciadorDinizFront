import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export type EstadoApi = 'conectando' | 'lento' | 'pronto' | 'offline';

/**
 * Acorda a API (Cloud Run) e o banco (Neon) assim que o portal abre, em paralelo à animação de entrada.
 * Usa um login com e-mail inexistente: a API consulta o banco e responde 401 sem gravar auditoria.
 * Qualquer resposta HTTP significa servidor e banco acordados.
 */
@Injectable({ providedIn: 'root' })
export class ApiStatusService {
  readonly estado = signal<EstadoApi>('conectando');
  private iniciado = false;

  aquecer(): void {
    if (this.iniciado) return;
    this.iniciado = true;
    const lento = setTimeout(() => { if (this.estado() === 'conectando') this.estado.set('lento'); }, 4000);
    this.tentar(0, () => clearTimeout(lento));
  }

  private tentar(n: number, fim: () => void): void {
    fetch(`${environment.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aquecimento@diniz.local', senha: '-' }),
      cache: 'no-store'
    })
      .then(() => { fim(); this.estado.set('pronto'); })
      .catch(() => {
        if (n < 6) setTimeout(() => this.tentar(n + 1, fim), 2500);
        else { fim(); this.estado.set('offline'); }
      });
  }
}
