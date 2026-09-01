# 🩺 Casos Clínicos UC4 — Simulador de Anamnese

Um **jogo de simulador de entrevista clínica** para treinar a prova prática de **anamnese da UC4**, hospedado no **GitHub Pages**.

**Jogar:** <https://jazzlsa.github.io/casos-clinicos-uc4/>

## Como a prova funciona (relato de aluno)

- O professor **encena o paciente**; você faz a entrevista e, no final, dá uma **hipótese diagnóstica**.
- **Sempre se apresentar antes** da anamnese.
- **Observar os sinais corporais de ansiedade** encenados pelo professor e, nesse momento, **demonstrar empatia** (perguntar se está tudo bem, dizer que será ajudado).
- **Não usar jargão técnico** ao perguntar sobre sintomas — o jargão entra só no **resumo final** do caso.

## Como o jogo funciona

Fluxo em 6 fases por caso. No início você escolhe o **modo de jogo**:

- **🖱️ Clique** — a cada fase, marca entre opções prontas as ações que tomaria.
- **✍️ Escrita** — a cada fase, **escreve em texto livre** o que diria/perguntaria. O
  jogo detecta por **palavras-chave** (`data/palavras.json`) quais itens do checklist sua
  resposta cobriu e mostra, por fase, o que ficou faltando + um aviso leve se você usar
  **jargão técnico** ao perguntar.

Nos dois modos, o fim pontua por **categorias do checklist** de avaliação e mostra dicas
de melhoria.

## Estrutura

```
casos-clinicos-uc4/
  index.html          # app single-page
  css/style.css       # visual mobile-first
  js/app.js           # motor do simulador
  data/rubrica.json   # checklist de avaliação
  data/casos.json     # casos clínicos
  data/palavras.json  # palavras-chave do modo escrita (+ lista de jargão)
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
- **Edema** — Dona Maria, 62 anos (ICC + anlodipina como chave escondida).

Cada caso trabalha uma das categorias do checklist (`Dispneia`, `Edema`, …) além da
Relação Estudante-Paciente e da Anamnese Geral.

## Adicionar conteúdo

1. Coloque o arquivo de referência em `rubrica/` (pasta local, não versionada).
2. `tools/parse_rubrica.py rubrica/NOME_ARQUIVO` → gera `data/rubrica.json`.
3. Monte `data/casos.json` a partir do checklist.
4. Commit + push → o Pages atualiza sozinho.
