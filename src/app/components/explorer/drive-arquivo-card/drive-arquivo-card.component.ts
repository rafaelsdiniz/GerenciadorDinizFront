import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon.component';
import { BytesPipe, PrazoPipe, PrazoTomPipe } from '../../../pipes/formatos.pipe';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { StatusArquivoLabel } from '../../../models/enums/status-arquivo.enum';
import { mostraPrazo, tomStatus, visualTipo, VisualTipo } from '../tipo-arquivo.util';

/**
 * Cartão de arquivo estilo Drive: miniatura colorida pelo tipo + barra com ícone, nome e "⋮".
 * Os eventos de clique/duplo clique/arrastar/clique direito são escutados no próprio elemento pelo pai.
 */
@Component({
  selector: 'app-drive-arquivo-card',
  standalone: true,
  imports: [CommonModule, IconComponent, BytesPipe, PrazoPipe, PrazoTomPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dcard',
    '[class.is-selected]': 'selecionado',
    '[class.is-sugerido]': 'variante === "sugerido"',
    '[class.show-check]': 'mostrarCheck',
    '[attr.aria-selected]': 'variante === "sugerido" ? null : selecionado',
  },
  template: `
    <div class="thumb" [ngClass]="'t-' + (v.tom || 'primary')">
      @if (variante !== 'sugerido') {
        <label class="chk" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()" title="Selecionar">
          <input type="checkbox" [checked]="selecionado" (change)="marcar.emit()" [attr.aria-label]="'Selecionar ' + arquivo.nomeOriginal" />
        </label>
      }
      <span class="big"><app-icon [name]="v.icone" [size]="40" [stroke]="1.4" /><span class="ext">{{ v.ext }}</span></span>
      @if (prazo) {
        <span class="badge st" [ngClass]="'badge-' + (prazoValor | prazoTom)">{{ prazoValor | prazo }}</span>
      } @else if (arquivo.status) {
        <span class="badge badge-dot st" [ngClass]="tom">{{ statusLabel[arquivo.status] }}</span>
      }
    </div>
    <div class="bar">
      <span class="mini" [ngClass]="'m-' + (v.tom || 'primary')"><app-icon [name]="v.icone" [size]="16" /></span>
      <div class="txt">
        <span class="nome" [title]="arquivo.nomeOriginal">{{ arquivo.nomeOriginal }}</span>
        <span class="meta">
          @if (variante === 'sugerido') {
            {{ arquivo.nomeUsuario ? 'Enviado por ' + primeiroNome : 'Enviado' }}@if (arquivo.dataCriacao) { · {{ arquivo.dataCriacao | date:'dd/MM' }} }
          } @else if (caminho) {
            <app-icon name="folder" [size]="11" /> {{ caminho }}
          } @else {
            @if (arquivo.dataCriacao) { {{ arquivo.dataCriacao | date:'dd/MM/yyyy' }} · }{{ arquivo.tamanho | bytes }}
          }
        </span>
      </div>
      <button type="button" class="btn-icon sm more" [class.active]="menuAtivo" (click)="$event.stopPropagation(); menu.emit($event)"
              (dblclick)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()"
              title="Mais ações" [attr.aria-label]="'Ações de ' + arquivo.nomeOriginal">
        <app-icon name="more-vertical" [size]="16" />
      </button>
    </div>
  `,
  styleUrl: './drive-arquivo-card.component.css'
})
export class DriveArquivoCardComponent implements OnChanges {
  @Input({ required: true }) arquivo!: ArquivoResponseDTO;
  @Input() selecionado = false;
  @Input() menuAtivo = false;
  /** Mostra as caixas de seleção mesmo sem hover (há itens selecionados). */
  @Input() mostrarCheck = false;
  /** Caminho da pasta (em resultados/Recentes/Vencendo). */
  @Input() caminho = '';
  @Input() variante: 'grade' | 'sugerido' = 'grade';

  @Output() menu = new EventEmitter<MouseEvent>();
  @Output() marcar = new EventEmitter<void>();

  readonly statusLabel = StatusArquivoLabel;
  v: VisualTipo = visualTipo('');
  tom = '';
  prazo = false;
  prazoValor: number | string | null = null;
  primeiroNome = '';

  ngOnChanges(): void {
    const a = this.arquivo;
    this.v = visualTipo(a.nomeOriginal, a.tipoArquivo);
    this.tom = tomStatus(a.status);
    this.prazo = mostraPrazo(a);
    this.prazoValor = a.diasParaVencer ?? a.dataVencimento;
    const partes = (a.nomeUsuario ?? '').trim().split(/\s+/);
    const titulo = /^(sr|sra|srta|dr|dra)\.?$/i.test(partes[0] ?? '') && partes.length > 1;
    this.primeiroNome = titulo ? `${partes[0]} ${partes[1]}` : (partes[0] ?? '');
  }
}
