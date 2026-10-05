import { Component, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogAcessoService } from '../../services/log-acesso.service';
import { LogAcessoResponseDTO } from '../../models/log-acesso-response.dto';
import { AcaoLog, AcaoLogLabel } from '../../models/enums/acao-log.enum';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { IniciaisPipe, AvatarCorPipe } from '../../pipes/formatos.pipe';

type Periodo = 'tudo' | 'hoje' | '7d' | '30d';

interface GrupoDia { chave: string; titulo: string; data: Date; itens: LogAcessoResponseDTO[]; }

/** Cor do badge (classe .badge-*) e ícone por tipo de ação. */
const ACAO_UI: Record<AcaoLog, { tom: string; chip: string; icon: string }> = {
  [AcaoLog.LOGIN]:                { tom: 'outline', chip: '',             icon: 'log-in' },
  [AcaoLog.UPLOAD]:               { tom: 'success', chip: 'chip-success', icon: 'upload' },
  [AcaoLog.DOWNLOAD]:             { tom: 'neutral', chip: '',             icon: 'download' },
  [AcaoLog.VISUALIZAR]:           { tom: 'neutral', chip: '',             icon: 'eye' },
  [AcaoLog.ATUALIZAR_STATUS]:     { tom: 'primary', chip: 'chip-info',    icon: 'refresh' },
  [AcaoLog.ATUALIZAR_VENCIMENTO]: { tom: 'primary', chip: 'chip-info',    icon: 'calendar-clock' },
  [AcaoLog.EXCLUIR]:              { tom: 'danger',  chip: 'chip-danger',  icon: 'trash' },
  [AcaoLog.EXCLUIR_PERMANENTE]:   { tom: 'danger',  chip: 'chip-danger',  icon: 'x-circle' },
  [AcaoLog.RESTAURAR]:            { tom: 'success', chip: 'chip-success', icon: 'rotate-ccw' },
};

const ENTIDADE_ICON: Record<string, string> = {
  arquivo: 'file-text', empresa: 'building', usuario: 'user', pasta: 'folder',
  socio: 'handshake', obrigacao: 'calendar-check', obrigacaopendente: 'calendar-check', obrigacaorecorrente: 'repeat'
};

