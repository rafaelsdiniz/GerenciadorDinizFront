import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/icon.component';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';

/** Barra superior estilo Drive: campo "Pesquisar em Arquivos" + empresa (admin) + botão de pastas no celular. */
@Component({
  selector: 'app-drive-busca',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <button type="button" class="btn-icon bordered so-mobile" (click)="abrirPastas.emit()" title="Pastas" aria-label="Abrir pastas e navegação">
      <app-icon name="folder" [size]="18" />
    </button>
    <div class="busca">
      <app-icon name="search" [size]="19" />
      <input #campo type="search" [ngModel]="termo" (ngModelChange)="termoChange.emit($event)" [disabled]="desabilitado"
             placeholder="Pesquisar em Arquivos" aria-label="Pesquisar em Arquivos" autocomplete="off" (keydown.escape)="limparCampo($event)" />
      @if (termo) {
        <button type="button" class="btn-icon sm" (click)="limpar.emit(); campo.focus()" title="Limpar pesquisa" aria-label="Limpar pesquisa"><app-icon name="x" [size]="17" /></button>
      }
    </div>
    @if (isAdmin && empresas.length > 0) {
      <select class="select empresa" [ngModel]="idEmpresa" (ngModelChange)="empresaChange.emit($event)" aria-label="Empresa" title="Empresa">
        @for (e of empresas; track e.id) { <option [ngValue]="e.id">{{ e.nomeFantasia }}</option> }
      </select>
    } @else if (nomeEmpresa) {
      <span class="empresa-fixa" title="Empresa"><app-icon name="building" [size]="15" /> <span class="truncate">{{ nomeEmpresa }}</span></span>
    }
  `,
  styles: [`
    :host { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .busca {
      flex: 1 1 auto; min-width: 0; max-width: 720px; height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 6px 0 16px;
      border: 1px solid transparent; border-radius: var(--radius-pill); background: var(--canvas-sunken); color: var(--ink-mute);
      transition: background var(--t-fast), box-shadow var(--t-fast), border-color var(--t-fast);
    }
    .busca:hover { background: var(--hairline); }
    .busca:focus-within { background: var(--canvas); border-color: var(--hairline); box-shadow: var(--shadow-2); }
    .busca input { flex: 1; min-width: 0; height: 100%; border: 0; background: none; outline: none; font-size: 15px; color: var(--ink); }
    .busca input::placeholder { color: var(--ink-mute); }
    .busca input::-webkit-search-cancel-button { display: none; }
    .empresa { width: auto; max-width: 240px; height: 40px; border-radius: var(--radius-pill); padding-left: 16px; }
    .empresa-fixa {
      display: inline-flex; align-items: center; gap: 6px; max-width: 260px; height: 36px; padding: 0 14px; min-width: 0;
      border: 1px solid var(--hairline-strong); border-radius: var(--radius-pill); background: var(--canvas); color: var(--ink-2); font-size: 13px;
    }
    .so-mobile { display: none; }
    @media (max-width: 899.98px) { .so-mobile { display: inline-grid; } }
    @media (max-width: 640px) {
      :host { flex-wrap: wrap; }
      .busca { height: 44px; flex-basis: calc(100% - 46px); }
      .empresa { flex: 1 1 100%; max-width: none; }
      .empresa-fixa { display: none; }
    }
  `]
})
export class DriveBuscaComponent {
  @Input() termo = '';
  @Input() desabilitado = false;
  @Input() empresas: EmpresaResponseDTO[] = [];
  @Input() idEmpresa: number | null = null;
  @Input() isAdmin = false;
  @Input() nomeEmpresa = '';

  @Output() termoChange = new EventEmitter<string>();
  @Output() empresaChange = new EventEmitter<number>();
  @Output() limpar = new EventEmitter<void>();
  @Output() abrirPastas = new EventEmitter<void>();

  @ViewChild('campo') campo?: ElementRef<HTMLInputElement>;

  focar(): void { this.campo?.nativeElement.focus(); }

  limparCampo(e: Event): void {
    if (!this.termo) return;
    e.stopPropagation();
    this.limpar.emit();
  }
}
