import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArquivoService } from '../../../services/arquivo.service';
import { EmpresaService } from '../../../services/empresa.service';
import { PastaService } from '../../../services/pasta.service';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { StatusArquivo, StatusArquivoLabel } from '../../../models/enums/status-arquivo.enum';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../../models/enums/categoria-fiscal.enum';
import { ArquivoFormComponent } from '../arquivo-form/arquivo-form.component';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { PaginadorComponent, paginar } from '../../../shared/ui/paginador.component';
import { BytesPipe, PrazoPipe, PrazoTomPipe } from '../../../pipes/formatos.pipe';

@Component({
  selector: 'app-arquivo-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ArquivoFormComponent, IconComponent, PaginadorComponent, BytesPipe, PrazoPipe, PrazoTomPipe],
  templateUrl: './arquivo-list.component.html',
  styleUrl: './arquivo-list.component.css'
})
export class ArquivoListComponent implements OnInit {
  private arquivoService = inject(ArquivoService);
  private empresaService = inject(EmpresaService);
  private pastaService = inject(PastaService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  arquivos: ArquivoResponseDTO[] = [];
  arquivosFiltrados: ArquivoResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  pastas: PastaResponseDTO[] = [];
  pastasFiltradas: PastaResponseDTO[] = [];

  termoBusca = '';
  idEmpresaFiltro: number | null = null;
  idPastaFiltro: number | null = null;
  statusFiltro: StatusArquivo | '' = '';
  categoriaFiltro: CategoriaFiscal | '' = '';

  statusList = Object.values(StatusArquivo);
  statusLabel = StatusArquivoLabel;
  categoriaList = Object.values(CategoriaFiscal);
  categoriaLabel = CategoriaFiscalLabel;

  pagina = 1;
  porPagina = 10;

  carregando = false;
  menuAbertoId: number | null = null;
  menuPosicao = { top: 0, right: 0 };

  painelAberto = false;

  arquivoStatus: ArquivoResponseDTO | null = null;
  novoStatus: StatusArquivo | '' = '';

  arquivoVencimento: ArquivoResponseDTO | null = null;
  novaDataVencimento = '';

  deletandoId: number | null = null;
  salvando = false;

  ngOnInit(): void {
    this.carregar();
    this.carregarEmpresas();
    this.carregarPastas();
  }

  get paginaItens(): ArquivoResponseDTO[] { return paginar(this.arquivosFiltrados, this.pagina, this.porPagina); }
  get temFiltro(): boolean {
    return !!this.termoBusca.trim() || !!this.idEmpresaFiltro || !!this.idPastaFiltro || !!this.statusFiltro || !!this.categoriaFiltro;
  }
  contarStatus(s: StatusArquivo): number { return this.arquivos.filter(a => a.status === s).length; }

  carregar(): void {
    this.carregando = true;
    this.arquivoService.listar().subscribe({
      next: (data) => {
        this.arquivos = data;
        this.carregando = false;
        this.filtrar(false);
      },
      error: () => {
        this.carregando = false;
        this.toast.error('Não foi possível carregar os arquivos');
      }
    });
  }

  carregarEmpresas(): void {
    this.empresaService.listar().subscribe({ next: (data) => { this.empresas = data; } });
  }

  carregarPastas(): void {
    this.pastaService.listar().subscribe({
      next: (data) => {
        this.pastas = data;
        this.pastasFiltradas = data;
      }
    });
  }

  onEmpresaChange(): void {
    this.pastasFiltradas = this.idEmpresaFiltro ? this.pastas.filter(p => p.idEmpresa === this.idEmpresaFiltro) : this.pastas;
    this.idPastaFiltro = null;
    this.filtrar();
  }

  setStatus(s: StatusArquivo | ''): void {
    this.statusFiltro = s;
    this.filtrar();
  }

  limparFiltros(): void {
    this.termoBusca = '';
    this.idEmpresaFiltro = null;
    this.idPastaFiltro = null;
    this.statusFiltro = '';
    this.categoriaFiltro = '';
    this.pastasFiltradas = this.pastas;
    this.filtrar();
  }

  filtrar(resetPagina = true): void {
    let resultado = this.arquivos;
    const termo = this.termoBusca.toLowerCase().trim();
    if (termo) {
      resultado = resultado.filter(a =>
        a.nomeOriginal.toLowerCase().includes(termo) ||
        (a.descricao?.toLowerCase().includes(termo) ?? false));
    }
    if (this.idEmpresaFiltro) resultado = resultado.filter(a => a.idEmpresa === this.idEmpresaFiltro);
    if (this.idPastaFiltro) resultado = resultado.filter(a => a.idPasta === this.idPastaFiltro);
    if (this.statusFiltro) resultado = resultado.filter(a => a.status === this.statusFiltro);
    if (this.categoriaFiltro) resultado = resultado.filter(a => a.categoriaFiscal === this.categoriaFiltro);
    this.arquivosFiltrados = resultado;
    if (resetPagina) this.pagina = 1;
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
  }

  getNomePasta(idPasta: number): string {
    return this.pastas.find(p => p.id === idPasta)?.nome ?? '—';
  }

  badgeStatus(status: StatusArquivo | null): string {
    switch (status) {
      case StatusArquivo.ENTREGUE: return 'badge-success';
      case StatusArquivo.PENDENTE: return 'badge-warning';
      case StatusArquivo.VENCIDO: return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  // ---------- menu de ações ----------
  toggleMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menuAbertoId === id) { this.menuAbertoId = null; return; }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuPosicao = { top: rect.bottom + 4, right: window.innerWidth - rect.right };
    this.menuAbertoId = id;
  }

  @HostListener('document:click')
  @HostListener('window:scroll')
  fecharMenu(): void { this.menuAbertoId = null; }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.salvando) return;
    this.menuAbertoId = null;
    this.arquivoStatus = null;
    this.arquivoVencimento = null;
  }

  // ---------- upload ----------
  abrirFormUpload(): void {
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  fecharPainel(): void { this.painelAberto = false; }

  onArquivoSalvo(): void {
    this.fecharPainel();
    this.carregar();
  }

  // ---------- ações ----------
  download(arquivo: ArquivoResponseDTO): void {
    this.menuAbertoId = null;
    this.arquivoService.download(arquivo.id!).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = arquivo.nomeOriginal;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('Não foi possível baixar o arquivo', arquivo.nomeOriginal)
    });
  }

  copiarLink(arquivo: ArquivoResponseDTO): void {
    this.menuAbertoId = null;
    const link = `${window.location.origin}/api/arquivos/${arquivo.id}/download`;
    navigator.clipboard.writeText(link).then(
      () => this.toast.success('Link copiado', 'Cole onde quiser compartilhar.'),
      () => this.toast.error('Não foi possível copiar o link')
    );
  }

  abrirAlterarStatus(arquivo: ArquivoResponseDTO): void {
    this.arquivoStatus = arquivo;
    this.novoStatus = arquivo.status ?? '';
    this.menuAbertoId = null;
  }

  cancelarAlterarStatus(): void {
    if (this.salvando) return;
    this.arquivoStatus = null;
    this.novoStatus = '';
  }

  alterarStatus(): void {
    if (!this.arquivoStatus?.id || !this.novoStatus) return;
    this.salvando = true;
    this.arquivoService.atualizarStatus(this.arquivoStatus.id, this.novoStatus as StatusArquivo).subscribe({
      next: () => {
        this.salvando = false;
        this.arquivoStatus = null;
        this.toast.success('Status atualizado');
        this.carregar();
      },
      error: () => {
        this.salvando = false;
        this.toast.error('Não foi possível atualizar o status');
      }
    });
  }

  abrirAlterarVencimento(arquivo: ArquivoResponseDTO): void {
    this.arquivoVencimento = arquivo;
    this.novaDataVencimento = arquivo.dataVencimento ?? '';
    this.menuAbertoId = null;
  }

  cancelarAlterarVencimento(): void {
    if (this.salvando) return;
    this.arquivoVencimento = null;
    this.novaDataVencimento = '';
  }

  alterarVencimento(): void {
    if (!this.arquivoVencimento?.id || !this.novaDataVencimento) return;
    this.salvando = true;
    this.arquivoService.atualizarVencimento(this.arquivoVencimento.id, this.novaDataVencimento).subscribe({
      next: () => {
        this.salvando = false;
        this.arquivoVencimento = null;
        this.toast.success('Vencimento atualizado');
        this.carregar();
      },
      error: () => {
        this.salvando = false;
        this.toast.error('Não foi possível atualizar o vencimento');
      }
    });
  }

  async confirmarDelete(arquivo: ArquivoResponseDTO): Promise<void> {
    this.menuAbertoId = null;
    const ok = await this.confirm.ask({
      titulo: 'Mover para a lixeira?',
      mensagem: `"${arquivo.nomeOriginal}" irá para a lixeira. Você pode restaurá-lo depois.`,
      confirmar: 'Mover para lixeira',
      tom: 'danger'
    });
    if (!ok) return;
    this.deletandoId = arquivo.id;
    this.arquivoService.deletar(arquivo.id).subscribe({
      next: () => {
        this.deletandoId = null;
        this.toast.success('Arquivo movido para a lixeira', arquivo.nomeOriginal);
        this.carregar();
      },
      error: () => {
        this.deletandoId = null;
        this.toast.error('Não foi possível mover o arquivo para a lixeira');
      }
    });
  }
}
