"use strict";

/* =========================================================================
   Simulador de anamnese — Casos Clínicos UC4
   Lê data/casos.json (fluxo por caso) e data/rubrica.json (itens do
   checklist de avaliação). O jogo marca quais itens o aluno perguntou/fêz e
   mostra no fim, por categoria, o que ficou faltando.
   Caminhos relativos (GitHub Pages em subpath).
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

/* ---------------- Estado ---------------- */
let dados = { CASOS: [], RUBRICA: [] };
let estado = null; // { caso, indiceFase, coberto:Set, evitou:Array, porFase:Array }

function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

function categoria(nome) { return dados.RUBRICA.find(c => c.nome.toLowerCase() === nome.toLowerCase()); }

/* ---------------- Telas ---------------- */

function renderVazio() {
  appEl.innerHTML = "";
  appEl.appendChild(el(`
    <div class="painel vazio">
      <div class="icone">🩺</div>
      <h2>Ainda não há casos clínicos</h2>
      <p>O simulador está pronto, mas ainda não há casos disponíveis.</p>
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
      sem jargão, e feche com hipótese diagnóstica. Marque as ações que você tomaria
      em cada etapa.</p>
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
  estado = { caso, indiceFase: 0, coberto: new Set(), evitou: [], porFase: [] };
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

  const opcoes = f.opcoes.map((o, i) => `
    <label class="opcao opcao-multi" data-i="${i}">
      <span class="check">⬜</span>
      <span>${esc(o.texto)}</span>
    </label>
  `).join("");

  const painel = el(`
    <div class="painel">
      <div class="barra-fases">${pontos}</div>
      <div class="fase-tag">Fase ${atual + 1} · ${esc(f.tag)}</div>
      <h2 class="titulo-pagina">${esc(estado.caso.titulo)}</h2>
      <p class="dica-fase">${esc(f.instrucao || "Marque todas as ações que você tomaria nesta etapa.")}</p>
      <div class="paciente">${esc(f.paciente)}</div>
      <div class="opcoes">${opcoes}</div>
      <div id="feedback-holder"></div>
      <div class="acoes">
        <button class="btn secundario" id="btn-voltar">← Menu</button>
        <button class="btn" id="btn-confirmar">Confirmar escolhas ✓</button>
      </div>
    </div>
  `);

  painel.querySelectorAll(".opcao-multi").forEach((lab, i) => {
    lab.addEventListener("click", () => { lab.classList.toggle("selecionada"); });
  });
  painel.querySelector("#btn-voltar").addEventListener("click", () => { estado = null; renderHome(); });
  painel.querySelector("#btn-confirmar").addEventListener("click", () => confirmarFase(painel));

  appEl.innerHTML = "";
  appEl.appendChild(painel);
}

function confirmarFase(painel) {
  const f = estado.caso.fases[estado.indiceFase];
  const selecionadas = [...painel.querySelectorAll(".opcao-multi.selecionada")].map(lab => f.opcoes[Number(lab.dataset.i)]);

  // não deixa re-confirmar
  painel.querySelectorAll(".opcao-multi").forEach(l => l.classList.add("bloqueada"));
  const btn = painel.querySelector("#btn-confirmar");
  btn.disabled = true; btn.textContent = "Fase confirmada";

  // acumula cobertura + evitações
  const cobreIds = new Set();
  const feitos = [];
  const evitados = [];
  for (const o of selecionadas) {
    for (const id of (o.cobre || [])) cobreIds.add(id);
    if (o.rotulo === "ruim") { evitados.push(o); estado.evitou.push({ fase: f, escolha: o }); }
    if (o.rotulo && o.feedback) feitos.push(o);
  }
  cobreIds.forEach(id => estado.coberto.add(id));
  estado.porFase.push({ fase: f, selecionadas });

  // feedback consolidado
  let fb = "";
  if (feitos.length) {
    fb += `<div class="feedback">
      <div class="rotulo bom">Ações consideradas</div>
      ${feitos.map(o => `<div class="detalhe" style="margin-top:4px"><b>${esc(o.rotulo === "ruim" ? "⚠" : rotuloIcone(o.rotulo))}</b> ${esc(o.feedback)}</div>`).join("")}
    </div>`;
  }
  if (evitados.length) {
    fb += `<div class="feedback" style="border-color:var(--erro)">
      <div class="rotulo ruim">⚠ Cuidado — você marcou algo a evitar nesta prova</div>
      ${evitados.map(o => `<div class="reacao">${esc(o.feedback)}</div>`).join("")}
    </div>`;
  }

  const holder = painel.querySelector("#feedback-holder");
  holder.innerHTML = fb;

  const proximo = el(`<button class="btn bloco" id="btn-proximo" style="margin-top:12px">${
    estado.indiceFase + 1 < estado.caso.fases.length ? "Próxima etapa →" : "Ver resultado 🏁"}</button>`);
  proximo.addEventListener("click", () => {
    estado.indiceFase += 1;
    if (estado.indiceFase < estado.caso.fases.length) renderFase();
    else renderResumo();
  });
  holder.appendChild(proximo);
  proximo.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function rotuloIcone(r) { return ({ bom: "✅", medio: "⚠️", ruim: "❌" })[r] || "•"; }

/* ---------------- Resumo final ---------------- */

function renderResumo() {
  const caso = estado.caso;

  const blocos = dados.RUBRICA.map(cat => {
    if (!caso.categorias || !caso.categorias.includes(cat.nome)) return ""; // só categorias do caso
    const itens = cat.itens;
    const cobertos = itens.filter(it => estado.coberto.has(it.id));
    const faltando = itens.filter(it => !estado.coberto.has(it.id));
    const pct = itens.length ? Math.round((cobertos.length / itens.length) * 100) : 0;
    const cls = pct >= 70 ? "ok" : (pct >= 40 ? "fraca" : "");
    const verdes = cobertos.map(it => `<li class="ok">✔ ${esc(it.texto)}</li>`).join("");
    const vermelhos = faltando.map(it => `<li class="falta">✖ ${esc(it.texto)}</li>`).join("");
    return `
      <div class="categoria">
        <div class="cab"><span class="nome">${esc(cat.nome)}</span>
          <span class="pts ${esc(cls)}">${cobertos.length}/${itens.length}</span></div>
        <div class="barra-nota"><span style="width:${pct}%"></span></div>
        <ul class="itens-checagem">
          ${verdes}
          ${vermelhos}
        </ul>
      </div>`;
  }).filter(Boolean).join("");

  const dicas = (caso.dicas || []).map(d => `<li>${esc(d)}</li>`).join("");

  appEl.innerHTML = "";
  appEl.appendChild(el(`
    <div class="painel">
      <div class="fase-tag">Fim da entrevista</div>
      <h2 class="titulo-pagina">Resumo do caso</h2>
      <p class="chamada">Hipótese diagnóstica de referência — <b>${esc(caso.hipotese || "—")}</b></p>
      <div class="resumo-pontos">${blocos}</div>
      ${dicas ? `<div class="dicas"><b>Dicas-chave para a prova</b><ul>${dicas}</ul></div>` : ""}
      ${estado.evitou.length ? `<div class="feedback" style="border-color:var(--erro)"><div class="rotulo ruim">Armadilhas que você marcou (evite na prova)</div>${estado.evitou.map(e => `<div class="reacao">${esc(e.escolha.feedback)}</div>`).join("")}</div>` : ""}
      <div class="acoes">
        <button class="btn" id="btn-repetir">↻ Repetir</button>
        <button class="btn secundario" id="btn-voltar-resumo">← Menu</button>
      </div>
    </div>
  `));
  appEl.querySelector("#btn-repetir").addEventListener("click", () => iniciarCaso(caso));
  appEl.querySelector("#btn-voltar-resumo").addEventListener("click", () => { estado = null; renderHome(); });
}

/* ---------------- Carga ---------------- */

function carregarDados() {
  Promise.all([
    fetch("./data/casos.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch("./data/rubrica.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  ]).then(([casos, rubrica]) => {
    dados.CASOS = (casos && casos.casos) || [];
    dados.RUBRICA = (rubrica && rubrica.categorias) || [];
    if (dados.CASOS.length) renderHome();
    else renderVazio();
  }).catch(() => { renderVazio(); });
}

carregarDados();
