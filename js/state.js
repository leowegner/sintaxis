/* ============================================================
   ESTADO GLOBAL Y FUNCIONES BÁSICAS
   ------------------------------------------------------------
   Contiene:
     - state: el objeto único con TODO el estado de la aplicación
       (tokens, anotaciones, sujetos tácitos, selección actual…).
     - tokenize(): separa la oración en tokens (palabras + signos).
     - loadSentence(), clearAll(): operaciones que reinician el
       análisis pero dejan la oración cargada.
     - render(): orquesta el repintado completo (delegado a
       render.js).
     - escapeHTML(): util compartido para inyectar texto seguro
       en HTML.

   El estado vive en una sola variable global `state` para que
   sea fácil de inspeccionar desde la consola del navegador.
   ============================================================ */

let state = {
  tokens: [],          // palabras + signos: ["Manuel", "estudia"]
  annotations: [],     // [{ id, from, to, level, label, color }]
  tacitSubjects: [],   // [{ id, scope: "" | "P1" | "P2" | ..., text }]
  selection: { from: null, to: null },
  extendNext: false,   // si true, el siguiente tap extiende el rango (modo táctil)
  currentLevel: 1,     // qué pestaña de niveles está activa en el picker
  aiReview: null,      // resultado de la última revisión de IA, si la hay
};

/* Separa los signos de puntuación como tokens propios.
   Ej.: "Llegué, vi, vencí" → ["Llegué", ",", "vi", ",", "vencí"]
   Importante: los signos quedan como tokens independientes para que
   las comas NO formen parte del rango del verbo. */
function tokenize(text) {
  return text
    .replace(/([¿¡])/g, ' $1 ')
    .replace(/([?!.,;:])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean);
}

/* Carga la oración del input y resetea TODO el análisis. */
function loadSentence() {
  const text = document.getElementById('sentenceInput').value.trim();
  state.tokens = tokenize(text);
  state.annotations = [];
  state.tacitSubjects = [];
  state.selection = { from: null, to: null };
  state.aiReview = null;
  render();
}

/* Borra solo el análisis (no la oración). */
function clearAll() {
  if (!confirm('¿Borrar todo el análisis?')) return;
  state.annotations = [];
  state.tacitSubjects = [];
  state.selection = { from: null, to: null };
  state.aiReview = null;
  render();
}

/* Repinta TODO. El reparto de subtareas vive en render.js. */
function render() {
  renderTokens();
  renderParens();    // paréntesis grandes de subordinadas (sobre la fila de palabras)
  renderLines();     // líneas horizontales de niveles 1-4
  renderLabelPicker();
  renderTacit();
  renderSelectionActions();
}

/* Util compartido: escapa caracteres HTML para insertar texto sin
   riesgo de que se interprete como markup. */
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
