"""
Django management command to import Science Bowl questions from JSON files.

The JSON files should be generated using the extract_pdf_pymupdf.py and text_to_json.py scripts.

Usage:
    python manage.py import_json <json_path> [--clear] [--dry-run]

Examples:
    # Import questions from JSON
    python manage.py import_json question_pdfs/Round_1_final.json

    # Clear existing questions first, then import
    python manage.py import_json question_pdfs/Round_1_final.json --clear

    # Preview what would be imported without saving
    python manage.py import_json question_pdfs/Round_1_final.json --dry-run
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from questions.models import Question


class Command(BaseCommand):
    help = 'Import Science Bowl questions from JSON files'

    def add_arguments(self, parser):
        parser.add_argument(
            'json_path',
            type=str,
            help='Path to the JSON file to import'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing questions before importing'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview questions without saving to database'
        )
        parser.add_argument(
            '--skip-duplicates',
            action='store_true',
            help='Skip questions that already exist in the database'
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompt (auto-confirm)'
        )

    def handle(self, *args, **options):
        json_path = Path(options['json_path'])
        clear_existing = options['clear']
        dry_run = options['dry_run']
        skip_duplicates = options['skip_duplicates']
        auto_confirm = options['yes']

        # Validate file exists
        if not json_path.exists():
            raise CommandError(f'JSON file not found: {json_path}')

        self.stdout.write(f'Reading JSON from: {json_path}')

        # Load JSON data
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                questions_data = json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f'Invalid JSON file: {e}')

        if not isinstance(questions_data, list):
            raise CommandError('JSON file must contain a list of questions')

        self.stdout.write(
            self.style.SUCCESS(f'Loaded {len(questions_data)} questions from JSON')
        )

        # Dry run - just display questions
        if dry_run:
            self._display_questions(questions_data)
            return

        # Clear existing questions if requested
        if clear_existing:
            count = Question.objects.count()
            if count > 0:
                if not auto_confirm:
                    confirm = input(
                        f'This will delete {count} existing questions. '
                        f'Are you sure? (yes/no): '
                    )
                    if confirm.lower() != 'yes':
                        self.stdout.write(self.style.WARNING('Import cancelled'))
                        return

                Question.objects.all().delete()
                self.stdout.write(
                    self.style.WARNING(f'Deleted {count} existing questions')
                )

        # Import questions
        created_count = 0
        skipped_count = 0
        error_count = 0

        with transaction.atomic():
            for i, q_data in enumerate(questions_data, 1):
                try:
                    # Check for duplicates if requested
                    if skip_duplicates:
                        exists = Question.objects.filter(
                            question_text=q_data['question_text'],
                            category=q_data['category'],
                            question_type=q_data['question_type']
                        ).exists()

                        if exists:
                            skipped_count += 1
                            self.stdout.write(
                                f'  [{i}/{len(questions_data)}] Skipped duplicate: '
                                f'{q_data["question_type"]} - {q_data["category"]}'
                            )
                            continue

                    # Create question
                    question = Question.objects.create(
                        question_text=q_data['question_text'],
                        category=q_data['category'],
                        question_style=q_data['question_style'],
                        question_type=q_data['question_type'],
                        correct_answer=q_data['correct_answer'],
                        option_1=q_data.get('option_1'),
                        option_2=q_data.get('option_2'),
                        option_3=q_data.get('option_3'),
                        option_4=q_data.get('option_4'),
                        source=q_data.get('source'),
                        explanation=q_data.get('explanation'),
                    )
                    created_count += 1

                    self.stdout.write(
                        f'  [{i}/{len(questions_data)}] Created: '
                        f'{question.question_type} #{question.id} - {question.category}'
                    )

                except Exception as e:
                    error_count += 1
                    self.stderr.write(
                        self.style.ERROR(
                            f'  [{i}/{len(questions_data)}] Error: {e}'
                        )
                    )

        # Summary
        self.stdout.write('\n' + '='*80)
        self.stdout.write(self.style.SUCCESS('IMPORT SUMMARY'))
        self.stdout.write('='*80)
        self.stdout.write(f'Total questions in JSON: {len(questions_data)}')
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created: {created_count}')
        )
        if skipped_count > 0:
            self.stdout.write(
                self.style.WARNING(f'Skipped duplicates: {skipped_count}')
            )
        if error_count > 0:
            self.stdout.write(
                self.style.ERROR(f'Errors: {error_count}')
            )

        # Display stats
        self.stdout.write('\n' + '='*80)
        self.stdout.write('DATABASE STATISTICS')
        self.stdout.write('='*80)

        total = Question.objects.count()
        self.stdout.write(f'Total questions in database: {total}')

        # Breakdown by category
        self.stdout.write('\nBy Category:')
        for category, label in Question.CATEGORY_CHOICES:
            count = Question.objects.filter(category=category).count()
            if count > 0:
                self.stdout.write(f'  {label}: {count}')

        # Breakdown by type
        self.stdout.write('\nBy Type:')
        for q_type, label in Question.QUESTION_TYPE_CHOICES:
            count = Question.objects.filter(question_type=q_type).count()
            if count > 0:
                self.stdout.write(f'  {label}: {count}')

        # Breakdown by style
        self.stdout.write('\nBy Style:')
        for style, label in Question.QUESTION_STYLE_CHOICES:
            count = Question.objects.filter(question_style=style).count()
            if count > 0:
                self.stdout.write(f'  {label}: {count}')

    def _display_questions(self, questions_data):
        """Display questions for dry-run mode."""
        self.stdout.write('\n' + '='*80)
        self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))
        self.stdout.write('='*80 + '\n')

        for i, q in enumerate(questions_data, 1):
            self.stdout.write(f'\n--- Question {i} ---')
            self.stdout.write(f'Type: {q["question_type"]}')
            self.stdout.write(f'Category: {q["category"]}')
            self.stdout.write(f'Style: {q["question_style"]}')

            # Truncate long question text
            text_preview = q["question_text"][:100]
            if len(q["question_text"]) > 100:
                text_preview += '...'
            self.stdout.write(f'Text: {text_preview}')

            if q.get('option_1'):
                self.stdout.write('Options:')
                self.stdout.write(f'  W) {q["option_1"][:60]}')
                self.stdout.write(f'  X) {q["option_2"][:60]}')
                self.stdout.write(f'  Y) {q["option_3"][:60]}')
                self.stdout.write(f'  Z) {q["option_4"][:60]}')

            self.stdout.write(f'Answer: {q["correct_answer"]}')

            if q.get('source'):
                self.stdout.write(f'Source: {q["source"]}')

        self.stdout.write('\n' + '='*80)
        self.stdout.write(f'Total: {len(questions_data)} questions')
        self.stdout.write('='*80)
