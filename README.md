# 🩺 Casos Clínicos UC4 — Simulador de Anamnese

Um **jogo de simulador de entrevista clínica** para treinar a prova prática de **anamnese da UC4**, hospedado no **GitHub Pages**.

**Jogar:** <https://jazzlsa.github.io/casos-clinicos-uc4/>

## Como a prova funciona (relato de aluno)

- O professor **encena o paciente**; você faz a entrevista e, no final, dá uma **hipótese diagnóstica**.
- **Sempre se apresentar antes** da anamnese.
- **Observar os sinais corporais de ansiedade** encenados pelo professor e, nesse momento, **demonstrar empatia** (perguntar se está tudo bem, dizer que será ajudado).
- **Não usar jargão técnico** ao perguntar sobre sintomas — o jargão entra só no **resumo final** do caso.

## Como o jogo funciona

Fluxo em 5 fases: **Apresentação → Abertura → Anamnese → Ansiedade/empatia → Resumo + Hipótese**.

Em cada fase você escolhe o que dizer/perguntar. O jogo reage como o paciente e, no fim, pontua por **categorias do checklist** de avaliação (Apresentação, Coleta, Comunicação sem jargão, Empatia, Resumo, Hipótese), com dicas de melhoria.

## Estrutura

```
casos-clinicos-uc4/
  index.html          # app single-page
  css/style.css       # visual mobile-first
  js/app.js           # motor do simulador
  data/rubrica.json   # checklist de avaliação
  data/casos.json     # casos clínicos
  rubrica/            # conteúdo de referência (local, fora do GitHub)
  tools/parse_rubrica.py  # importa conteúdo -> data/rubrica.json
```

## Rodar localmente

```
python -m http.server 8000
```
Abra <http://localhost:8000>.

## Casos disponíveis

- **Dor abdominal** — Sra. Cláudia, 38 anos (DIP; diabetes "escondido").
- **Dispneia** — Sr. Antônio, 45 anos (asma ocupacional do padeiro; exposição à farinha).

Cada caso trabalha uma das categorias do checklist (`Dispneia`, `Edema`, …) além da
Relação Estudante-Paciente e da Anamnese Geral.

## Adicionar conteúdo

1. Coloque o arquivo de referência em `rubrica/` (pasta local, não versionada).
2. `tools/parse_rubrica.py rubrica/NOME_ARQUIVO` → gera `data/rubrica.json`.
3. Monte `data/casos.json` a partir do checklist.
4. Commit + push → o Pages atualiza sozinho.
