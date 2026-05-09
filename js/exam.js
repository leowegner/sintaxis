/* ============================================================
   GENERADOR DE EXAMEN IMPRIMIBLE
   ------------------------------------------------------------
   Abre una ventana nueva con un examen listo para imprimir o
   guardar como PDF (Ctrl+P / Cmd+P → "Guardar como PDF"):
     - 10 oraciones elegidas al azar de EXAMPLES.
     - 5 por página (salto de página automático).
     - Mucho espacio en blanco debajo de cada oración para
       analizar a mano.
     - Pie de página con el enlace a la web.

   PARA CAMBIAR LA URL DE LA WEB: edita la constante EXAM_LINK_URL
   más abajo. Cuando publiques en GitHub Pages, pon ahí la URL
   real (p.ej. "https://tuusuario.github.io/sintaxis/").
   ============================================================ */

const EXAM_LINK_URL = "https://leowegner.github.io/sintaxis/"; // ← CAMBIA ESTO si tu URL es otra
const EXAM_SENTENCE_COUNT = 10;
const EXAM_PER_PAGE = 5;

function pickRandomSentences(n, excluded) {
  // Aplana EXAMPLES y elige n al azar sin repetir, EXCLUYENDO las
  // que aparezcan en `excluded` (lista de strings). Si tras excluir
  // queda menos de n disponibles, devuelve las que pueda (el banco
  // tiene ~99 → con 10 excluidas siempre quedan 89 para elegir).
  const all = EXAMPLES.flatMap(g => g.items);
  const exclSet = new Set(excluded || []);
  const pool = all.filter(s => !exclSet.has(s));
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/* exportExam() abre la ventana del examen.
   - `excluded` (opcional): array de oraciones que NO deben salir
     (las que ya salieron en el examen anterior). Lo usa el botón
     "🎲 Otras 10 al azar" del propio examen para regenerarse sin
     repetir lo que el alumno acaba de ver. */
function exportExam(excluded) {
  const sentences = pickRandomSentences(EXAM_SENTENCE_COUNT, excluded);

  // Construye el HTML del examen como string. Cada oración va en
  // una "caja" con borde y mucho padding inferior para que el
  // alumno pueda escribir el análisis. El salto de página se
  // fuerza con la clase .page-break después de cada bloque de 5.
  const items = sentences.map((s, i) => {
    const num = i + 1;
    // El primer ejercicio de cada página (excepto la primera) lleva
    // .force-page-2 para forzar el salto de página exactamente ahí.
    // Así la distribución es estable: 5 por página, sin viudas.
    const isPageStart = num > 1 && (num - 1) % EXAM_PER_PAGE === 0;
    const cls = isPageStart ? ' force-page-2' : '';
    return `<div class="exercise${cls}">
      <div class="exercise-head"><span class="num">${num}.</span> <span class="sentence">${escapeHTMLForExam(s)}</span></div>
    </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Examen de análisis sintáctico</title>
<style>
  @page { size: A4; margin: 18mm 16mm 22mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #111;
    margin: 0;
    line-height: 1.4;
  }
  .header {
    display: flex; justify-content: space-between; align-items: baseline;
    border-bottom: 1.5px solid #111;
    padding-bottom: 4px;
    margin-bottom: 6mm;
  }
  .header h1 { font-size: 16px; margin: 0; }

  /* Datos del alumno + ejercicio 1 en la misma "fila lógica" para
     ahorrar espacio vertical. El campo Nombre/Curso ocupa una línea. */
  .student {
    display: flex; gap: 18px;
    margin-bottom: 5mm;
    font-size: 12px;
  }
  .student .field { flex: 1; }
  .student .label { font-weight: bold; margin-right: 4px; }
  .student .line {
    display: inline-block;
    border-bottom: 1px solid #888;
    width: 75%;
    height: 14px;
  }

  /* La caja envuelve número + oración + espacio para analizar,
     todo en un único marco. Así el alumno puede dibujar las
     líneas del análisis DIRECTAMENTE sobre la oración.
     Cálculo: 5 cajas × (40mm caja + 3mm margen) = 215mm; cabecera
     + datos del alumno ≈ 16mm; total ≈ 231mm. Altura útil A4
     ~257mm → ~26mm de holgura sobre el footer (que vive en los
     últimos 22mm reservados de @page). */
  .exercise {
    border: 1px solid #bbb;
    border-radius: 4px;
    padding: 6mm 8mm 0 8mm;
    margin-bottom: 3mm;
    height: 40mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* Respaldo: forzar inicio de página 2 en el ejercicio 6.
     Si los cálculos de altura fallaran (p.ej. tipografía distinta),
     este break-before garantiza la distribución 5+5. */
  .force-page-2 {
    page-break-before: always;
    break-before: page;
  }
  .exercise-head {
    font-size: 16px;
    font-weight: bold;
    /* Espacio entre la oración y el borde inferior para que el
       alumno pueda escribir niveles debajo de las palabras sin
       chafarse contra el marco. */
    padding-bottom: 24mm;
    line-height: 1.6;
  }
  .exercise-head .num {
    display: inline-block;
    min-width: 28px;
    color: #555;
  }
  .exercise-head .sentence { color: #111; }

  .footer {
    position: fixed;
    bottom: 0;
    left: 0; right: 0;
    text-align: center;
    font-size: 10px;
    color: #666;
    border-top: 1px solid #ddd;
    padding: 3mm 16mm 4mm;
    background: white;
    /* z-index alto para que quede por encima de cualquier caja
       que llegue hasta el final de la página por error de cálculo. */
    z-index: 100;
  }
  .footer a { color: #2563eb; text-decoration: none; }

  /* Botones solo visibles en pantalla (no se imprimen). */
  .toolbar {
    background: #f3f4f6;
    padding: 10px 16mm;
    border-bottom: 1px solid #ddd;
    font-family: -apple-system, sans-serif;
    font-size: 13px;
  }
  .toolbar button {
    padding: 6px 12px;
    font-size: 13px;
    border: 1px solid #ccc;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 6px;
  }
  .toolbar button.primary {
    background: #2563eb; color: white; border-color: #2563eb;
  }
  .toolbar .tip {
    margin-top: 8px;
    color: #555;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    line-height: 1.5;
  }
  @media print {
    .toolbar { display: none; }
    body { padding: 0; }
    .footer { position: fixed; }
  }
  @media screen {
    body { padding: 0; }
    .sheet { padding: 18mm 16mm 22mm; max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 0 8px rgba(0,0,0,0.1); }
    body { background: #e5e5e5; padding-bottom: 22mm; }
  }
</style>
</head>
<body>

<script>
  // Las oraciones de ESTE examen, embebidas para que el botón
  // "🎲 Otras 10" pueda decirle al examen siguiente que las excluya
  // y así el alumno reciba 10 distintas a las de este examen.
  window.__EXAM_SENTENCES__ = ${JSON.stringify(sentences)};

  // Maneja el botón "Otras 10 al azar":
  // 1. Llama a exportExam() en la ventana padre pasándole las
  //    oraciones actuales como excluidas (genera otro examen).
  // 2. Cierra esta ventana.
  function regenerateExam() {
    if (window.opener && window.opener.exportExam) {
      window.opener.exportExam(window.__EXAM_SENTENCES__);
      window.close();
    } else {
      alert('No se puede regenerar: la página principal está cerrada.');
    }
  }
</script>

<div class="toolbar">
  <button class="primary" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
  <button onclick="regenerateExam()">🎲 Otras 10 al azar</button>
  <button onclick="window.close()">Cerrar</button>
  <div class="tip">
    <b>Antes de imprimir:</b> en el diálogo, despliega <i>Más ajustes</i> y <b>desactiva</b> la opción <i>"Encabezados y pies de página"</i> para que no aparezca el título ni la URL del navegador.
  </div>
</div>

<div class="sheet">

<div class="header">
  <h1>Análisis sintáctico — Examen</h1>
</div>

<div class="student">
  <div class="field"><span class="label">Nombre:</span><span class="line"></span></div>
  <div class="field"><span class="label">Curso:</span><span class="line"></span></div>
</div>

${items}

</div>

<!-- Footer FUERA del .sheet para que su position:fixed se ancle al
     viewport, no al sheet. Si queda dentro del sheet, en algunos
     navegadores acaba dibujándose sobre la última caja. -->
<div class="footer">
  Practica online: <a href="${EXAM_LINK_URL}">${EXAM_LINK_URL}</a>
</div>
</body>
</html>`;

  // Abrir ventana nueva con el HTML del examen.
  const w = window.open('', '_blank');
  if (!w) {
    alert('Tu navegador ha bloqueado la ventana emergente. Permite pop-ups para esta página y vuelve a intentarlo.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* Escape simple para inyectar la oración en el HTML del examen.
   No reusamos escapeHTML() de state.js porque exam.js puede
   ejecutarse en una ventana sin acceso a esa función — pero como
   compartimos contexto JS aquí sí está disponible; mantenemos la
   función local por independencia, igual que escapeXML en io.js. */
function escapeHTMLForExam(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
