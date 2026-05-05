import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ObrigacaoPendenteService } from '../../services/obrigacao-pendente.service';
import { EmpresaService } from '../../services/empresa.service';
import { AuthService } from '../../services/auth.service';
import { ObrigacaoPendenteResponseDTO } from '../../models/obrigacao-pendente-response.dto';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { StatusObrigacao, StatusObrigacaoLabel } from '../../models/enums/status-obrigacao.enum';

@Component({
  selector: 'app-obrigacao-pendente-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h1 class="page-titulo">Obrigações Pendentes</h1>
          <span class="page-subtitulo">{{ filtradas.length }} pendência(s)</span>
        </div>
        @if (isAdmin) {
          <button class="btn-gerar" (click)="gerar()" [disabled]="gerando">
            {{ gerando ? 'Gerando...' : '+ Gerar pendentes' }}
          </button>
        }
      </div>

      <div class="filtros">
        <select [(ngModel)]="idEmpresaFiltro" (change)="filtrar()">
          <option [ngValue]="null">Todas as empresas</option>
          @for (e of empresas; track e.id) {
            <option [ngValue]="e.id">{{ e.nomeFantasia }}</option>
          }
        </select>
        <select [(ngModel)]="statusFiltro" (change)="filtrar()">
          <option [ngValue]="''">Todos os status</option>
          @for (s of statusList; track s) {
            <option [ngValue]="s">{{ statusLabel[s] }}</option>
          }
        </select>
      </div>

      @if (carregando) {
        <div class="estado-vazio"><span class="spinner"></span></div>
      } @else if (filtradas.length === 0) {
        <div class="estado-vazio"><p>Nenhuma pendência.</p></div>
      } @else {
        <div class="tabela-wrapper">
          <table class="tabela">
            <thead>
              <tr>
                <th>Obrigação</th>
                <th>Empresa</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Entrega</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of filtradas; track p.id) {
                <tr>
                  <td><strong>{{ p.nomeObrigacao || '—' }}</strong></td>
                  <td>{{ getNomeEmpresa(p.idEmpresa) }}</td>
                  <td>
                    @if (idEditandoVencimento === p.id) {
                      <input
                        type="date"
                        [(ngModel)]="novaDataVencimento"
                        class="input-data"
                      />
                      <button class="btn-mini btn-confirma" (click)="salvarVencimento(p)">✓</button>
                      <button class="btn-mini" (click)="cancelarEdicao()">✕</button>
                    } @else {
                      {{ p.dataVencimento }}
                      @if (p.diasParaVencer != null) {
                        <small class="dias">
                          @if (p.diasParaVencer < 0) { (vencida há {{ -p.diasParaVencer }}d) }
                          @else if (p.diasParaVencer === 0) { (hoje) }
                          @else { (em {{ p.diasParaVencer }}d) }
                        </small>
                      }
                    }
                  </td>
                  <td>
                    <span class="badge" [class.b-pend]="p.status === 'PENDENTE'" [class.b-entr]="p.status === 'ENTREGUE'" [class.b-venc]="p.status === 'VENCIDA'">
                      {{ statusLabel[p.status] }}
                    </span>
                  </td>
                  <td>{{ p.dataEntrega || '—' }}</td>
                  <td class="td-acoes">
                    @if (p.status !== 'ENTREGUE') {
                      <button class="btn-acao btn-entregar" (click)="marcarEntregue(p)" [disabled]="p.id === idAcaoCarregando">
                        Marcar entregue
                      </button>
                      @if (idEditandoVencimento !== p.id) {
                        <button class="btn-acao btn-prorrogar" (click)="editarVencimento(p)">
                          Prorrogar
                        </button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (toastVisivel) { <div class="toast">{{ toastMensagem }}</div> }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 2rem; max-width: 1200px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; }
    .page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 1.5rem; }
    .page-titulo { font-size: 1.6rem; font-weight: 700; color: #0d1b4b; margin: 0; }
    .page-subtitulo { font-size: 0.82rem; color: #888; }
    .btn-gerar { background: #b8952a; color: #fff; border: none; border-radius: 8px; padding: 0.65rem 1.2rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .btn-gerar:hover { background: #8a6e1e; }
    .filtros { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .filtros select { border: 1.5px solid #e0e0e0; border-radius: 8px; padding: 0.5rem 0.8rem; font-size: 0.82rem; outline: none; }
    .estado-vazio { padding: 3rem; text-align: center; color: #aaa; }
    .tabela-wrapper { background: #fff; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; }
    .tabela { width: 100%; border-collapse: collapse; }
    .tabela th { text-align: left; background: #f9fafe; padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #0d1b4b; text-transform: uppercase; letter-spacing: 0.04em; }
    .tabela td { padding: 0.8rem 1rem; font-size: 0.85rem; border-top: 1px solid #f0f0f0; }
    .dias { color: #888; font-size: 0.72rem; margin-left: 4px; }
    .badge { padding: 0.2rem 0.65rem; border-radius: 12px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .b-pend { background: #fff8e1; color: #b8952a; }
    .b-entr { background: #e8f5e9; color: #2e7d32; }
    .b-venc { background: #fdecea; color: #c62828; }
    .td-acoes { display: flex; gap: 0.4rem; justify-content: flex-end; }
    .btn-acao { background: #fff; border: 1.5px solid #e0e0e0; border-radius: 6px; padding: 0.35rem 0.7rem; font-size: 0.75rem; font-weight: 600; cursor: pointer; color: #0d1b4b; }
    .btn-acao:hover { border-color: #0d1b4b; }
    .btn-acao:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-entregar { color: #2e7d32; border-color: #c8e6c9; }
    .btn-entregar:hover { border-color: #2e7d32; background: #e8f5e9; }
    .btn-prorrogar { color: #b8952a; border-color: #ffe0b2; }
    .btn-prorrogar:hover { border-color: #b8952a; background: #fff8e1; }
    .input-data { border: 1.5px solid #0d1b4b; border-radius: 6px; padding: 0.3rem 0.5rem; font-size: 0.78rem; }
    .btn-mini { border: 1.5px solid #e0e0e0; background: #fff; border-radius: 6px; padding: 0.3rem 0.5rem; font-size: 0.75rem; cursor: pointer; margin-left: 4px; }
    .btn-mini:hover { border-color: #0d1b4b; }
    .btn-confirma { color: #2e7d32; border-color: #c8e6c9; }
    .spinner { width: 28px; height: 28px; border: 3px solid #eee; border-top-color: #0d1b4b; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #0d1b4b; color: #fff; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.85rem; }
  `]
})
export class ObrigacaoPendenteListComponent implements OnInit {
  pendentes: ObrigacaoPendenteResponseDTO[] = [];
  filtradas: ObrigacaoPendenteResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  carregando = false;
  isAdmin = false;
  gerando = false;

  idEmpresaFiltro: number | null = null;
  statusFiltro: StatusObrigacao | '' = '';

  statusList = Object.values(StatusObrigacao);
  statusLabel = StatusObrigacaoLabel;

  toastVisivel = false;
  toastMensagem = '';

  idEditandoVencimento: number | null = null;
  novaDataVencimento = '';
  idAcaoCarregando: number | null = null;

  constructor(
    private service: ObrigacaoPendenteService,
    private empresaService: EmpresaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.empresaService.listar().subscribe({ next: (d) => this.empresas = d });
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.service.listar().subscribe({
      next: (d) => { this.pendentes = d; this.filtrar(); this.carregando = false; },
      error: () => { this.carregando = false; }
    });
  }

  filtrar(): void {
    let r = this.pendentes;
    if (this.idEmpresaFiltro) r = r.filter(p => p.idEmpresa === this.idEmpresaFiltro);
    if (this.statusFiltro) r = r.filter(p => p.status === this.statusFiltro);
    this.filtradas = r;
  }

  getNomeEmpresa(id: number): string {
    return this.empresas.find(e => e.id === id)?.nomeFantasia ?? '—';
  }

  gerar(): void {
    this.gerando = true;
    this.service.gerarPendentes().subscribe({
      next: (r) => {
        this.gerando = false;
        this.mostrarToast(`${r.criadas} pendência(s) gerada(s).`);
        this.carregar();
      },
      error: () => { this.gerando = false; }
    });
  }

  mostrarToast(msg: string): void {
    this.toastMensagem = msg;
    this.toastVisivel = true;
    setTimeout(() => this.toastVisivel = false, 3000);
  }

  marcarEntregue(p: ObrigacaoPendenteResponseDTO): void {
    if (!confirm(`Marcar "${p.nomeObrigacao}" como entregue?`)) return;
    this.idAcaoCarregando = p.id;
    this.service.marcarEntregue(p.id).subscribe({
      next: () => {
        this.idAcaoCarregando = null;
        this.mostrarToast('Marcada como entregue.');
        this.carregar();
      },
      error: () => {
        this.idAcaoCarregando = null;
        this.mostrarToast('Erro ao marcar entrega.');
      }
    });
  }

  editarVencimento(p: ObrigacaoPendenteResponseDTO): void {
    this.idEditandoVencimento = p.id;
    this.novaDataVencimento = p.dataVencimento || '';
  }

  cancelarEdicao(): void {
    this.idEditandoVencimento = null;
    this.novaDataVencimento = '';
  }

  salvarVencimento(p: ObrigacaoPendenteResponseDTO): void {
    if (!this.novaDataVencimento) {
      this.mostrarToast('Informe uma data.');
      return;
    }
    this.service.atualizarVencimento(p.id, this.novaDataVencimento).subscribe({
      next: () => {
        this.cancelarEdicao();
        this.mostrarToast('Vencimento atualizado.');
        this.carregar();
      },
      error: () => this.mostrarToast('Erro ao atualizar vencimento.')
    });
  }
}
