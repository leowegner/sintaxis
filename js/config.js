/* ============================================================
   CONFIGURACIÓN DEL ANÁLISIS SINTÁCTICO
   ------------------------------------------------------------
   ESTE ES EL ARCHIVO QUE MÁS VAS A TOCAR.

   Contiene:
     - LEVELS: los 4 niveles del análisis y las etiquetas válidas
       en cada uno, con su color. Para añadir/quitar/renombrar
       una etiqueta, edita aquí.
     - MODELS: lista de modelos de IA que aparecen en el desplegable.
     - PRICING: precio por millón de tokens (USD), para el cálculo
       de coste teórico.

   Los nombres de etiqueta deben coincidir EXACTAMENTE en este
   archivo y en js/prompts.js (donde se usan en los ejemplos del
   prompt) y en js/examples.js (banco de oraciones pre-hechas).
   Si renombras una etiqueta, busca su uso en esos archivos también.
   ============================================================ */

/* ---------- NIVELES + ETIQUETAS DEL ANÁLISIS ----------------
   Jerarquía sintáctica, de abajo arriba:
     1 = Sintagma + función fusionados (SN-NS, SV-NP, SN-CD…)
     2 = Funciones oracionales que abarcan varios sintagmas
         (Sujeto, Predicado verbal, Predicado nominal)
     3 = Clasificación de cada proposición componente
         (OSAT/OSAI/OSImp/OSCop/OSP, + Nx). En coordinadas/yuxtapuestas:
         una OS· por proposición. En subordinadas: la OS· solo de la
         subordinada (la principal NO se clasifica como simple aparte).
         Vacío en oraciones simples.
     4 = Etiqueta global de la oración entera
         (OSAT… si es simple; OCCoordinada…/OCSubSus…/OCSubRel si es compuesta)
     5 = Paréntesis de subordinada (especial: se dibuja como `( )`
         grandes alrededor del rango, no como línea horizontal).
   ------------------------------------------------------------ */
const LEVELS = [
  { n: 1, name: "Sintagma–Función", labels: [
    { text: "SN - NS",       color: "#2563eb" },
    { text: "SV - NP",       color: "#16a34a" },
    { text: "SN - CD",       color: "#0891b2" },
    { text: "SPrep - CD",    color: "#0891b2" },   // CD de persona con "a": "Saludé a Juan"
    { text: "SN - CI",       color: "#0891b2" },
    { text: "SPrep - CI",    color: "#0891b2" },
    { text: "SPrep - CCL",   color: "#ca8a04" },
    { text: "SPrep - CCT",   color: "#ca8a04" },
    { text: "SAdv - CCM",    color: "#ca8a04" },
    { text: "SAdv - CCT",    color: "#ca8a04" },
    { text: "SAdv - CCL",    color: "#ca8a04" },
    { text: "SPrep - CCC",   color: "#ca8a04" },
    { text: "SPrep - CCFin", color: "#ca8a04" },
    { text: "SAdj - Atrib.", color: "#db2777" },
    { text: "SN - Atrib.",   color: "#db2777" },
    { text: "SPrep - C. Agente",  color: "#7c3aed" },
    { text: "SPrep - C. Régimen", color: "#7c3aed" },
    { text: "SAdj - C. Predicativo", color: "#db2777" },
    { text: "Nx",  color: "#a855f7" },
  ]},
  { n: 2, name: "Funciones oracionales", labels: [
    { text: "Sujeto",            color: "#2563eb" },
    { text: "Predicado verbal",  color: "#16a34a" },
    { text: "Predicado nominal", color: "#16a34a" },
  ]},
  /* Nivel 3 = clasificación de cada PROPOSICIÓN componente de
     una oración compuesta:
       - Coordinadas/yuxtapuestas: una OS· (+ Nx) por cada prop. simple.
       - Subordinadas: una OS· para la SUBORDINADA, cubriendo solo su
         rango (incluyendo el "que"/nexo). La PRINCIPAL no se clasifica
         como simple aparte: la oración entera ya tiene su etiqueta
         global en nivel 4 (p.ej. OCSubSus-Suj), no hay un OSCop/OSAT
         intermedio para la principal.
     Vacío en oraciones simples. */
  { n: 3, name: "Clasif. de proposiciones", labels: [
    { text: "OSAT",  color: "#111" },     // Oración Simple Activa Transitiva
    { text: "OSAI",  color: "#111" },     // Oración Simple Activa Intransitiva
    { text: "OSImp", color: "#111" },     // Oración Simple Impersonal
    { text: "OSCop", color: "#111" },     // Oración Simple Copulativa
    { text: "OSP",   color: "#111" },     // Oración Simple Pasiva
    { text: "Nx",    color: "#a855f7" },
  ]},
  { n: 4, name: "Etiqueta global", labels: [
    // Si es simple, repite la etiqueta OS· correspondiente.
    { text: "OSAT",  color: "#111" },
    { text: "OSAI",  color: "#111" },
    { text: "OSImp", color: "#111" },
    { text: "OSCop", color: "#111" },
    { text: "OSP",   color: "#111" },
    // Compuestas coordinadas / yuxtapuestas
    { text: "OCCoordinada Copulativa",  color: "#111" },
    { text: "OCCoordinada Adversativa", color: "#111" },
    { text: "OCCoordinada Disyuntiva",  color: "#111" },
    { text: "OCYuxtapuesta",            color: "#111" },
    // Compuestas subordinadas (combinan tipo + función)
    { text: "OCSubSus-CD",    color: "#0e7490" },
    { text: "OCSubSus-Suj",   color: "#0e7490" },
    { text: "OCSubSus-CI",    color: "#0e7490" },
    { text: "OCSubSus-Atrib", color: "#0e7490" },
    { text: "OCSubSus-CR",    color: "#0e7490" },
    { text: "OCSubSus-CN",    color: "#0e7490" },
    { text: "OCSubRel",       color: "#7e22ce" },
  ]},
  /* Nivel 5 = paréntesis de subordinada. Es ESPECIAL: no se
     dibuja como una línea horizontal debajo de la oración, sino
     como dos paréntesis grandes a los lados del rango, en la
     misma fila que las palabras (ver renderParens en render.js).
     La etiqueta indica qué tipo de subordinada es (informativa;
     el dibujo siempre es `( )`).
     Las anotaciones de este nivel se reconocen por kind === 'paren'. */
  { n: 5, name: "Subordinadas (paréntesis)", labels: [
    { text: "Sub. Sustantiva CD",    color: "#0e7490", kind: "paren" },
    { text: "Sub. Sustantiva Suj",   color: "#0e7490", kind: "paren" },
    { text: "Sub. Sustantiva CI",    color: "#0e7490", kind: "paren" },
    { text: "Sub. Sustantiva Atrib", color: "#0e7490", kind: "paren" },
    { text: "Sub. Sustantiva CR",    color: "#0e7490", kind: "paren" },
    { text: "Sub. Sustantiva CN",    color: "#0e7490", kind: "paren" },
    { text: "Sub. Relativa",         color: "#7e22ce", kind: "paren" },
  ]},
];

