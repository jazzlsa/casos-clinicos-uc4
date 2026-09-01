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

/* ---------------- Modo (clique / escrita) ---------------- */
let modo = "clique"; // "clique" | "escrita"
function setModo(m) {
  if (m !== "clique" && m !== "escrita") m = "clique";
  modo = m;
  try { localStorage.setItem("casos-modo", m); } catch (e) {}
}
(function initModo() {
  let salvo = null;
  try { salvo = localStorage.getItem("casos-modo"); } catch (e) {}
  setModo(salvo);
})();

/* ---------------- Estado ---------------- */
let dados = { CASOS: [], RUBRICA: [], PALAVRAS: { itens: {}, jargao: [] } };
let estado = null; // { caso, indiceFase, coberto:Set, evitou:Array, porFase:Array, modo }

function el(html) {
  // Com um único elemento-raiz, devolve o próprio elemento (mantém chamadas
  // como .querySelector/.addEventListener no retorno). Com vários irmãos
  // (a tela inicial: título + chamada + lista), devolve um fragmento com todos.
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  const filhos = [...t.content.childNodes].filter(n => n.nodeType === Node.ELEMENT_NODE);
  if (filhos.length === 1) return filhos[0];
  return t.content.cloneNode(true);
}
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
  const sel = m => m === modo ? " modo-ativa" : "";
  appEl.appendChild(el(`
    <div class="seletor-modo" role="group" aria-label="Modo de jogo">
      <button class="modo-btn${sel("clique")}" data-modo="clique">🖱️ Clique</button>
      <button class="modo-btn${sel("escrita")}" data-modo="escrita">✍️ Escrita</button>
    </div>
    <h2 class="titulo-pagina">Escolha um caso</h2>
    <p class="chamada">${
      modo === "escrita"
        ? "Você é o médico. Escreva as perguntas que faria em cada etapa — o jogo aponta o que você cobriu do checklist e o que faltou."
        : "Você é o médico. Conduza a entrevista — apresente-se, acolha, sem jargão, e feche com hipótese diagnóstica. Marque as ações que você tomaria em cada etapa."
    }</p>
    <div class="lista-casos">${lista}</div>
  `));
  appEl.querySelectorAll(".modo-btn").forEach(b => {
    b.addEventListener("click", () => { setModo(b.dataset.modo); renderHome(); });
  });
  appEl.querySelectorAll(".cartao-caso").forEach(b => {
    b.addEventListener("click", () => {
      const c = casos.find(x => x.id === b.dataset.caso);
      if (c) iniciarCaso(c, modo);
    });
  });
}

/* ---------------- Motor de fases ---------------- */

function iniciarCaso(caso, modoJogo) {
  estado = { caso, indiceFase: 0, coberto: new Set(), evitou: [], porFase: [], modo: modoJogo };
  renderFase();
}

