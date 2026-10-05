import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon.component';
import { StatusArquivo, StatusArquivoLabel } from '../../../models/enums/status-arquivo.enum';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../../models/enums/categoria-fiscal.enum';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { GRUPOS_TIPO, GrupoTipo } from '../tipo-arquivo.util';

export type FiltroModificado = '' | 'hoje' | '7d' | '30d' | 'ano';
export type Visao = 'grade' | 'lista';
type Dropdown = 'tipo' | 'status' | 'categoria' | 'modificado';

export const MODIFICADO_OPCOES: { valor: Exclude<FiltroModificado, ''>; label: string }[] = [
  { valor: 'hoje', label: 'Hoje' },
  { valor: '7d', label: 'Últimos 7 dias' },
  { valor: '30d', label: 'Últimos 30 dias' },
  { valor: 'ano', label: 'Este ano' },
];

/**
 * Linha de filtros estilo Drive (chips com menu suspenso + alternância grade/lista + painel ⓘ).
 * Com arquivos selecionados, a mesma linha vira a barra de ações da seleção.
 */
@Component({
  selector: 'app-drive-filtros',
  standalone: true,
  imports: [CommonModule, IconComponent, ContextMenuComponent],
  templateUrl: './drive-filtros.component.html',
  styleUrl: './drive-filtros.component.css'
})
export class DriveFiltrosComponent {
  @Input() tipo: GrupoTipo | '' = '';
  @Input() status: StatusArquivo | '' = '';
  @Input() categoria: CategoriaFiscal | '' = '';
  @Input() modificado: FiltroModificado = '';
  @Input() contagemStatus: Record<string, number> = {};
  @Input() contagemTipo: Record<string, number> = {};
  @Input() filtrosAtivos = false;
  @Input() visao: Visao = 'grade';
  @Input() painelAberto = false;
  /** O painel ⓘ embutido cabe na tela (senão os detalhes abrem como gaveta). */
  @Input() painelDisponivel = true;
  @Input() selecionados = 0;
  @Input() baixando = false;
  @Input() deletando = false;
  @Input() movendo = false;
  @Input() desabilitado = false;

  @Output() tipoChange = new EventEmitter<GrupoTipo | ''>();
  @Output() statusChange = new EventEmitter<StatusArquivo | ''>();
  @Output() categoriaChange = new EventEmitter<CategoriaFiscal | ''>();
  @Output() modificadoChange = new EventEmitter<FiltroModificado>();
  @Output() limpar = new EventEmitter<void>();
  @Output() visaoChange = new EventEmitter<Visao>();
  @Output() painelToggle = new EventEmitter<void>();
  @Output() baixar = new EventEmitter<void>();
  @Output() mover = new EventEmitter<void>();
  @Output() lixeira = new EventEmitter<void>();
  @Output() limparSelecao = new EventEmitter<void>();

  readonly tipos = GRUPOS_TIPO;
  readonly statusOpcoes = Object.values(StatusArquivo);
  readonly statusLabel = StatusArquivoLabel;
  readonly categorias = Object.values(CategoriaFiscal);
  readonly categoriaLabel = CategoriaFiscalLabel;
  readonly modificadoOpcoes = MODIFICADO_OPCOES;

  aberto: { qual: Dropdown; x: number; y: number; yAcima: number } | null = null;

  abrir(qual: Dropdown, e: MouseEvent): void {
    e.stopPropagation();
    if (this.aberto?.qual === qual) { this.aberto = null; return; }
    const chip = (e.currentTarget as HTMLElement).closest('.fchip') as HTMLElement;
    const r = chip.getBoundingClientRect();
    this.aberto = { qual, x: r.left, y: r.bottom + 6, yAcima: r.top - 6 };
  }

  get rotuloTipo(): string { return this.tipos.find(t => t.valor === this.tipo)?.label ?? 'Tipo'; }
  get rotuloStatus(): string { return this.status ? this.statusLabel[this.status] : 'Status'; }
  get rotuloCategoria(): string { return this.categoria ? this.categoriaLabel[this.categoria] : 'Categoria'; }
  get rotuloModificado(): string { return this.modificadoOpcoes.find(m => m.valor === this.modificado)?.label ?? 'Modificado'; }

  tomStatus(s: StatusArquivo): string {
    return s === 'ENTREGUE' ? 'success' : s === 'PENDENTE' ? 'warning' : s === 'VENCIDO' ? 'danger' : 'neutral';
  }
}
