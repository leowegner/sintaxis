/* ============================================================
   PROMPTS DE LA IA
   ------------------------------------------------------------
   ESTE ES EL OTRO ARCHIVO QUE VAS A TOCAR A MENUDO.

   Contiene los DOS prompts grandes que se mandan a la IA:
     - buildPrompt()          → para "Revisar mi análisis":
                                la IA recibe lo que el alumno
                                anotó y dice qué está bien y qué
                                falta. Devuelve un JSON con
                                veredicto/revision/faltantes.
     - buildAnalysisPrompt()  → para "Analizar con IA":
                                la IA recibe SOLO la oración y
                                devuelve un análisis completo
                                (annotations + tacitSubjects).

   Al cambiar la convención (etiquetas, reglas, ejemplos), edita:
     1. Las etiquetas en js/config.js (LEVELS).
     2. El texto de los prompts aquí (regla, ejemplos, restricciones).
   El JSON de etiquetas válidas se inyecta automáticamente desde
   LEVELS — no hay que duplicar la lista en el prompt.
   ============================================================ */

/* Prompt para "Revisar mi análisis": la IA actúa como corrector.
   Recibe el análisis del alumno y devuelve qué anotaciones están
   bien/mal y qué falta. */
function buildPrompt() {
  const annotated = state.annotations.map((a, i) => ({
    id: i,
    rango: state.tokens.slice(a.from, a.to + 1).join(' '),
    from: a.from, to: a.to,
    nivel: a.level,
    etiqueta: a.label
  }));

  return `Eres un corrector de análisis sintáctico del español. Sigues una convención específica del estudiante. NO uses convenciones de otros manuales.

CONVENCIÓN ESTRICTA:

Nivel 1 (sintagma + función fusionados):
- Verbo → "SV - NP" (cubre SOLO el verbo, nunca sus complementos)
- Sujeto → "SN - NS" (UNA anotación que abarque determinante + núcleo + modificadores adjetivales, juntos)
- Complementos → su función fusionada con el sintagma: "SN - CD", "SPrep - CCL", "SAdj - Atrib.", "SPrep - C. Agente", etc. Cada SN/SPrep abarca el determinante + núcleo + adyacentes EN UN ÚNICO RANGO.
- CD de persona introducido por la preposición "a" ("Saludé a Juan", "Conozco al chico") → "SPrep - CD" (NO "SN - CD"). Si NO empieza por la preposición "a" → "SN - CD" ("Compré un libro").
- Nexo coordinante → "Nx"
- REGLA OBLIGATORIA: los determinantes (el, la, un, mi, este…) y los adjetivos modificadores NO llevan etiqueta propia: van DENTRO del rango del sintagma. NUNCA un determinante puede quedar sin cubrir. Si el estudiante deja un determinante sin marcar (p. ej. SN-CD solo sobre "manzana" en "la manzana"), eso ES un error y debes señalarlo.

Nivel 2 (funciones oracionales — SOLO tres etiquetas posibles, cada una en UNA SOLA anotación que cubra todo su rango):
- "Sujeto" (un único rango cubriendo todo el sintagma del sujeto)
- "Predicado verbal" (un único rango cubriendo verbo + TODOS sus complementos)
- "Predicado nominal" (un único rango cubriendo verbo copulativo + atributo + complementos)
Estas DEBEN aparecer en nivel 2 incluso cuando cubren el mismo rango que su etiqueta de nivel 1. Por ejemplo, si "Manuel" lleva "SN - NS" en nivel 1, TAMBIÉN debe llevar "Sujeto" en nivel 2 — eso NO es redundante, es lo correcto.
Las únicas etiquetas que NO van a nivel 2 son los complementos del verbo (CD, CI, CCL, CCT, CCM, Atributo, C. Agente, C. Régimen): esos viven SOLO en nivel 1, fusionados con su sintagma.

Nivel 3 (clasificación de cada PROPOSICIÓN componente):
Etiquetas OS·: "OSAT" (con CD), "OSAI" (sin CD), "OSImp" (meteorológicos/"hay"…), "OSCop" (ser/estar/parecer + atributo), "OSP" (pasiva), "Nx" (nexos).
USO según tipo de oración:
- Subordinada (sustantiva o de relativo): aquí va la OS· de la SUBORDINADA cubriendo SOLO su rango (incluido el "que"/nexo). La PRINCIPAL no se clasifica con OS· aparte: la oración entera ya tiene su etiqueta global en nivel 4 (p.ej. OCSubSus-Suj). NO marques OSCop/OSAT/etc. para la principal — sería redundante con el nivel 4 y semánticamente incorrecto (una compuesta no es OSCop).
- Coordinada / yuxtapuesta: aquí va la OS· de CADA proposición simple componente + Nx entre ellas.
- Oración SIMPLE: nivel 3 queda VACÍO (la clasificación va en nivel 4).

Nivel 4 (etiqueta global de la oración entera, una sola anotación):
- Simple: OSAT/OSAI/OSImp/OSCop/OSP.
- Compuesta coordinada: "OCCoordinada Copulativa", "OCCoordinada Adversativa", "OCCoordinada Disyuntiva".
- Yuxtapuesta: "OCYuxtapuesta".
- Subordinada sustantiva (combina tipo + función): "OCSubSus-CD", "OCSubSus-Suj", "OCSubSus-CI", "OCSubSus-Atrib", "OCSubSus-CR", "OCSubSus-CN".
- Subordinada de relativo: "OCSubRel".

Nivel 5 (paréntesis de subordinada — SOLO en subordinadas):
- Marca el rango EXACTO de la subordinada incrustada con UNA anotación cuya etiqueta sea: "Sub. Sustantiva CD/Suj/CI/Atrib/CR/CN" o "Sub. Relativa".
- La principal NO lleva paréntesis. SOLO la subordinada incrustada.
- La subordinada conserva su análisis completo dentro (SN-NS, SV-NP, OS· en nivel 3…).

Las adverbiales (causales, condicionales, concesivas, finales, etc.) NO se contemplan en esta convención: solo damos sustantivas y de relativo.

TOKENIZACIÓN: los signos de puntuación (, . ; : ¿ ? ¡ !) son tokens separados. Por ejemplo "Llegué, vi, vencí" tiene 5 tokens: ["Llegué", ",", "vi", ",", "vencí"]. Las comas NO forman parte del rango del verbo.

REGLA CRÍTICA SIMPLE vs COMPUESTA:
Una oración es compuesta SOLO si hay más de un verbo conjugado en proposiciones distintas. Una conjunción coordinante (y, o, u, ni, pero, sino...) NO implica oración compuesta por sí sola: puede coordinar sintagmas dentro de una misma proposición.
- "Quieres té o café" → SIMPLE. "o" coordina dos SN-CD. NO P1/P2.
- "Quieres té y yo quiero café" → COMPUESTA. SÍ P1/P2.
- "Canta y baila" → SIMPLE (mismo sujeto, núcleo verbal compuesto). NO P1/P2.

REGLAS CRÍTICAS:
- En nivel 1 NO existe un "SV" que cubra el predicado entero. El predicado completo solo existe como "Predicado verbal" en nivel 2.
- En nivel 1 NO existe un "SN" que cubra una proposición entera.
- Tener "SN - NS" en nivel 1 Y "Sujeto" en nivel 2 sobre el mismo rango es CORRECTO, no redundante. NO lo marques como error.
- Tener "SV - NP" en nivel 1 Y "Predicado verbal" en nivel 2 sobre el mismo rango es CORRECTO. NO lo marques como error.
- Si el estudiante ha puesto: nivel 1 para cada palabra de contenido + Sujeto/Predicado en nivel 2 + proposiciones en nivel 3 + tipo de oración en nivel 4 → el análisis está COMPLETO.

QUÉ NO MARCAR COMO ERROR (importante):
- NO marques como error que una palabra tenga dos etiquetas en niveles distintos. Es el diseño del sistema: cada nivel describe una capa diferente.
- NO marques "Sujeto" en nivel 2 como redundante por existir "SN - NS" en nivel 1.
- NO marques "Predicado verbal" en nivel 2 como redundante por existir "SV - NP" en nivel 1.
- NO marques como error que un rango de nivel 5 (paréntesis de subordinada) solape con anotaciones de otros niveles: el paréntesis es un envoltorio anidado.

QUÉ SÍ MARCAR COMO ERROR:
- En oraciones con subordinada, marcar OSCop/OSAT/OSAI/etc. para la PRINCIPAL en nivel 3 ES UN ERROR. Una oración compuesta no se clasifica como simple aparte: nivel 3 SOLO lleva la OS· de la subordinada (cubriendo su rango). La oración entera tiene su etiqueta global en nivel 4 (OCSubSus-X / OCSubRel).

ETIQUETAS VÁLIDAS (no inventes otras):
${JSON.stringify(validLabelsByLevel(), null, 2)}

EJEMPLO 1 — coordinada copulativa, "Manuel estudia y Pablo escucha música":
[
  {"rango":"Manuel","from":0,"to":0,"nivel":1,"etiqueta":"SN - NS"},
  {"rango":"estudia","from":1,"to":1,"nivel":1,"etiqueta":"SV - NP"},
  {"rango":"y","from":2,"to":2,"nivel":1,"etiqueta":"Nx"},
  {"rango":"Pablo","from":3,"to":3,"nivel":1,"etiqueta":"SN - NS"},
  {"rango":"escucha","from":4,"to":4,"nivel":1,"etiqueta":"SV - NP"},
  {"rango":"música","from":5,"to":5,"nivel":1,"etiqueta":"SN - CD"},
  {"rango":"Manuel","from":0,"to":0,"nivel":2,"etiqueta":"Sujeto"},
  {"rango":"estudia","from":1,"to":1,"nivel":2,"etiqueta":"Predicado verbal"},
  {"rango":"Pablo","from":3,"to":3,"nivel":2,"etiqueta":"Sujeto"},
  {"rango":"escucha música","from":4,"to":5,"nivel":2,"etiqueta":"Predicado verbal"},
  {"rango":"Manuel estudia","from":0,"to":1,"nivel":3,"etiqueta":"OSAI"},
  {"rango":"y","from":2,"to":2,"nivel":3,"etiqueta":"Nx"},
  {"rango":"Pablo escucha música","from":3,"to":5,"nivel":3,"etiqueta":"OSAT"},
  {"rango":"oración entera","from":0,"to":5,"nivel":4,"etiqueta":"OCCoordinada Copulativa"}
]
En coordinadas/yuxtapuestas no hay paréntesis (nivel 5 vacío).

EJEMPLO 2 — subordinada de relativo, "El libro que compré es interesante":
[
  {"rango":"El libro","from":0,"to":1,"nivel":1,"etiqueta":"SN - NS"},
  {"rango":"que","from":2,"to":2,"nivel":1,"etiqueta":"Nx"},
  {"rango":"compré","from":3,"to":3,"nivel":1,"etiqueta":"SV - NP"},
  {"rango":"es","from":4,"to":4,"nivel":1,"etiqueta":"SV - NP"},
  {"rango":"interesante","from":5,"to":5,"nivel":1,"etiqueta":"SAdj - Atrib."},
  {"rango":"El libro","from":0,"to":1,"nivel":2,"etiqueta":"Sujeto"},
  {"rango":"compré","from":3,"to":3,"nivel":2,"etiqueta":"Predicado verbal"},
  {"rango":"es interesante","from":4,"to":5,"nivel":2,"etiqueta":"Predicado nominal"},
  {"rango":"que compré","from":2,"to":3,"nivel":3,"etiqueta":"OSAT"},
  {"rango":"oración entera","from":0,"to":5,"nivel":4,"etiqueta":"OCSubRel"},
  {"rango":"que compré","from":2,"to":3,"nivel":5,"etiqueta":"Sub. Relativa"}
]
En nivel 3 SOLO va la OS· de la subordinada (OSAT, rango 2,3). NO marques OSCop/OSAT/etc. para la principal — la oración entera ya es OCSubRel (nivel 4); una compuesta no se clasifica como simple aparte. El paréntesis del nivel 5 envuelve solo la subordinada.

AHORA REVISA:

ORACIÓN: "${state.tokens.join(' ')}"
TOKENS: ${JSON.stringify(state.tokens.map((t, i) => `${i}:${t}`))}

ANÁLISIS DEL ESTUDIANTE:
${JSON.stringify(annotated, null, 2)}

SUJETOS TÁCITOS QUE EL ESTUDIANTE HA MARCADO:
${JSON.stringify(state.tacitSubjects.map(t => ({ ámbito: t.scope || 'oración entera', texto: t.text })), null, 2)}

DEVUELVE EXCLUSIVAMENTE UN JSON (sin markdown, sin prosa fuera):
{
  "veredicto": "ok" | "con_errores",
  "resumen": "una frase corta",
  "revision": [
    { "id": <id>, "estado": "ok" | "incorrecta", "motivo": "breve, solo si incorrecta" }
  ],
  "faltantes": [
    { "from": <idx>, "to": <idx>, "nivel": <1-5>, "etiqueta": "<exacta de las válidas>", "motivo": "breve" }
  ]
}

- "estado": "ok" si la anotación cumple la convención.
- "faltantes": SOLO incluye lo que realmente falta según la convención. Si el análisis está completo, deja "faltantes" vacío y "veredicto":"ok".
- NO sugieras "SN - NS" para rangos que abarquen proposiciones enteras.
- NO sugieras nivel 2 para CD/CI/CC.
- Sé estricto. JSON válido.`;
}

