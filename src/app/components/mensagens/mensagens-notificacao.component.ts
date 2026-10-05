import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConversaRecenteDTO } from '../../models/mensagem.dto';
import { MensagemService } from '../../services/mensagem.service';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { AvatarCorPipe, IniciaisPipe } from '../../pipes/formatos.pipe';
import { dataHoraCompleta, tempoRelativo } from './mensagem.util';

/**
 * Conversas recentes das obrigações para o painel de notificações da topbar.
 *
 * Uso: `<app-mensagens-notificacao [limite]="5" (navegou)="fecharPainel()" (resumo)="msgs = $event" />`
 * Clique numa conversa → /obrigacoes-pendentes?obrigacao=<id> (abre o drawer com a conversa).
 */
@Component({
  selector: 'app-mensagens-notificacao',
  standalone: true,
  imports: [CommonModule, IconComponent, IniciaisPipe, AvatarCorPipe],
  template: `
    @if (!(ocultarSeVazio && !carregando && !conversas.length && !erro)) {
      @if (titulo) {
        <div class="menu-label mn-label">
          <span>{{ titulo }}</span>
          @if (naoLidas > 0) { <span class="count count-danger tnum">{{ naoLidas }}</span> }
        </div>
      }
      @if (carregando && !conversas.length) {
        <div class="mn-status"><span class="spinner"></span> Carregando mensagens…</div>
      } @else if (erro) {
        <div class="mn-status">Não foi possível carregar as mensagens. <button type="button" class="link" (click)="recarregar()">Tentar novamente</button></div>
      } @else if (!conversas.length) {
        <div class="mn-status"><app-icon name="message-circle" [size]="16" /> Nenhuma conversa ainda.</div>
      } @else {
        <ul class="mn-lista" role="list">
          @for (c of conversas; track c.idObrigacao) {
            <li>
              <button type="button" class="mn-item" [class.nao-lida]="c.naoLidas > 0" (click)="abrir(c)"
                      [attr.aria-label]="rotuloAcessivel(c)">
                <span [class]="'avatar avatar-sm mn-av ' + ((c.autorNome || '') | avatarCor)">{{ c.autorNome | iniciais }}</span>
                <span class="mn-corpo">
                  <span class="mn-linha">
                    <strong class="truncate">{{ isAdmin ? (c.nomeEmpresa || 'Empresa') : (c.doEscritorio ? 'Escritório' : (c.autorNome || 'Cliente')) }}</strong>
                    <time class="mn-tempo" [attr.datetime]="c.dataUltimaMensagem" [title]="dataHora(c.dataUltimaMensagem)">{{ tempo(c.dataUltimaMensagem) }}</time>
                  </span>
                  <span class="mn-obr truncate">
                    {{ c.nomeObrigacao }}@if (c.competencia) { · <span class="tnum">{{ c.competencia }}</span> }
                  </span>
                  <span class="mn-previa">
                    @if (c.minha) { <span class="mn-voce">Você:</span> }
                    @else if (isAdmin && c.autorNome) { <span class="mn-voce">{{ primeiroNome(c.autorNome) }}:</span> }
                    {{ c.previa }}
                  </span>
                </span>
                @if (c.naoLidas > 0) {
                  <span class="mn-dot" [title]="c.naoLidas + ' não lida(s)'"><span class="sr-only">{{ c.naoLidas }} não lida(s)</span></span>
                }
              </button>
            </li>
          }
        </ul>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .mn-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .mn-label .count { height: 18px; min-width: 18px; font-size: 10.5px; }
    .mn-status { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-size: 13px; color: var(--ink-mute); }
    .mn-lista { list-style: none; margin: 0; padding: 0; }
    .mn-item {
      position: relative; display: flex; align-items: flex-start; gap: 10px; width: 100%;
      padding: 9px 12px; border: 0; border-radius: var(--radius-md); background: none;
      text-align: left; color: var(--ink); cursor: pointer; transition: background var(--t-fast) var(--ease-out);
    }
    .mn-item:hover, .mn-item:focus-visible { background: var(--canvas-soft); }
    .mn-item:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
    .mn-item.nao-lida { background: var(--primary-50); }
    .mn-item.nao-lida:hover { background: var(--primary-100); }
    .mn-av { margin-top: 2px; flex-shrink: 0; }
    .mn-corpo { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .mn-linha { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; }
    .mn-linha strong { font-size: 13px; font-weight: 600; }
    .mn-tempo { flex-shrink: 0; font-size: 11.5px; color: var(--ink-mute); white-space: nowrap; }
    .mn-obr { font-size: 12px; color: var(--ink-2); }
    .mn-previa {
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      font-size: 12.5px; line-height: 1.4; color: var(--ink-mute); overflow-wrap: anywhere;
    }
    .nao-lida .mn-previa { color: var(--ink); }
    .mn-voce { font-weight: 600; color: var(--ink-2); }
    .mn-dot { flex-shrink: 0; width: 9px; height: 9px; margin-top: 6px; border-radius: 50%; background: var(--danger); box-shadow: 0 0 0 3px var(--danger-bg); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `]
})
export class MensagensNotificacaoComponent implements OnInit, OnDestroy {
  /** Quantas conversas mostrar (máx. 50). */
  @Input() limite = 5;
  /** Rótulo da seção (vazio = sem rótulo). */
  @Input() titulo = 'Mensagens';
  /** Não renderiza nada quando não há conversas (bom para o painel de notificações). */
  @Input() ocultarSeVazio = true;

