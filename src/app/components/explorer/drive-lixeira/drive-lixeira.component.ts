import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArquivoService } from '../../../services/arquivo.service';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { PaginadorComponent, paginar } from '../../../shared/ui/paginador.component';
import { BytesPipe } from '../../../pipes/formatos.pipe';
import { tempoDe, visualTipo, VisualTipo } from '../tipo-arquivo.util';

type Ordem = 'nome' | 'excluido' | 'tamanho' | 'empresa';
const COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Seção "Lixeira" dentro da área de Arquivos: restaurar e (admin) excluir definitivamente. */
@Component({
  selector: 'app-drive-lixeira',
  standalone: true,
  imports: [CommonModule, IconComponent, PaginadorComponent, BytesPipe],
  templateUrl: './drive-lixeira.component.html',
  styleUrl: './drive-lixeira.component.css'
})
export class DriveLixeiraComponent implements OnInit, OnChanges {
  private arquivoService = inject(ArquivoService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  /** Empresa selecionada na área de Arquivos. */
  @Input() idEmpresa: number | null = null;
  @Input() empresas: EmpresaResponseDTO[] = [];
  @Input() isAdmin = false;
  /** Texto do campo "Pesquisar em Arquivos". */
  @Input() termo = '';

  /** Um arquivo voltou para a pasta de origem (recarregar os dados da área de Arquivos). */
  @Output() restaurado = new EventEmitter<ArquivoResponseDTO>();
  @Output() limparBusca = new EventEmitter<void>();

  arquivos: ArquivoResponseDTO[] = [];
  filtrados: ArquivoResponseDTO[] = [];
  carregando = true;
  erroCarregar = false;
  /** Admin: ver a lixeira de todas as empresas. */
  todasEmpresas = false;
  ordem: Ordem = 'excluido';
  ordemAsc = false;
  pagina = 1;
  porPagina = 24;
  processandoId: number | null = null;
  acao: 'restaurar' | 'excluir' | null = null;
  readonly skeletons = [1, 2, 3, 4];

  ngOnInit(): void { this.carregar(); }

  ngOnChanges(ch: SimpleChanges): void {
    if ((ch['termo'] && !ch['termo'].firstChange) || (ch['idEmpresa'] && !ch['idEmpresa'].firstChange)) this.filtrar();
  }

  carregar(): void {
    this.carregando = true;
    this.erroCarregar = false;
    this.arquivoService.listarLixeira().subscribe({
      next: (data) => { this.arquivos = data; this.carregando = false; this.filtrar(false); },
      error: () => {
        this.carregando = false;
        this.erroCarregar = true;
        this.arquivos = [];
        this.filtrar(false);
        this.toast.error('Erro ao carregar a lixeira', 'Verifique sua conexão e tente novamente.');
      }
    });
  }

  get escopoEmpresa(): boolean { return !this.todasEmpresas && this.idEmpresa != null; }
  get mostrarEmpresa(): boolean { return this.isAdmin && !this.escopoEmpresa; }
  get paginaItens(): ArquivoResponseDTO[] { return paginar(this.filtrados, this.pagina, this.porPagina); }
  get tamanhoTotal(): number { return this.filtrados.reduce((s, a) => s + (a.tamanho ?? 0), 0); }
  get nomeEmpresaAtual(): string { return this.getNomeEmpresa(this.idEmpresa); }

  alternarEscopo(): void { this.todasEmpresas = !this.todasEmpresas; this.filtrar(); }

  filtrar(resetPagina = true): void {
    const termo = this.termo.trim().toLowerCase();
    const dir = this.ordemAsc ? 1 : -1;
    this.filtrados = this.arquivos
      .filter(a => (!this.escopoEmpresa || a.idEmpresa === this.idEmpresa)
        && (!termo || a.nomeOriginal.toLowerCase().includes(termo) || (a.descricao?.toLowerCase().includes(termo) ?? false)))
      .sort((x, y) => {
        switch (this.ordem) {
          case 'excluido': return (tempoDe(x.excluidoEm) - tempoDe(y.excluidoEm)) * dir;
          case 'tamanho': return ((x.tamanho ?? 0) - (y.tamanho ?? 0)) * dir;
          case 'empresa': return COLLATOR.compare(this.getNomeEmpresa(x.idEmpresa), this.getNomeEmpresa(y.idEmpresa)) * dir;
          default: return COLLATOR.compare(x.nomeOriginal, y.nomeOriginal) * dir;
        }
      });
    if (resetPagina) this.pagina = 1;
  }

  ordenarPor(campo: Ordem): void {
    if (this.ordem === campo) this.ordemAsc = !this.ordemAsc;
    else { this.ordem = campo; this.ordemAsc = campo === 'nome' || campo === 'empresa'; }
    this.filtrar();
  }

  ariaSort(campo: Ordem): string | null { return this.ordem === campo ? (this.ordemAsc ? 'ascending' : 'descending') : null; }
  iconeOrdem(campo: Ordem): string { return this.ordem === campo ? (this.ordemAsc ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down'; }

  getNomeEmpresa(id: number | null): string { return this.empresas.find(e => e.id === id)?.nomeFantasia ?? '—'; }

  visual(a: ArquivoResponseDTO): VisualTipo { return visualTipo(a.nomeOriginal, a.tipoArquivo); }

  /** "hoje", "ontem", "há 5 dias", "há 2 meses". */
  tempoRelativo(iso: string | null): string {
    const t = tempoDe(iso);
    if (!t) return '';
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = new Date(t); dia.setHours(0, 0, 0, 0);
    const dias = Math.round((hoje.getTime() - dia.getTime()) / 86400000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 30) return `há ${dias} dias`;
    const meses = Math.floor(dias / 30);
    return meses === 1 ? 'há 1 mês' : `há ${meses} meses`;
  }

  restaurar(arquivo: ArquivoResponseDTO): void {
    if (this.processandoId) return;
    this.processandoId = arquivo.id;
    this.acao = 'restaurar';
    this.arquivoService.restaurar(arquivo.id).subscribe({
      next: (restaurado) => {
        this.processandoId = null;
        this.arquivos = this.arquivos.filter(a => a.id !== arquivo.id);
        this.filtrar(false);
        this.toast.success('Arquivo restaurado', `"${arquivo.nomeOriginal}" voltou para a pasta de origem.`);
        this.restaurado.emit(restaurado ?? arquivo);
      },
      error: (err) => {
        this.processandoId = null;
        this.toast.error('Erro ao restaurar', err?.error?.mensagem ?? err?.error?.message ?? 'Tente novamente em instantes.');
      }
    });
  }

  async excluirPermanente(arquivo: ArquivoResponseDTO): Promise<void> {
    if (this.processandoId) return;
    const ok = await this.confirm.ask({
      titulo: 'Excluir definitivamente?',
      mensagem: `"${arquivo.nomeOriginal}" será removido do servidor. Esta ação não pode ser desfeita.`,
      confirmar: 'Excluir definitivamente',
      tom: 'danger'
    });
    if (!ok) return;
    this.processandoId = arquivo.id;
    this.acao = 'excluir';
    this.arquivoService.excluirPermanente(arquivo.id).subscribe({
      next: () => {
        this.processandoId = null;
        this.arquivos = this.arquivos.filter(a => a.id !== arquivo.id);
        this.filtrar(false);
        this.toast.success('Arquivo excluído permanentemente', `"${arquivo.nomeOriginal}"`);
      },
      error: (err) => {
        this.processandoId = null;
        this.toast.error('Erro ao excluir', err?.error?.mensagem ?? err?.error?.message ?? 'Tente novamente em instantes.');
      }
    });
  }
}
