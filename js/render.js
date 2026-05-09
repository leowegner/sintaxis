/* ============================================================
   RENDERIZADO DE LA UI
   ------------------------------------------------------------
   Cada función pinta una zona concreta:
     - renderTokens()           → la fila de palabras (clic = seleccionar)
     - renderLines()            → las líneas SVG de las anotaciones
     - renderLabelPicker()      → tabs de niveles + grid de etiquetas
     - renderTacit()            → "chips" de sujetos tácitos
     - renderSelectionActions() → botón Extender + texto informativo
     - tokenPositions()         → util geométrico (posición x de cada palabra)
     - toggleExtend()           → handler del botón "+ Extender"
   El orquestador render() vive en state.js y llama a todas estas.
   ============================================================ */

/* Pinta el botón "Extender" y el texto que dice qué está
   seleccionado en este momento. */
function renderSelectionActions() {
  const btn = document.getElementById('extendBtn');
  if (btn) btn.classList.toggle('active', !!state.extendNext);
  const info = document.getElementById('selectionInfo');
  if (!info) return;
  if (state.selection.from === null) {
    info.textContent = state.extendNext ? 'Toca la primera palabra del rango.' : '';
  } else {
    const from = Math.min(state.selection.from, state.selection.to);
    const to = Math.max(state.selection.from, state.selection.to);
    const txt = state.tokens.slice(from, to + 1).join(' ');
    info.textContent = state.extendNext
      ? `Selección: "${txt}". Toca otra palabra para extender.`
      : `Selección: "${txt}".`;
  }
}

function toggleExtend() {
  state.extendNext = !state.extendNext;
  render();
}

/* Pinta los chips de sujetos tácitos con su botón × para borrar. */
function renderTacit() {
  const list = document.getElementById('tacitList');
  list.innerHTML = '';
  state.tacitSubjects.forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'tacit-chip';
    const scope = t.scope ? `<span class="scope">(${t.scope})</span>` : '';
    chip.innerHTML = `Sujeto tácito${scope}: ${escapeHTML(t.text)} <button title="Quitar" data-id="${t.id}">×</button>`;
    chip.querySelector('button').onclick = () => {
      state.tacitSubjects = state.tacitSubjects.filter(x => x.id !== t.id);
      render();
    };
    list.appendChild(chip);
  });
}

/* Pinta cada palabra como un <span class="token"> clicable.
   Lógica de selección:
     - Tap normal → nueva selección puntual (from = to = i).
     - Shift+clic o "Extender" activo → mueve "to" a la palabra
       tocada, manteniendo "from".
*/
function renderTokens() {
  const row = document.getElementById('sentenceRow');
  row.innerHTML = '';

  // Para que los paréntesis grandes de subordinadas (kind:'paren')
  // no se monten sobre las palabras vecinas, separamos en pantalla
  // los tokens-frontera. Recolectamos cuánto padding extra necesita
  // cada token (en píxeles) por la izquierda o por la derecha.
  // - Token "from" del rango: padding-left para meter `(` a su izquierda.
  // - Token "to" del rango: padding-right para meter `)` a su derecha.
  // Si dos paréntesis caen sobre el mismo token, nos quedamos con el
  // padding mayor (Math.max).
  const PAREN_GAP = 32;  // anchura aproximada del glifo `(` o `)` a 80px
  const padL = {}, padR = {};
  state.annotations.forEach(a => {
    if (a.kind !== 'paren') return;
    padL[a.from] = Math.max(padL[a.from] || 0, PAREN_GAP);
    padR[a.to]   = Math.max(padR[a.to]   || 0, PAREN_GAP);
  });

  state.tokens.forEach((tok, i) => {
    const span = document.createElement('span');
    span.className = 'token';
    span.textContent = tok;
    span.dataset.idx = i;
    if (padL[i]) span.style.marginLeft  = padL[i] + 'px';
    if (padR[i]) span.style.marginRight = padR[i] + 'px';
    if (state.selection.from !== null
        && i >= Math.min(state.selection.from, state.selection.to)
        && i <= Math.max(state.selection.from, state.selection.to)) {
      span.classList.add('selected');
    }
    span.onclick = (e) => {
      const hasSel = state.selection.from !== null;
      if ((e.shiftKey || state.extendNext) && hasSel) {
        state.selection.to = i;
        state.extendNext = false;
      } else {
        state.selection.from = i;
        state.selection.to = i;
      }
      render();
    };
    row.appendChild(span);
  });
}

