import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon.component';
import { BytesPipe } from '../../../pipes/formatos.pipe';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { ContextMenuComponent } from '../context-menu/context-menu.component';

export type SecaoDrive = 'pasta' | 'recentes' | 'vencendo' | 'lixeira';
export type DragPasta = { evento: DragEvent; id: number | null };
type No = { pasta: PastaResponseDTO; nivel: number; temFilhos: boolean; aberto: boolean };

const COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const ARVORE_KEY = 'diniz.arquivos.arvore';

/** Coluna esquerda estilo Drive: botão "+ Novo", navegação, árvore de pastas e uso de armazenamento. */
@Component({
  selector: 'app-drive-sidebar',
  standalone: true,
  imports: [CommonModule, IconComponent, BytesPipe, ContextMenuComponent],
  host: { class: 'dsb', '[class.is-open]': 'aberta' },
  templateUrl: './drive-sidebar.component.html',
  styleUrl: './drive-sidebar.component.css'
})
export class DriveSidebarComponent implements OnChanges, OnDestroy {
  @Input() pastas: PastaResponseDTO[] = [];
  @Input() secao: SecaoDrive = 'pasta';
  @Input() pastaAtualId: number | null = null;
  /** Destaca "Meus arquivos" só quando é a raiz sem busca ativa. */
  @Input() emBusca = false;
  @Input() dropTargetId: number | 'raiz' | null = null;
  @Input() arrastando = false;
  @Input() desabilitado = false;
  @Input() totalBytes = 0;
  @Input() totalArquivos = 0;
  @Input() qtdVencendo = 0;
  @Input() temVencido = false;
  @Input() nomeEmpresa = '';
  /** Gaveta aberta (telas < 900px). */
  @Input() aberta = false;

  @Output() novaPasta = new EventEmitter<void>();
  @Output() enviar = new EventEmitter<void>();
  @Output() irSecao = new EventEmitter<SecaoDrive>();
  @Output() irPasta = new EventEmitter<number | null>();
  @Output() fechar = new EventEmitter<void>();
  @Output() dragOverPasta = new EventEmitter<DragPasta>();
  @Output() dragLeavePasta = new EventEmitter<number | null>();
  @Output() dropPasta = new EventEmitter<DragPasta>();
  /** Arquivos soltos sobre "Lixeira". */
  @Output() dropLixeira = new EventEmitter<DragEvent>();

  lixeiraDrop = false;

  menuNovo: { x: number; y: number; yAcima: number } | null = null;
  arvoreAberta = true;
  nos: No[] = [];
  private expandidos = new Set<number>();
  private filhos = new Map<number | null, PastaResponseDTO[]>();
  private timerExpandir: ReturnType<typeof setTimeout> | null = null;
  private alvoExpandir: number | null = null;

  constructor() {
    try { this.arvoreAberta = localStorage.getItem(ARVORE_KEY) !== '0'; } catch { /* storage indisponível */ }
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['pastas']) {
      this.filhos = new Map();
      for (const p of [...this.pastas].sort((a, b) => COLLATOR.compare(a.nome, b.nome))) {
        const pai = p.idPastaPai ?? null;
        const l = this.filhos.get(pai);
        if (l) l.push(p); else this.filhos.set(pai, [p]);
      }
    }
    if (ch['pastaAtualId'] || ch['pastas']) this.expandirAncestrais();
    this.montar();
  }

  ngOnDestroy(): void { this.cancelarExpansao(); }

  /** Mantém visível o caminho até a pasta atual. */
  private expandirAncestrais(): void {
    const porId = new Map(this.pastas.map(p => [p.id, p]));
    let atual = this.pastaAtualId != null ? porId.get(this.pastaAtualId) : undefined;
    if (atual && this.filhos.get(atual.id)?.length) this.expandidos.add(atual.id);
    let guarda = 0;
    while (atual && atual.idPastaPai != null && guarda++ < 50) {
      this.expandidos.add(atual.idPastaPai);
      atual = porId.get(atual.idPastaPai);
    }
  }

  private montar(): void {
    const nos: No[] = [];
    const visitar = (pai: number | null, nivel: number) => {
      if (nivel > 20) return;
      for (const p of this.filhos.get(pai) ?? []) {
        const temFilhos = !!this.filhos.get(p.id)?.length;
        const aberto = temFilhos && this.expandidos.has(p.id);
        nos.push({ pasta: p, nivel, temFilhos, aberto });
        if (aberto) visitar(p.id, nivel + 1);
      }
    };
    visitar(null, 0);
    this.nos = nos;
  }

  alternar(no: No, e?: Event): void {
    e?.stopPropagation();
    if (this.expandidos.has(no.pasta.id)) this.expandidos.delete(no.pasta.id);
    else this.expandidos.add(no.pasta.id);
    this.montar();
  }

  alternarArvore(): void {
    this.arvoreAberta = !this.arvoreAberta;
    try { localStorage.setItem(ARVORE_KEY, this.arvoreAberta ? '1' : '0'); } catch { /* storage indisponível */ }
  }

  ativo(no: No): boolean { return this.secao === 'pasta' && !this.emBusca && this.pastaAtualId === no.pasta.id; }

  abrirPasta(id: number | null): void { this.irPasta.emit(id); this.fechar.emit(); }

  abrirSecao(s: SecaoDrive): void { this.irSecao.emit(s); this.fechar.emit(); }

  // ---------- "+ Novo" ----------
  toggleNovo(e: MouseEvent): void {
    e.stopPropagation();
    if (this.menuNovo) { this.menuNovo = null; return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuNovo = { x: r.left, y: r.bottom + 6, yAcima: r.top - 6 };
  }

  escolherNovo(acao: 'pasta' | 'enviar'): void {
    this.menuNovo = null;
    this.fechar.emit();
    if (acao === 'pasta') this.novaPasta.emit(); else this.enviar.emit();
  }

  // ---------- arrastar arquivos para pastas da árvore ----------
  onDragOver(e: DragEvent, no: No | null): void {
    if (!this.arrastando) return;
    this.dragOverPasta.emit({ evento: e, id: no ? no.pasta.id : null });
    if (no?.temFilhos && !no.aberto && this.alvoExpandir !== no.pasta.id) {
      this.cancelarExpansao();
      this.alvoExpandir = no.pasta.id;
      this.timerExpandir = setTimeout(() => {
        this.expandidos.add(no.pasta.id);
        this.montar();
        this.alvoExpandir = null;
      }, 700);
    }
  }

  onDragLeave(id: number | null): void {
    if (this.alvoExpandir === id) this.cancelarExpansao();
    this.dragLeavePasta.emit(id);
  }

  onDrop(e: DragEvent, id: number | null): void {
    this.cancelarExpansao();
    this.dropPasta.emit({ evento: e, id });
  }

  onDragOverLixeira(e: DragEvent): void {
    if (!this.arrastando) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    this.lixeiraDrop = true;
  }

  onDropLixeira(e: DragEvent): void {
    if (!this.arrastando) return;
    e.preventDefault();
    this.lixeiraDrop = false;
    this.dropLixeira.emit(e);
  }

  private cancelarExpansao(): void {
    if (this.timerExpandir) clearTimeout(this.timerExpandir);
    this.timerExpandir = null;
    this.alvoExpandir = null;
  }

  trackNo(_: number, no: No): number { return no.pasta.id; }
}
