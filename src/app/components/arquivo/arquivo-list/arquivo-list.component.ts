import { Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-arquivo-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ArquivoFormComponent],
  templateUrl: './arquivo-list.component.html',
  styleUrl: './arquivo-list.component.css'
})
export class ArquivoListComponent implements OnInit {

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

  carregando = false;
  menuAbertoId: number | null = null;
  menuPosicao = { top: 0, right: 0 };

  painelAberto = false;

  arquivoStatus: ArquivoResponseDTO | null = null;
  novoStatus: StatusArquivo | '' = '';

  arquivoVencimento: ArquivoResponseDTO | null = null;
  novaDataVencimento = '';

  arquivoParaDeletar: ArquivoResponseDTO | null = null;
  deletando = false;
  salvando = false;

  toastVisivel = false;
  toastMensagem = '';

  constructor(
    private arquivoService: ArquivoService,
    private empresaService: EmpresaService,
    private pastaService: PastaService
  ) {}

  ngOnInit(): void {
    this.carregar();
    this.carregarEmpresas();
    this.carregarPastas();
  }

  carregar(): void {
    this.carregando = true;
    this.arquivoService.listar().subscribe({
      next: (data) => {
        this.arquivos = data;
        this.arquivosFiltrados = data;
        this.carregando = false;
      },
      error: () => { this.carregando = false; }
    });
  }

  carregarEmpresas(): void {
    this.empresaService.listar().subscribe({
      next: (data) => { this.empresas = data; }
    });
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
    if (this.idEmpresaFiltro) {
      this.pastasFiltradas = this.pastas.filter(p => p.idEmpresa === this.idEmpresaFiltro);
    } else {
      this.pastasFiltradas = this.pastas;
    }
    this.idPastaFiltro = null;
    this.filtrar();
  }

  filtrar(): void {
    let resultado = this.arquivos;
    const termo = this.termoBusca.toLowerCase();

    if (termo) {
      resultado = resultado.filter(a =>
        a.nomeOriginal.toLowerCase().includes(termo) ||
        (a.descricao?.toLowerCase().includes(termo) ?? false)
      );
    }
    if (this.idEmpresaFiltro) {
      resultado = resultado.filter(a => a.idEmpresa === this.idEmpresaFiltro);
    }
    if (this.idPastaFiltro) {
      resultado = resultado.filter(a => a.idPasta === this.idPastaFiltro);
    }
    if (this.statusFiltro) {
      resultado = resultado.filter(a => a.status === this.statusFiltro);
    }
    if (this.categoriaFiltro) {
      resultado = resultado.filter(a => a.categoriaFiscal === this.categoriaFiltro);
    }

    this.arquivosFiltrados = resultado;
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
  }

  getNomePasta(idPasta: number): string {
    return this.pastas.find(p => p.id === idPasta)?.nome ?? '—';
  }

  formatarTamanho(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  badgeStatusClasse(status: StatusArquivo | null): string {
    switch (status) {
      case StatusArquivo.PENDENTE: return 'badge-status badge-pendente';
      case StatusArquivo.ENTREGUE: return 'badge-status badge-entregue';
      case StatusArquivo.VENCIDO: return 'badge-status badge-vencido';
      case StatusArquivo.ARQUIVADO: return 'badge-status badge-arquivado';
      default: return 'badge-status';
    }
  }

  textoVencimento(arquivo: ArquivoResponseDTO): string {
    if (!arquivo.dataVencimento) return '—';
    const dias = arquivo.diasParaVencer;
    if (dias == null) return arquivo.dataVencimento;
    if (dias < 0) return `${arquivo.dataVencimento} (vencido há ${Math.abs(dias)}d)`;
    if (dias === 0) return `${arquivo.dataVencimento} (hoje)`;
    return `${arquivo.dataVencimento} (em ${dias}d)`;
  }

  toggleMenu(id: number, event: MouseEvent): void {
    if (this.menuAbertoId === id) {
      this.menuAbertoId = null;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosicao = {
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right
    };
    this.menuAbertoId = id;
  }

  abrirFormUpload(): void {
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  fecharPainel(): void {
    this.painelAberto = false;
  }

  onArquivoSalvo(): void {
    this.fecharPainel();
    this.carregar();
  }

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
      }
    });
  }

  copiarLink(arquivo: ArquivoResponseDTO): void {
    this.menuAbertoId = null;
    const link = `${window.location.origin}/api/arquivos/${arquivo.id}/download`;
    navigator.clipboard.writeText(link).then(() => {
      this.mostrarToast('Link copiado para a área de transferência!');
    });
  }

  abrirAlterarStatus(arquivo: ArquivoResponseDTO): void {
    this.arquivoStatus = arquivo;
    this.novoStatus = arquivo.status ?? '';
    this.menuAbertoId = null;
  }

  cancelarAlterarStatus(): void {
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
        this.mostrarToast('Status atualizado.');
        this.carregar();
      },
      error: () => { this.salvando = false; }
    });
  }

  abrirAlterarVencimento(arquivo: ArquivoResponseDTO): void {
    this.arquivoVencimento = arquivo;
    this.novaDataVencimento = arquivo.dataVencimento ?? '';
    this.menuAbertoId = null;
  }

  cancelarAlterarVencimento(): void {
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
        this.mostrarToast('Vencimento atualizado.');
        this.carregar();
      },
      error: () => { this.salvando = false; }
    });
  }

  confirmarDelete(arquivo: ArquivoResponseDTO): void {
    this.arquivoParaDeletar = arquivo;
    this.menuAbertoId = null;
  }

  cancelarDelete(): void {
    this.arquivoParaDeletar = null;
  }

  deletar(): void {
    if (!this.arquivoParaDeletar?.id) return;
    this.deletando = true;
    this.arquivoService.deletar(this.arquivoParaDeletar.id).subscribe({
      next: () => {
        this.deletando = false;
        this.arquivoParaDeletar = null;
        this.mostrarToast('Arquivo movido para a lixeira.');
        this.carregar();
      },
      error: () => { this.deletando = false; }
    });
  }

  mostrarToast(mensagem: string): void {
    this.toastMensagem = mensagem;
    this.toastVisivel = true;
    setTimeout(() => { this.toastVisivel = false; }, 3000);
  }
}
