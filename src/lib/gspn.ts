/**
 * Regras da Base GSPN — as MESMAS usadas no teste de acerto (backtest).
 * Tradutor de peças reaproveitado do Samsung Contigo (lib/classificacao.js).
 */

/** Sem acento, minúsculo, só letras/números separados por 1 espaço. */
export function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Texto usado na busca: normalizado e SEM espaços ("BARULHOCESTO", "ÁGUARRR" continuam achando "barulho"/"agua"). */
export function textoBusca(texto: unknown): string {
  return normalizar(texto).replace(/ /g, "");
}

/** Agrupa variações de cor/região do mesmo aparelho. Ex: UN50CU7700GXZD -> UN50CU7700, SM-A155MZKDZTO -> SM-A155 */
export function familiaModelo(modelo: unknown): string {
  let m = String(modelo ?? "").toUpperCase().trim();
  if (!m || m.startsWith("UNKNOWN")) return "";
  const cel = m.match(/^(SM-[A-Z]\d{3})/);
  if (cel) return cel[1];
  m = m.split("/")[0];
  if (m.startsWith("NP") && m.includes("-")) return m.split("-")[0];
  return m.slice(0, 10);
}

export type SiglaCategoria = "DTV" | "HHP" | "WSM" | "REF" | "ACN" | "NPC" | "CKT" | "MON" | "OUT";

export const CATEGORIAS: { sigla: SiglaCategoria; nome: string }[] = [
  { sigla: "DTV", nome: "Televisores" },
  { sigla: "HHP", nome: "Celulares" },
  { sigla: "WSM", nome: "Lava e Seca" },
  { sigla: "REF", nome: "Refrigeradores" },
  { sigla: "ACN", nome: "Ar Condicionado" },
  { sigla: "NPC", nome: "Notebooks" },
  { sigla: "MON", nome: "Monitores" },
  { sigla: "CKT", nome: "Cooktop" },
  { sigla: "OUT", nome: "Outros" },
];

/** Coluna BH (Service Product Description) -> sigla. */
export function categoriaSigla(bh: unknown): SiglaCategoria {
  const d = String(bh ?? "").toUpperCase();
  if (d.includes("MONITOR")) return "MON";
  if (d.includes("TV") || d.includes("DISPLAY") || d.includes("LFD")) return "DTV";
  if (d.startsWith("HHP")) return "HHP";
  if (d.includes("WASHING") || d.includes("DRYER")) return "WSM";
  if (d.includes("REFRIGERATOR") || d.includes("WINE")) return "REF";
  if (d.includes("AIR CONDITIONER") || d.startsWith("SAC") || d.startsWith("RAM")) return "ACN";
  if (d.includes("NOTE PC") || d.includes("NOTEBOOK")) return "NPC";
  if (d.includes("COOKTOP")) return "CKT";
  return "OUT";
}

