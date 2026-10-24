export type CapturedResponse = {
  method: string;
  url: string;
  status: number;
  body: string;
};

export type ProbeOutput = {
  /** Status HTTP del documento principal; null si ni siquiera cargó. */
  mainStatus: number | null;
  html: string;
  /** Visibilidad del modal "sin especialidades" medida en el navegador (el nodo queda en el DOM al cerrarse). */
  modalVisible: boolean;
  responses: CapturedResponse[];
  failure?: { step: string; message: string };
};

export type Status =
  | { kind: 'NO_SLOTS' }
  | { kind: 'AVAILABLE'; detail?: string }
  | { kind: 'BLOCKED'; reason: string }
  | { kind: 'ERROR'; step: string; message: string };
