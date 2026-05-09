/* ============================================================
   AÑADIR / DESHACER ANOTACIONES Y SUJETOS TÁCITOS
   ------------------------------------------------------------
   Funciones que mutan state.annotations o state.tacitSubjects.
   Cada operación llama a render() al final para repintar.
     - addAnnotation(label, color) → la usa el grid de etiquetas
     - undoLastAnnotation()        → botón "Borrar última"
     - addTacit()                  → botón "Añadir" del bloque
                                     "Sujeto tácito"
     - colorForLabel(level, label) → busca el color de una etiqueta
       por nombre. Útil para reconstruir anotaciones que vienen de
       JSON o de la IA (sin color asociado).
     - validLabelsByLevel(),
       validLabelSetByLevel()      → utilidades para validar
       respuestas de IA contra LEVELS.
   ============================================================ */

/* `kind` es opcional. Si la etiqueta del nivel lo trae (p.ej. los
   paréntesis de subordinada con kind:'paren'), se persiste en la
   anotación para que renderParens() la reconozca. Si no, queda
   undefined y se dibuja como una línea horizontal normal. */
function addAnnotation(label, color, kind) {
  if (state.selection.from === null) {
    alert('Selecciona primero una o más palabras (clic, y shift+clic para extender).');
    return;
  }
  const from = Math.min(state.selection.from, state.selection.to);
  const to = Math.max(state.selection.from, state.selection.to);
  const ann = {
    id: Date.now() + Math.random(),
    from, to,
    level: state.currentLevel,
    label, color,
  };
  if (kind) ann.kind = kind;
  state.annotations.push(ann);
  // Cualquier cambio invalida la última revisión de IA, así no quedan
  // marcas rojas obsoletas.
  state.aiReview = null;
  render();
}

function undoLastAnnotation() {
  if (!state.annotations.length) return;
  state.annotations.pop();
  state.aiReview = null;
  render();
}

function addTacit() {
  const text = document.getElementById('tacitText').value.trim();
  if (!text) return;
  const scope = document.getElementById('tacitScope').value;
  state.tacitSubjects.push({
    id: Date.now() + Math.random(),
    scope, text,
  });
  document.getElementById('tacitText').value = '';
  render();
}

/* Devuelve el color asociado a una etiqueta concreta de un nivel,
   o '#111' si no la encuentra. Se usa al cargar análisis pre-hechos
   o respuestas de IA, donde solo viene el texto de la etiqueta. */
function colorForLabel(level, label) {
  const L = LEVELS.find(x => x.n === level);
  if (!L) return '#111';
  const found = L.labels.find(x => x.text === label);
  return found ? found.color : '#111';
}

/* Igual que colorForLabel pero devuelve el `kind` (o undefined).
   Lo necesita la carga desde JSON / IA: si la etiqueta original
   trae kind:'paren', la anotación reconstruida también debe
   llevarlo para que se dibuje como paréntesis y no como línea. */
function kindForLabel(level, label) {
  const L = LEVELS.find(x => x.n === level);
  if (!L) return undefined;
  const found = L.labels.find(x => x.text === label);
  return found ? found.kind : undefined;
}

/* { 1: ["SN - NS", "SV - NP", ...], 2: [...], ... }
   Se inyecta en los prompts para que la IA sepa qué etiquetas son válidas. */
function validLabelsByLevel() {
  const out = {};
  LEVELS.forEach(L => { out[L.n] = L.labels.map(x => x.text); });
  return out;
}

/* Igual que validLabelsByLevel pero con Sets (búsqueda O(1)).
   Se usa para validar respuestas de IA. */
function validLabelSetByLevel() {
  const map = {};
  LEVELS.forEach(L => { map[L.n] = new Set(L.labels.map(x => x.text)); });
  return map;
}
