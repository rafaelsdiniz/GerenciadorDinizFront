import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarioService } from '../../services/calendario.service';
import { EmpresaService } from '../../services/empresa.service';
import { AuthService } from '../../services/auth.service';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { EventoCalendarioDTO } from '../../models/evento-calendario.dto';

interface DiaCelula {
  data: Date | null;
  iso: string;
  diaMes: number;
  hoje: boolean;
  doMes: boolean;
  eventos: EventoCalendarioDTO[];
}

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h1 class="page-titulo">Calendário Fiscal</h1>
          <span class="page-subtitulo">Vencimentos e obrigações do mês</span>
        </div>
        <div class="ctrl-mes">
          <button class="btn-nav" (click)="navegar(-1)">‹</button>
          <span class="rotulo-mes">{{ rotuloMes() }}</span>
          <button class="btn-nav" (click)="navegar(1)">›</button>
          <button class="btn-hoje" (click)="hojeBtn()">Hoje</button>
        </div>
      </div>

      <div class="filtro-empresa">
        <label>Empresa:</label>
        <select [(ngModel)]="idEmpresa" (change)="carregar()">
          @for (e of empresas; track e.id) {
            <option [ngValue]="e.id">{{ e.nomeFantasia }}</option>
          }
        </select>
      </div>

      <div class="cal-grid">
        <div class="cal-cabecalho">
          @for (d of diasSemana; track d) { <span>{{ d }}</span> }
        </div>
        <div class="cal-celulas">
          @for (cel of celulas; track cel.iso) {
            <div class="cel" [class.cel-fora]="!cel.doMes" [class.cel-hoje]="cel.hoje" (click)="abrirDia(cel)">
              <span class="cel-num">{{ cel.diaMes }}</span>
              @if (cel.eventos.length > 0) {
                <div class="cel-eventos">
                  @for (ev of cel.eventos.slice(0, 3); track ev.idReferencia + ev.tipo) {
                    <span class="ev-tag" [class.ev-arquivo]="ev.tipo === 'ARQUIVO'" [class.ev-obrig]="ev.tipo === 'OBRIGACAO'">
                      {{ ev.titulo }}
                    </span>
                  }
                  @if (cel.eventos.length > 3) {
                    <span class="ev-mais">+{{ cel.eventos.length - 3 }}</span>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>

      @if (diaAberto) {
        <div class="overlay" (click)="diaAberto = null"></div>
        <div class="modal-dia">
          <h3>Eventos de {{ diaAberto.iso }}</h3>
          @if (diaAberto.eventos.length === 0) {
            <p class="vazio">Nenhum evento.</p>
          } @else {
            @for (ev of diaAberto.eventos; track ev.idReferencia + ev.tipo) {
              <div class="ev-card">
                <span class="ev-tipo" [class.ev-arquivo]="ev.tipo === 'ARQUIVO'" [class.ev-obrig]="ev.tipo === 'OBRIGACAO'">
                  {{ ev.tipo === 'ARQUIVO' ? 'Arquivo' : 'Obrigação' }}
                </span>
                <strong>{{ ev.titulo }}</strong>
                @if (ev.descricao) { <p>{{ ev.descricao }}</p> }
                @if (ev.status) { <small>Status: {{ ev.status }}</small> }
              </div>
            }
          }
          <div class="modal-acoes">
            <button class="btn-fechar-modal" (click)="diaAberto = null">Fechar</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 2rem; max-width: 1200px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
    .page-titulo { font-size: 1.6rem; font-weight: 700; color: #0d1b4b; margin: 0; }
    .page-subtitulo { font-size: 0.82rem; color: #888; }
    .ctrl-mes { display: flex; align-items: center; gap: 0.5rem; }
    .btn-nav { width: 32px; height: 32px; background: #fff; border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: 1.2rem; cursor: pointer; color: #0d1b4b; font-weight: 700; }
    .btn-nav:hover { border-color: #0d1b4b; }
    .rotulo-mes { font-size: 0.95rem; font-weight: 700; color: #0d1b4b; min-width: 160px; text-align: center; text-transform: capitalize; }
    .btn-hoje { background: #0d1b4b; color: #fff; border: none; border-radius: 8px; padding: 0.5rem 0.9rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .filtro-empresa { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; font-size: 0.82rem; color: #555; }
    .filtro-empresa select { border: 1.5px solid #e0e0e0; border-radius: 8px; padding: 0.45rem 0.8rem; font-size: 0.82rem; outline: none; }
    .cal-grid { background: #fff; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; }
    .cal-cabecalho { display: grid; grid-template-columns: repeat(7, 1fr); background: #f9fafe; border-bottom: 1px solid #f0f0f0; }
    .cal-cabecalho span { padding: 0.6rem; text-align: center; font-size: 0.72rem; font-weight: 700; color: #0d1b4b; text-transform: uppercase; letter-spacing: 0.04em; }
    .cal-celulas { display: grid; grid-template-columns: repeat(7, 1fr); }
    .cel { min-height: 110px; border-right: 1px solid #f0f0f0; border-bottom: 1px solid #f0f0f0; padding: 0.4rem; cursor: pointer; transition: background 0.15s; display: flex; flex-direction: column; gap: 0.25rem; }
    .cel:hover { background: #fafbff; }
    .cel-fora { background: #fafafa; color: #ccc; }
    .cel-hoje { background: #fff8e1; }
    .cel-num { font-size: 0.78rem; font-weight: 700; color: #555; }
    .cel-fora .cel-num { color: #ccc; }
    .cel-hoje .cel-num { color: #b8952a; }
    .cel-eventos { display: flex; flex-direction: column; gap: 2px; }
    .ev-tag { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .ev-arquivo { background: #e8eaf6; color: #283593; }
    .ev-obrig { background: #fff8e1; color: #b8952a; }
    .ev-mais { font-size: 0.65rem; color: #888; padding-left: 4px; }
    .overlay { position: fixed; inset: 0; background: rgba(13,27,75,0.4); z-index: 100; }
    .modal-dia { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); background: #fff; border-radius: 12px; padding: 1.5rem; width: 480px; max-width: 90vw; max-height: 80vh; overflow-y: auto; z-index: 101; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
    .modal-dia h3 { color: #0d1b4b; margin: 0 0 1rem; }
    .ev-card { padding: 0.75rem; border: 1px solid #f0f0f0; border-radius: 8px; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .ev-card strong { color: #222; }
    .ev-card p { margin: 0; font-size: 0.82rem; color: #666; }
    .ev-card small { color: #888; font-size: 0.72rem; }
    .ev-tipo { font-size: 0.65rem; padding: 2px 8px; border-radius: 12px; font-weight: 700; text-transform: uppercase; width: fit-content; letter-spacing: 0.04em; }
    .vazio { color: #aaa; text-align: center; padding: 1rem; }
    .modal-acoes { display: flex; justify-content: flex-end; margin-top: 1rem; }
    .btn-fechar-modal { background: #0d1b4b; color: #fff; border: none; border-radius: 8px; padding: 0.55rem 1.2rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
  `]
})
export class CalendarioComponent implements OnInit {
  diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  empresas: EmpresaResponseDTO[] = [];
  idEmpresa: number | null = null;

  ano = new Date().getFullYear();
  mes = new Date().getMonth() + 1;
  hoje = new Date();
  hojeIso = this.toIso(this.hoje);

  eventos: EventoCalendarioDTO[] = [];
  celulas: DiaCelula[] = [];
  diaAberto: DiaCelula | null = null;

  constructor(
    private calendarioService: CalendarioService,
    private empresaService: EmpresaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.empresaService.listar().subscribe({
      next: (data) => {
        this.empresas = data;
        this.idEmpresa = this.authService.getEmpresaId() ?? data[0]?.id ?? null;
        this.carregar();
      }
    });
  }

  rotuloMes(): string {
    const d = new Date(this.ano, this.mes - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  navegar(delta: number): void {
    let m = this.mes + delta;
    let a = this.ano;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    this.mes = m; this.ano = a;
    this.carregar();
  }

  hojeBtn(): void {
    const h = new Date();
    this.ano = h.getFullYear();
    this.mes = h.getMonth() + 1;
    this.carregar();
  }

  carregar(): void {
    if (this.idEmpresa == null) return;
    this.calendarioService.porMes(this.idEmpresa, this.ano, this.mes).subscribe({
      next: (data) => { this.eventos = data; this.montarCelulas(); }
    });
  }

  private montarCelulas(): void {
    const inicio = new Date(this.ano, this.mes - 1, 1);
    const fim = new Date(this.ano, this.mes, 0);
    const offset = inicio.getDay();
    const totalDias = fim.getDate();

    const cels: DiaCelula[] = [];
    const eventosPorIso: Record<string, EventoCalendarioDTO[]> = {};
    for (const e of this.eventos) {
      (eventosPorIso[e.data] ??= []).push(e);
    }

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
      eventos: eventosPorIso[iso] ?? []
    };
  }

  private toIso(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }

  abrirDia(cel: DiaCelula): void {
    this.diaAberto = cel;
  }
}
