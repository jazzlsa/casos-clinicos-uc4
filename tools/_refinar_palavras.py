#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verificacao e refinamento de data/palavras.json (modo escrita).

O app (js/app.js) avalia por SUBSTRING apos normalizar: lowercase + remover
acentos (NFD + drop combining marks). Logo:

  * "remedio" e "remédio" sao a mesma coisa apos normalizacao (duplicata).
  * se a palavra curta X esta contida na longa Y no MESMO grupo, Y e
    redundante para cobertura (qualquer texto com Y ja contem X) — cabe a
    voce decidir manter so a mais abrangente.
  * palavras muito curtas (<=2 chars) geram falso positivo (ex.: "po" bate
    dentro de "depois", "ponto", "pode").

Checks:
  A. duplicata exata dentro do mesmo grupo            -> auto-fix com --fix
  B. duplicata por normalizacao (acento/caixa)        -> auto-fix com --fix
  C. redundancia por substring dentro do mesmo grupo  -> report
  D. palavra de grupo que tambem esta em jargao (cobre o item E avisa jargao)
  E. palavra de grupo muito curta (<=2 apos normalizar)
  F. palavra presente em itens distintos (sangra para outras categorias)
  G. checklist estrutural (itens nao sao listas de listas; grupos vazios)

Uso:
  python tools/_refinar_palavras.py [--fix] [--all] [--json]
