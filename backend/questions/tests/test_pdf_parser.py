"""
Unit tests for PDF question parser.
"""
import re
from pathlib import Path
from django.test import TestCase
from questions.management.commands.import_questions import PDFParser


class PDFParserTestCase(TestCase):
    """Test cases for PDF parsing functionality."""

    def setUp(self):
        """Set up test fixtures."""
        # Path from backend/questions/tests/test_pdf_parser.py to backend/question_pdfs/Round 1.pdf
        self.pdf_path = Path(__file__).parent.parent.parent / "question_pdfs" / "Round 1.pdf"
        self.parser = PDFParser(str(self.pdf_path))

    def test_parser_finds_questions(self):
        """Test that parser finds questions in PDF."""
        questions = self.parser.parse()
        self.assertGreater(len(questions), 0, "Parser should find at least one question")

    def test_multiple_choice_answer_format(self):
        """Test that multiple choice answers are single letters."""
        questions = self.parser.parse()
        mc_questions = [q for q in questions if q['question_style'] == 'MULTIPLE_CHOICE']

        self.assertGreater(len(mc_questions), 0, "Should have multiple choice questions")

        for q in mc_questions:
            answer = q['correct_answer']
            self.assertIn(answer, ['W', 'X', 'Y', 'Z'],
                         f"MC answer should be W/X/Y/Z, got: {answer}")
            self.assertEqual(len(answer), 1,
                           f"MC answer should be single letter, got: {answer}")

    def test_multiple_choice_has_all_options(self):
        """Test that multiple choice questions have all 4 options extracted."""
        questions = self.parser.parse()
        mc_questions = [q for q in questions if q['question_style'] == 'MULTIPLE_CHOICE']

        for q in mc_questions:
            self.assertIsNotNone(q['option_1'], f"Question {q['number']} missing option W")
            self.assertIsNotNone(q['option_2'], f"Question {q['number']} missing option X")
            self.assertIsNotNone(q['option_3'], f"Question {q['number']} missing option Y")
            self.assertIsNotNone(q['option_4'], f"Question {q['number']} missing option Z")

            # Options should not be empty
            self.assertGreater(len(q['option_1']), 0, "Option W should not be empty")
            self.assertGreater(len(q['option_2']), 0, "Option X should not be empty")
            self.assertGreater(len(q['option_3']), 0, "Option Y should not be empty")
            self.assertGreater(len(q['option_4']), 0, "Option Z should not be empty")

    def test_question_text_does_not_include_options(self):
        """Test that question text doesn't include the W/X/Y/Z options."""
        questions = self.parser.parse()
        mc_questions = [q for q in questions if q['question_style'] == 'MULTIPLE_CHOICE']

        for q in mc_questions:
            question_text = q['question_text']

            # Question text should not contain option patterns like "W) ", "X) ", etc.
            # Allow single W, X, Y, Z in the text but not as option markers
            self.assertNotRegex(question_text, r'\bW\)\s+\w+',
                              f"Question {q['number']} text contains 'W) option'")
            self.assertNotRegex(question_text, r'\bX\)\s+\w+',
                              f"Question {q['number']} text contains 'X) option'")
            self.assertNotRegex(question_text, r'\bY\)\s+\w+',
                              f"Question {q['number']} text contains 'Y) option'")
            self.assertNotRegex(question_text, r'\bZ\)\s+\w+',
                              f"Question {q['number']} text contains 'Z) option'")

    def test_answer_no_footer_text(self):
        """Test that answers don't contain footer text."""
        questions = self.parser.parse()

        for q in questions:
            answer = q['correct_answer']

            self.assertNotIn('MIT Science Bowl', answer,
                           f"Question {q['number']} answer contains footer")
            self.assertNotIn('Page', answer,
                           f"Question {q['number']} answer contains page number")
            self.assertNotIn('Invitational', answer,
                           f"Question {q['number']} answer contains 'Invitational'")

    def test_short_answer_no_options(self):
        """Test that short answer questions don't have options."""
        questions = self.parser.parse()
        sa_questions = [q for q in questions if q['question_style'] == 'SHORT_ANSWER']

        for q in sa_questions:
            self.assertIsNone(q['option_1'],
                            f"Short answer question {q['number']} should not have option_1")
            self.assertIsNone(q['option_2'],
                            f"Short answer question {q['number']} should not have option_2")
            self.assertIsNone(q['option_3'],
                            f"Short answer question {q['number']} should not have option_3")
            self.assertIsNone(q['option_4'],
                            f"Short answer question {q['number']} should not have option_4")

    def test_all_questions_have_category(self):
        """Test that all questions have valid categories."""
        questions = self.parser.parse()
        valid_categories = ['BIOLOGY', 'CHEMISTRY', 'PHYSICS', 'EARTH_SPACE', 'MATH', 'ENERGY', 'OTHER']

        for q in questions:
            self.assertIn(q['category'], valid_categories,
                         f"Question {q['number']} has invalid category: {q['category']}")

    def test_all_questions_have_text(self):
        """Test that all questions have non-empty text."""
        questions = self.parser.parse()

        for q in questions:
            self.assertGreater(len(q['question_text']), 0,
                             f"Question {q['number']} has empty text")

    def test_all_questions_have_answer(self):
        """Test that all questions have answers."""
        questions = self.parser.parse()

        for q in questions:
            self.assertGreater(len(q['correct_answer']), 0,
                             f"Question {q['number']} has empty answer")

    def test_specific_question_parsing(self):
        """Test a specific known question to verify parsing accuracy."""
        questions = self.parser.parse()

        # Find question about acids and glass containers
        acid_question = None
        for q in questions:
            if 'glass' in q['question_text'].lower() and 'acid' in q['question_text'].lower():
                acid_question = q
                break

        if acid_question:
            # This should be multiple choice
            self.assertEqual(acid_question['question_style'], 'MULTIPLE_CHOICE')

            # Should have 4 options
            self.assertIsNotNone(acid_question['option_1'])
            self.assertIsNotNone(acid_question['option_2'])
            self.assertIsNotNone(acid_question['option_3'])
            self.assertIsNotNone(acid_question['option_4'])

            # Options should mention acids
            options_text = ' '.join([
                acid_question['option_1'],
                acid_question['option_2'],
                acid_question['option_3'],
                acid_question['option_4']
            ]).lower()
            self.assertIn('acid', options_text)

            # Answer should be a single letter
            self.assertIn(acid_question['correct_answer'], ['W', 'X', 'Y', 'Z'])

            # Question text should NOT contain the full options
            self.assertNotIn('Fluoroantimonic', acid_question['question_text'],
                           "Question text should not contain option text")


