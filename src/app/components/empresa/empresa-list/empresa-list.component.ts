import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EmpresaService } from '../../../services/empresa.service';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { EmpresaFormComponent } from '../empresa-form/empresa-form.component';

@Component({
  selector: 'app-empresa-list',
  standalone: true,
  imports: [CommonModule, FormsModule, EmpresaFormComponent],
  templateUrl: './empresa-list.component.html',
  styleUrl: './empresa-list.component.css'
})
export class EmpresaListComponent implements OnInit {

  empresas: EmpresaResponseDTO[] = [];
  empresasFiltradas: EmpresaResponseDTO[] = [];
  termoBusca = '';

  carregando = false;
  menuAbertoId: number | null = null;

  painelAberto = false;
  modoPainel: 'novo' | 'editar' | 'detalhes' = 'novo';
  empresaSelecionada: EmpresaResponseDTO | null = null;

  empresaParaDeletar: EmpresaResponseDTO | null = null;
  deletando = false;

  constructor(
    private empresaService: EmpresaService,
    private router: Router
  ) {}

  abrirPerfil(empresa: EmpresaResponseDTO): void {
    this.menuAbertoId = null;
    this.router.navigate(['/empresas', empresa.id]);
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.empresaService.listar().subscribe({
      next: (data) => {
        this.empresas = data;
        this.empresasFiltradas = data;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
      }
    });
  }

  filtrar(): void {
    const termo = this.termoBusca.toLowerCase();
    this.empresasFiltradas = this.empresas.filter(e =>
      e.nomeFantasia.toLowerCase().includes(termo) ||
      e.razaoSocial.toLowerCase().includes(termo) ||
      e.cnpj.includes(termo)
    );
  }

  menuPosicao = { top: 0, right: 0 };

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
    this.empresaSelecionada = null;
    this.modoPainel = 'novo';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  abrirFormEdicao(empresa: EmpresaResponseDTO): void {
    this.empresaSelecionada = empresa;
    this.modoPainel = 'editar';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  verDetalhes(empresa: EmpresaResponseDTO): void {
    this.empresaSelecionada = empresa;
    this.modoPainel = 'detalhes';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  fecharPainel(): void {
    this.painelAberto = false;
    this.empresaSelecionada = null;
    this.menuAbertoId = null;
  }

  confirmarDelete(empresa: EmpresaResponseDTO): void {
    this.empresaParaDeletar = empresa;
    this.menuAbertoId = null;
  }

  cancelarDelete(): void {
    this.empresaParaDeletar = null;
  }

  deletar(): void {
    if (!this.empresaParaDeletar?.id) return;
    this.deletando = true;

    this.empresaService.deletar(this.empresaParaDeletar.id).subscribe({
      next: () => {
        this.deletando = false;
        this.empresaParaDeletar = null;
        this.carregar();
      },
      error: () => {
        this.deletando = false;
      }
    });
  }

  onEmpresaSalva(): void {
    this.fecharPainel();
    this.carregar();
  }

  onEmpresaDeletada(): void {
    this.fecharPainel();
    this.carregar();
  }

  formatarCnpj(cnpj: string): string {
  if (!cnpj) return '';
  const v = cnpj.replace(/\D/g, '');
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
}