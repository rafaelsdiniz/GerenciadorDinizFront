import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { ArquivoService } from '../../../services/arquivo.service';
import { PastaService } from '../../../services/pasta.service';
import { AuthService } from '../../../services/auth.service';
import { IconComponent } from '../../../shared/icon.component';
import { BytesPipe } from '../../../pipes/formatos.pipe';
import { visualTipo, VisualTipo } from '../../explorer/tipo-arquivo.util';
import { fotoDoInput, temCameraTouch } from '../../../shared/camera.util';
import { caminhoPasta, isCliente, mensagemErro, rotuloAnexar, sugerirCategoria, sugerirPasta } from '../obrigacao.util';
import { Subscription } from 'rxjs';
import { saveAs } from 'file-saver';
import { IaService } from '../../../services/ia.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { LeituraIaComponent } from '../../ia/leitura-ia/leitura-ia.component';
import { DocumentoAnalisado } from '../../../models/documento-analisado.dto';

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Modal "Anexar guia" / "Enviar documento": envia um arquivo vinculado à obrigação.
 * O backend vincula o arquivo e marca a obrigação como ENTREGUE na data de hoje.
 */
@Component({
  selector: 'app-obrigacao-anexar',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BytesPipe, LeituraIaComponent],
  templateUrl: './obrigacao-anexar.component.html',
  styleUrl: './obrigacao-anexar.component.css'
})
export class ObrigacaoAnexarComponent implements OnInit {
  @Input({ required: true }) obrigacao!: ObrigacaoPendenteResponseDTO;
  @Input() empresa = '';
  @Output() fechar = new EventEmitter<void>();
  @Output() enviado = new EventEmitter<ArquivoResponseDTO>();

  pastas: { id: number; caminho: string }[] = [];
  carregandoPastas = true;
  idPasta: number | null = null;
  descricao = '';
  arquivo: File | null = null;
  visual: VisualTipo | null = null;
  arrastando = false;
  /** "Tirar foto" só em telas de toque (celular/tablet) */
  readonly podeFotografar = temCameraTouch();
  enviando = false;
  erro = '';
  erroArquivo = '';

  // ---- leitura inteligente (IA): roda ao escolher o arquivo; nunca bloqueia o envio
  analise: DocumentoAnalisado | null = null;
  analisando = false;
  erroAnalise: string | null = null;
  /** a descrição atual veio da IA (some se o usuário editar) */
  descricaoDaIa = false;
  carregandoExemplo = false;
  private leituraSub?: Subscription;

  constructor(
    private arquivoService: ArquivoService,
    private pastaService: PastaService,
    private auth: AuthService,
    private ia: IaService,
    private confirm: ConfirmService,
    private toast: ToastService
  ) {}

  get titulo(): string { return rotuloAnexar(this.obrigacao); }
  get cliente(): boolean { return isCliente(this.obrigacao); }

  /** Guia de exemplo disponível para esta obrigação (demonstração da leitura inteligente). */
  get exemploTipo(): 'das' | 'fgts' | null {
    if (this.cliente) return null;
    const n = (this.obrigacao.nomeObrigacao ?? '').toLowerCase();
    if (/^das\b|simples nacional/.test(n)) return 'das';
    if (/\bfgts\b/.test(n)) return 'fgts';
    return null;
  }

  /** Categoria lida pela IA (quando o tipo combina com a obrigação); senão a sugerida pela obrigação. */
  private get categoriaEnvio() {
    const a = this.analise;
    const incompativel = a?.alertas.some(x => x.codigo === 'TIPO_INCOMPATIVEL');
    return a?.textoLegivel && a.tipoDocumento !== 'OUTRO' && a.categoriaFiscalSugerida && !incompativel
      ? a.categoriaFiscalSugerida : sugerirCategoria(this.obrigacao);
  }

  ngOnInit(): void {
    this.pastaService.buscarPorEmpresa(this.obrigacao.idEmpresa).subscribe({
      next: (lista) => {
        this.montarPastas(lista);
        this.carregandoPastas = false;
      },
      error: (err) => {
        this.carregandoPastas = false;
        this.erro = 'Não foi possível carregar as pastas da empresa. ' + mensagemErro(err, '');
      }
    });
  }

  private montarPastas(lista: PastaResponseDTO[]): void {
    this.pastas = lista
      .map(f => ({ id: f.id, caminho: caminhoPasta(f, lista) }))
      .sort((a, b) => a.caminho.localeCompare(b.caminho, 'pt-BR'));
    this.idPasta = sugerirPasta(this.obrigacao, lista)?.id ?? null;
  }