@Component({
  selector: 'app-log-acesso-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, IniciaisPipe, AvatarCorPipe],
  providers: [DatePipe],
  template: `
    <div class="page">
      <header class="page-header">
        <div class="page-header-text">
          <h1 class="page-title">Auditoria</h1>
          <p class="page-subtitle">Registro de atividades: quem fez o quê e quando — acessos, envios, downloads, alterações e exclusões.</p>
        </div>
        <div class="page-actions">
          <button class="btn-icon bordered" (click)="carregar()" [disabled]="carregando" title="Atualizar" aria-label="Atualizar registros">
            <app-icon name="refresh" [size]="16" />
          </button>
          <button class="btn btn-secondary" (click)="exportarCsv()" [disabled]="carregando || !filtrados.length">
            <app-icon name="download" [size]="15" /> Exportar CSV
          </button>
        </div>
      </header>

      <div class="section-label">
        <h2>Atividade recente</h2>
        @if (!carregando) {
          <span class="tnum">{{ filtrados.length }} de {{ logs.length }} {{ logs.length === 1 ? 'registro' : 'registros' }}</span>
        }
      </div>

      <!-- FILTROS -->
      <div class="filter-card">
        <div class="filter-row">
          <div class="input-icon search">
            <app-icon name="search" [size]="16" />
            <input #busca class="input" type="search" placeholder="Buscar por usuário, entidade, ID ou detalhe"
                   [(ngModel)]="termoBusca" (ngModelChange)="aplicarFiltro()" aria-label="Buscar registros" />
            @if (!termoBusca) { <span class="kbd search-kbd" aria-hidden="true">/</span> }
          </div>
          <select class="select" [(ngModel)]="usuarioFiltro" (ngModelChange)="aplicarFiltro()" aria-label="Filtrar por usuário">
            <option [ngValue]="''">Todos os usuários</option>
            @for (u of usuarios; track u) { <option [ngValue]="u">{{ u }}</option> }
          </select>
          <select class="select" [(ngModel)]="periodo" (ngModelChange)="aplicarFiltro()" aria-label="Período">
            <option value="tudo">Todo o período</option>
            <option value="hoje">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
        </div>
        <div class="filter-chips" role="group" aria-label="Filtrar por ação">
          <button type="button" class="chip" [class.active]="!acaoFiltro" [attr.aria-pressed]="!acaoFiltro" (click)="setAcao('')">
            Todas <span class="count tnum">{{ baseAcao.length }}</span>
          </button>
          @for (a of acoesPresentes; track a) {
            <button type="button" class="chip" [ngClass]="ui[a].chip" [class.active]="acaoFiltro === a" [attr.aria-pressed]="acaoFiltro === a" (click)="setAcao(a)">
              <app-icon [name]="ui[a].icon" [size]="13" /> {{ acaoLabel[a] }} <span class="count tnum">{{ contagem[a] }}</span>
            </button>
          }
        </div>
      </div>

      <!-- TABELA -->
      <div class="card table-card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th class="col-when">Quando</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              @if (carregando && !logs.length) {
                @for (r of skeletonRows; track r) {
                  <tr>
                    <td><span class="skeleton skeleton-line sk sk-60"></span></td>
                    <td><div class="cell-entity"><span class="avatar avatar-sm skeleton"></span><span class="skeleton skeleton-line sk sk-100"></span></div></td>
                    <td><span class="skeleton skeleton-line sk sk-80"></span></td>
                    <td><span class="skeleton skeleton-line sk sk-80"></span></td>
                    <td><span class="skeleton skeleton-line sk sk-200"></span></td>
                  </tr>
                }
              } @else {
                @for (g of grupos; track g.chave) {
                  <tr class="day-row">
                    <td colspan="5">
                      <span class="day-title">{{ g.titulo }}</span>
                      <span class="tnum">{{ g.data | date:'EEEE, dd/MM/yyyy' }} · {{ g.itens.length }} {{ g.itens.length === 1 ? 'registro' : 'registros' }}</span>
                    </td>
                  </tr>
                  @for (log of g.itens; track log.id) {
                    <tr>
                      <td class="col-when">
                        <span class="cell-main tnum" [title]="log.dataCriacao | date:'dd/MM/yyyy HH:mm:ss'">{{ log.dataCriacao | date:'HH:mm' }}</span>
                        <span class="cell-sub">{{ relativo(log.dataCriacao) }}</span>
                      </td>
                      <td>
                        @if (log.nomeUsuario) {
                          <div class="cell-entity">
                            <span class="avatar avatar-sm" [ngClass]="log.nomeUsuario | avatarCor">{{ log.nomeUsuario | iniciais }}</span>
                            <span class="cell-main truncate who">{{ log.nomeUsuario }}</span>
                          </div>
                        } @else {
                          <div class="cell-entity">
                            <span class="icon-tile sm neutral"><app-icon name="settings" [size]="14" /></span>
                            <span class="text-mute">Sistema</span>
                          </div>
                        }
                      </td>
                      <td>
                        <span class="badge" [ngClass]="'badge-' + uiDe(log.acao).tom">
                          <app-icon [name]="uiDe(log.acao).icon" [size]="12" [stroke]="2" />
                          {{ acaoLabel[log.acao] || log.acao }}
                        </span>
                      </td>
                      <td class="nowrap">
                        @if (log.entidade) {
                          <span class="ent">
                            <app-icon [name]="entidadeIcon(log.entidade)" [size]="14" />
                            {{ entidadeLabel(log.entidade) }}
                            @if (log.idEntidade != null) { <span class="tag tnum">#{{ log.idEntidade }}</span> }
                          </span>
                        } @else { <span class="text-faint">—</span> }
                      </td>
                      <td class="col-det">
                        @if (log.detalhes) { <span class="det" [title]="log.detalhes">{{ log.detalhes }}</span> }
                        @else { <span class="text-faint">—</span> }
                      </td>
                    </tr>
                  }
                }
              }
            </tbody>
          </table>
        </div>

        @if (!carregando && !filtrados.length) {
          @if (erroCarregar) {
            <div class="empty">
              <span class="empty-icon"><app-icon name="alert-triangle" [size]="22" /></span>
              <p class="empty-title">Não foi possível carregar o registro</p>
              <p class="empty-text">Verifique sua conexão com o servidor e tente novamente.</p>
              <button class="btn btn-secondary" (click)="carregar()"><app-icon name="refresh" [size]="15" /> Tentar novamente</button>
            </div>
          } @else if (logs.length) {
            <div class="empty">
              <span class="empty-icon"><app-icon name="search" [size]="22" /></span>
              <p class="empty-title">Nenhum registro encontrado</p>
              <p class="empty-text">Nenhuma atividade corresponde aos filtros. Ajuste a busca ou limpe os filtros.</p>
              <button class="btn btn-secondary" (click)="limparFiltros()"><app-icon name="x" [size]="15" /> Limpar filtros</button>
            </div>
          } @else {
            <div class="empty">
              <span class="empty-icon"><app-icon name="history" [size]="22" /></span>
              <p class="empty-title">Nenhuma atividade registrada</p>
              <p class="empty-text">Acessos, envios, downloads e exclusões aparecerão aqui assim que acontecerem.</p>
              <button class="btn btn-secondary" (click)="carregar()"><app-icon name="refresh" [size]="15" /> Atualizar</button>
            </div>
          }
        }

        @if (logs.length) {
          <div class="table-footer">
            <span class="tnum">Exibindo os {{ logs.length }} registros mais recentes</span>
            @if (temMais) {
              <button class="btn btn-secondary btn-sm" (click)="carregarMais()" [disabled]="carregando">
                @if (carregando) { <span class="spinner"></span> Carregando… } @else { <app-icon name="chevron-down" [size]="14" /> Carregar mais {{ passo }} }
              </button>
            } @else {
              <span class="text-faint">Início do histórico</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .filter-card { flex-direction: column; flex-wrap: nowrap; align-items: stretch; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
    .filter-row .search { flex: 1 1 260px; max-width: 440px; min-width: 0; }
    .filter-row .select { width: auto; min-width: 170px; }
    .search-kbd { position: absolute; right: 10px; pointer-events: none; }

    .col-when { width: 110px; white-space: nowrap; }
    .day-row td { background: var(--canvas-soft); padding: 8px 16px; font-size: 12px; color: var(--ink-mute); }
    .table tbody tr.day-row:hover td { background: var(--canvas-soft); }
    .day-title { font-weight: 600; color: var(--ink-2); margin-right: 8px; text-transform: capitalize; }
    .who { max-width: 200px; }
    .ent { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-2); }
    .ent app-icon { color: var(--ink-mute); }
    .col-det { min-width: 240px; max-width: 420px; }
    .det { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px; color: var(--ink-mute); }
    .sk { display: block; } .sk-60 { width: 60px; } .sk-80 { width: 90px; } .sk-100 { width: 120px; } .sk-200 { width: 220px; }
    @media (max-width: 720px) {
      .filter-row .search, .filter-row .select { flex: 1 1 100%; max-width: none; }
      .search-kbd { display: none; }
    }
  `]
})
export class LogAcessoListComponent implements OnInit {
  private service = inject(LogAcessoService);
  private toast = inject(ToastService);
  private datePipe = inject(DatePipe);

