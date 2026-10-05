import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CalendarioService } from '../../services/calendario.service';
import { EmpresaService } from '../../services/empresa.service';
import { AuthService } from '../../services/auth.service';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { EventoCalendarioDTO } from '../../models/evento-calendario.dto';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../models/enums/categoria-fiscal.enum';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { UrgenciaDecLabel } from '../../models/comunicacao-dec.dto';

type Tom = 'danger' | 'warning' | 'success' | 'neutral' | 'info';
type FiltroTipo = 'TODOS' | 'OBRIGACAO' | 'ARQUIVO' | 'DEC';

interface DiaCelula {
  data: Date | null;
  iso: string;
  diaMes: number;
  hoje: boolean;
  doMes: boolean;
  fimDeSemana: boolean;
  eventos: EventoCalendarioDTO[];
}

interface DiaAgenda {
  iso: string;
  data: Date;
  hoje: boolean;
  eventos: EventoCalendarioDTO[];
}

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './calendario.component.html',
  styleUrl: './calendario.component.css'
})
export class CalendarioComponent implements OnInit, OnDestroy {
  diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  empresas: EmpresaResponseDTO[] = [];
  idEmpresa: number | null = null;

  ano = new Date().getFullYear();
  mes = new Date().getMonth() + 1;
  hoje = new Date();
  hojeIso = this.toIso(this.hoje);

  eventos: EventoCalendarioDTO[] = [];
  celulas: DiaCelula[] = [];
  /** dia selecionado (painel lateral) */
  selecionadoIso = this.hojeIso;
  carregando = false;

  filtroTipo: FiltroTipo = 'TODOS';
  vista: 'mes' | 'lista' = 'mes';
  estreito = false;
  private mql?: MediaQueryList;
  private readonly onMql = (e: MediaQueryListEvent) => this.estreito = e.matches;

  readonly maxPills = 2;

