"use strict";

/* =========================================================================
   Simulador de anamnese — Casos Clínicos UC4
   Lê data/casos.json (fluxo por caso) e data/rubrica.json (categorias do
   checklist de avaliação), ambos caminhos relativos (GitHub Pages em subpath).
   ========================================================================= */

const appEl = document.getElementById("app");
const btnTema = document.getElementById("btn-tema");

/* ---------------- Tema (claro/escuro) ---------------- */
function aplicarTema(tema) {
  document.documentElement.setAttribute("data-tema", tema);
  btnTema.textContent = tema === "escuro" ? "☀️" : "🌙";
  try { localStorage.setItem("casos-tema", tema); } catch (e) {}
}
btnTema.addEventListener("click", () => {
  const atual = document.documentElement.getAttribute("data-tema");
  aplicarTema(atual === "escuro" ? "claro" : "escuro");
});
(function initTema() {
  let salvo = null;
  try { salvo = localStorage.getItem("casos-tema"); } catch (e) {}
  if (!salvo) {
    salvo = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ? "escuro" : "claro";
  }
  aplicarTema(salvo);
})();

/* ---------------- Estado do jogo ---------------- */
let dados = { CASOS: [], RUBRICA: [] };
let estado = null; // { caso, indiceFase, pontos: {categoria: total}, escolhas: [] }

function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
function categoriaMax(nome) {
  const c = dados.RUBRICA.find(r => r.nome.toLowerCase() === nome.toLowerCase());
  return c ? (c.pontos_max || 0) : null;
}

/* ---------------- Telas ---------------- */

function renderVazio() {
  appEl.innerHTML = "";
  appEl.appendChild(el(`
    <div class="painel vazio">
      <div class="icone">🩺</div>
      <h2>Ainda não há casos clínicos</h2>
      <p>
        O simulador está pronto, mas ainda não há casos disponíveis.
        Quando o conteúdo de referência for adicionado ao projeto, o primeiro
        caso aparece aqui para você treinar a entrevista.
      </p>
    </div>
  `));
}

function renderHome() {
  appEl.innerHTML = "";
  const casos = dados.CASOS;
  const lista = casos.map(c => `
    <button class="cartao-caso" data-caso="${esc(c.id)}">
      <h3>${esc(c.titulo)}</h3>
      <p>${esc(c.chamada || "Caso clínico de anamnese")}</p>
    </button>
  `).join("");
  appEl.appendChild(el(`
    <h2 class="titulo-pagina">Escolha um caso</h2>
    <p class="chamada">Você é o médico. Conduza a entrevista — apresente-se, acolha,
      sem jargão, e feche com hipótese diagnóstica.</p>
    <div class="lista-casos">${lista}</div>
  `));
  appEl.querySelectorAll(".cartao-caso").forEach(b => {
    b.addEventListener("click", () => {
      const c = casos.find(x => x.id === b.dataset.caso);
      if (c) iniciarCaso(c);
    });
  });
}

/* ---------------- Motor de fases ---------------- */

function iniciarCaso(caso) {
  estado = { caso, indiceFase: 0, pontos: {}, escolhas: [] };
  renderFase();
}

function renderFase() {
  const f = estado.caso.fases[estado.indiceFase];
  const total = estado.caso.fases.length;
  const atual = estado.indiceFase;

  let pontos = "";
  for (let i = 0; i < total; i++) {
    const cls = i < atual ? "feita" : (i === atual ? "ativa" : "");
    pontos += `<span class="fase-ponto ${cls}"></span>`;
  }

  const opcoes = f.opcoes.map((o, i) =>
    `<button class="opcao" data-i="${i}">${esc(o.texto)}</button>`
  ).join("");

  const painel = el(`
    <div class="painel">
      <div class="barra-fases">${pontos}</div>
      <div class="fase-tag">Fase ${atual + 1} · ${esc(f.tag)}</div>
      <h2 class="titulo-pagina">${esc(estado.caso.titulo)}</h2>
      <div class="paciente">${esc(f.paciente)}</div>
      <div class="opcoes">${opcoes}</div>
      <div class="acoes">
        <button class="btn secundario" id="btn-voltar">← Menu</button>
      </div>
    </div>
  `);

  painel.querySelectorAll(".opcao").forEach(op => {
    op.addEventListener("click", () => escolher(op));
  });
  painel.querySelector("#btn-voltar").addEventListener("click", () => {
    estado = null; renderHome();
  });

  appEl.innerHTML = "";
  appEl.appendChild(painel);
}