  @ViewChild('busca') buscaInput?: ElementRef<HTMLInputElement>;

  readonly passo = 100;
  readonly ui = ACAO_UI;
  readonly acaoLabel = AcaoLogLabel;
  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  acoes = Object.values(AcaoLog);

  logs: LogAcessoResponseDTO[] = [];
  filtrados: LogAcessoResponseDTO[] = [];
  grupos: GrupoDia[] = [];
  /** registros antes do filtro de ação (base para as contagens dos chips) */
  baseAcao: LogAcessoResponseDTO[] = [];
  contagem: Partial<Record<AcaoLog, number>> = {};
  acoesPresentes: AcaoLog[] = [];
  usuarios: string[] = [];

  carregando = false;
  erroCarregar = false;
  limite = 100;
  temMais = false;

  termoBusca = '';
  acaoFiltro: AcaoLog | '' = '';
  usuarioFiltro = '';
  periodo: Periodo = 'tudo';

  ngOnInit(): void { this.carregar(); }

  carregar(): void {
    this.carregando = true;
    this.erroCarregar = false;
    this.service.listarRecentes(this.limite).subscribe({
      next: (d) => {
        this.logs = [...d].sort((a, b) => this.ts(b.dataCriacao) - this.ts(a.dataCriacao));
        this.temMais = d.length >= this.limite;
        this.usuarios = [...new Set(d.map(l => l.nomeUsuario).filter((n): n is string => !!n))]
          .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        this.aplicarFiltro();
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erroCarregar = true;
        this.toast.error('Não foi possível carregar o registro de atividades', 'Tente novamente em instantes.');
      }
    });
  }

  carregarMais(): void {
    this.limite += this.passo;
    this.carregar();
  }

  setAcao(a: AcaoLog | ''): void {
    this.acaoFiltro = a;
    this.aplicarFiltro();
  }

  limparFiltros(): void {
    this.termoBusca = '';
    this.acaoFiltro = '';
    this.usuarioFiltro = '';
    this.periodo = 'tudo';
    this.aplicarFiltro();
  }

