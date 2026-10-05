import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArquivoService } from '../../../services/arquivo.service';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../../models/enums/categoria-fiscal.enum';
import { AuthService } from '../../../services/auth.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { IconComponent } from '../../../shared/icon.component';
import { BytesPipe } from '../../../pipes/formatos.pipe';
import { visualTipo, VisualTipo } from '../../explorer/tipo-arquivo.util';

type OpcaoPasta = { id: number; label: string };
const COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/**
 * Modal de envio de arquivos (um ou vários). Renderiza o próprio backdrop:
 * fecha no clique fora e no Esc (exceto durante o envio).
 */
@Component({
  selector: 'app-arquivo-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BytesPipe],
  templateUrl: './arquivo-form.component.html',
  styleUrl: './arquivo-form.component.css'
})
export class ArquivoFormComponent implements OnInit, OnChanges, OnDestroy {

  private arquivoService = inject(ArquivoService);
  private obrigacaoPendenteService = inject(ObrigacaoPendenteService);
  private authService = inject(AuthService);
  private confirm = inject(ConfirmService);

  @Input() empresas: EmpresaResponseDTO[] = [];
  @Input() pastas: PastaResponseDTO[] = [];
  /** Pré-seleções vindas do explorer (empresa/pasta atual e arquivos soltos na tela). */
  @Input() idEmpresaInicial: number | null = null;
  @Input() idPastaInicial: number | null = null;
  @Input() arquivosIniciais: File[] = [];

  @Output() fechar = new EventEmitter<void>();
  /** Todos os arquivos foram enviados (emite a quantidade). */
  @Output() salvo = new EventEmitter<number>();
  /** Parte dos arquivos foi enviada e parte falhou: a lista deve ser recarregada. */
  @Output() parcial = new EventEmitter<number>();

  arquivosSelecionados: File[] = [];
  idEmpresa = 0;
  idPasta = 0;
  pastasFiltradas: PastaResponseDTO[] = [];
  opcoesPasta: OpcaoPasta[] = [];

  descricao = '';
  dataVencimento = '';
  categoriaFiscal: CategoriaFiscal | '' = '';
  idObrigacaoPendente: number | null = null;

  obrigacoesPendentes: ObrigacaoPendenteResponseDTO[] = [];
  carregandoObrigacoes = false;

  categorias = Object.values(CategoriaFiscal);
  categoriaLabel = CategoriaFiscalLabel;

  arrastando = false;
  enviando = false;
  progresso = 0;
  enviandoIndice = 0;
  erros: Record<string, string> = {};
  erroGeral = '';
  falhas: string[] = [];

  private intervalo: ReturnType<typeof setInterval> | null = null;
  /** Esc que fechou o diálogo de confirmação não deve fechar também o modal. */
  private escComConfirm = false;
  private capturaEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') this.escComConfirm = !!this.confirm.state(); };

  constructor() {
    document.addEventListener('keydown', this.capturaEsc, true);
  }

  /** Compatibilidade: primeiro arquivo da lista. */
  get arquivoSelecionado(): File | null { return this.arquivosSelecionados[0] ?? null; }

  get tamanhoTotal(): number { return this.arquivosSelecionados.reduce((s, f) => s + f.size, 0); }

  get mostrarEmpresa(): boolean { return this.empresas.length !== 1 || !this.idEmpresa; }

  get nomeEmpresa(): string { return this.empresas.find(e => e.id === this.idEmpresa)?.nomeFantasia ?? ''; }

  get arquivoAtual(): File | null { return this.arquivosSelecionados[this.enviandoIndice] ?? null; }

  ngOnInit(): void {
    if (this.idEmpresaInicial) this.idEmpresa = this.idEmpresaInicial;
    else if (this.empresas.length === 1) this.idEmpresa = this.empresas[0].id;
    this.atualizarPastas();
    if (this.idPastaInicial && this.pastasFiltradas.some(p => p.id === this.idPastaInicial)) this.idPasta = this.idPastaInicial;
    if (this.arquivosIniciais?.length) this.adicionarArquivos(this.arquivosIniciais);
    this.carregarObrigacoes();
  }

  ngOnChanges(): void {
    this.atualizarPastas();
  }

  ngOnDestroy(): void {
    this.pararSimulacao();
    document.removeEventListener('keydown', this.capturaEsc, true);
  }

  private atualizarPastas(): void {
    this.pastasFiltradas = this.idEmpresa
      ? this.pastas.filter(p => p.idEmpresa === this.idEmpresa)
      : this.pastas;
    const porId = new Map(this.pastas.map(p => [p.id, p]));
    this.opcoesPasta = this.pastasFiltradas.map(p => {
      const partes: string[] = [];
      let atual: PastaResponseDTO | undefined = p;
      let guarda = 0;
      while (atual && guarda++ < 50) {
        partes.unshift(atual.nome);
        atual = atual.idPastaPai != null ? porId.get(atual.idPastaPai) : undefined;
      }
      return { id: p.id, label: partes.join(' / ') };
    }).sort((a, b) => COLLATOR.compare(a.label, b.label));
  }

  onEmpresaChange(): void {
    this.atualizarPastas();
    this.idPasta = 0;
    this.idObrigacaoPendente = null;
    this.obrigacoesPendentes = [];
    this.erros['idEmpresa'] = '';
    this.carregarObrigacoes();
  }

  private carregarObrigacoes(): void {
    if (!this.idEmpresa) return;
    const id = this.idEmpresa;
    this.carregandoObrigacoes = true;
    this.obrigacaoPendenteService.pendentesPorEmpresa(id).subscribe({
      next: (data) => { if (id === this.idEmpresa) this.obrigacoesPendentes = data; this.carregandoObrigacoes = false; },
      error: () => { this.carregandoObrigacoes = false; }
    });
  }

