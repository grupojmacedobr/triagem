/**
 * Tradutor de peças Samsung (descrição do GSPN -> nome amigável em português).
 *
 * A descrição do GSPN vem assim:  "ASSY DUCT SCROLL;WD5000T 9KG,VE MOTOR,11"
 *   - antes do ";" é o NOME da peça (ASSY = conjunto, DUCT SCROLL = duto de secagem)
 *   - depois do ";" é especificação (modelo, tensão, medidas...)
 *
 * Montado a partir de TODAS as descrições da base GSPN (1.351 nomes diferentes).
 * Cada regra devolve: nome amigável + grupo (tipo geral, usado nas estatísticas).
 * Regras em ordem: da mais específica para a mais geral. Para acrescentar uma peça,
 * inclua uma linha no lugar certo da lista REGRAS.
 */

export type TraducaoPeca = { nome: string; grupo: string };

// Grupos (tipos gerais)
const G = {
  tela: "Tela / Painel",
  placaMain: "Placa Principal",
  placaFonte: "Placa de Fonte",
  placaInv: "Placa Inversora",
  tcon: "Placa T-Con",
  placa: "Placa Eletrônica",
  led: "Iluminação da Tela (LED)",
  bateria: "Bateria",
  motor: "Motor",
  bomba: "Bomba",
  comp: "Compressor",
  sensor: "Sensor",
  valvula: "Válvula",
  mangueira: "Mangueira",
  tubo: "Tubulação",
  suspensao: "Suspensão / Amortecedor",
  tambor: "Tambor / Tanque",
  rolamento: "Rolamento / Vedação",
  porta: "Porta",
  vedacao: "Borracha de Vedação",
  carcaca: "Tampa / Carcaça",
  gelo: "Fabricador de Gelo",
  evap: "Evaporador",
  cond: "Condensador",
  resist: "Resistência",
  termostato: "Termostato",
  filtro: "Filtro",
  ventilador: "Ventilador",
  controle: "Controle Remoto",
  wifi: "Módulo Wi-Fi",
  cabo: "Cabo / Chicote",
  som: "Alto-falante",
  camera: "Câmera",
  carga: "Placa de Carga (USB)",
  flex: "Cabo Flex",
  fita: "Fita Adesiva",
  parafuso: "Parafuso / Porca / Arruela",
  etiqueta: "Etiqueta / Adesivo",
  pelicula: "Película Protetora",
  dispenser: "Dispenser / Gaveta",
  painel: "Painel de Controle",
  acessorio: "Acessório",
  fixacao: "Fixação / Suporte",
  outros: "Outros",
} as const;

/** Grupos que são material de consumo (não mudam o "conserto"). */
export const GRUPOS_CONSUMO = new Set<string>([G.fita, G.parafuso, G.etiqueta, G.pelicula]);

type Regra = [RegExp, string | ((h: string, cat: string, completo: string) => string), string];

function cameraCelular(h: string): string {
  const frontal = /\bVT\b|VT CAMERA|FRONT|SELFIE/.test(h);
  if (frontal) return "Câmera Frontal (Selfie)";
  if (/ULTRA ?WIDE|\bUW\b/.test(h)) return "Câmera Traseira Ultra-angular";
  if (/TELE/.test(h)) return "Câmera Traseira Zoom (Teleobjetiva)";
  if (/MACRO/.test(h)) return "Câmera Traseira Macro";
  if (/WIDE/.test(h)) return "Câmera Traseira Principal";
  return "Câmera Traseira";
}

function porLado(h: string, base: string): string {
  if (/LEFT|[- ]L$/.test(h)) return `${base} (Esquerda)`;
  if (/RIGHT|[- ]R$/.test(h)) return `${base} (Direita)`;
  return base;
}