  // ------------------------------------------------------------- arquivo
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (!this.enviando) this.arrastando = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.arrastando = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.arrastando = false;
    if (this.enviando) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) this.selecionar(f);
  }

  onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.selecionar(f);
    input.value = '';
  }

  /** Foto tirada pela câmera do celular vira o arquivo a enviar. */
  onFotoTirada(e: Event): void {
    const foto = fotoDoInput(e);
    if (foto && !this.enviando) this.selecionar(foto);
  }

  private selecionar(f: File): void {
    this.erro = '';
    if (f.size > MAX_BYTES) {
      this.erroArquivo = 'O arquivo excede o limite de 50 MB.';
      return;
    }
    this.erroArquivo = '';
    this.arquivo = f;
    this.visual = visualTipo(f.name);
    this.ler(f);
  }

  remover(): void {
    if (this.enviando) return;
    this.arquivo = null;
    this.visual = null;
    this.limparLeitura();
  }

  // ---------------------------------------------------- leitura inteligente
  private ler(f: File): void {
    this.limparLeitura();
    this.analisando = true;
    this.leituraSub = this.ia.analisar(f, { idObrigacaoPendente: this.obrigacao.id }).subscribe({
      next: (a) => {
        this.analisando = false;
        this.analise = a;
        if (a.textoLegivel && a.descricaoSugerida && (!this.descricao.trim() || this.descricaoDaIa)) {
          this.descricao = a.descricaoSugerida;
          this.descricaoDaIa = true;
        }
      },
      error: () => {
        this.analisando = false;
        this.erroAnalise = 'Não foi possível ler o documento agora — você pode enviar normalmente.';
      }
    });
  }

  private limparLeitura(): void {
    this.leituraSub?.unsubscribe();
    this.analise = null;
    this.analisando = false;
    this.erroAnalise = null;
    if (this.descricaoDaIa) { this.descricao = ''; this.descricaoDaIa = false; }
  }

  onDescricaoEditada(): void {
    this.descricaoDaIa = false;
  }

  /** Carrega uma guia fictícia montada para esta obrigação (para testar a leitura inteligente). */
  usarExemplo(baixar = false): void {
    const tipo = this.exemploTipo;
    if (!tipo || this.carregandoExemplo) return;
    this.carregandoExemplo = true;
    this.ia.baixarExemplo(tipo, { idObrigacaoPendente: this.obrigacao.id }).subscribe({
      next: (blob) => {
        this.carregandoExemplo = false;
        const nome = `guia-${tipo}-exemplo.pdf`;
        if (baixar) { saveAs(blob, nome); return; }
        this.selecionar(new File([blob], nome, { type: 'application/pdf' }));
      },
      error: (err) => {
        this.carregandoExemplo = false;
        this.toast.error('Não foi possível gerar o exemplo', mensagemErro(err));
      }
    });
  }

  // --------------------------------------------------------------- envio
  get podeEnviar(): boolean {
    return !!this.arquivo && !!this.idPasta && !this.enviando && !this.carregandoPastas;
  }

  async enviar(): Promise<void> {
    if (!this.arquivo) { this.erroArquivo = 'Selecione um arquivo.'; return; }
    if (!this.idPasta) { this.erro = 'Selecione a pasta de destino.'; return; }
    const idUsuario = this.auth.getUsuarioId();
    if (idUsuario == null) { this.erro = 'Sessão expirada. Entre novamente.'; return; }

    // divergência grave apontada pela leitura (CNPJ de outra empresa, tipo errado): confirma antes
    const grave = this.analise?.alertas.find(a => a.nivel === 'danger');
    if (grave && !(await this.confirm.ask({
      titulo: 'Enviar mesmo assim?',
      mensagem: `${grave.mensagem} Confira se este é o arquivo certo para "${this.obrigacao.nomeObrigacao || 'esta obrigação'}".`,
      confirmar: 'Enviar assim mesmo',
      cancelar: 'Revisar',
      tom: 'danger'
    }))) return;

    this.enviando = true;
    this.erro = '';
    this.arquivoService.upload({
      arquivo: this.arquivo,
      idEmpresa: this.obrigacao.idEmpresa,
      idUsuario,
      idPasta: this.idPasta,
      descricao: this.descricao.trim() || null,
      idObrigacaoPendente: this.obrigacao.id,
      categoriaFiscal: this.categoriaEnvio,
      // vencimento real da guia (lido do documento) quando houver
      dataVencimento: this.cliente ? null : (this.analise?.vencimento ?? this.obrigacao.dataVencimento)
    }).subscribe({
      next: (a) => {
        this.enviando = false;
        this.enviado.emit(a);
      },
      error: (err) => {
        this.enviando = false;
        this.erro = err?.status === 413
          ? 'O arquivo é grande demais para o servidor.'
          : mensagemErro(err, 'Não foi possível enviar o arquivo.');
      }
    });
  }

  tentarFechar(): void {
    if (!this.enviando) {
      this.leituraSub?.unsubscribe();
      this.fechar.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.confirm.state()) return;
    this.tentarFechar();
  }
}
