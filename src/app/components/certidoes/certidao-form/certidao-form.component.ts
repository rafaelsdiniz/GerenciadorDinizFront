import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CertidaoRequestDTO, CertidaoResponseDTO, SituacaoCertidao, TipoCertidao } from '../../../models/certidao.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { CertidaoService, LeituraDocumento } from '../../../services/certidao.service';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { BytesPipe } from '../../../pipes/formatos.pipe';
import { SITUACOES, TIPOS, hojeIso, mensagemErro, prazoTexto, somarDias, tipoInfo } from '../certidao.util';

const EXTENSOES = ['pdf', 'png', 'jpg', 'jpeg'];
const TAMANHO_MAX = 10 * 1024 * 1024;

/** Modal de cadastro / edição (renovação) de certidão, com PDF opcional e leitura inteligente. */
@Component({
  selector: 'app-certidao-form',
  standalone: true,
  imports: [FormsModule, IconComponent, BytesPipe],
  templateUrl: './certidao-form.component.html',
  styleUrl: './certidao-form.component.css'
})
export class CertidaoFormComponent implements OnInit {
  /** certidão em edição (null = nova) */
  @Input() certidao: CertidaoResponseDTO | null = null;
  @Input() empresas: EmpresaResponseDTO[] = [];
  /** empresa já definida (aba da empresa ou célula da matriz) */
  @Input() idEmpresa: number | null = null;
  @Input() tipoInicial: TipoCertidao | null = null;

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<CertidaoResponseDTO>();

  readonly tipos = TIPOS;
  readonly situacoes = SITUACOES;
  readonly hoje = hojeIso();

  empresaSel: number | null = null;
  tipo: TipoCertidao = 'FEDERAL';
  situacao: SituacaoCertidao = 'NEGATIVA';
  numero = '';
  dataEmissao = '';
  dataValidade = '';
  orgaoEmissor = '';
  observacao = '';

  arquivo: File | null = null;
  erroArquivo = '';
  arrastando = false;

  lendo = false;
  /** campos preenchidos pela leitura inteligente */
  lidosIa: string[] = [];
  /** a leitura reconheceu outro tipo de documento */
  avisoIa = '';

  salvando = false;
  tentouSalvar = false;
  erro = '';

  constructor(private service: CertidaoService, private toast: ToastService) {}

  ngOnInit(): void {
    const c = this.certidao;
    if (c) {
      this.empresaSel = c.idEmpresa;
      this.tipo = c.tipo;
      this.situacao = c.situacao;
      this.numero = c.numero ?? '';
      this.dataEmissao = c.dataEmissao ?? '';
      this.dataValidade = c.dataValidade;
      this.orgaoEmissor = c.orgaoEmissor ?? '';
      this.observacao = c.observacao ?? '';
    } else {
      this.empresaSel = this.idEmpresa ?? (this.empresas.length === 1 ? this.empresas[0].id : null);
      this.tipo = this.tipoInicial ?? 'FEDERAL';
      this.orgaoEmissor = tipoInfo(this.tipo).orgao;
      this.dataEmissao = this.hoje;
      this.dataValidade = somarDias(this.hoje, tipoInfo(this.tipo).validadeDias);
    }
  }

  get editando(): boolean { return !!this.certidao; }
  get empresaFixa(): boolean { return this.idEmpresa != null || this.editando; }

  /** edição de certidão vencida ou vencendo: oferece "renovar hoje" */
  get podeRenovar(): boolean { return !!this.certidao && this.certidao.statusValidade !== 'VALIDA'; }

  renovarHoje(): void {
    this.dataEmissao = this.hoje;
    this.dataValidade = somarDias(this.hoje, tipoInfo(this.tipo).validadeDias);
    if (this.situacao === 'POSITIVA') this.situacao = 'NEGATIVA';
  }
  get nomeEmpresa(): string {
    if (this.certidao) return this.certidao.nomeEmpresa;
    return this.empresas.find(e => e.id === this.empresaSel)?.nomeFantasia ?? '';
  }

