/* ============================================================
   INTEGRACIÓN CON IA (OpenAI / Gemini)
   ------------------------------------------------------------
   Contiene:
     - saveKey(), refreshModelSelect()  → gestión de la API key y
       el desplegable de modelos. Los datos se guardan SOLO en
       localStorage del navegador.
     - callAI(promptText)               → manda el prompt al provider
       elegido y devuelve el texto crudo. También actualiza el
       contador de coste teórico.
     - reviewWithAI()                   → "Revisar mi análisis":
       construye el prompt corrector y pinta el resultado.
     - analyzeWithAI()                  → "Analizar con IA":
       1) si la oración está en PREBUILT, carga el análisis pre-hecho
          (gratis, sin llamar a IA).
       2) si no, llama a la IA, valida etiquetas, reintenta una vez
          si hay etiquetas inválidas, y carga el resultado.
     - parseAnalysisJSON(), findInvalidLabels(), renderAIResult()
       → utilidades de parseo y pintado.
     - calcCost(), updateCostUI(), resetCost(), fmtUSD(), fmtTok()
       → cálculo y pintado del coste teórico (los precios viven
       en js/config.js).
   ============================================================ */

/* ---------- API KEY ---------------------------------------- */
function saveKey() {
  const provider = document.getElementById('aiProvider').value;
  const key = document.getElementById('aiKey').value;
  localStorage.setItem('sintaxis_key_' + provider, key);
  alert('Clave guardada en tu navegador (localStorage).');
}

/* Rellena el <select> de modelos según el provider activo y
   recupera el modelo + key guardados. */
function refreshModelSelect() {
  const provider = document.getElementById('aiProvider').value;
  const sel = document.getElementById('aiModel');
  sel.innerHTML = '';
  MODELS[provider].forEach(m => {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = m.label;
    sel.appendChild(o);
  });
  const saved = localStorage.getItem('sintaxis_model_' + provider);
  if (saved) sel.value = saved;
  document.getElementById('aiKey').value = localStorage.getItem('sintaxis_key_' + provider) || '';
}

/* ---------- COSTE TEÓRICO ---------------------------------- */
function calcCost(model, inTok, outTok) {
  const p = PRICING[model];
  if (!p) return null;
  return (inTok * p.in + outTok * p.out) / 1_000_000;
}

function fmtUSD(v) {
  if (v < 0.01) return '$' + v.toFixed(6);
  return '$' + v.toFixed(4);
}

function fmtTok(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function updateCostUI(last) {
  const total = parseFloat(localStorage.getItem('sintaxis_cost_total') || '0');
  document.getElementById('costTotal').textContent = 'Sesión: ' + fmtUSD(total);
  if (last) {
    const { model, inTok, outTok, cost } = last;
    document.getElementById('costLast').textContent =
      `Última: ${fmtUSD(cost)} · ${fmtTok(inTok)} in + ${fmtTok(outTok)} out · ${model}`;
  }
}

function resetCost() {
  localStorage.setItem('sintaxis_cost_total', '0');
  document.getElementById('costLast').textContent = 'Última: —';
  updateCostUI();
}

/* ---------- LLAMADA A LA IA -------------------------------- */
/* Llama al provider activo y devuelve el texto crudo de la
   respuesta. Lanza Error si falta la key o si el provider devuelve
   un error. Acumula el coste teórico en localStorage. */
async function callAI(promptText) {
  const provider = document.getElementById('aiProvider').value;
  const key = localStorage.getItem('sintaxis_key_' + provider);
  if (!key) throw new Error('Guarda primero tu API key.');
  const model = document.getElementById('aiModel').value;
  let text, inTok = 0, outTok = 0;

  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      })
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    text = j.choices[0].message.content;
    inTok = j.usage?.prompt_tokens || 0;
    outTok = j.usage?.completion_tokens || 0;
  } else {
    // Gemini
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    text = j.candidates[0].content.parts[0].text;
    inTok = j.usageMetadata?.promptTokenCount || 0;
    outTok = j.usageMetadata?.candidatesTokenCount || 0;
  }

  const cost = calcCost(model, inTok, outTok) ?? 0;
  const total = parseFloat(localStorage.getItem('sintaxis_cost_total') || '0') + cost;
  localStorage.setItem('sintaxis_cost_total', String(total));
  updateCostUI({ model, inTok, outTok, cost });
  return text;
}