class OptionExtractionTestCase(TestCase):
    """Test cases for option extraction logic."""

    def setUp(self):
        """Set up test parser instance."""
        pdf_path = Path(__file__).parent.parent.parent / "question_pdfs" / "Round 1.pdf"
        self.parser = PDFParser(str(pdf_path))

    def test_extract_options_from_sample_text(self):
        """Test option extraction from sample multiple choice text."""
        sample_text = """Which of the following is correct?
W) First option here
X) Second option here
Y) Third option here
Z) Fourth option here"""

        options = self.parser._extract_options(sample_text, 'MULTIPLE_CHOICE')

        self.assertIsNotNone(options)
        self.assertEqual(len(options), 4)
        self.assertIn('W', options)
        self.assertIn('X', options)
        self.assertIn('Y', options)
        self.assertIn('Z', options)

        # Check option text is extracted (allowing for spacing variations)
        self.assertIn('option', options['W'].lower())
        self.assertIn('option', options['X'].lower())
        self.assertIn('option', options['Y'].lower())
        self.assertIn('option', options['Z'].lower())

    def test_extract_options_inline(self):
        """Test option extraction when options are on one line."""
        sample_text = """What is the answer? W) One X) Two Y) Three Z) Four"""

        options = self.parser._extract_options(sample_text, 'MULTIPLE_CHOICE')

        self.assertIsNotNone(options)
        self.assertEqual(len(options), 4)

    def test_extract_options_with_parentheses(self):
        """Test option extraction with parentheses in option text."""
        sample_text = """Question here?
W) Option with (parenthetical)
X) Another (read: example) option
Y) Third option
Z) Fourth option"""

        options = self.parser._extract_options(sample_text, 'MULTIPLE_CHOICE')

        self.assertIsNotNone(options)
        self.assertEqual(len(options), 4)


class AnswerCleaningTestCase(TestCase):
    """Test cases for answer cleaning logic."""

    def setUp(self):
        """Set up test parser instance."""
        pdf_path = Path(__file__).parent.parent.parent / "question_pdfs" / "Round 1.pdf"
        self.parser = PDFParser(str(pdf_path))

    def test_clean_multiple_choice_answer_with_prefix(self):
        """Test cleaning MC answer like 'W) ANSWER TEXT'."""
        answer = self.parser._clean_answer("W) CONTINENTAL-CONTINENTAL CONVERGENCE",
                                           'MULTIPLE_CHOICE', None)
        self.assertEqual(answer, 'W')

    def test_clean_multiple_choice_answer_plain_letter(self):
        """Test cleaning MC answer that's just a letter."""
        answer = self.parser._clean_answer("X", 'MULTIPLE_CHOICE', None)
        self.assertEqual(answer, 'X')

    def test_clean_answer_removes_footer(self):
        """Test that footer text is removed from answers."""
        answer = self.parser._clean_answer(
            "HIBERNATION MIT Science Bowl Invitational Round 1 Page 3",
            'SHORT_ANSWER', None
        )
        self.assertEqual(answer, 'HIBERNATION')

    def test_clean_answer_removes_accept_notes(self):
        """Test that (ACCEPT: ...) notes are removed."""
        answer = self.parser._clean_answer(
            "MAXIMUM PARSIMONY (ACCEPT: PARSIMONY, OCCAM'S RAZOR)",
            'SHORT_ANSWER', None
        )
        self.assertNotIn('ACCEPT', answer)
        self.assertIn('MAXIMUM PARSIMONY', answer)


def run_parser_tests():
    """Helper function to run parser tests and print results."""
    import sys
    from io import StringIO
    from django.test.runner import DiscoverRunner

    # Create test runner
    runner = DiscoverRunner(verbosity=2)

    # Run tests
    test_suite = runner.test_loader.loadTestsFromTestCase(PDFParserTestCase)
    test_suite.addTests(runner.test_loader.loadTestsFromTestCase(OptionExtractionTestCase))
    test_suite.addTests(runner.test_loader.loadTestsFromTestCase(AnswerCleaningTestCase))

    result = runner.test_runner(verbosity=2).run(test_suite)

    return result.wasSuccessful()