/* Mide la posición x (izquierda, derecha y centro) de cada token
   relativa al canvas SVG. Se usa para dibujar las líneas. */
function tokenPositions() {
  const row = document.getElementById('sentenceRow');
  const rowRect = row.getBoundingClientRect();
  const positions = [];
  row.querySelectorAll('.token').forEach((el) => {
    const r = el.getBoundingClientRect();
    positions.push({
      left: r.left - rowRect.left,
      right: r.right - rowRect.left,
      center: r.left - rowRect.left + r.width / 2,
    });
  });
  return positions;
}

/* Pinta las líneas de las anotaciones en el SVG.
   Estructura visual: cada nivel ocupa una fila vertical, y dentro
   de la fila cada anotación es una línea horizontal con etiqueta
   centrada. Si la IA marcó la anotación como incorrecta, se dibuja
   en rojo y discontinua. */
function renderLines() {
  const svg = document.getElementById('svg');
  svg.innerHTML = '';
  const positions = tokenPositions();
  if (!positions.length) return;

  // Margen lateral para que los labels que sobresalen del rango
  // (p. ej. "Predicado verbal" en un rango corto) no se corten.
  const SIDE_PAD = 80;
  const totalWidth = Math.max(...positions.map(p => p.right)) + SIDE_PAD;
  svg.setAttribute('width', totalWidth);

  const LEVEL_HEIGHT = 36;
  const TOP_PAD = 8;
  // Las anotaciones con kind:'paren' viven sobre la fila de palabras
  // (no en filas SVG), así que las excluimos del cálculo de altura.
  const flatAnns = state.annotations.filter(a => a.kind !== 'paren');

  // Compactamos las filas: si solo se usan los niveles 1, 3 y 5, los
  // dibujamos en filas 0, 1, 2 (sin huecos). Mantenemos el orden
  // semántico (más interno = más cerca de la oración) ordenando los
  // niveles usados de menor a mayor.
  const usedLevels = [...new Set(flatAnns.map(a => a.level))].sort((a, b) => a - b);
  const rowOf = Object.fromEntries(usedLevels.map((lvl, i) => [lvl, i]));
  const rowCount = Math.max(1, usedLevels.length);
  svg.setAttribute('height', TOP_PAD + rowCount * LEVEL_HEIGHT + 20);

  // Anotaciones marcadas como incorrectas por la IA, para pintarlas en rojo.
  const wrongIds = new Set(
    (state.aiReview && state.aiReview.revision || [])
      .filter(r => r.estado === 'incorrecta')
      .map(r => r.id)
  );

  state.annotations.forEach((a, idx) => {
    if (a.kind === 'paren') return;  // se dibujan en renderParens(), no aquí
    const x1 = positions[a.from].left;
    const x2 = positions[a.to].right;
    const y = TOP_PAD + rowOf[a.level] * LEVEL_HEIGHT + 12;
    const isWrong = wrongIds.has(idx);
    const strokeColor = isWrong ? '#dc2626' : a.color;
    const textColor = isWrong ? '#dc2626' : a.color;

    // Grupo clicable (toda la línea + etiqueta) para borrar la anotación.
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('level-line');
    g.setAttribute('data-id', a.id);
    g.onclick = () => {
      if (confirm('¿Borrar esta anotación: "' + a.label + '"?')) {
        state.annotations = state.annotations.filter(x => x.id !== a.id);
        render();
      }
    };

    // Fondo invisible (solo se ilumina al hover) para hacer la zona clicable más amplia.
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', x1);
    bg.setAttribute('y', y - 12);
    bg.setAttribute('width', x2 - x1);
    bg.setAttribute('height', 28);
    bg.setAttribute('fill', a.color);
    bg.setAttribute('opacity', 0);
    bg.classList.add('line-bg');
    g.appendChild(bg);

    // Línea horizontal.
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', strokeColor);
    line.setAttribute('stroke-width', 2);
    if (isWrong) line.setAttribute('stroke-dasharray', '4 3');
    g.appendChild(line);

    // Etiqueta centrada bajo la línea.
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', (x1 + x2) / 2);
    text.setAttribute('y', y + 16);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', textColor);
    text.setAttribute('font-size', '13');
    text.setAttribute('font-weight', '600');
    text.textContent = a.label;
    g.appendChild(text);

    svg.appendChild(g);
  });
}