// [expressão no nome da peça, nome amigável, grupo]
const REGRAS: Regra[] = [
  // ---------- consumo ----------
  [/PROTECTOR FILM|FILM PROTECT/, "Película Protetora da Tela", G.pelicula],
  [/JIG/, "Gabarito / Ferramenta de Serviço", G.fita],
  [/TAPE.*(BACK ?COVER|B\/C|\bBC\b|BACK GLASS|\bBG\b|GLAS+TIC|REAR COVER)/, "Fita Adesiva da Tampa Traseira", G.fita],
  [/TAPE.*(MAIN WINDOW|WINDOW|OCTA|\bUB\b|FRONT)/, "Fita Adesiva da Tela", G.fita],
  [/TAPE.*INSULATION/, "Fita Isolante", G.fita],
  [/TAPE/, "Fita Adesiva Dupla Face", G.fita],
  [/\bLABEL\b|STICKER|MASCOT/, "Etiqueta / Emblema", G.etiqueta],
  [/\bSCREW\b|\bBOLT\b|\bNUT\b|WASHER-PLAIN|\bSPACER\b|FASTENER/, "Parafuso / Porca / Arruela", G.parafuso],

  // ---------- celulares / tablets / relógios / fones (HHP) ----------
  // "A/S REPAIR KIT-SVC;SM-S901,GLOBAL KIT" = kit de adesivos/vedações para abrir o aparelho
  [/REPAIR KIT-SVC|COMMON KIT|GLOBAL KIT/, "Kit de Serviço (Adesivos e Vedações)", G.fita],
  [/REPAIR KIT.*(OLED|SCREEN|OCTA|DISPLAY)|SCREEN ASSY|SMT-OCTA|OCTA-ASSY|OCTA KIT|SMT-LCD|^OLED-|ASSY OLED/, "Tela Completa (Display + Touch)", G.tela],
  [/FRONT MODULE-FRONT/, "Tela Completa com Aro", G.tela],
  [/REPAIR KIT.*SUB UB|SUB UB/, "Tela Externa (Galaxy Flip)", G.tela],
  [/REPAIR KIT.*UB REWORK/, "Kit de Reparo da Tela", G.tela],
  [/REPAIR KIT.*(B\/C|BACK GLASS)|COVER ASSY-(B\/[CG]|REAR|[A-Z]\d{3})|BACK COVER|COVER BACK|GLASS COVER|COVER-BACK|CASE-REAR|MEA REAR|MEA BACK COVER|COVER ASSY-REAR|OPTION SUB-REAR/, "Tampa Traseira", G.carcaca],
  [/FRONT MODULE-FRAME|METAL FRONT UNIT|CASE-FRONT SUB/, "Aro / Chassi Frontal", G.carcaca],
  [/MEA FRONT/, "Carcaça Frontal (Relógio)", G.carcaca],
  [/IF SUB PBA|SUB PBA[-_ ]?.*(USB|IF)|SUB PBA_COMMON|SUB PBA_GLOBAL|ASSY SUB PBA|SVC SUB PBA-USB|SUB PBA SKU/, "Placa de Carga (Conector USB)", G.carga],
  [/SUB PBA-WIFI GPS/, "Placa Wi-Fi / GPS", G.placa],
  [/SIM SOCKET/, "Placa do Chip (SIM)", G.placa],
  [/IF PBA.*(FPCB|CTC)|CON TO CON FPCB|UNIT-FRC FPCB|\bFRC\b.*FPCB/, "Cabo Flex de Conexão (Placa ↔ Placa)", G.flex],
  [/LCD FPCB/, "Cabo Flex da Tela", G.flex],
  [/KEY FPCB|ECG.*KEY|KEY-POWER|BACK KEY/, "Botões Laterais (Flex de Volume / Liga)", G.flex],
  [/MIC PBA/, "Placa de Botões e Microfone (Relógio)", G.placa],
  [/SENSOR PBA-BAROMETER/, "Sensor Barômetro (Relógio)", G.sensor],
  [/CAMERA/, (h) => cameraCelular(h), G.camera],
  [/US FP|FINGER ?PRINT/, "Leitor de Impressão Digital", G.sensor],
  [/SIM[ _]TRAY/, "Gaveta do Chip (SIM)", G.carcaca],
  [/LINEAR VIBRATOR|VIBRATOR/, "Motor de Vibração", G.motor],
  [/AUDIO-RECEIVER|\bRECEIVER\b/, "Alto-falante de Chamada (Auricular)", G.som],
  [/SPEAKER-SUBWOOFER|SUBWOOFER/, "Subwoofer", G.som],
  [/CH SET/, (h) => porLado(h, "Fone Galaxy Buds"), G.acessorio],
  [/CRADLE/, "Estojo de Carga (Galaxy Buds)", G.acessorio],
  [/WLESS CHARGER|WIRELESS CHARGER/, "Carregador Sem Fio", G.acessorio],
  [/STYLUS|\bS ?PEN\b/, "Caneta S Pen", G.acessorio],
  [/KEYBOARD COVER/, "Capa com Teclado (Tablet)", G.acessorio],
  [/ADAPTOR|ADAPTER|CHARGER/, "Carregador (Fonte de Tomada)", G.acessorio],
  [/DATA LINK CABLE/, "Cabo USB", G.cabo],
  [/COA?XIAL/, "Cabo Coaxial da Antena", G.cabo],
  [/HDMI CABLE/, "Cabo HDMI", G.cabo],
  [/HDMI PBA/, "Placa HDMI", G.placa],
  [/AMP PCB|AMP PBA/, "Placa de Áudio (Amplificador)", G.placa],
  [/EARJACK/, "Flex do Conector de Fone de Ouvido", G.flex],
  [/WIRELESS MODULE/, "Módulo Sem Fio (Transmissor)", G.wifi],
  [/ANTENNA/, "Antena", G.placa],
  [/INCELL BATTERY|\bBATT\b|BATTERY/, "Bateria", G.bateria],
  [/PBA-MAIN|PBA-JDM MAIN|MOTHER BD|MAIN PBA|PBA MAIN|PCB MAIN|PCB-MAIN|MAIN PCB/, (h, cat) => {
    if (/MAIN-IN\b/.test(h)) return "Placa Principal da Evaporadora (Unidade Interna)";
    if (/MAIN-OUT\b/.test(h)) return "Placa Principal da Condensadora (Unidade Externa)";
    if (/MOTHER BD/.test(h) || cat === "NPC") return "Placa-mãe";
    return "Placa Principal";
  }, G.placaMain],

  // ---------- notebooks (NPC) ----------
  [/SSD/, "SSD (Armazenamento)", G.placa],
  [/LCD SUBINS|JDM-LCD|LCD ASSY|SVC LCD|LCD PANEL/, (h, cat) => (cat === "NPC" ? "Tela do Notebook" : "Painel da Tela (Módulo LCD)"), G.tela],
  [/CASE-UPPER|CASE FRONT-TOP|CASE-FRONT-TOP|FRONT ASSY/, "Carcaça Superior com Teclado", G.carcaca],
  [/CASE-LOWER|REAR-ASSY/, "Carcaça Inferior", G.carcaca],
  [/SUB BOARD/, "Placa Secundária", G.placa],
  [/RUBBER[-_ ]?FOOT/, "Pé de Borracha", G.carcaca],

  // ---------- TVs e monitores (DTV / MON) ----------
  [/OPEN CELL-DECORATION/, "Moldura Decorativa da Tela", G.carcaca],
  [/OPEN CELL/, "Painel da Tela (Open Cell)", G.tela],
  [/T-?CON\b|TCON|\bT CON\b/, "Placa T-Con (Controle da Imagem)", G.tcon],
  [/PRODUCT LCD|^LCD-|^LCD\b|A\/S LCD|LCD-PANEL|DP CY CODE|FOR SED|\bLCM\b/, "Painel da Tela (Módulo LCD)", G.tela],
  // painéis identificados só pelo modelo e fabricante: "Y24 50DU7000 CSOT(T9) IPS", "60AU7000 SDP"
  [/^(Y\d{2}\b|\d{2}[A-Z]{1,2}\d{3,4}[A-Z]?\b|[A-Z]{3,4} \d{2}[A-Z]{2}\d{4}|UTU\d{4}|\d{2}Q\d{2})/, "Painel da Tela (Módulo LCD)", G.tela],
  [/LED BAR|ASSY-LED\b|A\/S ASSY-LED/, "Barra de LED (Luz de Fundo da Tela)", G.led],
  [/\bLGP\b/, "Placa Difusora de Luz (LGP)", G.led],
  [/OPTICAL SHEET-REFLECTOR|REFLECTOR/, "Folha Refletora da Luz de Fundo", G.led],
  [/OPTICAL SHEET/, "Filme Óptico da Tela", G.led],
  [/VSS-PD BOARD|PD BOARD|LED TV PD BD/, "Placa de Fonte (Fonte + Driver de LED)", G.placaFonte],
  [/VSS-POWER BOARD|POWER BOARD|\bSMPS\b|DC VSS\(A\)|PCB POWER/, "Placa de Fonte", G.placaFonte],
  [/VSS-DRIVER BOARD|DRIVER BOARD/, "Placa Driver de LED", G.placaFonte],
  [/ONECONNECT ?MINI CABLE/, "Cabo One Connect Mini", G.cabo],
  [/PCB OCM/, "Placa One Connect Mini", G.placa],
  [/PCB OC\b/, "Placa One Connect", G.placa],
  [/ONECONNECT(MINI)? CABLE|ONECONNECT/, "Cabo One Connect", G.cabo],
  [/WIFI\/IR COMBO/, "Módulo Wi-Fi + Receptor do Controle", G.wifi],
  [/IR\/FUNCTION|K\/D-FUNCTION|BOARD P-FUNCTION|P-FUNCTION/, "Placa de Botões e Receptor do Controle", G.placa],
  [/K\/D-WIFI|NETWORK-WLAN|W-LAN|WLAN/, "Módulo Wi-Fi", G.wifi],
  [/IOT HUB/, "Módulo SmartThings (IoT)", G.wifi],
  [/K\/D-BOARD P-SUB|BOARD P-SUB/, "Placa Secundária", G.placa],
  [/REMOCON|REMOTE/, "Controle Remoto", G.controle],
  [/SPEAKER/, (_h, cat) => (cat === "HHP" ? "Alto-falante" : "Alto-falantes"), G.som],
  [/TUNER/, "Sintonizador de TV Digital", G.placa],
  [/\bFFC\b/, "Cabo Flat (Tela ↔ Placa)", G.cabo],
  [/LEAD CONNECTOR/, "Cabo de Conexão Interno", G.cabo],
  [/OPTICAL CABLE/, "Cabo Óptico de Áudio", G.cabo],
  [/COVER P-REAR|^COVER-REAR/, "Tampa Traseira", G.carcaca],
  [/COVER P-DECORATION/, "Moldura Decorativa", G.carcaca],
  [/STAND P-COVER|GUIDE-STAND/, "Acabamento do Pé / Suporte", G.carcaca],
  [/JACKPACK/, "Fixação do Jack Pack (Conexões)", G.fixacao],
  [/FAN-DC/, "Ventilador de Refrigeração", G.ventilador],
  [/PCB MISC|PCB SUB\b|PBA-SUB|PCB SUBCON/, "Placa Secundária", G.placa],

  // ---------- ar-condicionado (ACN) ----------
  [/EVAP-TOTAL|EVAP-MODULE/, (_h, cat) => (cat === "ACN" ? "Evaporador (Serpentina da Unidade Interna)" : "Evaporador"), G.evap],
  [/COND-MODULE|COND SUB|\bCOND\b/, "Condensador (Serpentina da Unidade Externa)", G.cond],
  [/BASE OUT/, "Base da Condensadora (Unidade Externa)", G.carcaca],
  [/PBA KIT-OUT|PBA KIT-OUT MODULE/, "Placa da Condensadora (Unidade Externa)", G.placaMain],
  [/EEPROM-OUT/, "Memória EEPROM da Condensadora", G.placa],
  [/EEPROM/, "Memória EEPROM (Programação da Placa)", G.placa],
  [/INVERTER/, "Placa Inversora (Controle do Compressor)", G.placaInv],
  [/TUBE EEV|\bEEV\b/, "Tubo da Válvula de Expansão Eletrônica (EEV)", G.tubo],
  [/TUBE CAPILLARY|CAPILLARY/, "Tubo Capilar", G.tubo],
  [/TUBE 4WAY|4WAY|4-WAY/, "Válvula de 4 Vias (Reversora)", G.valvula],
  [/TUBE SUCTION/, "Tubo de Sucção", G.tubo],
  [/TUBE DISCHARGE/, "Tubo de Descarga", G.tubo],
  [/VALVE SERVICE/, "Válvula de Serviço", G.valvula],
  [/FAN PROPELLER|PROPELLER/, "Hélice do Ventilador (Unidade Externa)", G.ventilador],
  [/FAN CROSS/, "Turbina do Ventilador (Unidade Interna)", G.ventilador],
  [/MOTOR STEP/, "Motor da Aleta (Movimento do Ar)", G.motor],
  [/BLADE H\b|BLADE-H/, "Aleta Horizontal (Direcionador de Ar)", G.carcaca],
  [/HOLDER BLADE-DRAIN|TRAY DRAIN(?! WATER)/, "Bandeja de Drenagem", G.carcaca],
  [/GROMMET ISOLATOR/, "Coxim do Compressor (Borracha)", G.fixacao],
  [/CONNECTOR WIRE-COMP/, "Cabo de Ligação do Compressor", G.cabo],
  [/BODY BACK|BACK BODY/, "Gabinete Traseiro", G.carcaca],
  [/PANEL FRONT/, "Painel Frontal", G.carcaca],
  [/COVER MOTOR/, "Tampa do Motor", G.carcaca],
  [/BRACKET MOTOR|SUPPORT-CIRCUIT MOTOR/, "Suporte do Motor", G.fixacao],
  [/BRACKET-VALVE/, "Suporte da Válvula", G.fixacao],
  [/THERMISTOR OUT/, "Sensor de Temperatura Externo", G.sensor],
  [/COIL HARMONIC/, "Bobina Filtro de Harmônicas", G.placa],

  // ---------- compressor / refrigeração ----------
  [/CMP,COMP|RCP,COMP|ASSY COMP\b|COMPRESSOR/, "Compressor", G.comp],
  [/A\/S-DRYER|^DRYER$|^DRYER\b/, "Filtro Secador (Circuito de Gás)", G.filtro],
  [/CHASSIS COMP|CHASSIS-COMP/, "Base do Compressor", G.fixacao],

  // ---------- geladeiras (REF) ----------
  [/ICE MAKER-MECH/, "Mecanismo do Fabricador de Gelo", G.gelo],
  [/SUPPORT ICE MAKER/, "Suporte do Fabricador de Gelo", G.gelo],
  [/ICE MAKER/, "Fabricador de Gelo (Ice Maker)", G.gelo],
  [/AUGER MOTOR/, "Motor do Dispenser de Gelo (Rosca)", G.gelo],
  [/TRAY ICE/, "Forma / Bandeja de Gelo", G.gelo],
  [/CASE ICE ROUTE/, "Duto de Passagem do Gelo", G.gelo],
  [/CASE ICE/, "Reservatório de Gelo", G.gelo],
  [/CHUTE ICE/, "Tampa da Saída de Gelo", G.gelo],
  [/PIPE WATER ICE|PIPE IMMERGING|FITTING TUBE|PIPE-CONNECT/, "Tubo / Conexão de Água", G.tubo],
  [/HEATER-EVAP|HEATER METAL SHEATH|HEATER-METAL SHEATH/, "Resistência de Degelo", G.resist],
  [/COVER EVAP|COVER-EVAP|ASSY-COVER EVAP/, "Tampa do Evaporador (Duto de Ar)", G.carcaca],
  [/EVAP-REF|EVAP-FRE|\bEVAP\b/, "Evaporador", G.evap],
  [/GASKET|PACKING DOOR/, (h) => (/FRE/.test(h) ? "Borracha da Porta do Freezer" : /REF/.test(h) ? "Borracha da Porta do Refrigerador" : "Borracha de Vedação da Porta"), G.vedacao],
  [/DOOR FOAM|^ASSY FRENCH|ASSY-DOOR REF|SVC-ASSY DOOR/, (h) => (/FRE/.test(h) ? "Porta do Freezer" : "Porta do Refrigerador"), G.porta],
  [/COVER DISPENSER/, "Painel do Dispenser de Água / Gelo", G.dispenser],
  [/LEVER DISPENSER/, "Alavanca do Dispenser", G.dispenser],
  [/COVER MULTI|COVER-MULTI|COVER-MOTOR DAMPER|COVER DAMPER/, "Tampa do Duto de Ar Frio (Multi Flow)", G.carcaca],
  [/DAMPER CONV|GEARED DC DAMPER/, "Damper Motorizado (Controle de Ar Frio)", G.motor],
  [/COVER CONTROL|COVER DISPLAY|ASSY-COVER DISPLAY/, "Painel de Controle (Display)", G.painel],
  [/LAMP LED|MODULE LED|PBA-LAMP/, "Lâmpada LED Interna", G.placa],
  [/TRAY DRAIN WATER|DRAIN HOSE-LOW/, "Bandeja / Mangueira de Degelo", G.mangueira],
  [/TANK WATER/, "Reservatório de Água", G.dispenser],
  [/CASE WATER FILTER|INSTALL-FILTER/, "Suporte do Filtro de Água", G.filtro],
  [/Y CLIP/, "Presilha em Y (Mangueiras)", G.fixacao],
  [/HINGE/, (h) => (/COVER HINGE/.test(h) ? "Tampa da Dobradiça" : "Dobradiça da Porta"), G.porta],
  [/CASTER|SHAFT-CASTER/, "Rodízio (Roda)", G.fixacao],
  [/SHELF/, "Prateleira", G.carcaca],
  [/CASE VEG/, "Gaveta de Legumes", G.carcaca],
  [/RAIL-SLIDE/, (h) => porLado(h, "Trilho da Gaveta"), G.fixacao],
  [/GUARD/, "Prateleira da Porta", G.carcaca],
  [/STOPPER DOOR/, "Batente da Porta", G.porta],
  [/THERMO FUSE/, "Fusível Térmico", G.sensor],
  [/C-FILM|CAPACITOR/, "Capacitor", G.placa],
  [/INSTALL-STEP KIT/, "Kit de Instalação", G.acessorio],
  [/VALVE STEP/, "Válvula de Passo (Distribuição do Gás)", G.valvula],
  [/HANDLE(?! DOOR| DRAWER)/, "Puxador da Porta", G.porta],
  [/SENSOR HUMIDITY/, "Sensor de Umidade", G.sensor],

  // ---------- lava e seca (WSM) ----------
  [/DUCT SCROLL/, "Duto de Secagem", G.tambor],
  [/DUCT CONDENSER|S\.DUCT CONDENSER/, "Duto do Condensador de Secagem", G.tambor],
  [/HOSE CONDENSER/, "Mangueira do Condensador de Secagem", G.mangueira],
  [/FAN DRY/, "Ventoinha de Secagem", G.ventilador],
  [/HEATER DRY/, "Resistência de Secagem", G.resist],
  [/HEATER WASH/, "Resistência de Aquecimento da Água", G.resist],
  [/HEATER IGNITER|IGNITER/, "Ignitor do Queimador (Secadora a Gás)", G.resist],
  [/BURNER CUP/, "Espalhador de Chama (Queimador)", G.resist],
  [/BURNER/, "Queimador (Secadora a Gás)", G.resist],
  [/VALVE GAS/, "Válvula de Gás", G.valvula],
  [/DRUM LIFTER|LIFTER/, "Pá / Aleta do Tambor", G.tambor],
  [/DRUM WRAPPER/, "Revestimento do Tambor", G.tambor],
  [/\bDRUM\b/, "Conjunto do Tambor", G.tambor],
  [/BASKET SPIN/, "Cesto de Centrifugação", G.tambor],
  [/TUB BACK|S\.TUB BACK|SEMI TUB BACK/, "Tanque Traseiro (Cuba)", G.tambor],
  [/TUB FRONT|SEMI TUB FRONT/, "Tanque Dianteiro (Cuba)", G.tambor],
  [/WEIGHT BALANCER/, (h) => porLado(h.replace(/-?MODULE/, ""), "Contrapeso de Concreto"), G.suspensao],
  [/DAMPER SHOCK|SHOCK-MODULE|^ASSY DAMPER$|^DAMPER$/, "Amortecedor", G.suspensao],
  [/SPRING.*HANGER|HANGER/, "Mola de Suspensão do Tanque", G.suspensao],
  [/MOTOR AC PUMP|PUMP DRAIN|PUMP-DRAIN/, "Bomba de Drenagem", G.bomba],
  [/MOTOR-PUMP|HOSE PUMP/, (h) => (/HOSE/.test(h) ? "Mangueira da Bomba" : "Motor da Bomba de Lavagem"), G.bomba],
  [/SWITCH DOOR LOCK|DOOR LOCK/, "Trava da Porta", G.porta],
  [/SWITCH DOOR/, "Interruptor da Porta", G.porta],
  [/MICRO SWITCH|^SWITCH$/, "Micro Chave (Interruptor)", G.sensor],
  [/DOOR DIAPHRAGM|\bDIAPHRAGM\b/, "Borracha da Porta (Gaxeta)", G.vedacao],
  [/DOOR GLASS|HOLDER GLASS/, (h) => (/HOLDER/.test(h) ? "Moldura do Vidro da Porta" : "Vidro da Porta"), G.porta],
  [/HANDLE DOOR/, "Puxador da Porta", G.porta],
  [/COVER DOOR/, "Tampa / Acabamento da Porta", G.porta],
  [/ASSY DOOR|DOOR-MODULE/, "Porta Completa", G.porta],
  [/LATCH/, "Trinco / Fecho", G.porta],
  [/BEARING BALL|\bBEARING\b(?! HOUSING)/, "Rolamento", G.rolamento],
  [/HOUSING BEARING/, "Mancal do Rolamento", G.rolamento],
  [/SEAL OIL|OIL SEAL/, "Retentor (Vedação do Eixo)", G.rolamento],
  [/SEAL WATER/, "Vedação de Água", G.rolamento],
  [/FLANGE SHAFT|FLANGE/, "Cruzeta (Eixo do Tambor)", G.rolamento],
  [/HALL SENSOR/, "Sensor Hall do Motor", G.sensor],
  [/ROTOR MIDDLE/, "Braço Aspersor do Meio", G.dispenser],
  [/\bROTOR\b/, "Rotor do Motor", G.motor],
  [/\bSTATOR\b/, "Estator do Motor (Bobina)", G.motor],
  [/DD BLDC MOTOR|MOTOR BLDC-MODULE|ASSY MOTOR BLDC/, "Motor de Acionamento Direto (Inverter)", G.motor],
  [/MOTOR BLDC FAN|MOTOR AC FAN|MOTOR FAN/, "Motor do Ventilador", G.motor],
  [/MOTOR AC DRIVE/, "Motor de Acionamento do Tambor", G.motor],
  [/CLUTCH/, "Embreagem", G.motor],
  [/PULLEY/, "Polia do Motor", G.motor],
  [/BELT/, "Correia", G.motor],
  [/BRACKET IDLER|IDLER/, "Suporte do Tensor da Correia", G.fixacao],
  [/SENSOR PRESSURE|HOSE PRESSURE/, "Sensor de Nível de Água (Pressostato)", G.sensor],
  [/SENSOR PHOTO/, "Sensor Óptico", G.sensor],
  [/SENSOR-ACCELERATION|ACCELERATION/, "Sensor de Vibração", G.sensor],
  [/SENSOR-RADIANT|RADIANT/, "Sensor de Temperatura Infravermelho", G.sensor],
  [/THERMISTOR|SENSOR TEMP|SENSOR-TEMP/, "Sensor de Temperatura", G.sensor],
  [/THERMOSTAT/, "Termostato (Proteção de Temperatura)", G.termostato],
  [/VALVE WATER|WATER VALVE/, (_h, cat) => (cat === "REF" ? "Válvula de Água (Dispenser / Gelo)" : "Válvula de Entrada de Água"), G.valvula],
  [/HOSE DRAWER|HOSE-DRAWER/, "Mangueira do Dispenser de Sabão", G.mangueira],
  [/HOSE FILTER/, "Mangueira do Filtro", G.mangueira],
  [/HOSE AIR/, "Mangueira de Ar (Pressostato)", G.mangueira],
  [/HOSE CIRCULATION/, "Mangueira de Recirculação", G.mangueira],
  [/HOSE DRAIN|DRAIN HOSE|HOSE-DRAIN/, "Mangueira de Drenagem", G.mangueira],
  [/HOSE WATER|HOSE-WATER/, "Mangueira de Entrada de Água", G.mangueira],
  [/CLAMPER HOSE/, "Abraçadeira da Mangueira", G.fixacao],
  [/\bHOSE\b/, "Mangueira", G.mangueira],
  [/HANDLE DRAWER|PANEL DRAWER/, "Frente da Gaveta de Sabão", G.dispenser],
  [/HOUSING DRAWER|S\.HOUSING DRAWER/, "Alojamento da Gaveta de Sabão", G.dispenser],
  [/DRAWER|BODY DRAWER/, "Gaveta de Sabão (Dispenser)", G.dispenser],
  [/CASE DETERGENT|BODY DETERGENT/, "Compartimento de Detergente", G.dispenser],
  [/CASE RINSE|CAP RINSE|RINSE AID/, "Compartimento do Amaciante / Secante", G.dispenser],
  [/DISPENSER/, "Dispenser de Detergente", G.dispenser],
  [/PANEL CONTROL|CONTROL PANEL|TOP PANEL|WINDOW PANEL|PCB DISPLAY|PBA MODULE-DISPLAY/, (h) => (/PCB|PBA/.test(h) ? "Placa do Painel (Display e Botões)" : "Painel de Controle"), G.painel],
  [/BUTTON/, "Botão do Painel", G.painel],
  [/CASE FILTER|COVER FILTER|GUIDE FILTER|FILTER GUIDE|ASSY FILTER|^FILTER/, "Filtro / Tampa do Filtro", G.filtro],
  [/NOZZLE/, "Bico Injetor de Água", G.tubo],
  [/SHUTTER/, "Obturador do Dispenser", G.dispenser],
  [/SUMP/, "Reservatório (Sump)", G.bomba],
  [/BASKET CUTLERY/, "Cesto de Talheres", G.acessorio],
  [/BASKET LOWER/, "Cesto Inferior", G.acessorio],
  [/\bLEG\b|\bFOOT\b|FOOT-/, "Pé Nivelador", G.fixacao],
  [/ACCESSORY/, "Kit de Acessórios", G.acessorio],
  [/COVER TOP/, "Tampa Superior", G.carcaca],
  [/FRAME FRONT|PAINT FRAME|FRAME-MODULE|ASSY PANEL$/, "Gabinete / Painel Frontal", G.carcaca],
  [/WIRE HARNESS|GUIDE WIRE HARNESS/, "Chicote Elétrico (Fiação)", G.cabo],
  [/POWER CORD/, "Cabo de Força", G.cabo],

  // ---------- placas genéricas (vem depois das específicas) ----------
  [/HOLDER PCB/, "Placa Principal com Suporte", G.placaMain],
  [/PCB KIT|PBA KIT|^ASSY KIT$/, "Placa Principal (Kit de Serviço)", G.placaMain],
  [/PBA MODULE|ASSY MODULE$|ASSY MODULE\b/, (_h, _c, c) => {
    if (/TOUCH|DISPLAY/.test(c)) return "Placa do Painel (Display e Botões)";
    if (/SMPS/.test(c)) return "Placa de Fonte";
    if (/MEMS|ACCEL/.test(c)) return "Sensor de Vibração";
    if (/BUZZER/.test(c)) return "Placa do Aviso Sonoro (Buzzer)";
    return "Placa Eletrônica Auxiliar";
  }, G.placa],
  [/PCB|PBA|BOARD/, "Placa Eletrônica", G.placa],

  // ---------- genéricos ----------
  [/REPAIR KIT/, "Kit de Reparo", G.acessorio],
  [/MOTOR/, (_h, cat) => (cat === "HHP" ? "Motor de Vibração" : "Motor"), G.motor],
  [/PUMP/, "Bomba", G.bomba],
  [/VALVE/, "Válvula", G.valvula],
  [/SENSOR/, "Sensor", G.sensor],
  [/HEATER/, "Resistência", G.resist],
  [/\bFAN\b/, "Ventilador", G.ventilador],
  [/\bTUBE\b|\bPIPE\b/, "Tubo", G.tubo],
  [/CHASSIS/, "Chassi", G.carcaca],
  [/BRACKET|HOLDER|SUPPORT/, "Suporte", G.fixacao],
  [/GROMMET/, "Bucha de Borracha", G.fixacao],
  [/CAM HINGE|CAP-SHAFT|\bCAP\b/, "Tampa / Acabamento", G.carcaca],
  [/COVER|CASE|\bBODY\b|\bBASE\b|HOUSING/, "Tampa / Carcaça", G.carcaca],
  [/CABLE|WIRE|CORD/, "Cabo", G.cabo],
  [/LCD|OLED|DISPLAY|SCREEN/, "Tela", G.tela],
];