"""
import json
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARQUIVO = RAIZ / "data" / "palavras.json"


def normalizar(s: str) -> str:
    """Mesma normalizacao do app (js/normalizar): lowercase + NFD + sem acentos."""
    s = unicodedata.normalize("NFD", str(s or "").lower())
    return "".join(c for c in s if not (0x0300 <= ord(c) <= 0x036F))


def carregar():
    with open(ARQUIVO, encoding="utf-8") as f:
        return json.load(f)


# --------------------------------------------------------------------------
# G. Estrutura
# --------------------------------------------------------------------------
def check_estrutura(dados):
    problemas = []
    itens = dados.get("itens", {})
    if not isinstance(itens, dict):
        return [("estrutura", "itens nao e um dict")]
    for id_, grupos in itens.items():
        if not isinstance(grupos, list) or not grupos:
            problemas.append(("estrutura", f"{id_}: grupos vazio/nao-lista"))
            continue
        for gi, g in enumerate(grupos):
            if not isinstance(g, list) or not g:
                problemas.append(("estrutura", f"{id_}[{gi}]: grupo vazio/nao-lista"))
    if "jargao" not in dados or not isinstance(dados["jargao"], list):
        problemas.append(("estrutura", "jargao ausente/nao-lista"))
    return problemas


# --------------------------------------------------------------------------
# A/B. Duplicatas dentro do grupo (exata e por normalizacao)
# --------------------------------------------------------------------------
def check_duplicatas(dados, fix=False):
    """Retorna (relatorio, mochila_de_fixes)."""
    rel = []
    fixes = {}  # (id, gi) -> lista de INDICES a remover do grupo
    for id_, grupos in dados.get("itens", {}).items():
        for gi, g in enumerate(grupos):
            if not isinstance(g, list):
                continue
            # agrupa indices por chave normalizada (a comparacao do app)
            vistos_norm = defaultdict(list)  # palavra_norm -> [indices]
            for pi, p in enumerate(g):
                vistos_norm[normalizar(p)].append(pi)

            exatas, normais = [], []
            dups_para_remover = []
            for chave, ixs in vistos_norm.items():
                if len(ixs) < 2:
                    continue
                # A: strings identicas no arquivo (mesma cadeia de caracteres)
                text_prev = g[ixs[0]]
                dups_iguais = [i for i in ixs if g[i] == text_prev]
                if len(dups_iguais) > 1:
                    exatas.append((g[ixs[0]], len(dups_iguais) - 1))
                    dups_para_remover.extend(dups_iguais[1:])  # mantem a 1a
                # B: demais repeticoes da chave normalizada (variante acento/caixa)
                dups_normais = [i for i in ixs if g[i] != text_prev]
                if dups_normais:
                    normais.append((chave, [g[i] for i in [ixs[0]] + dups_normais]))
                    dups_para_remover.extend(dups_normais)  # mantem a 1a variante

            if exatas:
                for t, n_extra in exatas:
                    rel.append(("A", f"{id_}[{gi}] '{t}': {n_extra} repeticao(es) exata(s)"))
            if normais:
                for chave, variants in normais:
                    rel.append(("B", f"{id_}[{gi}] '{chave}': variantes com acento/caixa → {variants}"))
            if dups_para_remover:
                fixes[(id_, gi)] = sorted(set(dups_para_remover))  # indices
    return rel, fixes


# --------------------------------------------------------------------------
# C. Redundancia por substring dentro do mesmo grupo
# --------------------------------------------------------------------------
def check_substring(dados):
    rel = []
    for id_, grupos in dados.get("itens", {}).items():
        for gi, g in enumerate(grupos):
            if not isinstance(g, list):
                continue
            norm = [normalizar(p) for p in g]
            for i in range(len(g)):
                for j in range(len(g)):
                    if i == j or norm[i] == norm[j]:
                        continue
                    if norm[i] in norm[j]:  # i esta contida em j
                        rel.append(("C", f"{id_}[{gi}] '{g[i]}' ⊂ '{g[j]}' (manter so a mais abrangente p/ cobertura)"))
    # dedupe pares (j,i) x (i,j)
    return rel


# --------------------------------------------------------------------------
# D. Palavra de grupo que tambem esta no jargao
# --------------------------------------------------------------------------
def check_jargao(dados):
    rel = []
    jarg = {normalizar(j) for j in dados.get("jargao", [])}
    for id_, grupos in dados.get("itens", {}).items():
        for gi, g in enumerate(grupos):
            if not isinstance(g, list):
                continue
            for p in g:
                if normalizar(p) in jarg:
                    rel.append(("D", f"{id_}[{gi}] '{p}' é palavra-chave de grupo E está no jargão (cobre o item + avisa jargão)"))
    return rel


# --------------------------------------------------------------------------
# E. Palavras muito curtas
# --------------------------------------------------------------------------
def check_curtas(dados, limite=2):
    rel = []
    for id_, grupos in dados.get("itens", {}).items():
        for gi, g in enumerate(grupos):
            if not isinstance(g, list):
                continue
            for p in g:
                n = normalizar(p)
                if 0 < len(n) <= limite:
                    rel.append(("E", f"{id_}[{gi}] '{p}' ({len(n)} letras pós-normalização) — alto risco de falso positivo por substring"))
    return rel


# --------------------------------------------------------------------------
# F. Palavra presente em itens distintos (sangra entre categorias)
# --------------------------------------------------------------------------
def check_sangria(dados):
    onde = defaultdict(list)  # palavra_norm -> [ids]
    for id_, grupos in dados.get("itens", {}).items():
        for g in grupos:
            if not isinstance(g, list):
                continue
            for p in g:
                onde[normalizar(p)].append(id_)
    rel = []
    for p, ids in onde.items():
        ids_unicos = sorted(set(ids))
        if len(ids_unicos) > 1:
            rel.append(("F", f"'{p}' aparece em {ids_unicos} — conferir se o mesmo trecho de fala não cobre item errado"))
    return rel


# --------------------------------------------------------------------------
# Aplicar --fix
# --------------------------------------------------------------------------
def aplicar_fix(dados, fixes):
    removidos = 0
    for (id_, gi), indices in fixes.items():
        grupos = dados["itens"][id_]
        novo = [p for i, p in enumerate(grupos[gi]) if i not in indices]
        removidos += len(grupos[gi]) - len(novo)
        grupos[gi] = novo
    return removidos


def main():
    fix = "--fix" in sys.argv
    ja = "--json" in sys.argv
    tudo = "--all" in sys.argv
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    dados = carregar()

    rel = []
    rel += check_estrutura(dados)
    rel += check_jargao(dados)
    rel += check_curtas(dados)
    if tudo:
        rel += check_substring(dados)
    rel += check_sangria(dados)
    dup_rel, fixes = check_duplicatas(dados)
    rel += dup_rel

    if fix and fixes:
        removidos = aplicar_fix(dados, fixes)
        with open(ARQUIVO, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"[--fix] removidas {removidos} palavra(s) duplicada(s). Arquivo regravado.")

    if ja:
        relatorio = defaultdict(list)
        for tipo, msg in rel:
            relatorio[tipo].append(msg)
        print(json.dumps(relatorio, ensure_ascii=False, indent=2))
        return

    if not rel:
        print("✅ Nenhum problema encontrado.")
        return

    pesos = {"A": 0, "B": 1, "C": 9, "D": 2, "E": 3, "F": 4, "estrutura": 5}
    ordem = sorted({t for t, _ in rel}, key=lambda t: pesos.get(t, 9))
    for tipo in ordem:
        msgs = [m for t, m in rel if t == tipo]
        rotulo = {
            "A": "A. Duplicata exata (auto-fix com --fix)",
            "B": "B. Duplicata por normalizacao (acento/caixa; auto-fix com --fix)",
            "C": "C. Redundancia por substring no mesmo grupo",
            "D": "D. Palavra de grupo tambem no jargao",
            "E": "E. Palavra muito curta (risco falso positivo)",
            "F": "F. Palavra em itens distintos (possivel sangria)",
            "estrutura": "G. Estrutura",
        }[tipo]
        print(f"\n— {rotulo} ({len(msgs)}) —")
        for m in msgs:
            print("  " + m)


if __name__ == "__main__":
    main()
