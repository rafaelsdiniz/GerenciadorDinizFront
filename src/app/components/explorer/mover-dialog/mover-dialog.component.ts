import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconComponent } from '../../../shared/icon.component';

export type OpcaoDestino = { id: number; nome: string; nivel: number };

/** Diálogo "Mover para…": árvore de pastas da empresa para escolher o destino. */
@Component({
  selector: 'app-mover-dialog',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="modal-backdrop" (click)="cancelar()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mover-titulo" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="mover-titulo">Mover {{ quantidade === 1 ? 'arquivo' : quantidade + ' arquivos' }}</h2>
            <p class="modal-subtitle">Escolha a pasta de destino{{ nomeEmpresa ? ' em ' + nomeEmpresa : '' }}.</p>
          </div>
          <button type="button" class="btn-icon" (click)="cancelar()" [disabled]="movendo" aria-label="Fechar" title="Fechar (Esc)">
            <app-icon name="x" [size]="18" />
          </button>
        </div>
        <div class="modal-body move-body">
          @if (!opcoes.length) {
            <div class="empty">
              <span class="empty-icon"><app-icon name="folder-plus" [size]="22" /></span>
              <span class="empty-title">Nenhuma pasta disponível</span>
              <span class="empty-text">Crie uma pasta antes de mover arquivos.</span>
            </div>
          } @else {
            <div class="move-list" role="listbox" aria-label="Pastas de destino">
              @for (op of opcoes; track op.id) {
                <button type="button" class="move-item" role="option"
                        [class.active]="destino === op.id" [attr.aria-selected]="destino === op.id"
                        [disabled]="atual(op.id)" [style.padding-left.px]="12 + op.nivel * 20"
                        (click)="destino = op.id" (dblclick)="destino = op.id; confirmar.emit(op.id)">
                  <app-icon [name]="destino === op.id ? 'folder-open' : 'folder'" [size]="16" />
                  <span class="truncate">{{ op.nome }}</span>
                  @if (atual(op.id)) { <span class="badge badge-neutral">Atual</span> }
                  @if (destino === op.id) { <app-icon class="move-check" name="check" [size]="16" [stroke]="2" /> }
                </button>
              }
            </div>
          }
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="cancelar()" [disabled]="movendo">Cancelar</button>
          <button type="button" class="btn btn-primary" (click)="destino !== null && confirmar.emit(destino)" [disabled]="destino === null || movendo">
            @if (movendo) { <span class="spinner"></span> Movendo… } @else { <app-icon name="folder-input" [size]="16" /> Mover aqui }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .move-body { padding: var(--sp-md); }
    .move-list { display: flex; flex-direction: column; gap: 2px; max-height: 50vh; overflow-y: auto; }
    .move-item {
      display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 8px 12px;
      border: 1px solid transparent; border-radius: var(--radius-sm); background: none;
      text-align: left; color: var(--ink-2); cursor: pointer;
    }
    .move-item:hover:not(:disabled) { background: var(--canvas-soft); }
    .move-item.active { background: var(--primary-50); border-color: var(--primary-200); color: var(--primary); font-weight: 500; }
    .move-item:disabled { cursor: not-allowed; color: var(--ink-faint); }
    .move-check { margin-left: auto; }
  `]
})
export class MoverDialogComponent {
  @Input() opcoes: OpcaoDestino[] = [];
  /** Pastas onde os arquivos já estão (desabilitada quando todos estão na mesma). */
  @Input() origem = new Set<number>();
  @Input() quantidade = 1;
  @Input() nomeEmpresa = '';
  @Input() movendo = false;

  @Output() confirmar = new EventEmitter<number>();
  @Output() fechar = new EventEmitter<void>();

  destino: number | null = null;

  atual(id: number): boolean {
    return this.origem.size === 1 && this.origem.has(id);
  }

  cancelar(): void {
    if (!this.movendo) this.fechar.emit();
  }
}
