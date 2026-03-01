#!/usr/bin/env python3
"""
Convert Science Bowl packet JSON files to readable LaTeX.

Handles:
  - Bare ^ and _ outside math mode → wrapped in $...$
  - % signs → \%
  - Unicode em/en dashes, smart quotes, degree symbol, Greek letters, etc.
  - Existing $...$ and \textbf{...} are left untouched

Usage:
    python3 packet_to_latex.py <input.json>              # outputs .tex alongside input
    python3 packet_to_latex.py <input.json> <output.tex> # specify output path
    python3 packet_to_latex.py --all                     # convert all packets in pdf_processing/output/
"""

import json
import re
import sys
from pathlib import Path


# ─── Category display names and colors ──────────────────────────────────────

CATEGORY_MAP = {
    'CHEMISTRY':  ('Chemistry',       'green!12'),
    'PHYSICS':    ('Physics',         'blue!12'),
    'BIOLOGY':    ('Biology',         'red!12'),
    'MATH':       ('Math',            'orange!15'),
    'EARTH_SPACE':('Earth \\& Space', 'violet!12'),
    'ENERGY':     ('Energy',          'teal!12'),
}

OPTION_LABELS = ['W', 'X', 'Y', 'Z']

# ─── Text escaping ───────────────────────────────────────────────────────────

# Unicode replacements applied in plain-text segments (not inside $...$)
UNICODE_REPLACEMENTS = [
    ('\u2014', '---'),          # em dash
    ('\u2013', '--'),           # en dash
    ('\u2212', '$-$'),          # unicode minus sign
    ('\u2018', '`'),            # left single quote
    ('\u2019', "'"),            # right single quote
    ('\u201c', '``'),           # left double quote
    ('\u201d', "''"),           # right double quote
    ('\u00b0', r'$^\circ$'),    # degree symbol
    ('\u00d7', r'$\times$'),    # multiplication ×
    ('\u00f7', r'$\div$'),      # division ÷
    ('\u00b1', r'$\pm$'),       # ±
    ('\u221e', r'$\infty$'),    # ∞
    ('\u03b1', r'$\alpha$'),
    ('\u03b2', r'$\beta$'),
    ('\u03b3', r'$\gamma$'),
    ('\u03b4', r'$\delta$'),
    ('\u03bb', r'$\lambda$'),
    ('\u03bc', r'$\mu$'),
    ('\u03c0', r'$\pi$'),
    ('\u03c3', r'$\sigma$'),
    ('\u03a9', r'$\Omega$'),
    ('\u2248', r'$\approx$'),   # ≈
    ('\u2260', r'$\neq$'),      # ≠
    ('\u2264', r'$\leq$'),      # ≤
    ('\u2265', r'$\geq$'),      # ≥
    ('\u221a', r'$\sqrt{}$'),   # √ (bare, fallback)
]

# Matches a math-like token with ^ or _ that is NOT yet in math mode.
# Covers: 43^2, 10^{-12}, O_2^{2-}, x^3, 2^n, f_1, ClO^-, N_2^{2-}
_BARE_MATH_RE = re.compile(
    r'([A-Za-z0-9]+'           # base: one or more alphanumeric chars
    r'(?:'
    r'[_^]'                    # ^ or _
    r'(?:\{[^}]*\}|[A-Za-z0-9\-+]+)'  # argument: {braced} or bare token
    r')+'                      # one or more superscripts/subscripts
    r')'
)

# Splits text into [$...$, plain, $...$, plain, …]
_MATH_SPLIT_RE = re.compile(r'(\$(?:[^$\\]|\\.)*\$)')


def _fix_plain(text: str) -> str:
    """Fix issues in a plain (non-math) text segment."""
    # 1. Wrap bare ^ / _ expressions in $...$
    text = _BARE_MATH_RE.sub(lambda m: f'${m.group(1)}$', text)

    # 2. Escape bare % (not already escaped)
    text = re.sub(r'(?<!\\)%', r'\\%', text)

    # 3. Unicode replacements
    for char, replacement in UNICODE_REPLACEMENTS:
        text = text.replace(char, replacement)

    return text


def fix_text(text: str) -> str:
    """
    Make text safe for LaTeX output.
    Preserves existing $...$ math blocks and \\textbf{...} commands.
    """
    if not text:
        return text

    parts = _MATH_SPLIT_RE.split(text)
    result = []
    for part in parts:
        if part.startswith('$') and part.endswith('$') and len(part) > 1:
            result.append(part)   # already in math mode, leave untouched
        else:
            result.append(_fix_plain(part))
    return ''.join(result)


# ─── LaTeX rendering helpers ─────────────────────────────────────────────────

def _category_info(cat: str):
    return CATEGORY_MAP.get(cat, (cat, 'gray!10'))


def _style_label(style: str) -> str:
    return {'MULTIPLE_CHOICE': 'Multiple Choice', 'SHORT_ANSWER': 'Short Answer'}.get(style, style)


def _format_answer(answer, style: str, options: list) -> str:
    """Return a display string for the answer."""
    if isinstance(answer, list):
        return ', '.join(str(x) for x in answer) if answer else 'None'

    ans = str(answer)
    if style == 'MULTIPLE_CHOICE' and ans in OPTION_LABELS:
        idx = OPTION_LABELS.index(ans)
        if idx < len(options):
            return f'{ans}) {fix_text(options[idx])}'
        return ans
    return fix_text(ans)


