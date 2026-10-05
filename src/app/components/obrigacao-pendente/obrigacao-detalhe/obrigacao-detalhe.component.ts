import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { saveAs } from 'file-saver';
import { ObrigacaoPendenteResponseDTO, SituacaoPagamento } from '../../../models/obrigacao-pendente-response.dto';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { ArquivoService } from '../../../services/arquivo.service';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { BytesPipe, PrazoPipe } from '../../../pipes/formatos.pipe';
import { visualTipo, VisualTipo } from '../../explorer/tipo-arquivo.util';
import {
  aguardaPagamento, isCliente, mensagemErro, pagamentoVisual, PagamentoVisual, rotuloAnexar, rotuloResponsavel, situacaoPagamento
} from '../obrigacao.util';

export type SituacaoObrigacao = 'VENCIDA' | 'PENDENTE' | 'ENTREGUE';

interface ArquivoVisual { a: ArquivoResponseDTO; v: VisualTipo; }

/** Drawer "Detalhes da obrigação": resumo, pagamento da guia, arquivos anexados e ações de entrega/pagamento. */
@Component({
  selector: 'app-obrigacao-detalhe',
  standalone: true,
  imports: [CommonModule, IconComponent, BytesPipe, PrazoPipe],
  templateUrl: './obrigacao-detalhe.component.html',
  styleUrl: './obrigacao-detalhe.component.css'
})
export class ObrigacaoDetalheComponent implements OnChanges {
  @Input({ required: true }) obrigacao!: ObrigacaoPendenteResponseDTO;
  @Input() empresa = '';
  @Input() situacao: SituacaoObrigacao = 'PENDENTE';
  @Input() dias: number | null = null;
  @Input() isAdmin = false;
  /** exibe a ação de anexo (o cliente não anexa guias do escritório) */
  @Input() podeAnexar = true;
  /** id da obrigação com ação em andamento no pai (desabilita botões) */
  @Input() ocupado = false;
  /** a ação em andamento é "desfazer pagamento" (spinner no botão certo) */
  @Input() desfazendo = false;

  @Output() fechar = new EventEmitter<void>();
  @Output() anexar = new EventEmitter<void>();
  @Output() entregar = new EventEmitter<void>();
  @Output() prorrogar = new EventEmitter<void>();
  @Output() reabrir = new EventEmitter<void>();
  @Output() pagar = new EventEmitter<void>();
  @Output() desfazerPagamento = new EventEmitter<void>();

  arquivos: ArquivoVisual[] = [];
  carregando = false;
  erro = '';
  baixandoId: number | null = null;

  constructor(private arquivoService: ArquivoService, private toast: ToastService) {}

  get rotuloAnexar(): string { return rotuloAnexar(this.obrigacao); }
  get rotuloResponsavel(): string { return rotuloResponsavel(this.obrigacao); }
  get cliente(): boolean { return isCliente(this.obrigacao); }
  get entregue(): boolean { return this.situacao === 'ENTREGUE'; }
  get situacaoPag(): SituacaoPagamento { return situacaoPagamento(this.obrigacao); }
  get aguardaPagamento(): boolean { return aguardaPagamento(this.obrigacao); }
  get pagamento(): PagamentoVisual | null { return pagamentoVisual(this.obrigacao); }
  get pagoAposVencimento(): boolean {
    const p = this.obrigacao.dataPagamento, v = this.obrigacao.dataVencimento;
    return !!p && !!v && p > v;
  }

  get statusClasse(): string {
    return this.situacao === 'ENTREGUE' ? 'badge-success' : this.situacao === 'VENCIDA' ? 'badge-danger' : 'badge-warning';
  }

  get statusTexto(): string {
    return this.situacao === 'ENTREGUE' ? 'Entregue' : this.situacao === 'VENCIDA' ? 'Vencida' : 'Pendente';
  }

  get prazoClasse(): string {
    if (this.situacao === 'VENCIDA') return 'badge-danger';
    const d = this.dias;
    if (d == null) return 'badge-neutral';
    return d <= 1 ? 'badge-danger' : d <= 7 ? 'badge-warning' : 'badge-success';
  }

  ngOnChanges(ch: SimpleChanges): void {
    // o pai entrega um objeto novo a cada recarga da lista → recarrega os anexos
    if (ch['obrigacao']) this.carregarArquivos();
  }

  carregarArquivos(): void {
    if (!this.obrigacao) return;
    this.carregando = true;
    this.erro = '';
    this.arquivoService.porObrigacao(this.obrigacao.id).subscribe({
      next: (lista) => {
        this.arquivos = lista
          .filter(a => !a.excluidoEm)
          .sort((x, y) => (y.dataCriacao ?? '').localeCompare(x.dataCriacao ?? ''))
          .map(a => ({ a, v: visualTipo(a.nomeOriginal, a.tipoArquivo) }));
        this.carregando = false;
      },
      error: (err) => {
        this.carregando = false;
        this.arquivos = [];
        this.erro = mensagemErro(err, 'Não foi possível carregar os arquivos.');
      }
    });
  }

  baixar(a: ArquivoResponseDTO): void {
    this.baixandoId = a.id;
    this.arquivoService.download(a.id).subscribe({
      next: (blob) => {
        this.baixandoId = null;
        saveAs(blob, a.nomeOriginal || a.nome);
      },
      error: (err) => {
        this.baixandoId = null;
        this.toast.error('Erro ao baixar arquivo', mensagemErro(err));
      }
    });
  }
}