  aplicarFiltro(): void {
    const termo = this.normalizar(this.termoBusca.trim());
    const desde = this.inicioPeriodo();
    this.baseAcao = this.logs.filter(l =>
      (!this.usuarioFiltro || l.nomeUsuario === this.usuarioFiltro) &&
      (desde == null || this.ts(l.dataCriacao) >= desde) &&
      (!termo || [l.nomeUsuario, l.entidade, l.detalhes, l.idEntidade != null ? '#' + l.idEntidade : '', this.acaoLabel[l.acao]]
        .some(v => v != null && this.normalizar(String(v)).includes(termo)))
    );
    const cont: Partial<Record<AcaoLog, number>> = {};
    this.baseAcao.forEach(l => cont[l.acao] = (cont[l.acao] ?? 0) + 1);
    this.contagem = cont;
    this.acoesPresentes = this.acoes.filter(a => cont[a] || a === this.acaoFiltro);
    this.filtrados = this.acaoFiltro ? this.baseAcao.filter(l => l.acao === this.acaoFiltro) : this.baseAcao;
    this.agrupar();
  }

  private agrupar(): void {
    const mapa = new Map<string, GrupoDia>();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    for (const l of this.filtrados) {
      const d = new Date(this.ts(l.dataCriacao)); d.setHours(0, 0, 0, 0);
      const chave = d.toISOString();
      let g = mapa.get(chave);
      if (!g) {
        const dias = Math.round((hoje.getTime() - d.getTime()) / 86400000);
        const titulo = dias === 0 ? 'Hoje' : dias === 1 ? 'Ontem' : (this.datePipe.transform(d, 'dd MMM') ?? '');
        g = { chave, titulo, data: d, itens: [] };
        mapa.set(chave, g);
      }
      g.itens.push(l);
    }
    this.grupos = [...mapa.values()];
  }

  private inicioPeriodo(): number | null {
    if (this.periodo === 'tudo') return null;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (this.periodo === '7d') d.setDate(d.getDate() - 6);
    if (this.periodo === '30d') d.setDate(d.getDate() - 29);
    return d.getTime();
  }

  private ts(v: string): number {
    const t = new Date(v).getTime();
    return isNaN(t) ? 0 : t;
  }

  private normalizar(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  uiDe(a: AcaoLog): { tom: string; chip: string; icon: string } {
    return ACAO_UI[a] ?? { tom: 'neutral', chip: '', icon: 'activity' };
  }

  relativo(v: string): string {
    const diff = Date.now() - this.ts(v);
    if (diff < 0) return '';
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'ontem';
    if (d < 30) return `há ${d} dias`;
    const m = Math.floor(d / 30);
    return m < 12 ? `há ${m} ${m === 1 ? 'mês' : 'meses'}` : `há ${Math.floor(m / 12)} ano(s)`;
  }

  private chaveEntidade(e: string): string {
    return this.normalizar(e).replace(/[^a-z]/g, '');
  }

  entidadeIcon(e: string): string {
    return ENTIDADE_ICON[this.chaveEntidade(e)] ?? 'circle-dot';
  }

  entidadeLabel(e: string): string {
    const k = this.chaveEntidade(e);
    const nomes: Record<string, string> = {
      arquivo: 'Arquivo', empresa: 'Empresa', usuario: 'Usuário', pasta: 'Pasta', socio: 'Sócio',
      obrigacao: 'Obrigação', obrigacaopendente: 'Obrigação', obrigacaorecorrente: 'Obrigação recorrente'
    };
    return nomes[k] ?? e.charAt(0).toUpperCase() + e.slice(1).toLowerCase();
  }

  exportarCsv(): void {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [
      ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'ID', 'Detalhes'].map(esc).join(';'),
      ...this.filtrados.map(l => [
        this.datePipe.transform(l.dataCriacao, 'dd/MM/yyyy HH:mm:ss'),
        l.nomeUsuario ?? 'Sistema',
        this.acaoLabel[l.acao] ?? l.acao,
        l.entidade ?? '',
        l.idEntidade ?? '',
        l.detalhes ?? ''
      ].map(esc).join(';'))
    ];
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registro-atividades-${this.datePipe.transform(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Exportação concluída', `${this.filtrados.length} registros exportados em CSV.`);
  }

  @HostListener('document:keydown', ['$event'])
  atalhos(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key !== '/') return;
    const alvo = e.target as HTMLElement;
    if (alvo?.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    this.buscaInput?.nativeElement.focus();
  }
}
