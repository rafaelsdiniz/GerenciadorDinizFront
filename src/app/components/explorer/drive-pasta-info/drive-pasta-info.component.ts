import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconComponent } from '../../../shared/icon.component';
import { BytesPipe } from '../../../pipes/formatos.pipe';

/** Painel ⓘ quando nenhum arquivo está em foco: resumo da pasta atual, da seção ou da seleção múltipla. */
@Component({
  selector: 'app-drive-pasta-info',
  standalone: true,
  imports: [IconComponent, BytesPipe],
  template: `
    <aside class="pi" [attr.aria-label]="'Detalhes de ' + titulo">
      <header class="pi-head">
        <span class="icon-tile sm" [class.accent]="icone === 'folder' || icone === 'folder-open'" [class.danger]="icone === 'calendar-clock'"><app-icon [name]="icone" [size]="15" /></span>
        <h2 class="pi-title" [title]="titulo">{{ titulo }}</h2>
        <button type="button" class="btn-icon sm" (click)="fechar.emit()" title="Fechar painel" aria-label="Fechar painel de detalhes"><app-icon name="x" [size]="16" /></button>
      </header>
      <div class="pi-body">
        <div class="pi-art" [class.is-multi]="selecionados > 1">
          <app-icon [name]="selecionados > 1 ? 'files' : icone" [size]="56" [stroke]="1.25" />
        </div>
        @if (selecionados > 1) {
          <p class="pi-lead"><strong class="tnum">{{ selecionados }} arquivos selecionados</strong><br /><span class="tnum">{{ bytesSelecionados | bytes }} no total</span></p>
          <p class="pi-hint">Use a barra acima para baixar (ZIP), mover ou enviar para a lixeira.</p>
        } @else {
          <dl class="dl">
            @if (caminho) { <div class="span-2"><dt>Local</dt><dd>{{ caminho }}</dd></div> }
            @if (nPastas !== null) { <div><dt>Subpastas</dt><dd class="tnum">{{ nPastas }}</dd></div> }
            <div><dt>Arquivos</dt><dd class="tnum">{{ nArquivos }}</dd></div>
            <div [class.span-2]="nPastas === null"><dt>Tamanho</dt><dd class="tnum">{{ bytes | bytes }}</dd></div>
            @if (empresa) { <div class="span-2"><dt>Empresa</dt><dd>{{ empresa }}</dd></div> }
            @if (descricao) { <div class="span-2"><dt>Descrição</dt><dd>{{ descricao }}</dd></div> }
          </dl>
          @if (acoes) {
            <div class="pi-actions">
              <button type="button" class="btn btn-secondary btn-sm" (click)="enviar.emit()"><app-icon name="upload" [size]="15" /> Enviar aqui</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="novaPasta.emit()"><app-icon name="folder-plus" [size]="15" /> {{ ehRaiz ? 'Nova pasta' : 'Nova subpasta' }}</button>
            </div>
          }
          <p class="pi-hint">Clique em um arquivo para ver os detalhes dele aqui.</p>
        }
      </div>
    </aside>
  `,
  styles: [`
    :host { display: contents; }
    .pi { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--canvas); }
    .pi-head { display: flex; align-items: center; gap: 10px; padding: 14px 12px 12px 16px; border-bottom: 1px solid var(--hairline); }
    .pi-title { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pi-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
    .pi-art { height: 140px; display: grid; place-items: center; border-radius: var(--radius-lg); background: var(--accent-bg); color: var(--accent-fg); }
    .pi-art.is-multi { background: var(--primary-50); color: var(--primary); }
    .pi-lead { font-size: 14px; color: var(--ink-2); line-height: 1.5; }
    .pi-lead strong { color: var(--ink); }
    .pi-hint { font-size: 12.5px; color: var(--ink-mute); }
    .pi-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .dl { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px 16px; }
    .dl dd { font-size: 13px; }
  `]
})
export class DrivePastaInfoComponent {
  @Input() titulo = '';
  @Input() icone = 'folder';
  @Input() caminho = '';
  @Input() descricao = '';
  /** null = não se aplica (ex.: Recentes). */
  @Input() nPastas: number | null = null;
  @Input() nArquivos = 0;
  @Input() bytes = 0;
  @Input() empresa = '';
  @Input() acoes = true;
  @Input() ehRaiz = true;
  @Input() selecionados = 0;
  @Input() bytesSelecionados = 0;

  @Output() fechar = new EventEmitter<void>();
  @Output() enviar = new EventEmitter<void>();
  @Output() novaPasta = new EventEmitter<void>();
}
