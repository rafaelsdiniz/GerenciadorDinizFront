import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PastaService } from '../../../services/pasta.service';
import { EmpresaService } from '../../../services/empresa.service';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { PastaFormComponent } from '../pasta-form/pasta-form.component';

@Component({
  selector: 'app-pasta-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PastaFormComponent],
  templateUrl: './pasta-list.component.html',
  styleUrl: './pasta-list.component.css'
})
export class PastaListComponent implements OnInit {

  pastas: PastaResponseDTO[] = [];
  pastasFiltradas: PastaResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  termoBusca = '';

  carregando = false;
  menuAbertoId: number | null = null;
  menuPosicao = { top: 0, right: 0 };

  painelAberto = false;
  modoPainel: 'novo' | 'editar' | 'detalhes' = 'novo';
  pastaSelecionada: PastaResponseDTO | null = null;

  pastaParaDeletar: PastaResponseDTO | null = null;
  deletando = false;

  constructor(
    private pastaService: PastaService,
    private empresaService: EmpresaService
  ) {}

  ngOnInit(): void {
    this.carregar();
    this.carregarEmpresas();
  }

  carregar(): void {
    this.carregando = true;
    this.pastaService.listar().subscribe({
      next: (data) => {
        this.pastas = data;
        this.pastasFiltradas = data;
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

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
  }

  getNomePasta(idPastaPai?: number | null): string {
    if (!idPastaPai) return '—';
    return this.pastas.find(p => p.id === idPastaPai)?.nome ?? '—';
  }

  filtrar(): void {
    const termo = this.termoBusca.toLowerCase();
    this.pastasFiltradas = this.pastas.filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      (p.descricao?.toLowerCase().includes(termo) ?? false)
    );
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

  abrirFormNovo(): void {
    this.pastaSelecionada = null;
    this.modoPainel = 'novo';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  abrirFormEdicao(pasta: PastaResponseDTO): void {
    this.pastaSelecionada = pasta;
    this.modoPainel = 'editar';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  verDetalhes(pasta: PastaResponseDTO): void {
    this.pastaSelecionada = pasta;
    this.modoPainel = 'detalhes';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  fecharPainel(): void {
    this.painelAberto = false;
    this.pastaSelecionada = null;
    this.menuAbertoId = null;
  }

  confirmarDelete(pasta: PastaResponseDTO): void {
    this.pastaParaDeletar = pasta;
    this.menuAbertoId = null;
  }

  cancelarDelete(): void {
    this.pastaParaDeletar = null;
  }

  deletar(): void {
    if (!this.pastaParaDeletar?.id) return;
    this.deletando = true;
    this.pastaService.deletar(this.pastaParaDeletar.id).subscribe({
      next: () => {
        this.deletando = false;
        this.pastaParaDeletar = null;
        this.carregar();
      },
      error: () => { this.deletando = false; }
    });
  }

  onPastaSalva(): void {
    this.fecharPainel();
    this.carregar();
  }
}