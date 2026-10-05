import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  titulo: string;
  mensagem?: string;
  confirmar?: string;
  cancelar?: string;
  /** 'danger' pinta o botão de vermelho (exclusões, ações irreversíveis) */
  tom?: 'primary' | 'danger';
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Diálogo de confirmação no padrão visual do sistema (substitui window.confirm).
 * Uso: if (!(await this.confirm.ask({ titulo: 'Excluir?', tom: 'danger' }))) return;
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    this.state()?.resolve(false);
    return new Promise<boolean>(resolve => this.state.set({ ...opts, resolve }));
  }

  responder(ok: boolean): void {
    const s = this.state();
    if (!s) return;
    this.state.set(null);
    s.resolve(ok);
  }
}