  /** prazo resultante da validade escolhida */
  get prazo(): { texto: string; tom: string } | null {
    if (!this.dataValidade) return null;
    const [y, m, d] = this.dataValidade.split('-').map(Number);
    const [hy, hm, hd] = this.hoje.split('-').map(Number);
    const dias = Math.round((new Date(y, m - 1, d).getTime() - new Date(hy, hm - 1, hd).getTime()) / 86400000);
    return { texto: prazoTexto(dias), tom: dias <= 0 ? 'text-danger' : dias <= 15 ? 'text-warning' : 'text-success' };
  }

  get erroDatas(): string {
    if (this.dataEmissao && this.dataEmissao > this.hoje) return 'A emissão não pode estar no futuro.';
    if (this.dataEmissao && this.dataValidade && this.dataValidade < this.dataEmissao) return 'A validade não pode ser anterior à emissão.';
    return '';
  }

  get valido(): boolean {
    return !!this.empresaSel && !!this.tipo && !!this.situacao && !!this.dataValidade && !this.erroDatas;
  }

  selecionarTipo(t: TipoCertidao): void {
    const anterior = tipoInfo(this.tipo);
    // troca o órgão sugerido se ele ainda é o padrão do tipo anterior
    if (!this.orgaoEmissor || this.orgaoEmissor === anterior.orgao) this.orgaoEmissor = tipoInfo(t).orgao;
    // e a validade sugerida, se ainda não foi alterada à mão
    if (!this.editando && this.dataEmissao && this.dataValidade === somarDias(this.dataEmissao, anterior.validadeDias)) {
      this.dataValidade = somarDias(this.dataEmissao, tipoInfo(t).validadeDias);
    }
    this.tipo = t;
  }

  aplicarValidadePadrao(): void {
    const base = this.dataEmissao || this.hoje;
    this.dataValidade = somarDias(base, tipoInfo(this.tipo).validadeDias);
  }

  get validadePadraoDias(): number { return tipoInfo(this.tipo).validadeDias; }

