import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { IconComponent } from '../icon.component';
import { CamposAprimoradosService } from './campos-aprimorados.service';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';

/** Renderiza toasts e o diálogo de confirmação globais. Fica no App root. */
@Component({
  selector: 'app-ui-host',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast toast-' + t.tipo" role="status">
          <span class="toast-icon">
            <app-icon [name]="icone(t.tipo)" [size]="18" [stroke]="2" />
          </span>
          <div class="toast-body">
            <strong>{{ t.titulo }}</strong>
            @if (t.mensagem) { <p>{{ t.mensagem }}</p> }
          </div>
          <button class="btn-icon sm" (click)="toast.fechar(t.id)" aria-label="Fechar">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>

    @if (confirm.state(); as c) {
      <div class="modal-backdrop" (click)="confirm.responder(false)">
        <div class="modal modal-sm" role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-body confirm-body">
            <span class="icon-tile lg" [class.danger]="c.tom === 'danger'">
              <app-icon [name]="c.tom === 'danger' ? 'alert-triangle' : 'info'" [size]="22" />
            </span>
            <div>
              <h2 class="modal-title">{{ c.titulo }}</h2>
              @if (c.mensagem) { <p class="confirm-msg">{{ c.mensagem }}</p> }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="confirm.responder(false)">{{ c.cancelar || 'Cancelar' }}</button>
            <button class="btn" [class.btn-danger]="c.tom === 'danger'" [class.btn-primary]="c.tom !== 'danger'"
                    (click)="confirm.responder(true)" autofocus>
              {{ c.confirmar || 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .toast-stack {
      position: fixed; right: 24px; bottom: 24px; z-index: var(--z-toast);
      display: flex; flex-direction: column; gap: 10px; width: min(380px, calc(100vw - 32px));
    }
    .toast {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 10px 14px 16px;
      background: var(--navy-900); color: #fff;
      border-radius: var(--radius-lg); box-shadow: var(--shadow-3);
      animation: slideUp var(--t-slow) var(--ease-spring);
    }
    .toast-icon { margin-top: 1px; }
    .toast-success .toast-icon { color: #6ee7a0; }
    .toast-error .toast-icon { color: #ff8fab; }
    .toast-warning .toast-icon { color: #ffc56b; }
    .toast-info .toast-icon { color: var(--primary-200); }
    .toast-body { flex: 1; min-width: 0; padding-top: 1px; }
    .toast-body strong { font-weight: 500; font-size: 14px; display: block; }
    .toast-body p { font-size: 13px; color: rgba(255,255,255,.72); margin-top: 2px; }
    .toast .btn-icon { color: rgba(255,255,255,.6); margin-top: -4px; }
    .toast .btn-icon:hover { background: rgba(255,255,255,.1); color: #fff; }
    /* acima de modais e drawers abertos pelas telas */
    .modal-backdrop { z-index: calc(var(--z-dropdown) + 50); }
    .confirm-body { display: flex; gap: 16px; align-items: flex-start; padding: 24px 24px 20px; }
    .confirm-msg { margin-top: 6px; color: var(--ink-mute); font-size: 14px; line-height: 1.5; }
    @media (max-width: 640px) { .toast-stack { right: 16px; bottom: 16px; } }
  `],
})
export class UiHostComponent implements OnInit, OnDestroy {
  readonly toast = inject(ToastService);
  readonly confirm = inject(ConfirmService);
  private readonly campos = inject(CamposAprimoradosService);

  /** Esc fecha só o diálogo: captura antes das outras telas e não deixa o evento seguir. */
  private readonly onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && this.confirm.state()) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      this.confirm.responder(false);
    }
  };

  ngOnInit(): void {
    window.addEventListener('keydown', this.onKey, true);
    this.campos.iniciar();
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.onKey, true);
  }

  icone(tipo: string): string {
    return { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' }[tipo] ?? 'info';
  }
}
