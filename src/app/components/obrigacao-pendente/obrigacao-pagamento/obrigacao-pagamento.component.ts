import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { CategoriaFiscal } from '../../../models/enums/categoria-fiscal.enum';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { ArquivoService } from '../../../services/arquivo.service';
import { PastaService } from '../../../services/pasta.service';
import { AuthService } from '../../../services/auth.service';
import { IconComponent } from '../../../shared/icon.component';
import { BytesPipe } from '../../../pipes/formatos.pipe';
import { visualTipo, VisualTipo } from '../../explorer/tipo-arquivo.util';
import { caminhoPasta, hojeIso, mensagemErro, situacaoPagamento, sugerirPasta } from '../obrigacao.util';

const MAX_BYTES = 50 * 1024 * 1024;

/** Resultado emitido ao pai para o toast e a recarga da lista/drawer. */
export interface PagamentoConfirmado {
  obrigacao: ObrigacaoPendenteResponseDTO | null;
  data: string;
  comComprovante: boolean;
}

/**
 * Modal "Confirmar pagamento da guia": registra a data em que a guia entregue pelo escritório foi paga
 * e, opcionalmente, anexa o comprovante (upload vinculado à obrigação — mantém a data de entrega original).
 */
@Component({
  selector: 'app-obrigacao-pagamento',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BytesPipe],
  templateUrl: './obrigacao-pagamento.component.html',
  styleUrl: './obrigacao-pagamento.component.css'
})
export class ObrigacaoPagamentoComponent implements OnInit {
  @Input({ required: true }) obrigacao!: ObrigacaoPendenteResponseDTO;
  @Input() empresa = '';
  /** true quando o comprovante chegou a ser anexado (o pai recarrega a lista) */
  @Output() fechar = new EventEmitter<boolean>();
  @Output() confirmado = new EventEmitter<PagamentoConfirmado>();

  readonly hoje = hojeIso();
  data = this.hoje;

  pastas: { id: number; caminho: string }[] = [];
  carregandoPastas = true;
  erroPastas = '';
  idPasta: number | null = null;
  /** pasta onde está a guia anexada (pré-selecionada para o comprovante) */
  pastaGuiaId: number | null = null;
  arquivo: File | null = null;
  visual: VisualTipo | null = null;
  arrastando = false;
  erroArquivo = '';

  salvando = false;
  /** etapa em andamento, para o rótulo do botão */
  etapa: 'upload' | 'pagamento' | null = null;
  /** comprovante já enviado numa tentativa anterior (não reenviar se só o PATCH falhou) */
  private comprovanteEnviado = false;
  erro = '';

  constructor(
    private service: ObrigacaoPendenteService,
    private arquivoService: ArquivoService,
    private pastaService: PastaService,
    private auth: AuthService
  ) {}

  get atrasado(): boolean { return situacaoPagamento(this.obrigacao) === 'ATRASADO'; }

  /** "No vencimento" só faz sentido se o vencimento não está no futuro. */
  get vencimentoSelecionavel(): boolean {
    const v = this.obrigacao.dataVencimento;
    return !!v && v <= this.hoje;
  }

  get dataFutura(): boolean { return !!this.data && this.data > this.hoje; }

  /** Pago depois do vencimento → aviso de juros e multa. */
  get aposVencimento(): boolean {
    return !!this.data && !this.dataFutura && !!this.obrigacao.dataVencimento && this.data > this.obrigacao.dataVencimento;
  }

  ngOnInit(): void {
    forkJoin({
      pastas: this.pastaService.buscarPorEmpresa(this.obrigacao.idEmpresa),
      // anexos da obrigação: o comprovante vai, por padrão, para a mesma pasta da guia
      anexos: this.arquivoService.porObrigacao(this.obrigacao.id).pipe(catchError(() => of([] as ArquivoResponseDTO[])))
    }).subscribe({
      next: ({ pastas, anexos }) => {
        this.montarPastas(pastas, anexos);
        this.carregandoPastas = false;
      },
      error: (err) => {
        this.carregandoPastas = false;
        this.erroPastas = 'Não foi possível carregar as pastas da empresa. ' + mensagemErro(err, '');
      }
    });
  }

