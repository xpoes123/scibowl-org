"""
Django management command to import Science Bowl questions from a packet JSON file.

The JSON file must follow the packet_json_spec format:
  {
    "packet": "Round 1",
    "year": 2025,
    "questions": [ { "id": 1, "pair_id": 1, "question_type": "TOSSUP", ... }, ... ]
  }

Usage:
    python manage.py import_json <json_path> --question-set NAME --packet-number N [options]

Examples:
    # Import a packet into a question set
    python manage.py import_json round_1.json --question-set "NSB 2025" --packet-number 1

    # Specify a version tag (default: v1)
    python manage.py import_json round_1.json --question-set "NSB 2025" --packet-number 1 --version-tag v2

    # Preview without saving
    python manage.py import_json round_1.json --question-set "NSB 2025" --packet-number 1 --dry-run

    # Replace all questions in the packet before importing
    python manage.py import_json round_1.json --question-set "NSB 2025" --packet-number 1 --clear
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from questions.models import Packet, Question, QuestionSet, QuestionSetVersion


class Command(BaseCommand):
    help = 'Import Science Bowl questions from a packet JSON file (packet_json_spec format)'

    def add_arguments(self, parser):
        parser.add_argument(
            'json_path',
            type=str,
            help='Path to the packet JSON file',
        )
        parser.add_argument(
            '--question-set',
            required=True,
            metavar='NAME',
            help='Name of the QuestionSet to import into (created if it does not exist)',
        )
        parser.add_argument(
            '--packet-number',
            required=True,
            type=int,
            metavar='N',
            help='Packet number within the QuestionSetVersion (e.g. 1, 2, 3)',
        )
        parser.add_argument(
            '--version-tag',
            default='v1',
            metavar='TAG',
            help='QuestionSetVersion tag to use (default: v1, created if it does not exist)',
        )
        parser.add_argument(
            '--year',
            type=int,
            default=None,
            metavar='YEAR',
            help='Override the year for the QuestionSet (default: taken from JSON)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing questions in this packet before importing',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview questions without saving to database',
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompts',
        )

    def handle(self, *args, **options):
        json_path = Path(options['json_path'])
        question_set_name = options['question_set']
        packet_number = options['packet_number']
        version_tag = options['version_tag']
        year_override = options['year']
        clear_existing = options['clear']
        dry_run = options['dry_run']
        auto_confirm = options['yes']

        if not json_path.exists():
            raise CommandError(f'JSON file not found: {json_path}')

        self.stdout.write(f'Reading JSON from: {json_path}')

        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                packet_data = json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f'Invalid JSON file: {e}')

        if not isinstance(packet_data, dict) or 'questions' not in packet_data:
            raise CommandError(
                'JSON file must be a packet object with a "questions" key. '
                'See packet_json_spec.md for the expected format.'
            )

        questions_data = packet_data['questions']
        if not isinstance(questions_data, list):
            raise CommandError('"questions" must be a list')

        packet_title = packet_data.get('packet', '')
        year = year_override if year_override is not None else packet_data.get('year')

        self.stdout.write(
            f'Loaded {len(questions_data)} questions '
            f'(packet: {packet_title!r}, year: {year})'
        )

        if dry_run:
            self._display_questions(questions_data)
            return

        with transaction.atomic():
            question_set, qs_created = QuestionSet.objects.get_or_create(
                name=question_set_name,
                defaults={'year': year},
            )
            if qs_created:
                self.stdout.write(f'Created QuestionSet: {question_set_name!r} (year={year})')
            else:
                self.stdout.write(f'Using existing QuestionSet: {question_set_name!r}')

            qs_version, qsv_created = QuestionSetVersion.objects.get_or_create(
                question_set=question_set,
                tag=version_tag,
                defaults={'is_primary': True},
            )
            if qsv_created:
                self.stdout.write(f'Created QuestionSetVersion tag={version_tag!r}')
            else:
                self.stdout.write(f'Using existing QuestionSetVersion tag={version_tag!r}')

            packet_obj, pkt_created = Packet.objects.get_or_create(
                question_set_version=qs_version,
                number=packet_number,
                defaults={'title': packet_title},
            )
            if pkt_created:
                self.stdout.write(f'Created Packet #{packet_number} ({packet_title!r})')
            else:
                self.stdout.write(f'Using existing Packet #{packet_number} ({packet_obj.title!r})')

            if clear_existing:
                count = Question.objects.filter(packet=packet_obj).count()
                if count > 0:
                    if not auto_confirm:
                        confirm = input(
                            f'This will delete {count} existing questions in this packet. '
                            f'Are you sure? (yes/no): '
                        )
                        if confirm.lower() != 'yes':
                            self.stdout.write(self.style.WARNING('Import cancelled'))
                            return
                    Question.objects.filter(packet=packet_obj).delete()
                    self.stdout.write(self.style.WARNING(f'Deleted {count} existing questions'))

            created_count = 0
            updated_count = 0
            error_count = 0

            for i, q_data in enumerate(questions_data, 1):
                try:
                    pair_id = q_data['pair_id']
                    qtype = q_data['question_type']
                    _, created = Question.objects.update_or_create(
                        packet=packet_obj,
                        pair_id=pair_id,
                        question_type=qtype,
                        defaults={
                            'question_text': q_data['question_text'],
                            'category': q_data['category'],
                            'question_style': q_data['question_style'],
                            'correct_answer': q_data['correct_answer'],
                            'options': q_data.get('options', []),
                            'explanation': q_data.get('explanation'),
                        },
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                    self.stdout.write(
                        f'  [{i}/{len(questions_data)}] {"Created" if created else "Updated"}: '
                        f'pair {pair_id} {qtype} - {q_data["category"]}'
                    )
                except Exception as e:
                    error_count += 1
                    self.stderr.write(
                        self.style.ERROR(f'  [{i}/{len(questions_data)}] Error: {e}')
                    )

        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.SUCCESS('IMPORT SUMMARY'))
        self.stdout.write('=' * 80)
        self.stdout.write(f'Total in JSON: {len(questions_data)}')
        self.stdout.write(self.style.SUCCESS(f'Created: {created_count}'))
        if updated_count:
            self.stdout.write(f'Updated: {updated_count}')
        if error_count:
            self.stdout.write(self.style.ERROR(f'Errors: {error_count}'))

    def _display_questions(self, questions_data):
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))
        self.stdout.write('=' * 80 + '\n')

        for i, q in enumerate(questions_data, 1):
            self.stdout.write(f'\n--- Question {i} (pair {q.get("pair_id")}) ---')
            self.stdout.write(f'Type: {q["question_type"]}')
            self.stdout.write(f'Category: {q["category"]}')
            self.stdout.write(f'Style: {q["question_style"]}')

            text_preview = q["question_text"][:100]
            if len(q["question_text"]) > 100:
                text_preview += '...'
            self.stdout.write(f'Text: {text_preview}')

            options = q.get('options') or []
            if options:
                labels = 'WXYZ'
                self.stdout.write('Options:')
                for idx, opt in enumerate(options):
                    label = labels[idx] if idx < len(labels) else str(idx + 1)
                    self.stdout.write(f'  {label}) {str(opt)[:60]}')

            self.stdout.write(f'Answer: {q["correct_answer"]}')

        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(f'Total: {len(questions_data)} questions')
        self.stdout.write('=' * 80)
