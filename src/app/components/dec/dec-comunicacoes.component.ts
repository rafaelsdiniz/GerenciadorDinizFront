import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { DecService } from '../../services/dec.service';
import { AuthService } from '../../services/auth.service';
import {
  ComunicacaoDecDTO, StatusIntegracaoDec, TipoDecLabel, UrgenciaDecLabel, decPrecisaAtencao, tomUrgenciaDec
} from '../../models/comunicacao-dec.dto';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { PaginadorComponent, paginar } from '../../shared/ui/paginador.component';
import { DecTabelaComponent } from './dec-tabela/dec-tabela.component';
import { DecDetalheComponent } from './dec-detalhe/dec-detalhe.component';
import {
  URGENCIAS_DEC, decAtualizadoHa, decDiasDesde, decMenorTacita, decNomeEmpresa, decNormalizar, decOrdenar, decSemCiencia
} from './dec.util';

type Situacao = 'todas' | 'atencao' | 'semCiencia' | 'recentes' | 'semEmpresa';
const SITUACOES: Situacao[] = ['todas', 'atencao', 'semCiencia', 'recentes', 'semEmpresa'];
/** valor do select de empresa para "CNPJ não cadastrado" */
const SEM_EMPRESA = -1;

interface OpcaoEmpresa { id: number; nome: string; }

/** Comunicações do DEC (SEFAZ-TO), sincronizadas do DEC Monitor. Somente leitura. */
@Component({
  selector: 'app-dec-comunicacoes',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, PaginadorComponent, DecTabelaComponent, DecDetalheComponent],
  templateUrl: './dec-comunicacoes.component.html',
  styleUrl: './dec-comunicacoes.component.css'
})
export class DecComunicacoesComponent implements OnInit, OnDestroy {
  @ViewChild('buscaInput') buscaInput?: ElementRef<HTMLInputElement>;

  status: StatusIntegracaoDec | null = null;
  lista: ComunicacaoDecDTO[] = [];
  carregando = true;
  erro = '';
  sincronizando = false;
  isAdmin = false;

  busca = '';
  idEmpresaFiltro: number | null = null;
  situacao: Situacao = 'todas';
  urgencia: string | null = null;
  tipo: string | null = null;
  ordem: 'urgencia' | 'data' = 'urgencia';
  pagina = 1;
  porPagina = 10;

  detalhe: ComunicacaoDecDTO | null = null;

  readonly urgencias = URGENCIAS_DEC;
  readonly urgenciaLabel = UrgenciaDecLabel;
  readonly tipoLabel = TipoDecLabel;
  readonly SEM_EMPRESA = SEM_EMPRESA;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  /** relógio para "Atualizado há X min" */
  agora = Date.now();
  private relogio?: ReturnType<typeof setInterval>;
  private recarga?: ReturnType<typeof setInterval>;

  constructor(
    private dec: DecService,
    private auth: AuthService,
    private toast: ToastService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.isAdmin();
    const qp = this.route.snapshot.queryParamMap;
    const s = qp.get('filtro') as Situacao | null;
    if (s && SITUACOES.includes(s)) this.situacao = s;
    const emp = Number(qp.get('empresa'));
    if (emp) this.idEmpresaFiltro = emp;

    this.carregar();
    this.relogio = setInterval(() => this.agora = Date.now(), 30_000);
    // o backend sincroniza a cada 10 min — acompanha sem recarregar a página
    this.recarga = setInterval(() => this.carregar(true), 5 * 60_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.relogio);
    clearInterval(this.recarga);
  }

  // ------------------------------------------------------------------ dados
  carregar(silencioso = false): void {
    if (!silencioso) { this.carregando = true; this.erro = ''; }
    forkJoin({
      status: this.dec.status().pipe(catchError(() => of(null))),
      lista: this.dec.listar()
    }).subscribe({
      next: ({ status, lista }) => {
        this.status = status;
        this.lista = lista ?? [];
        this.carregando = false;
        this.erro = '';
        this.agora = Date.now();
        if (this.detalhe) this.detalhe = this.lista.find(c => c.id === this.detalhe!.id) ?? null;
      },
      error: (err) => {
        this.carregando = false;
        if (silencioso && this.lista.length) return;
        this.erro = err?.error?.mensagem ?? 'Verifique sua conexão e tente novamente.';
      }
    });
  }

  sincronizar(): void {
    if (this.sincronizando) return;
    this.sincronizando = true;
    this.dec.sincronizar().subscribe({
      next: (r) => {
        this.sincronizando = false;
        if (r.novas || r.atualizadas) {
          this.toast.success('Sincronização concluída', `${r.novas} ${r.novas === 1 ? 'nova' : 'novas'}, ${r.atualizadas} ${r.atualizadas === 1 ? 'atualizada' : 'atualizadas'}`);
        } else {
          this.toast.info('Nenhuma novidade no DEC', `${r.recebidas} ${r.recebidas === 1 ? 'comunicação conferida' : 'comunicações conferidas'}`);
        }
        this.carregar(true);
      },
      error: (err) => {
        this.sincronizando = false;
        this.toast.error('Falha ao sincronizar com o DEC', err?.error?.mensagem ?? 'O DEC Monitor não respondeu. Tente novamente em instantes.');
        this.carregar(true);
      }
    });
  }

  // ---------------------------------------------------------------- status
  get configurada(): boolean { return this.status?.configurada !== false; }
  /** integração desligada e nada sincronizado ainda → tela de boas-vindas */
  get onboarding(): boolean { return !this.carregando && !this.erro && this.status?.configurada === false && !this.lista.length; }
  get atualizado(): string { return decAtualizadoHa(this.status?.ultimaSincronizacao, this.agora); }

