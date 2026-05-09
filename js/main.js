/* ============================================================
   PUNTO DE ENTRADA / ARRANQUE
   ------------------------------------------------------------
   Se ejecuta al final, cuando todos los demás scripts ya
   declararon sus funciones. Hace tres cosas:
     1. Rellena el desplegable "Ejemplos ▾" con EXAMPLES.
     2. Pinta la oración inicial (la del input por defecto).
     3. Inicializa el desplegable de modelos de IA, listeners
        de cambio de provider/modelo, y el contador de coste.
     4. Repinta las líneas SVG cuando se redimensiona la ventana.

   pickExample() y randomExample() también viven aquí porque
   son handlers de la barra superior que solo tocan ese bloque.
   ============================================================ */

/* Rellena el <select> de "Ejemplos ▾" con los grupos de EXAMPLES. */
function fillExamplesPicker() {
  const sel = document.getElementById('examplePicker');
  EXAMPLES.forEach(g => {
    const og = document.createElement('optgroup');
    og.label = g.group;
    g.items.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
}

/* Cuando el usuario elige una opción del desplegable. */
function pickExample(sentence) {
  if (!sentence) return;
  document.getElementById('sentenceInput').value = sentence;
  loadSentence();
  document.getElementById('examplePicker').value = '';
}

/* Botón 🎲: elige una oración al azar de cualquier grupo. */
function randomExample() {
  const all = EXAMPLES.flatMap(g => g.items);
  const pick = all[Math.floor(Math.random() * all.length)];
  document.getElementById('sentenceInput').value = pick;
  loadSentence();
}

/* ---------- INIT --------------------------------------------- */

// Listeners del panel de IA (provider + modelo).
document.getElementById('aiProvider').onchange = refreshModelSelect;
document.getElementById('aiModel').onchange = () => {
  const provider = document.getElementById('aiProvider').value;
  localStorage.setItem('sintaxis_model_' + provider, document.getElementById('aiModel').value);
};

// Pinta el desplegable de modelos con los valores guardados.
refreshModelSelect();

fillExamplesPicker();
loadSentence();
updateCostUI();

// Las posiciones de los tokens cambian al redimensionar la ventana,
// así que repintamos las líneas y los paréntesis para que sigan alineados.
window.addEventListener('resize', () => { renderLines(); renderParens(); });
