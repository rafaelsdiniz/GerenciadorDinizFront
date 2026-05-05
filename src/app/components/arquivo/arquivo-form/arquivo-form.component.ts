import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArquivoService } from '../../../services/arquivo.service';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../../models/enums/categoria-fiscal.enum';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-arquivo-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './arquivo-form.component.html',
  styleUrl: './arquivo-form.component.css'
})
export class ArquivoFormComponent implements OnInit, OnChanges {

  @Input() empresas: EmpresaResponseDTO[] = [];
  @Input() pastas: PastaResponseDTO[] = [];

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<void>();

  arquivoSelecionado: File | null = null;
  idEmpresa = 0;
  idPasta = 0;
  pastasFiltradas: PastaResponseDTO[] = [];

  descricao = '';
  dataVencimento = '';
  categoriaFiscal: CategoriaFiscal | '' = '';
  idObrigacaoPendente: number | null = null;

  obrigacoesPendentes: ObrigacaoPendenteResponseDTO[] = [];

  categorias = Object.values(CategoriaFiscal);
  categoriaLabel = CategoriaFiscalLabel;

  arrastando = false;
  enviando = false;
  progresso = 0;
  erros: Record<string, string> = {};
  erroGeral = '';

  constructor(
    private arquivoService: ArquivoService,
    private obrigacaoPendenteService: ObrigacaoPendenteService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.pastasFiltradas = this.pastas;
  }

  ngOnChanges(): void {
    this.pastasFiltradas = this.idEmpresa
      ? this.pastas.filter(p => p.idEmpresa === this.idEmpresa)
      : this.pastas;
  }

  onEmpresaChange(): void {
    this.pastasFiltradas = this.pastas.filter(p => p.idEmpresa === this.idEmpresa);
    this.idPasta = 0;
    this.idObrigacaoPendente = null;
    this.obrigacoesPendentes = [];
    if (this.idEmpresa) {
      this.obrigacaoPendenteService.pendentesPorEmpresa(this.idEmpresa).subscribe({
        next: (data) => { this.obrigacoesPendentes = data; }
      });
    }
  }

  onArquivoSelecionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.arquivoSelecionado = input.files[0];
      this.erros['arquivo'] = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.arrastando = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.arrastando = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.arquivoSelecionado = files[0];
      this.erros['arquivo'] = '';
    }
  }

  removerArquivo(event: Event): void {
    event.stopPropagation();
    this.arquivoSelecionado = null;
  }

  formatarTamanho(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  validar(): boolean {
    this.erros = {};
    if (!this.arquivoSelecionado) this.erros['arquivo'] = 'Selecione um arquivo.';
    if (!this.idEmpresa || this.idEmpresa === 0) this.erros['idEmpresa'] = 'Empresa é obrigatória.';
    if (!this.idPasta || this.idPasta === 0) this.erros['idPasta'] = 'Pasta é obrigatória.';
    return Object.keys(this.erros).length === 0;
  }

  enviar(): void {
    if (!this.validar() || !this.arquivoSelecionado) return;

    const idUsuario = this.authService.getUsuarioId();
    if (!idUsuario) {
      this.erroGeral = 'Usuário não identificado. Faça login novamente.';
      return;
    }

    this.enviando = true;
    this.erroGeral = '';

    const intervalo = setInterval(() => {
      if (this.progresso < 85) this.progresso += 10;
    }, 200);

    this.arquivoService.upload({
      arquivo: this.arquivoSelecionado,
      idEmpresa: this.idEmpresa,
      idUsuario: idUsuario,
      idPasta: this.idPasta,
      descricao: this.descricao || null,
      dataVencimento: this.dataVencimento || null,
      idObrigacaoPendente: this.idObrigacaoPendente,
      categoriaFiscal: this.categoriaFiscal || null
    }).subscribe({
      next: () => {
        clearInterval(intervalo);
        this.progresso = 100;
        setTimeout(() => {
          this.enviando = false;
          this.progresso = 0;
          this.salvo.emit();
        }, 500);
      },
      error: (err) => {
        clearInterval(intervalo);
        this.enviando = false;
        this.progresso = 0;
        this.erroGeral = err?.error?.mensagem
          ?? err?.error?.message
          ?? (typeof err?.error === 'string' ? err.error : null)
          ?? 'Erro ao enviar arquivo. Tente novamente.';
      }
    });
  }
}
