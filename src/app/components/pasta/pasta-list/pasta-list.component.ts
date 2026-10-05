import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PastaService } from '../../../services/pasta.service';
import { EmpresaService } from '../../../services/empresa.service';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { PastaFormComponent } from '../pasta-form/pasta-form.component';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { PaginadorComponent, paginar } from '../../../shared/ui/paginador.component';

@Component({
  selector: 'app-pasta-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PastaFormComponent, IconComponent, PaginadorComponent],
  templateUrl: './pasta-list.component.html',
  styleUrl: './pasta-list.component.css'
})
export class PastaListComponent implements OnInit {
  private pastaService = inject(PastaService);
  private empresaService = inject(EmpresaService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly skeletonRows = [1, 2, 3, 4];

  pastas: PastaResponseDTO[] = [];
  pastasFiltradas: PastaResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  termoBusca = '';
  filtroEmpresa: number | null = null;
  pagina = 1;
  porPagina = 10;

  carregando = false;

  painelAberto = false;
  modoPainel: 'novo' | 'editar' | 'detalhes' = 'novo';
  pastaSelecionada: PastaResponseDTO | null = null;
  deletandoId: number | null = null;

  ngOnInit(): void {
    this.carregar();
    this.carregarEmpresas();
  }

  get paginaItens(): PastaResponseDTO[] { return paginar(this.pastasFiltradas, this.pagina, this.porPagina); }
  get temFiltro(): boolean { return !!this.termoBusca.trim() || this.filtroEmpresa != null; }

  carregar(): void {
    this.carregando = true;
    this.pastaService.listar().subscribe({
      next: (data) => {
        this.pastas = data;
        this.carregando = false;
        this.filtrar(false);
      },
      error: () => {
        this.carregando = false;
        this.toast.error('Não foi possível carregar as pastas');
      }
    });
  }

  carregarEmpresas(): void {
    this.empresaService.listar().subscribe({
      next: (data) => { this.empresas = [...data].sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR')); }
    });
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
  }

  getNomePasta(idPastaPai?: number | null): string {
    if (!idPastaPai) return '—';
    return this.pastas.find(p => p.id === idPastaPai)?.nome ?? '—';
  }

  filtrar(resetPagina = true): void {
    const termo = this.termoBusca.toLowerCase().trim();
    this.pastasFiltradas = this.pastas
      .filter(p =>
        (this.filtroEmpresa == null || p.idEmpresa === this.filtroEmpresa) &&
        (!termo || p.nome.toLowerCase().includes(termo) || (p.descricao?.toLowerCase().includes(termo) ?? false)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (resetPagina) this.pagina = 1;
  }

  limparFiltros(): void {
    this.termoBusca = '';
    this.filtroEmpresa = null;
    this.filtrar();
  }

  abrirFormNovo(): void {
    this.pastaSelecionada = null;
    this.modoPainel = 'novo';
    this.painelAberto = true;
  }

  abrirFormEdicao(pasta: PastaResponseDTO): void {
    this.pastaSelecionada = pasta;
    this.modoPainel = 'editar';
    this.painelAberto = true;
  }

  verDetalhes(pasta: PastaResponseDTO): void {
    this.pastaSelecionada = pasta;
    this.modoPainel = 'detalhes';
    this.painelAberto = true;
  }

  fecharPainel(): void {
    this.painelAberto = false;
    this.pastaSelecionada = null;
  }

  async confirmarDelete(pasta: PastaResponseDTO): Promise<void> {
    const ok = await this.confirm.ask({
      titulo: `Excluir a pasta "${pasta.nome}"?`,
      mensagem: 'A pasta será removida. Esta ação não pode ser desfeita.',
      confirmar: 'Excluir pasta',
      tom: 'danger'
    });
    if (!ok) return;
    this.deletandoId = pasta.id;
    this.pastaService.deletar(pasta.id).subscribe({
      next: () => {
        this.deletandoId = null;
        this.toast.success('Pasta excluída', pasta.nome);
        this.carregar();
      },
      error: () => {
        this.deletandoId = null;
        this.toast.error('Não foi possível excluir a pasta', 'Verifique se ela não contém arquivos ou subpastas.');
      }
    });
  }

  onPastaSalva(): void {
    this.fecharPainel();
    this.carregar();
  }
}
