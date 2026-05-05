import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocioService } from '../../../services/socio.service';
import { EmpresaService } from '../../../services/empresa.service';
import { SocioResponseDTO } from '../../../models/socio-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { SocioFormComponent } from '../socio-form/socio-form.component';

@Component({
  selector: 'app-socio-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SocioFormComponent],
  templateUrl: './socio-list.component.html',
  styleUrl: './socio-list.component.css'
})
export class SocioListComponent implements OnInit {

  socios: SocioResponseDTO[] = [];
  sociosFiltrados: SocioResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  termoBusca = '';

  carregando = false;
  menuAbertoId: number | null = null;
  menuPosicao = { top: 0, right: 0 };

  painelAberto = false;
  modoPainel: 'novo' | 'editar' | 'detalhes' = 'novo';
  socioSelecionado: SocioResponseDTO | null = null;

  socioParaDeletar: SocioResponseDTO | null = null;
  deletando = false;

  constructor(
    private socioService: SocioService,
    private empresaService: EmpresaService
  ) {}

  ngOnInit(): void {
    this.carregar();
    this.carregarEmpresas();
  }

  carregar(): void {
    this.carregando = true;
    this.socioService.listar().subscribe({
      next: (data) => {
        this.socios = data;
        this.sociosFiltrados = data;
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

  filtrar(): void {
    const termo = this.termoBusca.toLowerCase();
    this.sociosFiltrados = this.socios.filter(s =>
      s.nome.toLowerCase().includes(termo) ||
      s.cpf.includes(termo)
    );
  }

  formatarCpf(cpf: string): string {
    if (!cpf) return '';
    const v = cpf.replace(/\D/g, '');
    return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
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
    this.socioSelecionado = null;
    this.modoPainel = 'novo';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  abrirFormEdicao(socio: SocioResponseDTO): void {
    this.socioSelecionado = socio;
    this.modoPainel = 'editar';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  verDetalhes(socio: SocioResponseDTO): void {
    this.socioSelecionado = socio;
    this.modoPainel = 'detalhes';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  fecharPainel(): void {
    this.painelAberto = false;
    this.socioSelecionado = null;
    this.menuAbertoId = null;
  }

  confirmarDelete(socio: SocioResponseDTO): void {
    this.socioParaDeletar = socio;
    this.menuAbertoId = null;
  }

  cancelarDelete(): void {
    this.socioParaDeletar = null;
  }

  deletar(): void {
    if (!this.socioParaDeletar?.id) return;
    this.deletando = true;
    this.socioService.deletar(this.socioParaDeletar.id).subscribe({
      next: () => {
        this.deletando = false;
        this.socioParaDeletar = null;
        this.carregar();
      },
      error: () => { this.deletando = false; }
    });
  }

  onSocioSalvo(): void {
    this.fecharPainel();
    this.carregar();
  }
}