def _render_question(q: dict, pair_num: int) -> str:
    qtype  = q.get('question_type', 'TOSSUP')
    style  = q.get('question_style', '')
    cat    = q.get('category', '')
    qtext  = fix_text(q.get('question_text', ''))
    options = q.get('options', [])
    answer  = q.get('correct_answer', '')

    cat_name, color = _category_info(cat)
    style_name = _style_label(style)

    is_tossup = (qtype == 'TOSSUP')
    type_str = r'\textbf{TOSSUP}' if is_tossup else r'\textit{Bonus}'
    rule_thickness = '1pt' if is_tossup else '0.5pt'

    lines = []

    # ── Header bar ──────────────────────────────────────────────────────────
    lines.append('')
    lines.append(r'\noindent\rule{\linewidth}{' + rule_thickness + '}')
    lines.append(
        r'\noindent ' + type_str +
        r' \textbf{\#' + str(pair_num) + r'}'
        r'\hfill'
        r'{\small\textsc{' + cat_name + r'}}'
        r'\hfill'
        r'{\small\textit{' + style_name + r'}}'
    )
    lines.append(r'\noindent\rule{\linewidth}{0.3pt}')
    lines.append('')

    # ── Question text ────────────────────────────────────────────────────────
    lines.append(r'\noindent ' + qtext)
    lines.append('')

    # ── Options (Multiple Choice) ────────────────────────────────────────────
    if style == 'MULTIPLE_CHOICE' and options:
        lines.append(r'\begin{tabular}{@{\hspace{1em}}lp{0.85\linewidth}}')
        for i, opt in enumerate(options[:4]):
            label = OPTION_LABELS[i]
            opt_text = fix_text(opt)
            lines.append(r'  \textbf{' + label + r')} & ' + opt_text + r' \\[2pt]')
        lines.append(r'\end{tabular}')
        lines.append('')

    # ── Answer ────────────────────────────────────────────────────────────────
    ans_display = _format_answer(answer, style, options)
    lines.append(
        r'\noindent\colorbox{yellow!55}{\strut\textbf{Answer:} ' + ans_display + r'}'
    )
    lines.append('')

    return '\n'.join(lines)


# ─── Full document ────────────────────────────────────────────────────────────

def packet_to_latex(data: dict) -> str:
    packet_name = data.get('packet', 'Packet')
    year        = data.get('year', '')
    questions   = data.get('questions', [])

    # Group by pair_id, preserving insertion order
    pairs: dict[int, list] = {}
    for q in questions:
        pid = q.get('pair_id', 0)
        pairs.setdefault(pid, []).append(q)

    doc = []

    # ── Preamble ──────────────────────────────────────────────────────────────
    doc += [
        r'\documentclass[11pt]{article}',
        r'\usepackage{amsmath,amssymb}',
        r'\usepackage[margin=0.85in,top=0.75in,bottom=0.75in]{geometry}',
        r'\usepackage{xcolor}',
        r'\usepackage{tabularx}',
        r'\usepackage{parskip}',
        r'\usepackage{microtype}',
        r'\setlength{\parindent}{0pt}',
        r'\setlength{\parskip}{5pt}',
        r'\renewcommand{\arraystretch}{1.3}',
        '',
    ]

    # ── Begin document ────────────────────────────────────────────────────────
    doc.append(r'\begin{document}')
    doc.append('')

    # Title
    doc.append(r'\begin{center}')
    doc.append(r'  {\LARGE\textbf{' + fix_text(packet_name) + r'}}\\[6pt]')
    if year:
        doc.append(r'  {\large ' + str(year) + r' Science Bowl}')
    doc.append(r'\end{center}')
    doc.append(r'\vspace{4pt}\noindent\rule{\linewidth}{1.5pt}\vspace{6pt}')
    doc.append('')

    # ── Questions ──────────────────────────────────────────────────────────────
    for pair_num, (pid, pair_qs) in enumerate(sorted(pairs.items()), 1):
        # Tossup before bonus
        pair_qs_sorted = sorted(pair_qs, key=lambda q: 0 if q.get('question_type') == 'TOSSUP' else 1)

        for q in pair_qs_sorted:
            doc.append(_render_question(q, pair_num))

        # Separator between pairs (light rule)
        doc.append(r'\vspace{4pt}\noindent{\color{gray!60}\rule{\linewidth}{0.5pt}}\vspace{4pt}')
        doc.append('')

        # Page break every 4 pairs to keep pages manageable
        if pair_num % 4 == 0:
            doc.append(r'\newpage')
            doc.append('')

    doc.append(r'\end{document}')

    return '\n'.join(doc)


# ─── CLI ──────────────────────────────────────────────────────────────────────

def convert_file(input_path: Path, output_path: Path):
    with open(input_path, encoding='utf-8') as f:
        data = json.load(f)
    latex = packet_to_latex(data)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(latex)
    print(f"  {input_path.name} → {output_path}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
        print(__doc__)
        sys.exit(0)

    if sys.argv[1] == '--all':
        here = Path(__file__).parent
        input_dir  = here / 'pdf_processing' / 'output'
        output_dir = here / 'pdf_processing' / 'latex_output'

        inputs = sorted(input_dir.glob('*.json'))
        if not inputs:
            print(f'No JSON files found in {input_dir}')
            sys.exit(1)

        print(f'Converting {len(inputs)} packets → {output_dir}')
        for p in inputs:
            convert_file(p, output_dir / (p.stem + '.tex'))

        print(f'\nDone. To compile all PDFs:')
        print(f'  cd {output_dir} && for f in *.tex; do pdflatex "$f"; done')

    else:
        input_path = Path(sys.argv[1])
        if not input_path.exists():
            print(f'Error: {input_path} not found')
            sys.exit(1)

        output_path = Path(sys.argv[2]) if len(sys.argv) >= 3 else input_path.with_suffix('.tex')
        convert_file(input_path, output_path)
        print(f'To compile: pdflatex {output_path}')


if __name__ == '__main__':
    main()