/* Prompt para "Analizar con IA": la IA recibe solo la oración y
   devuelve un análisis completo. Si extraInstruction != "" se
   añade al final (se usa en el reintento cuando la IA usó etiquetas
   inválidas). */
function buildAnalysisPrompt(extraInstruction = '') {
  return `Eres un analizador sintáctico del español. Vas a analizar una oración siguiendo una convención específica del estudiante.

CONVENCIÓN ESTRICTA:

Nivel 1 (sintagma + función fusionados):
- Verbo → "SV - NP" (cubre SOLO el verbo, nunca sus complementos)
- Sujeto → "SN - NS" (UNA SOLA anotación que abarque el determinante + el núcleo + cualquier modificador adjetival, todo junto)
- Complementos → su función fusionada con el sintagma: "SN - CD", "SPrep - CCL", etc. CADA SN/SPrep abarca DET + NÚCLEO + ADYACENTES en un único rango.
- CD de persona con preposición "a" ("Saludé a Juan", "Conozco al chico") → "SPrep - CD" (NO "SN - CD"). Si el CD NO lleva preposición "a" → "SN - CD" ("Compré un libro").
- Nexo coordinante → "Nx"
- REGLA OBLIGATORIA: los determinantes (el, la, los, las, un, una, mi, este, ese...) y los adjetivos modificadores NO llevan etiqueta propia: van DENTRO del rango del sintagma al que pertenecen. NUNCA dejes un determinante sin cubrir.

Ejemplos concretos:
- "El niño come la manzana roja" → "El niño" SN-NS (0,1), "come" SV-NP (2,2), "la manzana roja" SN-CD (3,5).
- "Saludé a Juan" → "Saludé" SV-NP (0,0), "a Juan" SPrep-CD (1,2). NO marcar como SN-CD.
NO marques solo "niño" o solo "manzana" — incluye SIEMPRE su determinante y sus adjetivos.

Nivel 2 (funciones oracionales — solo tres etiquetas):
- "Sujeto" — UNA SOLA anotación que cubra TODO el sintagma del sujeto.
- "Predicado verbal" — UNA SOLA anotación que cubra el verbo + TODOS sus complementos juntos en un único rango.
- "Predicado nominal" — UNA SOLA anotación que cubra el verbo copulativo + atributo + complementos.
NUNCA dividas el Predicado o el Sujeto en varias anotaciones de una sola palabra. Si el predicado abarca tokens 0-3, devuelve UNA anotación con from=0,to=3, NO cuatro anotaciones de una palabra cada una.
Los complementos (CD, CI, CC, etc.) NO van en nivel 2.

Nivel 3 (TIPO de cada proposición — una por proposición, siempre):
Solo etiquetas OS·: "OSAT" Activa Transitiva, "OSAI" Activa Intransitiva, "OSImp" Impersonal, "OSCop" Copulativa, "OSP" Pasiva. "Nx" entre proposiciones cuando hay nexo. SOLO se etiqueta en COMPUESTAS (una por cada oración simple componente + Nx). En oraciones simples, el nivel 3 queda VACÍO (la clasificación va solo en nivel 4).

Nivel 4 (etiqueta global de la oración entera, una sola anotación):
- Si es simple: repite OSAT/OSAI/OSImp/OSCop/OSP según corresponda.
- Si es compuesta coordinada: "OCCoordinada Copulativa", "OCCoordinada Adversativa", "OCCoordinada Disyuntiva".
- Si es yuxtapuesta: "OCYuxtapuesta".
- Si es subordinada sustantiva (combina tipo + función): "OCSubSus-CD", "OCSubSus-Suj", "OCSubSus-CI", "OCSubSus-Atrib", "OCSubSus-CR", "OCSubSus-CN".
- Si es subordinada de relativo: "OCSubRel".

Nivel 5 (paréntesis de subordinada — SOLO en oraciones con subordinada):
- Marca el rango EXACTO de la subordinada (sustantiva o de relativo) con UNA anotación de nivel 5 cuya etiqueta sea el tipo: "Sub. Sustantiva CD", "Sub. Sustantiva Suj", "Sub. Sustantiva CI", "Sub. Sustantiva Atrib", "Sub. Sustantiva CR", "Sub. Sustantiva CN", "Sub. Relativa".
- IMPORTANTE: la subordinada conserva su análisis completo dentro (SN-NS, SV-NP, OS·…). El nivel 5 es UN ENVOLTORIO; no sustituye al análisis interno.
- IMPORTANTE: la oración principal NO lleva paréntesis. SOLO la subordinada incrustada los lleva.
- IMPORTANTE: el rango del nivel 5 incluye el nexo introductor ("que", "donde", "cuando", "quien", "cuyo"…) y todas las palabras de la subordinada.
- Por culpa del envoltorio de paréntesis, la PROPOSICIÓN PRINCIPAL no se fragmenta en nivel 3: marca UNA SOLA OS· para la principal cubriendo TODO su rango (incluido el rango ocupado por la subordinada por dentro).

Ejemplo concreto, "El libro que compré es interesante":
- Nivel 1: "El libro" SN-NS (0,1) | "que" Nx (2,2) | "compré" SV-NP (3,3) | "es" SV-NP (4,4) | "interesante" SAdj-Atrib. (5,5).
- Nivel 2: "El libro" Sujeto (0,1) | "compré" Predicado verbal (3,3) | "es interesante" Predicado nominal (4,5).
- Nivel 3 (clasif. de la subordinada): OSAT (2,3) — SOLO el rango de la relativa. NO marques nada para la principal aquí: la oración entera no es OSCop, es OCSubRel (eso ya va en nivel 4).
- Nivel 4 (etiqueta global): OCSubRel (0,5).
- Nivel 5 (paréntesis): "Sub. Relativa" (2,3).

TOKENIZACIÓN: los signos de puntuación (, . ; : ¿ ? ¡ !) son tokens SEPARADOS. Las comas NO van dentro del rango del verbo.

REGLA CRÍTICA SOBRE COMPUESTAS vs SIMPLES:
Una oración es compuesta SOLO si tiene más de un verbo conjugado en proposiciones distintas. Una conjunción coordinante (y, o, u, ni, pero...) NO implica oración compuesta por sí sola: puede coordinar elementos dentro de una misma proposición (sintagmas, complementos, etc.).

Ejemplos:
- "Quieres té o café" → SIMPLE. Hay un solo verbo ("quieres"). "o" coordina dos SN-CD ("té" y "café") dentro del mismo predicado. NO marcar dos OS· en nivel 3; la oración va solo en nivel 4 como OSAT.
- "Quieres té y yo quiero café" → COMPUESTA. Dos verbos en proposiciones distintas. Cada proposición se clasifica en nivel 3 (OSAT/OSAI/etc.) y el global en nivel 4 ("OCCoordinada Copulativa").
- "Canta y baila" → SIMPLE con núcleo verbal compuesto. Mismo sujeto omitido. NO clasificar como compuesta.
- "Llegué tarde porque había tráfico" → COMPUESTA (subordinada): dos verbos.

ETIQUETAS VÁLIDAS (USA EXCLUSIVAMENTE ESTAS, NO INVENTES OTRAS):
${JSON.stringify(validLabelsByLevel(), null, 2)}

EJEMPLO 1, "Manuel estudia y Pablo escucha música" (coordinada copulativa):
{
  "annotations": [
    {"from":0,"to":0,"level":1,"label":"SN - NS"},
    {"from":1,"to":1,"level":1,"label":"SV - NP"},
    {"from":2,"to":2,"level":1,"label":"Nx"},
    {"from":3,"to":3,"level":1,"label":"SN - NS"},
    {"from":4,"to":4,"level":1,"label":"SV - NP"},
    {"from":5,"to":5,"level":1,"label":"SN - CD"},
    {"from":0,"to":0,"level":2,"label":"Sujeto"},
    {"from":1,"to":1,"level":2,"label":"Predicado verbal"},
    {"from":3,"to":3,"level":2,"label":"Sujeto"},
    {"from":4,"to":5,"level":2,"label":"Predicado verbal"},
    {"from":0,"to":1,"level":3,"label":"OSAI"},
    {"from":2,"to":2,"level":3,"label":"Nx"},
    {"from":3,"to":5,"level":3,"label":"OSAT"},
    {"from":0,"to":5,"level":4,"label":"OCCoordinada Copulativa"}
  ],
  "tacitSubjects": []
}
Nota: en coordinadas/yuxtapuestas NO hay paréntesis (nivel 5 vacío).

EJEMPLO 2, "Llegaré mañana" (simple, sujeto tácito 'yo'):
{
  "annotations": [
    {"from":0,"to":0,"level":1,"label":"SV - NP"},
    {"from":1,"to":1,"level":1,"label":"SAdv - CCM"},
    {"from":0,"to":1,"level":2,"label":"Predicado verbal"},
    {"from":0,"to":1,"level":4,"label":"OSAI"}
  ],
  "tacitSubjects": [
    {"scope":"","text":"yo"}
  ]
}
Nota del ejemplo 2: NO hay SN-NS porque no hay sujeto explícito. NO hay "Sujeto" en nivel 2. El sujeto va únicamente en "tacitSubjects". NO hay nivel 3 porque es simple. La etiqueta global de la oración va en nivel 4.

EJEMPLO 3, "El libro que compré es interesante" (subordinada de relativo):
{
  "annotations": [
    {"from":0,"to":1,"level":1,"label":"SN - NS"},
    {"from":2,"to":2,"level":1,"label":"Nx"},
    {"from":3,"to":3,"level":1,"label":"SV - NP"},
    {"from":4,"to":4,"level":1,"label":"SV - NP"},
    {"from":5,"to":5,"level":1,"label":"SAdj - Atrib."},
    {"from":0,"to":1,"level":2,"label":"Sujeto"},
    {"from":3,"to":3,"level":2,"label":"Predicado verbal"},
    {"from":4,"to":5,"level":2,"label":"Predicado nominal"},
    {"from":2,"to":3,"level":3,"label":"OSAT"},
    {"from":0,"to":5,"level":4,"label":"OCSubRel"},
    {"from":2,"to":3,"level":5,"label":"Sub. Relativa"}
  ],
  "tacitSubjects": [{"scope":"sub","text":"yo"}]
}
Nota del ejemplo 3: en nivel 3 SOLO está la OS· de la subordinada (OSAT, rango 2,3). NO hay OS· para la principal — la oración entera no es OSCop, es OCSubRel (eso ya va en nivel 4). El paréntesis del nivel 5 envuelve solo la subordinada.

ORACIÓN A ANALIZAR: "${state.tokens.join(' ')}"
TOKENS (índice : palabra): ${JSON.stringify(state.tokens.map((t, i) => `${i}:${t}`))}

${extraInstruction}

DEVUELVE EXCLUSIVAMENTE UN JSON con este esquema (sin markdown, sin prosa fuera):
{
  "annotations": [
    { "from": <idx>, "to": <idx>, "level": <1-5>, "label": "<una de las válidas>" }
  ],
  "tacitSubjects": [
    { "scope": "" | "P1" | "P2" | "P3" | "sub", "text": "él" }
  ]
}

Reglas:
- "from" y "to" son índices de tokens (inclusivos por ambos extremos).
- Cada anotación debe usar una etiqueta EXACTA de la lista de válidas. NO inventes etiquetas.
- Cubre los niveles necesarios. NO te saltes el nivel 4 (etiqueta global). En oraciones simples NO pongas nivel 3.
- OBLIGATORIO: si una proposición tiene un verbo conjugado pero NINGÚN SN-NS explícito en su rango, debes añadir un sujeto tácito en "tacitSubjects" deduciéndolo de la desinencia verbal (yo/tú/él/ella/nosotros/vosotros/ellos…). En ese caso NO inventes un SN-NS ni un "Sujeto" de nivel 2; el sujeto va SOLO en tacitSubjects.
- Para oraciones simples con sujeto tácito usa "scope": "" (toda la oración). Para compuestas, "scope" puede ser una etiqueta libre que identifique la proposición (p. ej. el rango o el primer verbo). Si dudas, usa "" y se aplica a la oración entera.
- Si NO hay sujetos tácitos, deja "tacitSubjects" como [].
- JSON válido. Nada más.`;
}