/* ---------- REVISAR ANÁLISIS DEL ALUMNO -------------------- */
async function reviewWithAI() {
  if (!state.annotations.length) { alert('Haz al menos una anotación primero.'); return; }
  const out = document.getElementById('aiOutput');
  out.innerHTML = '<div class="ai-fallback">Pensando...</div>';
  try {
    const text = await callAI(buildPrompt());
    renderAIResult(text);
  } catch (err) {
    out.innerHTML = '';
    out.textContent = 'Error: ' + err.message;
  }
}

/* Pinta el resultado del corrector. Si la respuesta no es JSON
   válido, la muestra tal cual como fallback. */
function renderAIResult(raw) {
  const out = document.getElementById('aiOutput');
  let data;
  try {
    // Tolerar fences de markdown por si el modelo los añade.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    data = JSON.parse(cleaned);
  } catch (e) {
    out.innerHTML = '<div class="ai-fallback"></div>';
    out.querySelector('.ai-fallback').textContent = raw;
    state.aiReview = null;
    render();
    return;
  }

  state.aiReview = data;

  const badge = data.veredicto === 'ok'
    ? '<span class="badge ok">✓ Correcto</span>'
    : '<span class="badge bad">✗ Hay errores</span>';

  const wrong = (data.revision || []).filter(r => r.estado === 'incorrecta');
  const missing = data.faltantes || [];

  let html = `<div class="ai-head">${badge}<span>${escapeHTML(data.resumen || '')}</span></div>`;

  if (wrong.length) {
    html += '<div class="ai-section"><b>Anotaciones a revisar</b><ul>';
    wrong.forEach(r => {
      const ann = state.annotations[r.id];
      if (!ann) return;
      const rango = state.tokens.slice(ann.from, ann.to + 1).join(' ');
      html += `<li><code>${escapeHTML(rango)}</code> — <i>${escapeHTML(ann.label)}</i> (nivel ${ann.level}): ${escapeHTML(r.motivo || '')}</li>`;
    });
    html += '</ul></div>';
  }

  if (missing.length) {
    html += '<div class="ai-section"><b>Anotaciones que faltan</b><ul>';
    missing.forEach(m => {
      const rango = state.tokens.slice(m.from, m.to + 1).join(' ');
      html += `<li><code>${escapeHTML(rango)}</code> — añadir <i>${escapeHTML(m.etiqueta)}</i> (nivel ${m.nivel}): ${escapeHTML(m.motivo || '')}</li>`;
    });
    html += '</ul></div>';
  }

  if (!wrong.length && !missing.length) {
    html += '<div class="ai-section">Sin observaciones.</div>';
  }

  out.innerHTML = html;
  render(); // Repinta para resaltar las erróneas en rojo.
}