  // ------------------------------------------------------------------ arquivo
  onDragOver(e: DragEvent): void { e.preventDefault(); if (!this.salvando) this.arrastando = true; }
  onDragLeave(e: DragEvent): void { e.preventDefault(); this.arrastando = false; }
  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.arrastando = false;
    const f = e.dataTransfer?.files?.[0];
    if (f && !this.salvando) this.definirArquivo(f);
  }
  onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.definirArquivo(f);
    input.value = '';
  }

  remover(): void {
    this.arquivo = null;
    this.erroArquivo = '';
    this.lidosIa = [];
    this.avisoIa = '';
  }

  private definirArquivo(f: File): void {
    const ext = f.name.toLowerCase().split('.').pop() ?? '';
    if (!EXTENSOES.includes(ext)) { this.erroArquivo = 'Envie a certidão em PDF (ou imagem PNG/JPG).'; return; }
    if (f.size > TAMANHO_MAX) { this.erroArquivo = 'O arquivo passa de 10 MB.'; return; }
    this.erroArquivo = '';
    this.arquivo = f;
    this.lerComIa(f);
  }

  /** Leitura inteligente: pré-preenche validade e número. Falha ou ausência do serviço = silêncio. */
  private lerComIa(f: File): void {
    this.lendo = true;
    this.lidosIa = [];
    this.avisoIa = '';
    this.service.lerDocumento(f).subscribe({
      next: (r) => {
        this.lendo = false;
        if (this.arquivo !== f) return;
        this.aplicarLeitura(r ?? {});
      },
      error: () => { this.lendo = false; }
    });
  }

  private aplicarLeitura(r: LeituraDocumento): void {
    const campos = (r['campos'] && typeof r['campos'] === 'object' ? r['campos'] : r) as LeituraDocumento;
    const lidos: string[] = [];
    const tipoDoc = typeof campos.tipoDocumento === 'string' ? campos.tipoDocumento : '';
    // a leitura reconheceu outro documento (ex.: guia DAS): não preenche nada, só avisa
    if (tipoDoc && tipoDoc !== 'CERTIDAO' && tipoDoc !== 'OUTRO') {
      this.avisoIa = `O arquivo parece ser ${String(campos['tipoDocumentoRotulo'] ?? tipoDoc)}, não uma certidão.`;
      return;
    }
    const resumo = typeof campos['textoExtraidoResumo'] === 'string' ? campos['textoExtraidoResumo'] as string : '';
    const validade = this.dataIso(campos.validade ?? campos['dataValidade']);
    if (validade) { this.dataValidade = validade; lidos.push('validade'); }
    const emissao = this.dataIso(campos['dataEmissao'] ?? campos['emissao'])
      ?? this.dataIso(/emitida (?:em|às[^,]*,?)\s*(\d{2}\/\d{2}\/\d{4})/i.exec(resumo)?.[1]);
    if (emissao && emissao <= this.hoje) { this.dataEmissao = emissao; lidos.push('emissão'); }
    const numero = typeof campos.numeroDocumento === 'string' && campos.numeroDocumento.trim()
      ? campos.numeroDocumento.trim()
      : (/c[óo]digo de controle[^:]*:\s*([A-Z0-9][A-Z0-9./-]{5,})/i.exec(resumo)?.[1] ?? '');
    if (numero) { this.numero = numero.slice(0, 120); lidos.push('número'); }
    // tipo pelo texto lido (ex.: "Certidão negativa de débitos trabalhistas")
    const texto = `${campos.descricao ?? ''} ${campos['descricaoSugerida'] ?? ''} ${resumo}`.toLowerCase();
    const tipo: TipoCertidao | null =
      /trabalhist|trabalho|cndt/.test(texto) ? 'TRABALHISTA' :
      /fgts|crf/.test(texto) ? 'FGTS' :
      /fal[eê]ncia/.test(texto) ? 'FALENCIA' :
      /estadua|sefaz/.test(texto) ? 'ESTADUAL' :
      /municip|prefeitura/.test(texto) ? 'MUNICIPAL' :
      /federa|receita|pgfn|uni[aã]o/.test(texto) ? 'FEDERAL' : null;
    if (tipo && !this.editando && tipo !== this.tipo) { this.selecionarTipo(tipo); lidos.push('tipo'); }
    if (/positiva com efeito/.test(texto)) { this.situacao = 'POSITIVA_COM_EFEITO_DE_NEGATIVA'; lidos.push('situação'); }
    this.lidosIa = lidos;
  }

  private dataIso(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(v);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }

  // ------------------------------------------------------------------ salvar
  salvar(): void {
    this.tentouSalvar = true;
    this.erro = '';
    if (!this.valido || this.salvando) return;
    const dto: CertidaoRequestDTO = {
      idEmpresa: this.empresaSel!,
      tipo: this.tipo,
      situacao: this.situacao,
      numero: this.numero.trim() || null,
      dataEmissao: this.dataEmissao || null,
      dataValidade: this.dataValidade,
      orgaoEmissor: this.orgaoEmissor.trim() || null,
      observacao: this.observacao.trim() || null,
    };
    this.salvando = true;
    const req = this.certidao ? this.service.atualizar(this.certidao.id, dto) : this.service.criar(dto);
    req.subscribe({
      next: (c) => {
        if (!this.arquivo) { this.concluir(c); return; }
        this.service.anexar(c.id, this.arquivo).subscribe({
          next: (comPdf) => this.concluir(comPdf),
          error: (err) => {
            this.toast.warning('Certidão salva, mas o PDF não foi enviado', mensagemErro(err, 'Tente anexar novamente pela edição.'));
            this.salvando = false;
            this.salvo.emit(c);
          }
        });
      },
      error: (err) => {
        this.salvando = false;
        this.erro = mensagemErro(err, 'Não foi possível salvar a certidão.');
      }
    });
  }

  private concluir(c: CertidaoResponseDTO): void {
    this.salvando = false;
    this.toast.success(this.editando ? 'Certidão atualizada' : 'Certidão cadastrada',
      `${c.tipoRotulo} · ${c.nomeEmpresa}${this.arquivo ? ' · PDF salvo no Drive' : ''}`);
    this.salvo.emit(c);
  }

  @HostListener('document:keydown.escape')
  tentarFechar(): void {
    if (!this.salvando) this.fechar.emit();
  }
}