/** Limpa prefixos de serviço: "A/S-", "SVC ", "SVC JDM-", "JDM-", "CKD "... */
function limparNome(desc: string): string {
  let h = desc.toUpperCase().split(";")[0].replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4; i++) {
    const antes = h;
    h = h
      .replace(/^A\/S[- ]?(SVC )?/, "")
      .replace(/^SVC[- ](JDM[- _]?)?/, "")
      .replace(/^JDM[- _]/, "")
      .replace(/^CKD [A-Z ]*BOARD-/, "")
      .replace(/^[A-Z]\d_/, "") // "B5_REPAIR KIT"
      .trim();
    if (h === antes) break;
  }
  return h;
}

const cache = new Map<string, TraducaoPeca>();

/** Traduz a descrição do GSPN para um nome fácil de entender. */
export function traduzirPeca(descricao: unknown, categoria = ""): TraducaoPeca {
  const desc = String(descricao ?? "").trim();
  if (!desc) return { nome: "Peça sem descrição", grupo: G.outros };
  const chave = categoria + "|" + desc;
  const pronto = cache.get(chave);
  if (pronto) return pronto;

  const h = limparNome(desc);
  let r: TraducaoPeca | null = null;
  for (const [re, nome, grupo] of REGRAS) {
    if (re.test(h)) {
      r = { nome: typeof nome === "function" ? nome(h, categoria, desc.toUpperCase()) : nome, grupo };
      break;
    }
  }
  if (!r) r = { nome: "Peça (ver descrição)", grupo: G.outros };
  if (cache.size > 20000) cache.clear();
  cache.set(chave, r);
  return r;
}

/** Tipo geral da peça (usado nas estatísticas e nos conjuntos por tipo). */
export function grupoPeca(descricao: unknown, categoria = ""): string {
  return traduzirPeca(descricao, categoria).grupo;
}