  // ================= SELEÇÃO DE ARQUIVOS =================

  adicionarArquivos(files: File[] | FileList): void {
    if (this.enviando) return;
    const novos = Array.from(files).filter(f =>
      !this.arquivosSelecionados.some(x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified));
    if (!novos.length) return;
    this.arquivosSelecionados = [...this.arquivosSelecionados, ...novos];
    this.erros['arquivo'] = '';
    this.erroGeral = '';
    this.falhas = [];
  }

  onArquivoSelecionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.adicionarArquivos(input.files);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.enviando) this.arrastando = true;
  }

  onDragLeave(event: DragEvent): void {
    const zona = event.currentTarget as HTMLElement;
    if (!zona.contains(event.relatedTarget as Node)) this.arrastando = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.arrastando = false;
    const files = event.dataTransfer?.files;
    if (files?.length) this.adicionarArquivos(files);
  }

  removerArquivo(event: Event, indice = 0): void {
    event.stopPropagation();
    if (this.enviando) return;
    this.arquivosSelecionados = this.arquivosSelecionados.filter((_, i) => i !== indice);
  }

  visual(f: File): VisualTipo { return visualTipo(f.name); }

  formatarTamanho(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ================= ENVIO =================

  validar(): boolean {
    this.erros = {};
    if (!this.arquivosSelecionados.length) this.erros['arquivo'] = 'Selecione ao menos um arquivo.';
    if (!this.idEmpresa || this.idEmpresa === 0) this.erros['idEmpresa'] = 'Empresa é obrigatória.';
    if (!this.idPasta || this.idPasta === 0) {
      this.erros['idPasta'] = this.opcoesPasta.length ? 'Escolha a pasta de destino.' : 'Esta empresa ainda não tem pastas. Crie uma pasta primeiro.';
    }
    return Object.values(this.erros).every(v => !v);
  }

  enviar(): void {
    if (this.enviando || !this.validar()) return;

    const idUsuario = this.authService.getUsuarioId();
    if (!idUsuario) {
      this.erroGeral = 'Usuário não identificado. Faça login novamente.';
      return;
    }

    this.enviando = true;
    this.erroGeral = '';
    this.falhas = [];
    this.progresso = 0;
    this.enviarProximo(0, idUsuario, 0, []);
  }

  private enviarProximo(indice: number, idUsuario: number, enviados: number, falhas: { arquivo: File; msg: string }[]): void {
    const total = this.arquivosSelecionados.length;
    if (indice >= total) {
      this.finalizar(enviados, falhas);
      return;
    }
    this.enviandoIndice = indice;
    const arquivo = this.arquivosSelecionados[indice];
    let parcialArquivo = 0;
    this.pararSimulacao();
    this.intervalo = setInterval(() => {
      if (parcialArquivo < 85) parcialArquivo += 10;
      this.progresso = Math.round(((indice + parcialArquivo / 100) / total) * 100);
    }, 200);

    this.arquivoService.upload({
      arquivo,
      idEmpresa: this.idEmpresa,
      idUsuario,
      idPasta: this.idPasta,
      descricao: this.descricao || null,
      dataVencimento: this.dataVencimento || null,
      idObrigacaoPendente: this.idObrigacaoPendente,
      categoriaFiscal: this.categoriaFiscal || null
    }).subscribe({
      next: () => {
        this.pararSimulacao();
        this.progresso = Math.round(((indice + 1) / total) * 100);
        this.enviarProximo(indice + 1, idUsuario, enviados + 1, falhas);
      },
      error: (err) => {
        this.pararSimulacao();
        const msg = err?.error?.mensagem
          ?? err?.error?.message
          ?? (typeof err?.error === 'string' && err.error ? err.error : null)
          ?? 'Erro ao enviar arquivo. Tente novamente.';
        this.enviarProximo(indice + 1, idUsuario, enviados, [...falhas, { arquivo, msg }]);
      }
    });
  }

  private finalizar(enviados: number, falhas: { arquivo: File; msg: string }[]): void {
    if (!falhas.length) {
      this.progresso = 100;
      setTimeout(() => {
        this.enviando = false;
        this.progresso = 0;
        this.salvo.emit(enviados);
      }, 400);
      return;
    }
    this.enviando = false;
    this.progresso = 0;
    this.arquivosSelecionados = falhas.map(f => f.arquivo);
    this.falhas = falhas.map(f => `${f.arquivo.name}: ${f.msg}`);
    this.erroGeral = enviados
      ? `${enviados} arquivo(s) enviado(s). ${falhas.length} não puderam ser enviados — eles continuam na lista para nova tentativa.`
      : (falhas.length === 1 ? falhas[0].msg : 'Nenhum arquivo pôde ser enviado.');
    if (enviados) this.parcial.emit(enviados);
  }

  private pararSimulacao(): void {
    if (this.intervalo) { clearInterval(this.intervalo); this.intervalo = null; }
  }

  // ================= FECHAR =================

  async tentarFechar(): Promise<void> {
    if (this.enviando) return;
    if (this.arquivosSelecionados.length && !this.erroGeral) {
      const ok = await this.confirm.ask({
        titulo: 'Descartar envio?',
        mensagem: 'Os arquivos selecionados ainda não foram enviados.',
        confirmar: 'Descartar',
        cancelar: 'Continuar editando',
        tom: 'danger'
      });
      if (!ok) return;
    }
    this.fechar.emit();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.escComConfirm || this.confirm.state()) { this.escComConfirm = false; return; }
    this.tentarFechar();
  }
}