  private montarPastas(lista: PastaResponseDTO[], anexos: ArquivoResponseDTO[]): void {
    this.pastas = lista
      .map(f => ({ id: f.id, caminho: caminhoPasta(f, lista) }))
      .sort((a, b) => a.caminho.localeCompare(b.caminho, 'pt-BR'));
    const daGuia = anexos
      .filter(a => !a.excluidoEm && lista.some(f => f.id === a.idPasta))
      .sort((x, y) => (y.dataCriacao ?? '').localeCompare(x.dataCriacao ?? ''))[0]?.idPasta;
    this.pastaGuiaId = daGuia ?? null;
    this.idPasta = daGuia ?? sugerirPasta(this.obrigacao, lista)?.id ?? null;
  }

  // ------------------------------------------------------------- comprovante
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (!this.salvando) this.arrastando = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.arrastando = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.arrastando = false;
    if (this.salvando) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) this.selecionar(f);
  }

  onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.selecionar(f);
    input.value = '';
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
    this.comprovanteEnviado = false;
  }

  remover(): void {
    if (this.salvando) return;
    this.arquivo = null;
    this.visual = null;
    this.comprovanteEnviado = false;
  }

  // ------------------------------------------------------------------ envio
  get precisaPasta(): boolean { return !!this.arquivo && !this.comprovanteEnviado; }

  get podeSalvar(): boolean {
    if (this.salvando || !this.data || this.dataFutura) return false;
    return !this.precisaPasta || (!!this.idPasta && !this.carregandoPastas);
  }

  salvar(): void {
    if (!this.data) { this.erro = 'Informe a data do pagamento.'; return; }
    if (this.dataFutura) { this.erro = 'A data do pagamento não pode ser futura.'; return; }
    this.erro = '';

    if (this.precisaPasta) {
      if (!this.idPasta) { this.erro = 'Selecione a pasta onde o comprovante será salvo.'; return; }
      const idUsuario = this.auth.getUsuarioId();
      if (idUsuario == null) { this.erro = 'Sessão expirada. Entre novamente.'; return; }
      this.salvando = true;
      this.etapa = 'upload';
      this.arquivoService.upload({
        arquivo: this.arquivo!,
        idEmpresa: this.obrigacao.idEmpresa,
        idUsuario,
        idPasta: this.idPasta,
        descricao: 'Comprovante de pagamento',
        idObrigacaoPendente: this.obrigacao.id,
        categoriaFiscal: CategoriaFiscal.OUTRO,
        dataVencimento: null
      }).subscribe({
        next: () => {
          this.comprovanteEnviado = true;
          this.confirmarPagamento();
        },
        error: (err) => {
          this.salvando = false;
          this.etapa = null;
          this.erro = err?.status === 413
            ? 'O comprovante é grande demais para o servidor.'
            : 'Não foi possível enviar o comprovante. ' + mensagemErro(err, '');
        }
      });
      return;
    }

    this.salvando = true;
    this.confirmarPagamento();
  }

  private confirmarPagamento(): void {
    this.etapa = 'pagamento';
    this.service.confirmarPagamento(this.obrigacao.id, this.data).subscribe({
      next: (o) => {
        this.salvando = false;
        this.etapa = null;
        this.confirmado.emit({ obrigacao: o ?? null, data: this.data, comComprovante: this.comprovanteEnviado });
      },
      error: (err) => {
        this.salvando = false;
        this.etapa = null;
        this.erro = (this.comprovanteEnviado ? 'O comprovante foi anexado, mas o pagamento não foi confirmado: ' : '')
          + mensagemErro(err, 'Não foi possível confirmar o pagamento.');
      }
    });
  }

  tentarFechar(): void {
    if (!this.salvando) this.fechar.emit(this.comprovanteEnviado);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.tentarFechar();
  }
}
