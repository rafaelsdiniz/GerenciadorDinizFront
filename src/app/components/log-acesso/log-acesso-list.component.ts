import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogAcessoService } from '../../services/log-acesso.service';
import { LogAcessoResponseDTO } from '../../models/log-acesso-response.dto';
import { AcaoLog, AcaoLogLabel } from '../../models/enums/acao-log.enum';

@Component({
  selector: 'app-log-acesso-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h1 class="page-titulo">Logs de Acesso</h1>
          <span class="page-subtitulo">Auditoria de ações dos usuários</span>
        </div>
        <div class="ctrls">
          <select [(ngModel)]="acaoFiltro" (change)="aplicarFiltro()">
            <option [ngValue]="''">Todas as ações</option>
            @for (a of acoes; track a) { <option [ngValue]="a">{{ acaoLabel[a] }}</option> }
          </select>
          <select [(ngModel)]="limite" (change)="carregar()">
            <option [ngValue]="50">Últimos 50</option>
            <option [ngValue]="100">Últimos 100</option>
            <option [ngValue]="250">Últimos 250</option>
            <option [ngValue]="500">Últimos 500</option>
          </select>
        </div>
      </div>

      @if (carregando) {
        <div class="estado-vazio"><span class="spinner"></span></div>
      } @else if (filtrados.length === 0) {
        <div class="estado-vazio"><p>Nenhum log encontrado.</p></div>
      } @else {
        <div class="tabela-wrapper">
          <table class="tabela">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>ID</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              @for (log of filtrados; track log.id) {
                <tr>
                  <td>{{ log.dataCriacao | date:'dd/MM/yyyy HH:mm:ss' }}</td>
                  <td>{{ log.nomeUsuario || '—' }}</td>
                  <td><span class="badge" [class]="'a-' + log.acao.toLowerCase()">{{ acaoLabel[log.acao] }}</span></td>
                  <td>{{ log.entidade || '—' }}</td>
                  <td>{{ log.idEntidade || '—' }}</td>
                  <td class="td-detalhes">{{ log.detalhes || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 2rem; max-width: 1300px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; }
    .page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; }
    .page-titulo { font-size: 1.6rem; font-weight: 700; color: #0d1b4b; margin: 0; }
    .page-subtitulo { font-size: 0.82rem; color: #888; }
    .ctrls { display: flex; gap: 0.5rem; }
    .ctrls select { border: 1.5px solid #e0e0e0; border-radius: 8px; padding: 0.5rem 0.8rem; font-size: 0.82rem; outline: none; background: #fff; }
    .estado-vazio { padding: 3rem; text-align: center; color: #aaa; }
    .tabela-wrapper { background: #fff; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; }
    .tabela { width: 100%; border-collapse: collapse; }
    .tabela th { text-align: left; background: #f9fafe; padding: 0.7rem 0.9rem; font-size: 0.7rem; font-weight: 700; color: #0d1b4b; text-transform: uppercase; letter-spacing: 0.04em; }
    .tabela td { padding: 0.6rem 0.9rem; font-size: 0.78rem; border-top: 1px solid #f0f0f0; }
    .td-detalhes { color: #666; font-size: 0.75rem; max-width: 350px; }
    .badge { padding: 0.18rem 0.55rem; border-radius: 10px; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; background: #eceff1; color: #455a64; }
    .a-upload { background: #e8f5e9; color: #2e7d32; }
    .a-download { background: #e8eaf6; color: #283593; }
    .a-excluir, .a-excluir_permanente { background: #fdecea; color: #c62828; }
    .a-restaurar { background: #fff8e1; color: #b8952a; }
    .a-login { background: #e0f2f1; color: #00695c; }
    .a-atualizar_status, .a-atualizar_vencimento { background: #f3e5f5; color: #6a1b9a; }
    .spinner { width: 28px; height: 28px; border: 3px solid #eee; border-top-color: #0d1b4b; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class LogAcessoListComponent implements OnInit {
  logs: LogAcessoResponseDTO[] = [];
  filtrados: LogAcessoResponseDTO[] = [];
  carregando = false;
  limite = 100;
  acaoFiltro: AcaoLog | '' = '';

  acoes = Object.values(AcaoLog);
  acaoLabel = AcaoLogLabel;

  constructor(private service: LogAcessoService) {}

  ngOnInit(): void { this.carregar(); }

  carregar(): void {
    this.carregando = true;
    this.service.listarRecentes(this.limite).subscribe({
      next: (d) => { this.logs = d; this.aplicarFiltro(); this.carregando = false; },
      error: () => { this.carregando = false; }
    });
  }

  aplicarFiltro(): void {
    this.filtrados = this.acaoFiltro
      ? this.logs.filter(l => l.acao === this.acaoFiltro)
      : this.logs;
  }
}