/* ---------- MODELOS DE IA disponibles -----------------------
   Los marcados como "free tier" funcionan con el plan gratuito
   de Google AI Studio (sin facturación activada).
   Para añadir un modelo nuevo: añade aquí su id + label, y
   añade su precio en PRICING (más abajo) si quieres que se
   calcule el coste teórico.
   ------------------------------------------------------------ */
const MODELS = {
  gemini: [
    { id: 'gemini-2.5-flash',       label: 'gemini-2.5-flash (free tier)' },
    { id: 'gemini-2.5-flash-lite',  label: 'gemini-2.5-flash-lite (free tier, más rápido)' },
    { id: 'gemini-2.0-flash',       label: 'gemini-2.0-flash' },
    { id: 'gemini-2.0-flash-lite',  label: 'gemini-2.0-flash-lite' },
    { id: 'gemini-1.5-flash',       label: 'gemini-1.5-flash (legacy)' },
    { id: 'gemini-1.5-flash-8b',    label: 'gemini-1.5-flash-8b (legacy)' },
  ],
  openai: [
    { id: 'gpt-4o-mini',  label: 'gpt-4o-mini' },
    { id: 'gpt-4o',       label: 'gpt-4o' },
    { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  ],
};

/* ---------- PRECIOS (USD por 1M tokens, enero 2026) ---------
   Solo se usan para el indicador de "coste teórico" en la UI;
   no afectan al funcionamiento.
   ------------------------------------------------------------ */
const PRICING = {
  'gpt-4o-mini':           { in: 0.15,   out: 0.60  },
  'gpt-4o':                { in: 2.50,   out: 10.00 },
  'gpt-4.1-mini':          { in: 0.40,   out: 1.60  },
  'gemini-2.5-flash':      { in: 0.30,   out: 2.50  },
  'gemini-2.5-flash-lite': { in: 0.10,   out: 0.40  },
  'gemini-2.0-flash':      { in: 0.10,   out: 0.40  },
  'gemini-2.0-flash-lite': { in: 0.075,  out: 0.30  },
  'gemini-1.5-flash':      { in: 0.075,  out: 0.30  },
  'gemini-1.5-flash-8b':   { in: 0.0375, out: 0.15  },
};
