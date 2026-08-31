"""Extrai as primeiras 25 páginas (sumário) do livro semiologia.pdf e salva em rubrica/sumario.txt

Uso: venv/Scripts/python.exe tools/extract_sumario.py
Saída vai para rubrica/ (gitignored, local) - conteúdo do livro não vai ao GitHub.
"""

from pypdf import PdfReader
from pathlib import Path

BOOK = Path("rubrica/semiologia.pdf")
OUTPUT = Path("rubrica/sumario.txt")
PAGES = 25

reader = PdfReader(str(BOOK))
total = len(reader.pages)
print(f"Total de páginas no livro: {total}")

text_parts = []
for i in range(min(PAGES, total)):
    page_text = reader.pages[i].extract_text() or ""
    text_parts.append(f"--- Página {i + 1} ---\n{page_text}\n")

OUTPUT.write_text("\n".join(text_parts), encoding="utf-8")
print(f"Salvo em {OUTPUT} ({len(text_parts)} páginas)")
