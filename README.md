# Sintaxis

Analizador sintáctico visual del español, al estilo de los esquemas de [sintaxis.org](https://sintaxis.org/) — con líneas a varios niveles bajo cada palabra.

**Demo:** https://leowegner.github.io/sintaxis/

## Qué hace

- Escribe una oración y márcala por niveles:
  - **Nivel 1** — Sintagma + función fusionados (`SN - NS`, `SV - NP`, `SN - CD`, `Nx`...)
  - **Nivel 2** — Funciones oracionales (`Sujeto`, `Predicado verbal`, `Predicado nominal`)
  - **Nivel 3** — Proposiciones (`P1`, `P2`, `Nx`)
  - **Nivel 4** — Tipo de oración global
- Exporta el análisis a **PNG**, **SVG** o **JSON**.
- **Corrector con IA**: pega tu API key de OpenAI o Gemini y el modelo revisa tu análisis.
- La clave se guarda solo en `localStorage` de tu navegador, nunca sale del cliente.

## Cómo usar

1. Abre la web.
2. Escribe una oración y pulsa **Cargar**.
3. Haz clic en una palabra (shift+clic para extender la selección).
4. Elige nivel y etiqueta.
5. (Opcional) Pega tu API key y pulsa **Revisar mi análisis**.

## Stack

HTML + CSS + JS vanilla. Sin build, sin backend. Una sola página.

## Licencia

MIT.