  /** Disparado ao clicar numa conversa (o pai pode fechar o painel). */
  @Output() navegou = new EventEmitter<number>();
  /** Resumo após cada carga: conversas listadas e total de mensagens não lidas (para o contador do sino). */
  @Output() resumo = new EventEmitter<{ conversas: number; naoLidas: number }>();

  conversas: ConversaRecenteDTO[] = [];
  carregando = false;
  erro = false;
  naoLidas = 0;
  isAdmin = false;

  private agora = new Date();
  private subs: Subscription[] = [];

  constructor(private service: MensagemService, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.isAdmin();
    this.subs.push(this.service.naoLidas$.subscribe(n => {
      this.naoLidas = n.total ?? 0;
      // conversa aberta em outro lugar: apaga o ponto sem nova chamada
      this.conversas = this.conversas.map(c => ({ ...c, naoLidas: n.porObrigacao?.[c.idObrigacao] ?? 0 }));
    }));
    this.recarregar();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  /** Recarrega as conversas e a contagem de não lidas. */
  recarregar(): void {
    this.carregando = true;
    this.erro = false;
    this.service.recentes(this.limite).subscribe({
      next: (lista) => {
        this.agora = new Date();
        this.conversas = lista ?? [];
        this.carregando = false;
        this.service.atualizarNaoLidas();
        this.resumo.emit({ conversas: this.conversas.length, naoLidas: this.conversas.reduce((s, c) => s + (c.naoLidas || 0), 0) });
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      }
    });
  }

  abrir(c: ConversaRecenteDTO): void {
    this.navegou.emit(c.idObrigacao);
    this.router.navigate(['/obrigacoes-pendentes'], { queryParams: { obrigacao: c.idObrigacao } });
  }

  tempo(iso: string): string { return tempoRelativo(iso, this.agora); }
  dataHora(iso: string): string { return dataHoraCompleta(iso); }
  primeiroNome(nome: string): string { return nome.trim().split(/\s+/)[0]; }

  rotuloAcessivel(c: ConversaRecenteDTO): string {
    const quem = c.minha ? 'Você' : (c.autorNome || (c.doEscritorio ? 'Escritório' : 'Cliente'));
    const novas = c.naoLidas > 0 ? `, ${c.naoLidas} não lida(s)` : '';
    return `${c.nomeObrigacao}${c.nomeEmpresa ? ' — ' + c.nomeEmpresa : ''}. ${quem}: ${c.previa}${novas}`;
  }
}
