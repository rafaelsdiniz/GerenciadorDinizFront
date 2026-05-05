import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ObrigacaoRecorrenteService } from '../../services/obrigacao-recorrente.service';
import { EmpresaService } from '../../services/empresa.service';
import { ObrigacaoRecorrenteResponseDTO } from '../../models/obrigacao-recorrente-response.dto';
import { ObrigacaoRecorrenteRequestDTO } from '../../models/obrigacao-recorrente-request.dto';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { Periodicidade, PeriodicidadeLabel } from '../../models/enums/periodicidade.enum';
import { TipoArquivo } from '../../models/enums/tipo-arquivo.enum';

@Component({
  selector: 'app-obrigacao-recorrente-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h1 class="page-titulo">Obrigações Recorrentes</h1>
          <span class="page-subtitulo">{{ obrigacoes.length }} obrigação(ões) cadastrada(s)</span>
        </div>
        <button class="btn-novo" (click)="abrirNova()">+ Nova obrigação</button>
      </div>

      @if (carregando) {
        <div class="estado-vazio"><span class="spinner"></span></div>
      } @else if (obrigacoes.length === 0) {
        <div class="estado-vazio"><p>Nenhuma obrigação cadastrada.</p></div>
      } @else {
        <div class="tabela-wrapper">
          <table class="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Empresa</th>
                <th>Periodicidade</th>
                <th>Dia venc.</th>
                <th>Tipo esperado</th>
                <th>Ativo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of obrigacoes; track o.id) {
                <tr>
                  <td>
                    <strong>{{ o.nome }}</strong>
                    @if (o.descricao) { <div class="td-desc">{{ o.descricao }}</div> }
                  </td>
                  <td>{{ getNomeEmpresa(o.idEmpresa) }}</td>
                  <td>{{ periodLabel[o.periodicidade] }}</td>
                  <td>{{ o.diaVencimento }}</td>
                  <td>{{ o.tipoArquivoEsperado || '—' }}</td>
                  <td>
                    <span class="badge" [class.b-on]="o.ativo" [class.b-off]="!o.ativo">
                      {{ o.ativo ? 'Ativo' : 'Inativo' }}
                    </span>
                  </td>
                  <td class="td-acoes">
                    <button class="btn-edit" (click)="editar(o)">Editar</button>
                    <button class="btn-del" (click)="deletar(o)">Excluir</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (formAberto) {
        <div class="overlay" (click)="fecharForm()"></div>
        <div class="painel-form">
          <h3>{{ editando ? 'Editar' : 'Nova' }} obrigação</h3>

          <div class="campo">
            <label>Empresa *</label>
            <select [(ngModel)]="form.idEmpresa">
              <option [ngValue]="0" disabled>Selecione...</option>
              @for (e of empresas; track e.id) {
                <option [ngValue]="e.id">{{ e.nomeFantasia }}</option>
              }
            </select>
          </div>

          <div class="campo">
            <label>Nome *</label>
            <input type="text" [(ngModel)]="form.nome" placeholder="Ex.: DAS — Simples Nacional" />
          </div>

          <div class="campo">
            <label>Descrição</label>
            <input type="text" [(ngModel)]="form.descricao" />
          </div>

          <div class="campo-row">
            <div class="campo">
              <label>Periodicidade *</label>
              <select [(ngModel)]="form.periodicidade">
                @for (p of periodicidades; track p) {
                  <option [ngValue]="p">{{ periodLabel[p] }}</option>
                }
              </select>
            </div>
            <div class="campo">
              <label>Dia de vencimento *</label>
              <input type="number" min="1" max="31" [(ngModel)]="form.diaVencimento" />
            </div>
          </div>

          <div class="campo">
            <label>Tipo de arquivo esperado</label>
            <select [(ngModel)]="form.tipoArquivoEsperado">
              <option [ngValue]="null">Nenhum</option>
              @for (t of tiposArquivo; track t) {
                <option [ngValue]="t">{{ t }}</option>
              }
            </select>
          </div>

          <div class="campo-check">
            <label><input type="checkbox" [(ngModel)]="form.ativo" /> Ativa</label>
          </div>

          @if (erro) { <p class="erro">{{ erro }}</p> }

          <div class="form-acoes">
            <button class="btn-cancelar" (click)="fecharForm()">Cancelar</button>
            <button class="btn-salvar" (click)="salvar()" [disabled]="salvando">
              {{ salvando ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 2rem; max-width: 1200px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; }
    .page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 1.5rem; }
    .page-titulo { font-size: 1.6rem; font-weight: 700; color: #0d1b4b; margin: 0; }
    .page-subtitulo { font-size: 0.82rem; color: #888; }
    .btn-novo { background: #0d1b4b; color: #fff; border: none; border-radius: 8px; padding: 0.65rem 1.2rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .btn-novo:hover { background: #162566; }
    .estado-vazio { padding: 3rem; text-align: center; color: #aaa; }
    .tabela-wrapper { background: #fff; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; }
    .tabela { width: 100%; border-collapse: collapse; }
    .tabela th { text-align: left; background: #f9fafe; padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #0d1b4b; text-transform: uppercase; letter-spacing: 0.04em; }
    .tabela td { padding: 0.8rem 1rem; font-size: 0.85rem; border-top: 1px solid #f0f0f0; }
    .td-desc { color: #888; font-size: 0.72rem; margin-top: 2px; }
    .td-acoes { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .btn-edit { background: #fff; border: 1.5px solid #e0e0e0; border-radius: 6px; padding: 0.4rem 0.8rem; font-size: 0.78rem; color: #0d1b4b; font-weight: 600; cursor: pointer; }
    .btn-edit:hover { border-color: #0d1b4b; }
    .btn-del { background: #fff; border: 1.5px solid #fdecea; border-radius: 6px; padding: 0.4rem 0.8rem; font-size: 0.78rem; color: #c62828; font-weight: 600; cursor: pointer; }
    .btn-del:hover { background: #fdecea; }
    .badge { padding: 0.2rem 0.65rem; border-radius: 12px; font-size: 0.72rem; font-weight: 700; }
    .b-on { background: #e8f5e9; color: #2e7d32; }
    .b-off { background: #eceff1; color: #455a64; }
    .overlay { position: fixed; inset: 0; background: rgba(13,27,75,0.4); z-index: 100; }
    .painel-form { position: fixed; top: 0; right: 0; height: 100vh; width: 480px; background: #fff; padding: 1.5rem; overflow-y: auto; z-index: 101; box-shadow: -4px 0 20px rgba(0,0,0,0.1); }
    .painel-form h3 { color: #0d1b4b; margin: 0 0 1rem; }
    .campo { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .campo label { font-size: 0.78rem; font-weight: 600; color: #555; }
    .campo input, .campo select { border: 1.5px solid #e0e0e0; border-radius: 8px; padding: 0.55rem 0.8rem; font-size: 0.85rem; outline: none; }
    .campo input:focus, .campo select:focus { border-color: #0d1b4b; }
    .campo-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .campo-check label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; cursor: pointer; }
    .erro { color: #c62828; font-size: 0.82rem; margin: 0.5rem 0; }
    .form-acoes { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem; }
    .btn-cancelar { background: #fff; border: 1.5px solid #e0e0e0; border-radius: 8px; padding: 0.55rem 1rem; font-size: 0.85rem; cursor: pointer; }
    .btn-salvar { background: #0d1b4b; color: #fff; border: none; border-radius: 8px; padding: 0.55rem 1.2rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .spinner { width: 28px; height: 28px; border: 3px solid #eee; border-top-color: #0d1b4b; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ObrigacaoRecorrenteListComponent implements OnInit {
  obrigacoes: ObrigacaoRecorrenteResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  carregando = false;

  formAberto = false;
  editando: ObrigacaoRecorrenteResponseDTO | null = null;
  form: ObrigacaoRecorrenteRequestDTO = this.formVazio();
  erro = '';
  salvando = false;

  periodicidades = Object.values(Periodicidade);
  periodLabel = PeriodicidadeLabel;
  tiposArquivo = Object.values(TipoArquivo);

  constructor(
    private service: ObrigacaoRecorrenteService,
    private empresaService: EmpresaService
  ) {}

  ngOnInit(): void {
    this.empresaService.listar().subscribe({ next: (d) => this.empresas = d });
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.service.listar().subscribe({
      next: (d) => { this.obrigacoes = d; this.carregando = false; },
      error: () => { this.carregando = false; }
    });
  }

  getNomeEmpresa(id: number): string {
    return this.empresas.find(e => e.id === id)?.nomeFantasia ?? '—';
  }

  formVazio(): ObrigacaoRecorrenteRequestDTO {
    return { idEmpresa: 0, nome: '', descricao: '', periodicidade: Periodicidade.MENSAL, diaVencimento: 10, tipoArquivoEsperado: null, ativo: true };
  }

  abrirNova(): void {
    this.editando = null;
    this.form = this.formVazio();
    this.erro = '';
    this.formAberto = true;
  }

  editar(o: ObrigacaoRecorrenteResponseDTO): void {
    this.editando = o;
    this.form = {
      idEmpresa: o.idEmpresa, nome: o.nome, descricao: o.descricao,
      periodicidade: o.periodicidade, diaVencimento: o.diaVencimento,
      tipoArquivoEsperado: o.tipoArquivoEsperado, ativo: o.ativo
    };
    this.erro = '';
    this.formAberto = true;
  }

  fecharForm(): void {
    this.formAberto = false;
    this.editando = null;
  }

  salvar(): void {
    if (!this.form.idEmpresa || !this.form.nome) { this.erro = 'Empresa e nome são obrigatórios.'; return; }
    if (!this.form.diaVencimento || this.form.diaVencimento < 1 || this.form.diaVencimento > 31) {
      this.erro = 'Dia de vencimento entre 1 e 31.'; return;
    }
    this.salvando = true;
    const obs = this.editando
      ? this.service.atualizar(this.editando.id, this.form)
      : this.service.salvar(this.form);
    obs.subscribe({
      next: () => { this.salvando = false; this.fecharForm(); this.carregar(); },
      error: (err) => { this.salvando = false; this.erro = err?.error?.mensagem ?? 'Erro ao salvar.'; }
    });
  }

  deletar(o: ObrigacaoRecorrenteResponseDTO): void {
    if (!confirm(`Excluir a obrigação "${o.nome}"?`)) return;
    this.service.deletar(o.id).subscribe({ next: () => this.carregar() });
  }
}