  // --------------------------------------------------------------- filtros
  get empresas(): OpcaoEmpresa[] {
    const m = new Map<number, string>();
    this.lista.forEach(c => { if (c.idEmpresa != null && !m.has(c.idEmpresa)) m.set(c.idEmpresa, decNomeEmpresa(c)); });
    return [...m].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  /** Após busca e empresa — base dos KPIs. */
  get base(): ComunicacaoDecDTO[] {
    const termo = decNormalizar(this.busca.trim());
    const digitos = this.busca.replace(/\D/g, '');
    const emp = this.idEmpresaFiltro;
    return this.lista.filter(c =>
      (emp == null || (emp === SEM_EMPRESA ? c.idEmpresa == null : c.idEmpresa === emp)) &&
      (!termo || decNormalizar(`${c.assunto ?? ''} ${c.numero ?? ''} ${c.razaoSocial ?? ''} ${c.nomeEmpresa ?? ''} ${c.remetente ?? ''}`).includes(termo)
        || (digitos.length >= 3 && (c.cnpj ?? '').replace(/\D/g, '').includes(digitos)))
    );
  }

  private passa(c: ComunicacaoDecDTO, s: Situacao): boolean {
    switch (s) {
      case 'atencao': return decPrecisaAtencao(c);
      case 'semCiencia': return decSemCiencia(c);
      case 'recentes': { const d = decDiasDesde(c.disponibilizadaEm); return d != null && d <= 7; }
      case 'semEmpresa': return c.idEmpresa == null;
      default: return true;
    }
  }

  contar(s: Situacao): number { return this.base.filter(c => this.passa(c, s)).length; }
  doTipo(s: Situacao): ComunicacaoDecDTO[] { return this.base.filter(c => this.passa(c, s)); }

  /** Base + situação (antes de urgência/tipo) — base dos chips. */
  private get naSituacao(): ComunicacaoDecDTO[] { return this.base.filter(c => this.passa(c, this.situacao)); }

  contarUrgencia(u: string): number {
    return this.naSituacao.filter(c => c.urgencia === u && (!this.tipo || c.tipo === this.tipo)).length;
  }

  get temChipUrgencia(): boolean {
    return !!this.urgencia || this.urgencias.some(u => this.contarUrgencia(u) > 0);
  }

  /** Tipos presentes, com contagem respeitando a urgência escolhida. */
  get tipos(): { tipo: string; total: number }[] {
    const m = new Map<string, number>();
    this.lista.forEach(c => m.set(c.tipo, 0));
    this.naSituacao.forEach(c => { if (!this.urgencia || c.urgencia === this.urgencia) m.set(c.tipo, (m.get(c.tipo) ?? 0) + 1); });
    return [...m].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total || a.tipo.localeCompare(b.tipo));
  }

  get filtradas(): ComunicacaoDecDTO[] {
    const r = this.naSituacao.filter(c => (!this.urgencia || c.urgencia === this.urgencia) && (!this.tipo || c.tipo === this.tipo));
    return decOrdenar(r, this.ordem);
  }

  get itensPagina(): ComunicacaoDecDTO[] { return paginar(this.filtradas, this.pagina, this.porPagina); }

  setSituacao(s: Situacao): void {
    this.situacao = this.situacao === s && s !== 'todas' ? 'todas' : s;
    if (s === 'semEmpresa' && this.idEmpresaFiltro != null && this.idEmpresaFiltro !== SEM_EMPRESA) this.idEmpresaFiltro = null;
    this.pagina = 1;
  }

  setUrgencia(u: string): void { this.urgencia = this.urgencia === u ? null : u; this.pagina = 1; }
  setTipo(t: string): void { this.tipo = this.tipo === t ? null : t; this.pagina = 1; }
  aoMudarFiltro(): void { this.pagina = 1; }

  get temFiltro(): boolean {
    return !!this.busca.trim() || this.idEmpresaFiltro != null || this.situacao !== 'todas' || !!this.urgencia || !!this.tipo;
  }

  limparFiltros(): void {
    this.busca = '';
    this.idEmpresaFiltro = null;
    this.situacao = 'todas';
    this.urgencia = null;
    this.tipo = null;
    this.pagina = 1;
  }

  // ------------------------------------------------------------------- KPIs
  get kpiAtencao(): ComunicacaoDecDTO[] { return this.doTipo('atencao'); }
  get menorTacitaAtencao(): number | null { return decMenorTacita(this.kpiAtencao); }
  get menorTacitaSemCiencia(): number | null { return decMenorTacita(this.doTipo('semCiencia')); }
  get empresasAtencao(): number { return new Set(this.kpiAtencao.map(c => c.idEmpresa ?? c.cnpj)).size; }
  get hoje(): number { return this.base.filter(c => decDiasDesde(c.disponibilizadaEm) === 0).length; }
  get semEmpresa(): number { return this.lista.filter(c => c.idEmpresa == null).length; }
  get mostraKpiSemEmpresa(): boolean { return this.isAdmin && (this.semEmpresa > 0 || (this.status?.semEmpresa ?? 0) > 0); }
  get cnpjsSemEmpresa(): number { return new Set(this.lista.filter(c => c.idEmpresa == null).map(c => c.cnpj)).size; }

  tomChip(u: string): string { return tomUrgenciaDec(u); }

  // ---------------------------------------------------------------- drawer
  abrir(c: ComunicacaoDecDTO): void { this.detalhe = c; }
  fechar(): void { this.detalhe = null; }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const alvo = e.target as HTMLElement;
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(alvo?.tagName) || alvo?.isContentEditable;
    if (e.key === '/' && !digitando && !this.detalhe) {
      e.preventDefault();
      this.buscaInput?.nativeElement.focus();
    }
  }
}