/* Pinta los tabs de niveles y el grid de etiquetas del nivel activo. */
function renderLabelPicker() {
  const tabs = document.getElementById('levelTabs');
  tabs.innerHTML = '';
  LEVELS.forEach(L => {
    const b = document.createElement('button');
    b.textContent = `Nivel ${L.n}: ${L.name}`;
    if (L.n === state.currentLevel) b.classList.add('active');
    b.onclick = () => { state.currentLevel = L.n; renderLabelPicker(); };
    tabs.appendChild(b);
  });

  const grid = document.getElementById('labelGrid');
  grid.innerHTML = '';
  const level = LEVELS.find(L => L.n === state.currentLevel);
  level.labels.forEach(lbl => {
    const b = document.createElement('button');
    b.className = 'label-btn';
    b.innerHTML = `<span class="swatch" style="background:${lbl.color}"></span>${lbl.text}`;
    // Pasamos el `kind` (si lo tiene, p.ej. 'paren') para que addAnnotation
    // sepa que es una anotación especial (paréntesis de subordinada).
    b.onclick = () => addAnnotation(lbl.text, lbl.color, lbl.kind);
    grid.appendChild(b);
  });
}

/* ----------- PARÉNTESIS GRANDES DE SUBORDINADAS -----------
   Se dibujan sobre la fila de palabras (#sentenceRow), no en
   las filas SVG de niveles. Cada anotación con kind:'paren' se
   convierte en dos glifos `(` `)` enormes (font-size grande,
   peso fino) a la izquierda y derecha del rango. El SVG es
   absoluto sobre .sentence-wrap; sus dimensiones se ajustan
   a la altura de la fila de palabras. */
function renderParens() {
  const svg = document.getElementById('parenSvg');
  if (!svg) return;
  svg.innerHTML = '';

  const wrap = svg.parentElement;            // .sentence-wrap
  const row = document.getElementById('sentenceRow');
  if (!row) return;

  // Tamaño del SVG = tamaño del wrap (cubre la fila de palabras).
  const wrapRect = wrap.getBoundingClientRect();
  const W = wrapRect.width;
  const H = wrapRect.height;
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const positions = tokenPositions();
  if (!positions.length) return;

  // Centro vertical de la fila de palabras (mismo sistema de
  // coordenadas que el wrap, así que vale row.offsetTop+row.height/2).
  const yMid = row.offsetTop + row.offsetHeight / 2;

  // Glifo grande: lo bastante alto para "abrazar" la palabra
  // por arriba y por abajo. Ajusta PAREN_SIZE para hacerlos más
  // o menos grandes.
  const PAREN_SIZE = 80;
  const PAREN_PAD = 4;   // separación pequeña: el espacio amplio ya
                          // viene del margin extra que renderTokens añadió
                          // a los tokens-frontera del rango.

  const wrongIds = new Set(
    (state.aiReview && state.aiReview.revision || [])
      .filter(r => r.estado === 'incorrecta')
      .map(r => r.id)
  );

  state.annotations.forEach((a, idx) => {
    if (a.kind !== 'paren') return;
    if (a.from < 0 || a.to >= positions.length) return;

    const xL = positions[a.from].left  - PAREN_PAD;
    const xR = positions[a.to].right   + PAREN_PAD;
    const isWrong = wrongIds.has(idx);
    const fill = isWrong ? '#dc2626' : (a.color || '#444');

    const drawGlyph = (x, ch, anchor) => {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', yMid);
      t.setAttribute('text-anchor', anchor);
      t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('font-size', PAREN_SIZE);
      t.setAttribute('font-weight', '300');
      t.setAttribute('font-family', 'Georgia, "Times New Roman", serif');
      t.setAttribute('fill', fill);
      t.classList.add('paren-glyph');
      t.textContent = ch;
      // Borrar la anotación al hacer clic en cualquiera de los dos paréntesis.
      t.onclick = () => {
        if (confirm(`¿Quitar paréntesis de "${a.label}"?`)) {
          state.annotations = state.annotations.filter(x => x.id !== a.id);
          render();
        }
      };
      // Tooltip con el tipo concreto de subordinada.
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = a.label;
      t.appendChild(title);
      svg.appendChild(t);
    };

    drawGlyph(xL, '(', 'end');
    drawGlyph(xR, ')', 'start');
  });
}