function renderFase() {
  if (estado.modo === "escrita") return renderFaseEscrita();
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

/* ---------------- Modo escrita (texto livre) ---------------- */

function normalizar(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function gruposDoItem(id) {
  const g = dados.PALAVRAS.itens && dados.PALAVRAS.itens[id];
  return Array.isArray(g) ? g : [];
}
function itemCoberto(id, txtNorm) {
  const gs = gruposDoItem(id);
  if (!gs.length) return false;
  return gs.every(gr => (Array.isArray(gr) ? gr : [gr]).some(p => txtNorm.includes(normalizar(p))));
}
// Itens que esta fase pode abordar = união dos cobre das opções da fase.
function itensDaFase(f) {
  const s = new Set();
  (f.opcoes || []).forEach(o => (o.cobre || []).forEach(id => s.add(id)));
  return [...s];
}
function tituloDoItem(id) {
  for (const c of dados.RUBRICA) for (const it of c.itens) if (it.id === id) return it.texto;
  return id;
}
// Frase de referência (opção "bom" que mais cobre o item) para ensinar como perguntar bem.
function idealDoItem(f, id) {
  let melhor = null;
  (f.opcoes || []).forEach(o => {
    if (o.rotulo === "bom" && (o.cobre || []).includes(id)) {
      if (!melhor || (o.cobre || []).length > melhor.cobre.length) melhor = o;
    }
  });
  return melhor ? melhor.texto : "";
}

function renderFaseEscrita() {
  const f = estado.caso.fases[estado.indiceFase];
  const total = estado.caso.fases.length;
  const atual = estado.indiceFase;

  let pontos = "";
  for (let i = 0; i < total; i++) {
    const cls = i < atual ? "feita" : (i === atual ? "ativa" : "");
    pontos += `<span class="fase-ponto ${cls}"></span>`;
  }

  const painel = el(`
    <div class="painel">
      <div class="barra-fases">${pontos}</div>
      <div class="fase-tag">Fase ${atual + 1} · ${esc(f.tag)} · ✍️ escrita</div>
      <h2 class="titulo-pagina">${esc(estado.caso.titulo)}</h2>
      <p class="dica-fase">${esc(f.instrucao || "Escreva o que você diria ou perguntaria nesta etapa.")}</p>
      <div class="paciente">${esc(f.paciente)}</div>
      <textarea id="resposta" class="textarea" rows="5" spellcheck="false"
        placeholder="Escreva aqui, em suas palavras, o que você diria ou perguntaria..."></textarea>
      <div id="feedback-holder"></div>
      <div class="acoes">
        <button class="btn secundario" id="btn-voltar">← Menu</button>
        <button class="btn" id="btn-enviar">Enviar resposta ✍️</button>
      </div>
    </div>
  `);
  painel.querySelector("#btn-voltar").addEventListener("click", () => { estado = null; renderHome(); });
  painel.querySelector("#btn-enviar").addEventListener("click", () => enviarEscrita(painel));

  appEl.innerHTML = "";
  appEl.appendChild(painel);
  painel.querySelector("#resposta").focus();
}

function enviarEscrita(painel) {
  const ta = painel.querySelector("#resposta");
  const txt = ta.value;
  if (!txt.trim()) { ta.focus(); return; }

  const f = estado.caso.fases[estado.indiceFase];
  const txtNorm = normalizar(txt);

  const alvo = itensDaFase(f);
  const cobertos = alvo.filter(id => itemCoberto(id, txtNorm));
  cobertos.forEach(id => estado.coberto.add(id));
  const faltando = alvo.filter(id => !cobertos.includes(id));
  const jarg = (dados.PALAVRAS.jargao || []).filter(p => txtNorm.includes(normalizar(p)));

  let html = "";
  if (cobertos.length) {
    html += `<div class="feedback">
      <div class="rotulo bom">✔ Itens que você perguntou (${cobertos.length}/${alvo.length})</div>
      ${cobertos.map(id => {
        const ideal = idealDoItem(f, id);
        return `<div class="detalhe esc-bom">✅ ${esc(tituloDoItem(id))}${
          ideal ? `<div class="ideal">Como perguntar: <i>${esc(ideal)}</i></div>` : ""}</div>`;
      }).join("")}
    </div>`;
  }
  if (faltando.length) {
    html += `<div class="feedback" style="border-color:var(--alerta)">
      <div class="rotulo ruim">⚠ Nesta etapa também se esperava perguntar sobre</div>
      ${faltando.map(id => `<div class="detalhe esc-falta">✖ ${esc(tituloDoItem(id))}</div>`).join("")}
    </div>`;
  }
  if (jarg.length) {
    html += `<div class="feedback" style="border-color:var(--erro)">
      <div class="rotulo ruim">🚩 Cuidado com jargão técnico ao perguntar</div>
      <div class="reacao">Você usou: ${jarg.map(esc).join(", ")}. Na prova, pergunte sobre sintomas
        em linguagem simples — o termo técnico entra só no resumo final.</div>
    </div>`;
  }

  const holder = painel.querySelector("#feedback-holder");
  holder.innerHTML = html;

  ta.disabled = true;
  const btn = painel.querySelector("#btn-enviar");
  btn.disabled = true; btn.textContent = "Resposta enviada";

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
  // palavras.json carrega em paralelo SEM bloquear a renderização: o app
  // funciona (modo clique) mesmo se ele falhar ou atrasar; o modo escrita usa
  // as palavras assim que chegam.
  fetch("./data/palavras.json")
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(p => {
      dados.PALAVRAS = (p && p.itens)
        ? { itens: p.itens, jargao: p.jargao || [] }
        : { itens: {}, jargao: [] };
      document.documentElement.dataset.palavras = "1";
    })
    .catch(() => { document.documentElement.dataset.palavras = "0"; });

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
