import { Injectable, signal } from '@angular/core';

export type ToastTipo = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  tipo: ToastTipo;
  titulo: string;
  mensagem?: string;
}

/** Notificações curtas no canto da tela. Substitui alert() e mensagens soltas. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  success(titulo: string, mensagem?: string): void { this.push('success', titulo, mensagem); }
  error(titulo: string, mensagem?: string): void { this.push('error', titulo, mensagem, 6000); }
  warning(titulo: string, mensagem?: string): void { this.push('warning', titulo, mensagem); }
  info(titulo: string, mensagem?: string): void { this.push('info', titulo, mensagem); }

  fechar(id: number): void {
    this.toasts.update(l => l.filter(t => t.id !== id));
  }

  private push(tipo: ToastTipo, titulo: string, mensagem?: string, duracao = 4000): void {
    const id = ++this.seq;
    this.toasts.update(l => [...l.slice(-3), { id, tipo, titulo, mensagem }]);
    setTimeout(() => this.fechar(id), duracao);
  }
}