const REGRAS_PECA: [string, string][] = [
  ["\\bPCB\\s*MAIN\\b|\\bPBA\\s*MAIN\\b|MAIN\\s*BOARD", "Placa Principal"],
  ["\\bPCB\\s*INVERTER\\b|\\bINVERTER\\s*PCB\\b", "Placa Inversora"],
  ["\\bPCB\\s*POWER\\b|\\bPOWER\\s*BOARD\\b|\\bSMPS\\b", "Placa de Fonte (Power)"],
  ["\\bVSS[- ]?PD\\s*BOARD\\b|\\bPD\\s*BOARD\\b", "Placa VSS/PD (Fonte)"],
  ["\\bOPEN\\s*CELL\\b", "Painel de Tela (Open Cell)"],
  ["\\bLED\\s*BAR\\b", "Barra de LED"],
  ["\\bT-?CON\\b|\\bTCON\\b", "Placa T-Con"],
  ["\\bPCB\\b|\\bPBA\\b", "Placa Eletrônica"],
  ["\\bBATT(ERY)?\\b", "Bateria"],
  ["\\bTAPE\\b", "Fita Adesiva"],
  ["\\bDAMPER\\b", "Amortecedor"],
  ["\\bMOTOR\\b", "Motor"],
  ["\\bCOMP(RESSOR)?\\b", "Compressor"],
  ["\\bPUMP\\b", "Bomba"],
  ["\\bVALVE\\b", "Válvula"],
  ["\\bSENSOR\\b", "Sensor"],
  ["\\bHINGE\\b", "Dobradiça"],
  ["\\bDOOR\\b", "Porta"],
  ["\\bCOVER\\b", "Tampa"],
  ["\\bBRACKET\\b", "Suporte"],
  ["\\bHOSE\\b", "Mangueira"],
  ["\\bDUCT\\b", "Duto"],
  ["\\bFILTER\\b", "Filtro"],
  ["\\bSWITCH\\b", "Interruptor/Chave"],
  ["\\bHARNESS\\b", "Chicote Elétrico"],
  ["\\bCABLE\\b", "Cabo"],
  ["\\bWIRE\\b", "Fio/Cabo"],
  ["\\bSPEAKER\\b", "Alto-falante"],
  ["\\bREMOCON\\b|\\bREMOTE\\b", "Controle Remoto"],
  ["\\bANTENNA\\b", "Antena"],
  ["\\bDISPLAY\\b|\\bLCD\\b|\\bOLED\\b|\\bSCREEN\\b", "Tela/Display"],
  ["\\bCHASSIS\\b", "Chassi"],
  ["\\bSPRING\\b", "Mola"],
  ["\\bGASKET\\b|\\bEPDM\\b", "Vedação/Borracha"],
  ["\\bDIAPHRAGM\\b", "Diafragma"],
  ["\\bEVAP(ORATOR)?\\b", "Evaporador"],
  ["\\bCONDENSER\\b", "Condensador"],
  ["\\bFAN\\b", "Ventilador"],
  ["\\bDRUM\\b", "Tambor"],
  ["\\bICE\\s*MAKER\\b|\\bICEMAKER\\b", "Fabricador de Gelo"],
  ["\\bKNOB\\b", "Botão/Manípulo"],
  ["\\bHANDLE\\b", "Puxador"],
  ["\\bPANEL\\b", "Painel"],
  ["\\bSCREW\\b", "Parafuso"],
  ["\\bGLASS\\b", "Vidro"],
  ["\\bLABEL\\b|\\bSTICKER\\b", "Etiqueta/Adesivo"],
  ["\\bTRANSFORMER\\b", "Transformador"],
  ["\\bCAPACITOR\\b", "Capacitor"],
  ["\\bEEPROM\\b", "Memória EEPROM"],
  ["\\bWLAN\\b|\\bNETWORK\\b|\\bWI-?FI\\b", "Módulo Wi-Fi/Rede"],
  ["\\bTUB\\b", "Tanque/Cesto"],
  ["\\bBASKET\\b", "Cesto"],
  ["\\bSHELF\\b", "Prateleira"],
  ["\\bDRAWER\\b", "Gaveta"],
  ["\\bTRAY\\b", "Bandeja"],
  ["\\bNOZZLE\\b", "Bico/Nozzle"],
  ["\\bTUBE\\b|\\bPIPE\\b", "Tubo"],
  ["\\bHEATER\\b", "Resistência/Aquecedor"],
  ["\\bTHERMOSTAT\\b", "Termostato"],
  ["\\bRELAY\\b", "Relé"],
  ["\\bBUZZER\\b", "Buzzer"],
  ["\\bCAMERA\\b", "Câmera"],
  ["\\bMICROPHONE\\b|\\bMIC\\b", "Microfone"],
  ["\\bBOLT\\b|\\bNUT\\b|\\bWASHER\\b", "Parafuso/Porca/Arruela"],
  ["\\bFOOT\\b|\\bLEG\\b", "Pé/Base"],
  ["\\bWHEEL\\b|\\bCASTER\\b|\\bROLLER\\b", "Roda/Rolete"],
  ["\\bBELT\\b", "Correia"],
  ["\\bFILTER\\s*HOUSING\\b", "Carcaça de Filtro"],
  ["\\bHOUSING\\b", "Carcaça"],
  ["\\bFRAME\\b", "Estrutura/Moldura"],
  ["\\bSTAND\\b", "Base/Suporte de Mesa"],
  ["\\bREMOTE\\s*CONTROLLER\\b", "Controle Remoto"],
  ["\\bADAPTOR\\b|\\bADAPTER\\b", "Adaptador"],
  ["\\bCHARGER\\b", "Carregador"],
  ["\\bKIT\\b", "Kit de Peças"],
  ["\\bMODULE\\b", "Módulo"],
  ["\\bBOARD\\b", "Placa"],
  ["\\bLGP\\b", "Guia de Luz (LGP)"],
  ["\\bBEARING\\b", "Rolamento"],
  ["\\bSEAL\\s*OIL\\b|\\bOIL\\s*SEAL\\b", "Retentor de Óleo"],
  ["\\bTHERMISTOR\\b", "Termistor"],
  ["\\bPOWER\\s*CORD\\b", "Cabo de Força"],
  ["\\bSTATOR\\b", "Estator"],
  ["\\bROTOR\\b", "Rotor"],
  ["\\bFLANGE\\b|\\bSHAFT\\b", "Eixo/Flange"],
  ["\\bA S DRYER\\b", "Filtro Secador"],
  ["\\bA/S-?DRYER\\b|\\bDRYER\\b", "Componente de Secadora"],
  ["\\bEBL\\)?\\s*(BOE|SDC|SDP|HKC|AUO|CSOT|LGD|CHOT|INX|NVT)\\b|\\b(BOE|SDC|SDP|HKC|AUO|CSOT|LGD|CHOT|INX)\\b.*\\b(BASIC|SEDA|LCM|LCDLCM)\\b", "Painel de Tela (provável)"],
  ["^\\d{2,3}[A-Z]{1,3}\\d{3,4}", "Painel de Tela / Modelo (provável)"],
  ["^Y\\d{2}\\b.*\\b(SDC|SDP|HKC|AUO|CSOT|LGD|CHOT|INX|BOE|CEC)\\b", "Painel de Tela (provável)"],
  ["\\b(SDC|SDP|HKC|AUO|CSOT|LGD|CHOT|INX|BOE|CEC)\\b\\s*\\d{2}[A-Z]{1,3}\\d{3,4}", "Painel de Tela (provável)"],
  ["\\bVSS\\b", "Placa VSS (Fonte)"],
  ["\\bIC[- ]", "Circuito Integrado (CI)"],
  ["\\bPROTECTOR\\s*FILM\\b", "Película Protetora"],
  ["\\bCLIP\\b", "Clipe/Grampo"],
  ["\\bSMT\\s*OCTA\\b|\\bOCTA\\s*ASSY\\b", "Módulo de Tela (Celular)"],
  ["\\bSTYLUS\\s*PEN\\b", "Caneta S Pen"],
  ["\\bFFC\\b", "Cabo Flex (FFC)"],
  ["\\bTHERMO\\s*FUSE\\b", "Fusível Térmico"],
  ["\\bFUSE\\b", "Fusível"],
  ["\\bLEAD\\s*CONNECTOR\\b", "Cabo Condutor"],
  ["\\bCONNECTOR\\b", "Conector"],
  ["\\bWEIGHT\\s*BALANCER\\b", "Contrapeso"],
  ["\\bK\\s*D\\s*IR\\b|\\bIR\\s*FUNCTION\\b", "Sensor Infravermelho (IR)"],
  ["\\bFPCB\\b", "Placa Flexível (FPCB)"]
];

const REGRAS_COMPILADAS = REGRAS_PECA.map(([p, c]) => [new RegExp(p), c] as const);

/** Descrição técnica da peça -> nome amigável. Ex: "ASSY OPEN CELL;BOE,50Inch" -> "Painel de Tela (Open Cell)" */
export function tipoPeca(descricao: unknown): string {
  if (descricao === null || descricao === undefined || descricao === "") return "Outros / Não Classificado";
  const t = String(descricao).toUpperCase().replace(/[_\-/;,]/g, " ");
  for (const [r, c] of REGRAS_COMPILADAS) if (r.test(t)) return c;
  return "Outros / Não Classificado";
}

export type PecaOS = { c: string; d: string; t: string; q: number };
