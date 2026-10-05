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
import { fotoDoInput, temCameraTouch } from '../../../shared/camera.util';
import { Subscription } from 'rxjs';
import { IaService } from '../../../services/ia.service';
import { LeituraIaComponent } from '../../ia/leitura-ia/leitura-ia.component';
import { DocumentoAnalisado, TipoDocumento } from '../../../models/documento-analisado.dto';

/** Nome da obrigação compatível com o tipo de documento lido (para sugerir o vínculo). */
const OBRIGACAO_POR_TIPO: Partial<Record<TipoDocumento, RegExp>> = {
  DAS: /^das\b|simples nacional/i,
  FGTS: /\bfgts\b/i,
  GPS: /\binss\b|\bgps\b|previd/i,
  DARF: /\bdarf\b|\birpj\b|\bcsll\b|\bpis\b|\bcofins\b|\birrf\b|\binss\b/i,
  ICMS: /\bicms\b|\bdare\b/i,
  ISS: /\biss\b/i,
  EXTRATO_BANCARIO: /extrato/i,
  NFE: /nota|nf-?e/i,
  NFSE: /nota|nfs-?e/i,
  BALANCETE: /balancete/i
};

type OpcaoPasta = { id: number; label: string };
const COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/**
 * Modal de envio de arquivos (um ou vários). Renderiza o próprio backdrop:
 * fecha no clique fora e no Esc (exceto durante o envio).
 */
@Component({
  selector: 'app-arquivo-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BytesPipe, LeituraIaComponent],
  templateUrl: './arquivo-form.component.html',
  styleUrl: './arquivo-form.component.css'
})
export class ArquivoFormComponent implements OnInit, OnChanges, OnDestroy {

  private arquivoService = inject(ArquivoService);
  private obrigacaoPendenteService = inject(ObrigacaoPendenteService);
  private authService = inject(AuthService);
  private confirm = inject(ConfirmService);
  private ia = inject(IaService);

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
  /** "Tirar foto" só em telas de toque (celular/tablet) */
  readonly podeFotografar = temCameraTouch();
  enviando = false;
  progresso = 0;
  enviandoIndice = 0;
  erros: Record<string, string> = {};
  erroGeral = '';
  falhas: string[] = [];

  // ---- leitura inteligente (IA): só com um arquivo selecionado; nunca bloqueia o envio
  analise: DocumentoAnalisado | null = null;
  analisando = false;
  erroAnalise: string | null = null;
  /** campos preenchidos pela IA (o selo some quando o usuário edita) */
  daIa = { descricao: false, categoria: false, vencimento: false };
  private lidoChave = '';
  private leituraSub?: Subscription;

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
    this.leituraSub?.unsubscribe();
    document.removeEventListener('keydown', this.capturaEsc, true);
  }

  // ================= LEITURA INTELIGENTE =================

  /** Relê quando muda o arquivo único, a empresa ou a obrigação vinculada (contexto das conferências). */
  atualizarLeitura(): void {
    const f = this.arquivosSelecionados.length === 1 ? this.arquivosSelecionados[0] : null;
    if (!f) {
      this.leituraSub?.unsubscribe();
      this.analise = null;
      this.analisando = false;
      this.erroAnalise = null;
      this.lidoChave = '';
      this.desfazerIa();
      return;
    }
    const chave = `${f.name}|${f.size}|${f.lastModified}|${this.idEmpresa}|${this.idObrigacaoPendente}`;
    if (chave === this.lidoChave) return;
    this.lidoChave = chave;
    this.leituraSub?.unsubscribe();
    this.analisando = true;
    this.erroAnalise = null;
    this.leituraSub = this.ia.analisar(f, { idEmpresa: this.idEmpresa || null, idObrigacaoPendente: this.idObrigacaoPendente }).subscribe({
      next: (a) => { this.analisando = false; this.analise = a; this.aplicarIa(a); },
      error: () => {
        this.analisando = false;
        this.analise = null;
        this.erroAnalise = 'Não foi possível ler o documento agora — você pode enviar normalmente.';
      }
    });
  }

  /** Preenche descrição, categoria e vencimento vazios (ou já preenchidos pela IA) com os dados lidos. */
  private aplicarIa(a: DocumentoAnalisado): void {
    if (!a.textoLegivel) return;
    if (a.descricaoSugerida && (!this.descricao.trim() || this.daIa.descricao)) {
      this.descricao = a.descricaoSugerida;
      this.daIa.descricao = true;
    }
    if (a.tipoDocumento !== 'OUTRO' && a.categoriaFiscalSugerida && (!this.categoriaFiscal || this.daIa.categoria)) {
      this.categoriaFiscal = a.categoriaFiscalSugerida;
      this.daIa.categoria = true;
    }
    const venc = a.vencimento ?? a.validade;
    if (venc && (!this.dataVencimento || this.daIa.vencimento)) {
      this.dataVencimento = venc;
      this.daIa.vencimento = true;
    }
  }

  /** Vários arquivos: os dados de um único documento não valem para todos. */
  private desfazerIa(): void {
    if (this.daIa.descricao) this.descricao = '';
    if (this.daIa.categoria) this.categoriaFiscal = '';
    if (this.daIa.vencimento) this.dataVencimento = '';
    this.daIa = { descricao: false, categoria: false, vencimento: false };
  }

  get rotuloIa(): string { return this.analise?.fonte === 'IA' ? 'Aplicado pela IA' : 'Preenchido pela leitura automática'; }

  /** Obrigação pendente que parece corresponder ao documento lido (mesmo tipo e competência/vencimento). */
  get obrigacaoSugerida(): ObrigacaoPendenteResponseDTO | null {
    const a = this.analise;
    if (!a?.textoLegivel || this.idObrigacaoPendente != null || a.tipoDocumento === 'OUTRO') return null;
    const re = OBRIGACAO_POR_TIPO[a.tipoDocumento];
    if (!re) return null;
    const candidatas = this.obrigacoesPendentes.filter(o => re.test(o.nomeObrigacao ?? ''));
    return candidatas.find(o => !!a.competencia && o.competencia === a.competencia)
      ?? candidatas.find(o => !!a.vencimento && o.dataVencimento === a.vencimento)
      ?? null;
  }

  vincularSugerida(o: ObrigacaoPendenteResponseDTO): void {
    this.idObrigacaoPendente = o.id;
    this.atualizarLeitura();
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
    this.atualizarLeitura();
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
    this.atualizarLeitura();
  }

  /** Foto tirada pela câmera do celular entra na lista como qualquer outro arquivo. */
  onFotoTirada(event: Event): void {
    const foto = fotoDoInput(event);
    if (foto) this.adicionarArquivos([foto]);
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
    this.atualizarLeitura();
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

  async enviar(): Promise<void> {
    if (this.enviando || !this.validar()) return;

    // divergência grave apontada pela leitura inteligente: confirma antes de enviar
    const grave = this.arquivosSelecionados.length === 1 ? this.analise?.alertas.find(a => a.nivel === 'danger') : undefined;
    if (grave && !(await this.confirm.ask({
      titulo: 'Enviar mesmo assim?',
      mensagem: `${grave.mensagem} Confira se este é o arquivo certo.`,
      confirmar: 'Enviar assim mesmo',
      cancelar: 'Revisar',
      tom: 'danger'
    }))) return;
    if (this.enviando) return;

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
