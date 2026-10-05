import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { saveAs } from 'file-saver';
import { ObrigacaoPendenteResponseDTO, SituacaoPagamento } from '../../../models/obrigacao-pendente-response.dto';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { ArquivoService } from '../../../services/arquivo.service';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { BytesPipe, PrazoPipe } from '../../../pipes/formatos.pipe';
import { visualTipo, VisualTipo } from '../../explorer/tipo-arquivo.util';
import { ObrigacaoConversaComponent } from '../../mensagens/obrigacao-conversa.component';
import { DadosLeituraComponent } from '../../ia/dados-leitura/dados-leitura.component';
import { legivelPorIa } from '../../../models/documento-analisado.dto';
import {
  aguardaPagamento, isCliente, mensagemErro, pagamentoVisual, PagamentoVisual, rotuloAnexar, rotuloResponsavel, situacaoPagamento
} from '../obrigacao.util';

export type SituacaoObrigacao = 'VENCIDA' | 'PENDENTE' | 'ENTREGUE';

interface ArquivoVisual { a: ArquivoResponseDTO; v: VisualTipo; }

/** Drawer "Detalhes da obrigação": resumo, pagamento da guia, arquivos anexados e ações de entrega/pagamento. */
@Component({
  selector: 'app-obrigacao-detalhe',
  standalone: true,
  imports: [CommonModule, IconComponent, BytesPipe, PrazoPipe, ObrigacaoConversaComponent, DadosLeituraComponent],
  templateUrl: './obrigacao-detalhe.component.html',
  styleUrl: './obrigacao-detalhe.component.css'
})
export class ObrigacaoDetalheComponent implements OnChanges, OnDestroy {
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

  /** Valor lido da guia anexada mais recente (ou o informado pela lista). */
  get valorGuia(): number | null {
    return this.arquivos.find(f => f.a.valor != null)?.a.valor ?? this.obrigacao.valorGuia ?? null;
  }

  /** Arquivo relido pela IA no próprio drawer. */
  atualizarArquivo(a: ArquivoResponseDTO): void {
    this.arquivos = this.arquivos.map(f => (f.a.id === a.id ? { a, v: f.v } : f));
  }

  // a guia anexada é lida em segundo plano logo após o envio: recarrega algumas vezes até os dados chegarem
  private releitura: ReturnType<typeof setTimeout> | null = null;
  private tentativasReleitura = 0;

  private agendarReleitura(): void {
    if (this.releitura) clearTimeout(this.releitura);
    const agora = Date.now();
    const aguardando = this.arquivos.some(f => !f.a.analisadoEm && f.a.possuiConteudo !== false && legivelPorIa(f.a.nomeOriginal)
      && !!f.a.dataCriacao && agora - new Date(f.a.dataCriacao).getTime() < 90_000);
    if (!aguardando || this.tentativasReleitura >= 8) return;
    this.tentativasReleitura++;
    this.releitura = setTimeout(() => this.carregarArquivos(true), 3000);
  }

  ngOnDestroy(): void {
    if (this.releitura) clearTimeout(this.releitura);
  }

  carregarArquivos(silencioso = false): void {
    if (!this.obrigacao) return;
    if (!silencioso) this.tentativasReleitura = 0;
    this.carregando = !silencioso;
    this.erro = '';
    this.arquivoService.porObrigacao(this.obrigacao.id).subscribe({
      next: (lista) => {
        this.arquivos = lista
          .filter(a => !a.excluidoEm)
          .sort((x, y) => (y.dataCriacao ?? '').localeCompare(x.dataCriacao ?? ''))
          .map(a => ({ a, v: visualTipo(a.nomeOriginal, a.tipoArquivo) }));
        this.carregando = false;
        this.agendarReleitura();
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
