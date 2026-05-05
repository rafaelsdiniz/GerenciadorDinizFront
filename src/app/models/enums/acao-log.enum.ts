export enum AcaoLog {
  UPLOAD = 'UPLOAD',
  DOWNLOAD = 'DOWNLOAD',
  VISUALIZAR = 'VISUALIZAR',
  ATUALIZAR_STATUS = 'ATUALIZAR_STATUS',
  ATUALIZAR_VENCIMENTO = 'ATUALIZAR_VENCIMENTO',
  EXCLUIR = 'EXCLUIR',
  EXCLUIR_PERMANENTE = 'EXCLUIR_PERMANENTE',
  RESTAURAR = 'RESTAURAR',
  LOGIN = 'LOGIN'
}

export const AcaoLogLabel: Record<AcaoLog, string> = {
  [AcaoLog.UPLOAD]: 'Upload',
  [AcaoLog.DOWNLOAD]: 'Download',
  [AcaoLog.VISUALIZAR]: 'Visualizar',
  [AcaoLog.ATUALIZAR_STATUS]: 'Atualizar Status',
  [AcaoLog.ATUALIZAR_VENCIMENTO]: 'Atualizar Vencimento',
  [AcaoLog.EXCLUIR]: 'Excluir',
  [AcaoLog.EXCLUIR_PERMANENTE]: 'Excluir Permanente',
  [AcaoLog.RESTAURAR]: 'Restaurar',
  [AcaoLog.LOGIN]: 'Login'
};
