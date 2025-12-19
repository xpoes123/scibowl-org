"""
Standalone script to extract text from PDF files with proper spacing.

Usage:
    python extract_pdf.py <pdf_path> [output_path]

Example:
    python extract_pdf.py "question_pdfs/Round 1.pdf" "question_pdfs/Round 1.txt"
"""

import re
import sys
from pathlib import Path


def fix_spacing(text: str) -> str:
    """
    Fix spacing issues in extracted PDF text.

    PDFs often have missing spaces between words. This function attempts to
    intelligently add spaces based on common patterns.
    """

    # Step 1: Add space between lowercase and uppercase (camelCase splitting)
    # Example: "theAlps" -> "the Alps"
    # BUT be careful not to break abbreviations like "pKa"
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)

    # Step 2: Add space between letter and number
    # Example: "question1" -> "question 1"
    text = re.sub(r'([a-z])(\d)', r'\1 \2', text)

    # Step 2b: Add space between number and word
    # Example: "2slices" -> "2 slices"
    text = re.sub(r'(\d)([a-z]+)', r'\1 \2', text)

    # Step 3: Add space between number and letter (but not at start of line)
    # Example: "1)EARTH" -> "1) EARTH"
    text = re.sub(r'(\d)([A-Z][a-z])', r'\1 \2', text)

    # Step 4: Fix common Science Bowl patterns
    # "EARTHANDSPACE" -> "EARTH AND SPACE"
    text = re.sub(r'EARTHANDSPACE', 'EARTH AND SPACE', text)

    # Step 5: Add space after common punctuation if missing
    # Example: "Alps.The" -> "Alps. The"
    text = re.sub(r'([.!?;:])([A-Z])', r'\1 \2', text)

    # Step 6: Add space before opening parentheses preceded by letter
    # Example: "choice(W)" -> "choice (W)"
    text = re.sub(r'([a-zA-Z])\(', r'\1 (', text)

    # Step 7: Fix question number patterns
    # "TOSS-UP1)" -> "TOSS-UP\n1)"
    text = re.sub(r'(TOSS-UP)(\d+\))', r'\1\n\2', text)
    text = re.sub(r'(BONUS)(\d+\))', r'\1\n\2', text)

    # Step 8: Add space after question type markers followed by category
    # "1)BIOLOGY" -> "1) BIOLOGY"
    text = re.sub(r'(\d+\))([A-Z]{2,})', r'\1 \2', text)

    # Step 9: Add space before option markers W), X), Y), Z) if preceded by letter
    # "choiceW)" -> "choice W)"
    text = re.sub(r'([a-z])([WXYZ]\))', r'\1 \2', text)

    # Step 10: Add space after dash/hyphen if followed by letter and preceded by space
    # " � Multiple" -> " � Multiple"
    text = re.sub(r'([�-])([A-Z][a-z])', r'\1 \2', text)

    # Step 11: Fix ANSWER: pattern
    # "ANSWER:W)" -> "ANSWER: W)"
    text = re.sub(r'ANSWER:([A-Z])', r'ANSWER: \1', text)

    # Step 12: More aggressive fix for concatenated words
    # Add space between word boundaries (lowercase followed by uppercase)
    # This catches most cases of concatenated words

    # Common multi-word terms that appear in science bowl questions
    multi_word_patterns = [
        # Question types
        (r'MultipleChoice', 'Multiple Choice'),
        (r'ShortAnswer', 'Short Answer'),
        (r'IdentifyAll', 'Identify All'),

        # Common phrases - case insensitive replacements
        (r'ofthefollowing', 'of the following'),
        (r'Identifyall', 'Identify all'),
        (r'innorthern', 'in northern'),
        (r'ofwhich', 'of which'),
        (r'typesof', 'types of'),
        (r'tectonicboundaries', 'tectonic boundaries'),
        (r'Whichof', 'Which of'),
        (r'Whatisthe', 'What is the'),
        (r'Howmany', 'How many'),
        (r'Ifyou', 'If you'),
        (r'Giventhat', 'Given that'),
        (r'Supposethat', 'Suppose that'),
        (r'areanexampleof', 'are an example of'),
        (r'followingthreelandmarks', 'following three landmarks'),
        (r'thatare', 'that are'),
        (r'usuallyglacialinorigin', 'usually glacial in origin'),
        (r'Kettlelake', 'Kettle lake'),
        (r'Intermittentstream', 'Intermittent stream'),
        (r'Submarinevalley', 'Submarine valley'),
        (r'followingcompounds', 'following compounds'),
        (r'violatestheoctetrule', 'violates the octet rule'),
        (r'Sulfurtetrafluoride', 'Sulfur tetrafluoride'),
        (r'Dinitrogentetroxide', 'Dinitrogen tetroxide'),
        (r'Phosphorustrichloride', 'Phosphorus trichloride'),
        (r'Sulfuricacid', 'Sulfuric acid'),
        (r'Hydrofluoricacid', 'Hydrofluoric acid'),
        (r'Perchloricacid', 'Perchloric acid'),
        (r'Nitricacid', 'Nitric acid'),
        (r'ofwhattypeofmutation', 'of what type of mutation'),
        (r'afibroblastintoastemcell', 'a fibroblast into a stem cell'),
        (r'Theseinducedstemcells', 'These induced stem cells'),
        (r'havewhichof', 'have which of'),
        (r'followingpotencies', 'following potencies'),
        (r'expressedas', 'expressed as'),
        (r'raisedtowhatpower', 'raised to what power'),
        (r'kilometers,howmanykilometersdoes', 'kilometers, how many kilometers does'),
        (r'Juliettravel', 'Juliet travel'),
        (r'winterconditionsoftenundergowhattypeof', 'winter conditions often undergo what type of'),
        (r'prolongedtorpor', 'prolonged torpor'),
        (r'usedtoscorephylogenetictrees', 'used to score phylogenetic trees'),
        (r'bythetotalnumberof', 'by the total number of'),
        (r'character-statechanges', 'character-state changes'),
        (r'appliesaconstantforceof', 'applies a constant force of'),
        (r'millinewtonstotheblockalong', 'millinewtons to the block along'),
        (r'accelerationoftheblockin', 'acceleration of the block in'),
        (r'meterspersecondsquared', 'meters per second squared'),
        (r'followingthreecharacteristicsof', 'following three characteristics of'),
        (r'meanderingstreamsthattypicallyincrease', 'meandering streams that typically increase'),
        (r'asonemovesdownstream', 'as one moves downstream'),
        (r'Hemispherehurricane,relativeto', 'Hemisphere hurricane, relative to'),
        (r'itsdirectionofmotion,experiencesthestrongest', 'its direction of motion, experiences the strongest'),
        (r'stormsurge', 'storm surge'),
        (r'Leftfront', 'Left front'),
        (r'Rightfront', 'Right front'),
        (r'Leftrear', 'Left rear'),
        (r'Rightrear', 'Right rear'),

        # Compound words that commonly appear together
        (r'continentalconvergence', 'continental convergence'),
        (r'oceanicconvergence', 'oceanic convergence'),
        (r'continentaldivergence', 'continental divergence'),

        # More concatenated word patterns from the PDF
        (r'Alpsin', 'Alps in'),
        (r'Italyare', 'Italy are'),
        (r'followingtypes', 'following types'),
        (r'oftectonic', 'of tectonic'),
        (r'landmarksthat', 'landmarks that'),
        (r'compoundsviolates', 'compounds violates'),
        (r'cellshave', 'cells have'),
        (r'Which of', 'Which of'),  # catch case issues
        (r'expressed as', 'expressed as'),
        (r'raised to', 'raised to'),
        (r'circumferenceis', 'circumference is'),
        (r'kilometers,How', 'kilometers, How'),
        (r'kilometersdoes', 'kilometers does'),
        (r'ofprolonged', 'of prolonged'),
        (r'treesby', 'trees by'),
        (r'ofcharacter', 'of character'),
        (r'alongthedesk', 'along the desk'),
        (r'Ifthecoefficients', 'If the coefficients'),
        (r'inmeters', 'in meters'),
        (r'increaseas', 'increase as'),
        (r'toits', 'to its'),
        (r'strongeststorm', 'strongest storm'),
        (r'Rickyrolls', 'Ricky rolls'),
        (r'afairsix', 'a fair six'),
        (r'sideddieandseesanevennumber', 'sided die and sees an even number'),
        (r'expectedvalueofthenumber', 'expected value of the number'),
        (r'Rickysaw', 'Ricky saw'),
        (r'Acheeseburgerhas', 'A cheeseburger has'),
        (r'slicesofbreadand', 'slices of bread and'),
        (r'sliceofbreadhave', 'slice of bread have'),
        (r'hypersecretionof', 'hypersecretion of'),
        (r'whichplanthormone', 'which plant hormone'),
        (r'effectstatesthatatsmaller', 'effect states that at smaller'),
        (r'forthe', 'for the'),
        (r'Alleeeffect', 'Allee effect'),
        (r'Atsmallerpopulationsizes', 'At smaller population sizes'),
        (r'organismsaremorevulnerable', 'organisms are more vulnerable'),
        (r'topredatorattack', 'to predator attack'),
        (r'populationsaremorelikely', 'populations are more likely'),
        (r'toexperiencestronggeneticdrift', 'to experience strong genetic drift'),
        (r'organismshaveahardertimefindingmates', 'organisms have a harder time finding mates'),
        (r'diseasespreadsmorerapidly', 'disease spreads more rapidly'),
        (r'discontinuitylocated', 'discontinuity located'),
        (r'Betweentheupperandlowercrust', 'Between the upper and lower crust'),
        (r'Betweenthelowercrustanduppermantle', 'Between the lower crust and upper mantle'),
        (r'Betweentheupperandlowermantle', 'Between the upper and lower mantle'),
        (r'Betweenthelowermantleandoutercore', 'Between the lower mantle and outer core'),
        (r'A0\.', 'A 0.'),
        (r'molarsolutionofhydrochloricacidisusedtotitrate', 'molar solution of hydrochloric acid is used to titrate'),
        (r'millilitersof', 'milliliters of'),
        (r'molarsodiumhydroxide', 'molar sodium hydroxide'),
        (r'Inmilliliters', 'In milliliters'),
        (r'howmuchhydrochloricacidisrequired', 'how much hydrochloric acid is required'),
        (r'toreachtheequivalencepoint', 'to reach the equivalence point'),
        (r'thehighestcontributingresonanceformof', 'the highest contributing resonance form of'),
    ]

    # Apply all pattern replacements
    for pattern, replacement in multi_word_patterns:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    # Step 13: Clean up multiple consecutive spaces
    text = re.sub(r' {2,}', ' ', text)

    # Step 14: Clean up spaces around newlines
    text = re.sub(r' *\n *', '\n', text)

    # Step 15: Ensure consistent line breaks
    # Multiple newlines should be max 2
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_pdf.py <pdf_path> [output_path]")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])

    if not pdf_path.exists():
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)

    # Determine output path
    if len(sys.argv) >= 3:
        output_path = Path(sys.argv[2])
    else:
        output_path = pdf_path.with_suffix('.txt')

    print(f'Extracting text from: {pdf_path}')
    print(f'Output file: {output_path}')

    try:
        import pdfplumber
    except ImportError:
        print("Error: pdfplumber is required. Install it with: pip install pdfplumber")
        sys.exit(1)

    # Extract raw text from PDF
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        for page_num, page in enumerate(pdf.pages, 1):
            print(f'Processing page {page_num}/{total_pages}...')
            page_text = page.extract_text()
            if page_text:
                full_text += page_text + "\n\n"

    print('Applying spacing corrections...')

    # Apply spacing corrections
    corrected_text = fix_spacing(full_text)

    # Write to output file
    output_path.write_text(corrected_text, encoding='utf-8')

    print(f'Successfully extracted text to {output_path}')
    print(f'Total characters: {len(corrected_text)}')
    print(f'\nFirst 500 characters:')
    print('-' * 80)
    print(corrected_text[:500])
    print('-' * 80)


if __name__ == '__main__':
    main()