function escolher(op) {
  const f = estado.caso.fases[estado.indiceFase];
  const idx = Number(op.dataset.i);
  const escolha = f.opcoes[idx];

  // desabilita re-seleção
  const painel = appEl.querySelector(".painel");
  painel.querySelectorAll(".opcao").forEach(o => { o.disabled = true; o.classList.remove("selecionada"); });
  op.classList.add("selecionada");

  // acumula pontos por categoria
  for (const [cat, delta] of Object.entries(escolha.pontos || {})) {
    estado.pontos[cat] = (estado.pontos[cat] || 0) + (delta || 0);
  }
  estado.escolhas.push({ fase: f, escolha });

  const rotuloCls = escolha.rotulo || "medio";
  const rotuloTexto = { bom: "Boa escolha ✅", medio: "Dá para melhorar ⚠️", ruim: "Evite isso ❌" }[rotuloCls] || "Dá para melhorar";

  const feedback = el(`
    <div class="feedback">
      <div class="rotulo ${esc(rotuloCls)}">${rotuloTexto}</div>
      <div class="detalhe">${esc(escolha.feedback)}</div>
      ${escolha.reacao ? `<div class="reacao"><b>Paciente:</b> ${esc(escolha.reacao)}</div>` : ""}
    </div>
  `);
  painel.appendChild(feedback);

  const botao = el(`<button class="btn bloco" id="btn-proximo" style="margin-top:12px">Seguir →</button>`);
  botao.addEventListener("click", () => {
    estado.indiceFase += 1;
    if (estado.indiceFase < estado.caso.fases.length) renderFase();
    else renderResumo();
  });
  painel.appendChild(botao);
  botao.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ---------------- Resumo final ---------------- */

function renderResumo() {
  const caso = estado.caso;
  const cats = dados.RUBRICA;

  let blocos = "";
  if (cats.length) {
    blocos += cats.map(cat => {
      const obtido = (estado.pontos[cat.nome] || 0);
      const max = cat.pontos_max || 0;
      const pct = max > 0 ? Math.max(0, Math.min(100, (obtido / max) * 100)) : 0;
      const cls = pct >= 70 ? "ok" : (pct >= 40 ? "fraca" : "");
      return `
        <div class="categoria">
          <div class="cab"><span class="nome">${esc(cat.nome)}</span>
            <span class="pts ${esc(cls)}">${obtido}/${max}</span></div>
          <div class="barra-nota"><span style="width:${pct}%"></span></div>
        </div>`;
    }).join("");
  } else {
    blocos = `<div class="categoria"><div class="cab"><span class="nome">Sem checklist ainda</span></div>
      <div class="detalhe" style="color:var(--texto-suave)">Adicione o conteúdo de avaliação para habilitar a pontuação por categoria.</div></div>`;
  }

  const dicas = (caso.dicas || []).map(d => `<li>${esc(d)}</li>`).join("");

  appEl.innerHTML = "";
  appEl.appendChild(el(`
    <div class="painel">
      <div class="fase-tag">Fim da entrevista</div>
      <h2 class="titulo-pagina">Resumo do caso</h2>
      <p class="chamada">Hipótese diagnóstica esperada — <b>${esc(caso.hipotese || "—")}</b></p>
      <div class="resumo-pontos">${blocos}</div>
      ${dicas ? `<div class="dicas"><b>Dicas para a prova</b><ul>${dicas}</ul></div>` : ""}
      <div class="acoes">
        <button class="btn" id="btn-repetir">↻ Repetir caso</button>
        <button class="btn secundario" id="btn-voltar-resumo">← Menu</button>
      </div>
    </div>
  `));
  appEl.querySelector("#btn-repetir").addEventListener("click", () => iniciarCaso(caso));
  appEl.querySelector("#btn-voltar-resumo").addEventListener("click", () => { estado = null; renderHome(); });
}

/* ---------------- Carga dos dados ---------------- */

function carregarDados() {
  Promise.all([
    fetch("./data/casos.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch("./data/rubrica.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  ]).then(([casos, rubrica]) => {
    dados.CASOS = (casos && casos.casos) || [];
    dados.RUBRICA = (rubrica && rubrica.categorias) || [];
    if (dados.CASOS.length) renderHome();
    else renderVazio();
  }).catch(() => {
    renderVazio();
  });
}

carregarDados();