/* ---------- ANALIZAR ORACIÓN DESDE CERO -------------------- */
async function analyzeWithAI() {
  if (!state.tokens.length) { alert('Carga primero una oración.'); return; }
  if (state.annotations.length && !confirm('Esto reemplazará tu análisis actual. ¿Continuar?')) return;

  const out = document.getElementById('aiOutput');

  // Atajo: si la oración coincide con una del banco, cargamos el
  // análisis pre-hecho sin gastar IA.
  const tokensJoined = state.tokens.join(' ');
  const prebuilt = PREBUILT.find(p => tokenize(p.sentence).join(' ') === tokensJoined);
  if (prebuilt) {
    state.annotations = prebuilt.annotations.map(a => {
      const ann = {
        id: Date.now() + Math.random(),
        from: a.from, to: a.to,
        level: a.level,
        label: a.label,
        color: colorForLabel(a.level, a.label),
      };
      // Conserva kind:'paren' si la etiqueta es de subordinada,
      // o el que venga directamente del JSON si lo trae.
      const k = a.kind || kindForLabel(a.level, a.label);
      if (k) ann.kind = k;
      return ann;
    });
    state.tacitSubjects = (prebuilt.tacitSubjects || []).map(t => ({
      id: Date.now() + Math.random(),
      scope: t.scope || '',
      text: t.text,
    }));
    state.aiReview = null;
    state.selection = { from: null, to: null };
    render();
    out.innerHTML = `<div class="ai-head"><span class="badge ok">✓ Análisis pre-hecho</span><span>${prebuilt.annotations.length} anotaciones (sin coste de IA).</span></div>`;
    return;
  }

  out.innerHTML = '<div class="ai-fallback">Analizando...</div>';

  try {
    let raw = await callAI(buildAnalysisPrompt());
    let parsed = parseAnalysisJSON(raw);
    let invalid = findInvalidLabels(parsed);

    if (invalid.length) {
      // Reintento: le decimos qué etiquetas usó mal y le pedimos que repita.
      const retryInstruction = `IMPORTANTE: en tu intento anterior usaste estas etiquetas que NO existen en la lista de válidas: ${JSON.stringify(invalid)}. Reemplázalas por la etiqueta correcta de la lista, o si la palabra no debe etiquetarse en ese nivel, omítela. Repite el análisis completo.`;
      raw = await callAI(buildAnalysisPrompt(retryInstruction));
      parsed = parseAnalysisJSON(raw);
      invalid = findInvalidLabels(parsed);
    }

    // Filtra anotaciones bien formadas (índices coherentes + etiqueta válida).
    const validSet = validLabelSetByLevel();
    const valid = parsed.annotations.filter(a =>
      Number.isInteger(a.from) && Number.isInteger(a.to) &&
      a.from >= 0 && a.to < state.tokens.length && a.from <= a.to &&
      [1,2,3,4,5].includes(a.level) &&
      validSet[a.level] && validSet[a.level].has(a.label)
    );

    state.annotations = valid.map(a => {
      const ann = {
        id: Date.now() + Math.random(),
        from: a.from, to: a.to,
        level: a.level,
        label: a.label,
        color: colorForLabel(a.level, a.label),
      };
      const k = a.kind || kindForLabel(a.level, a.label);
      if (k) ann.kind = k;
      return ann;
    });
    state.tacitSubjects = (parsed.tacitSubjects || [])
      .filter(t => t && typeof t.text === 'string' && t.text.trim())
      .map(t => ({
        id: Date.now() + Math.random(),
        scope: typeof t.scope === 'string' ? t.scope : '',
        text: t.text.trim(),
      }));
    state.aiReview = null;
    state.selection = { from: null, to: null };
    render();

    const dropped = parsed.annotations.length - valid.length;
    out.innerHTML = `<div class="ai-head"><span class="badge ok">✓ Análisis cargado</span><span>${valid.length} anotaciones${dropped ? ` (${dropped} descartadas por etiqueta inválida tras reintento)` : ''}.</span></div>`;
  } catch (err) {
    out.innerHTML = '';
    out.textContent = 'Error: ' + err.message;
  }
}

function parseAnalysisJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const data = JSON.parse(cleaned);
  if (!data.annotations || !Array.isArray(data.annotations)) {
    throw new Error('La respuesta no contiene "annotations".');
  }
  return data;
}

function findInvalidLabels(parsed) {
  const validSet = validLabelSetByLevel();
  const bad = [];
  parsed.annotations.forEach(a => {
    if (!validSet[a.level] || !validSet[a.level].has(a.label)) {
      bad.push({ level: a.level, label: a.label });
    }
  });
  return bad;
}