  constructor(
    private calendarioService: CalendarioService,
    private empresaService: EmpresaService,
    private authService: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mql = window.matchMedia('(max-width: 720px)');
      this.estreito = this.mql.matches;
      this.mql.addEventListener('change', this.onMql);
    }
    this.montarCelulas();
    this.empresaService.listar().subscribe({
      next: (data) => {
        const propria = this.authService.isAdmin() ? null : this.authService.getEmpresaId();
        this.empresas = propria ? data.filter(e => e.id === propria) : data;
        this.idEmpresa = this.authService.getEmpresaId() ?? data[0]?.id ?? null;
        this.carregar();
      },
      error: () => {
        // funcionário sem acesso à lista de empresas: usa a empresa do token
        this.idEmpresa = this.authService.getEmpresaId();
        this.carregar();
      }
    });
  }

  ngOnDestroy(): void {
    this.mql?.removeEventListener('change', this.onMql);
  }

  get vistaEfetiva(): 'mes' | 'lista' {
    return this.estreito ? 'lista' : this.vista;
  }

  get nomeEmpresa(): string {
    return this.empresas.find(e => e.id === this.idEmpresa)?.nomeFantasia ?? '';
  }

  rotuloMes(): string {
    const d = new Date(this.ano, this.mes - 1, 1);
    const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  get mesNome(): string {
    return new Date(this.ano, this.mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  }

  get ehMesAtual(): boolean {
    return this.ano === this.hoje.getFullYear() && this.mes === this.hoje.getMonth() + 1;
  }

  navegar(delta: number): void {
    let m = this.mes + delta;
    let a = this.ano;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    this.mes = m; this.ano = a;
    this.selecionadoIso = this.toIso(new Date(a, m - 1, 1));
    this.carregar();
  }

  hojeBtn(): void {
    const h = new Date();
    this.ano = h.getFullYear();
    this.mes = h.getMonth() + 1;
    this.selecionadoIso = this.hojeIso;
    this.carregar();
  }

  carregar(): void {
    if (this.idEmpresa == null) { this.montarCelulas(); return; }
    this.carregando = true;
    this.calendarioService.porMes(this.idEmpresa, this.ano, this.mes).subscribe({
      next: (data) => {
        this.eventos = data;
        this.carregando = false;
        this.montarCelulas();
        this.ajustarSelecao();
      },
      error: () => {
        this.eventos = [];
        this.carregando = false;
        this.montarCelulas();
        this.toast.error('Não foi possível carregar o calendário', 'Tente novamente em instantes.');
      }
    });
  }

  aoMudarEmpresa(): void {
    this.carregar();
  }

  setFiltroTipo(f: FiltroTipo): void {
    this.filtroTipo = f;
    this.montarCelulas();
  }

  /** Ao trocar de mês: seleciona hoje (se no mês) ou o primeiro dia com eventos. */
  private ajustarSelecao(): void {
    if (this.selecionadoIso.slice(0, 7) === this.hojeIso.slice(0, 7) && this.ehMesAtual) return;
    const primeiro = this.agenda[0];
    if (primeiro && this.selecionadoIso.endsWith('-01')) this.selecionadoIso = primeiro.iso;
  }

  private get eventosFiltrados(): EventoCalendarioDTO[] {
    return this.filtroTipo === 'TODOS' ? this.eventos : this.eventos.filter(e => e.tipo === this.filtroTipo);
  }

  contarTipo(t: FiltroTipo): number {
    return t === 'TODOS' ? this.eventos.length : this.eventos.filter(e => e.tipo === t).length;
  }

  private montarCelulas(): void {
    const inicio = new Date(this.ano, this.mes - 1, 1);
    const fim = new Date(this.ano, this.mes, 0);
    const offset = inicio.getDay();
    const totalDias = fim.getDate();

    const cels: DiaCelula[] = [];
    const eventosPorIso: Record<string, EventoCalendarioDTO[]> = {};
    for (const e of this.eventosFiltrados) {
      (eventosPorIso[e.data] ??= []).push(e);
    }
    // urgentes primeiro dentro do dia
    const ordemTom: Record<Tom, number> = { danger: 0, warning: 1, info: 2, neutral: 3, success: 4 };
    Object.values(eventosPorIso).forEach(l => l.sort((a, b) => ordemTom[this.tom(a)] - ordemTom[this.tom(b)]));

    for (let i = 0; i < offset; i++) {
      const d = new Date(this.ano, this.mes - 1, -offset + i + 1);
      cels.push(this.celulaDe(d, false, eventosPorIso));
    }
    for (let i = 1; i <= totalDias; i++) {
      const d = new Date(this.ano, this.mes - 1, i);
      cels.push(this.celulaDe(d, true, eventosPorIso));
    }
    while (cels.length % 7 !== 0) {
      const last = cels[cels.length - 1].data!;
      const next = new Date(last); next.setDate(next.getDate() + 1);
      cels.push(this.celulaDe(next, false, eventosPorIso));
    }
    this.celulas = cels;
  }

  private celulaDe(d: Date, doMes: boolean, eventosPorIso: Record<string, EventoCalendarioDTO[]>): DiaCelula {
    const iso = this.toIso(d);
    return {
      data: d,
      iso,
      diaMes: d.getDate(),
      hoje: iso === this.hojeIso,
      doMes,
      fimDeSemana: d.getDay() === 0 || d.getDay() === 6,
      eventos: eventosPorIso[iso] ?? []
    };
  }

  private toIso(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }

  private dataDe(iso: string): Date {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  abrirDia(cel: DiaCelula): void {
    if (!cel.doMes && cel.data) {
      // clique em dia de outro mês: navega até ele
      this.ano = cel.data.getFullYear();
      this.mes = cel.data.getMonth() + 1;
      this.selecionadoIso = cel.iso;
      this.carregar();
      return;
    }
    this.selecionadoIso = cel.iso;
  }

  get selecionado(): DiaAgenda {
    const cel = this.celulas.find(c => c.iso === this.selecionadoIso);
    return {
      iso: this.selecionadoIso,
      data: this.dataDe(this.selecionadoIso),
      hoje: this.selecionadoIso === this.hojeIso,
      eventos: cel?.eventos ?? []
    };
  }

  /** Dias do mês com eventos (vista lista / mobile). */
  get agenda(): DiaAgenda[] {
    return this.celulas
      .filter(c => c.doMes && c.eventos.length)
      .map(c => ({ iso: c.iso, data: c.data!, hoje: c.hoje, eventos: c.eventos }));
  }

  // --------------------------------------------------------------- resumo
  get resumo(): { total: number; vencidos: number; pendentes: number; entregues: number } {
    const ev = this.eventosFiltrados;
    return {
      total: ev.length,
      vencidos: ev.filter(e => this.tom(e) === 'danger').length,
      pendentes: ev.filter(e => this.tom(e) === 'warning').length,
      entregues: ev.filter(e => this.tom(e) === 'success').length
    };
  }

  // --------------------------------------------------------------- exibição
  tom(ev: EventoCalendarioDTO): Tom {
    if (ev.tipo === 'DEC') {
      // prazo do DEC: passado ou urgência alta/crítica = perigo; demais = atenção
      if (ev.data < this.hojeIso || ev.categoria === 'CRITICA' || ev.categoria === 'ALTA') return 'danger';
      return 'warning';
    }
    const s = (ev.status ?? '').toUpperCase();
    if (s === 'ENTREGUE') return 'success';
    if (s === 'VENCIDO' || s === 'VENCIDA') return 'danger';
    if (s === 'ARQUIVADO') return 'neutral';
    if (s === 'PENDENTE') return ev.data < this.hojeIso ? 'danger' : 'warning';
    return 'info';
  }

  statusTexto(ev: EventoCalendarioDTO): string {
    if (ev.tipo === 'DEC') return ev.status === 'PRAZO_RESPOSTA' ? 'Prazo de resposta' : 'Ciência tácita';
    const fem = ev.tipo === 'OBRIGACAO';
    switch (this.tom(ev)) {
      case 'success': return 'Entregue';
      case 'danger': return fem ? 'Vencida' : 'Vencido';
      case 'neutral': return 'Arquivado';
      case 'warning': return 'Pendente';
      default: return ev.status ?? 'Evento';
    }
  }

  categoriaTexto(ev: EventoCalendarioDTO): string {
    if (!ev.categoria) return '';
    if (ev.tipo === 'DEC') return 'Urgência ' + (UrgenciaDecLabel[ev.categoria] ?? ev.categoria).toLowerCase();
    return CategoriaFiscalLabel[ev.categoria as CategoriaFiscal] ?? ev.categoria;
  }

  linkEvento(ev: EventoCalendarioDTO): { link: string[]; params: Record<string, number> } {
    if (ev.tipo === 'DEC') return { link: ['/dec'], params: this.idEmpresa ? { empresa: this.idEmpresa } : {} };
    return ev.tipo === 'ARQUIVO'
      ? { link: ['/arquivos'], params: { id: ev.idReferencia } }
      : { link: ['/obrigacoes-pendentes'], params: this.idEmpresa ? { empresa: this.idEmpresa } : {} };
  }

  diaAriaLabel(cel: DiaCelula): string {
    const d = cel.data!.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return cel.eventos.length ? `${d}, ${cel.eventos.length} evento(s)` : d;
  }

  // ---------------------------------------------------------------- teclado
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const alvo = e.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo?.tagName) || alvo?.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal-backdrop')) return;
    if (e.key === 'PageUp') { e.preventDefault(); this.navegar(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); this.navegar(1); }
    else if (e.key.toLowerCase() === 't') { this.hojeBtn(); }
  }
}
