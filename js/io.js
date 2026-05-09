/* ============================================================
   IMPORTAR / EXPORTAR ANÁLISIS
   ------------------------------------------------------------
   - exportJSON()  → descarga el análisis como .json
   - importJSON()  → abre un selector de archivo y lo carga
   - exportPNG()   → captura el lienzo entero como imagen
                     (usa html2canvas, cargado vía CDN en index.html)
   - exportSVG()   → reconstruye un SVG autocontenido (palabras +
                     líneas + sujetos tácitos) y lo descarga
   - filenameSafe() → genera un nombre de archivo a partir de las
                     primeras palabras de la oración
   - escapeXML()    → util para escapar texto dentro del SVG
   Para añadir un formato nuevo (p. ej. PDF, copiar al portapapeles),
   añade aquí una función y enchúfala en el menú "Más ⋯" del
   index.html.
   ============================================================ */

function exportJSON() {
  const data = {
    sentence: state.tokens.join(' '),
    tokens: state.tokens,
    annotations: state.annotations,
    tacitSubjects: state.tacitSubjects,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'analisis.json'; a.click();
  URL.revokeObjectURL(url);
}

function importJSON() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = ev => {
      const data = JSON.parse(ev.target.result);
      state.tokens = data.tokens;
      state.annotations = data.annotations || [];
      state.tacitSubjects = data.tacitSubjects || [];
      document.getElementById('sentenceInput').value = data.sentence || data.tokens.join(' ');
      render();
    };
    reader.readAsText(file);
  };
  input.click();
}

/* Genera un nombre de fichero seguro a partir de las primeras 4 palabras. */
function filenameSafe() {
  const slug = state.tokens.slice(0, 4).join('-')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita acentos
    .replace(/[^a-z0-9-]/g, '');
  return 'analisis-' + (slug || 'oracion');
}

async function exportPNG() {
  if (typeof html2canvas === 'undefined') {
    alert('La librería de exportación aún no se ha cargado, espera un momento.');
    return;
  }
  const canvasEl = document.getElementById('canvas');
  // Quitar la selección amarilla temporalmente para que no salga en la imagen.
  const prevSel = state.selection;
  state.selection = { from: null, to: null };
  render();
  try {
    const canvas = await html2canvas(canvasEl, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
    });
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filenameSafe() + '.png'; a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } finally {
    state.selection = prevSel;
    render();
  }
}

/* Reconstruye un SVG autocontenido (palabras como <text> + líneas
   del SVG existente + lista de sujetos tácitos abajo). */
function exportSVG() {
  const positions = tokenPositions();
  if (!positions.length) return;
  const svgInner = document.getElementById('svg');
  const linesHeight = parseInt(svgInner.getAttribute('height') || '200', 10);
  const totalWidth = Math.max(...positions.map(p => p.right)) + 24;
  const wordsHeight = 50;
  const totalHeight = wordsHeight + linesHeight + 16;

  const tokens = state.tokens.map((t, i) => {
    const cx = positions[i].center;
    return `<text x="${cx}" y="32" text-anchor="middle" font-size="22" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#222">${escapeXML(t)}</text>`;
  }).join('');

  const linesSvg = svgInner.innerHTML;

  const tacitLines = state.tacitSubjects.map((t, i) => {
    const scope = t.scope ? ` (${t.scope})` : '';
    return `<text x="${totalWidth/2}" y="${linesHeight + 24 + i * 18}" text-anchor="middle" font-size="13" font-family="-apple-system, sans-serif" fill="#555">Sujeto tácito${escapeXML(scope)}: ${escapeXML(t.text)}</text>`;
  }).join('');
  const tacitHeight = state.tacitSubjects.length * 18 + (state.tacitSubjects.length ? 16 : 0);
  const finalHeight = totalHeight + tacitHeight;

  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${finalHeight}" viewBox="0 0 ${totalWidth} ${finalHeight}">
  <rect width="100%" height="100%" fill="white"/>
  <g transform="translate(0,0)">${tokens}</g>
  <g transform="translate(0,${wordsHeight})" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${linesSvg}${tacitLines}</g>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filenameSafe() + '.svg'; a.click();
  URL.revokeObjectURL(url);
}

function escapeXML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
  }[c]));
}
