from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import date, timedelta
from tournaments.models import Tournament

User = get_user_model()


class Command(BaseCommand):
    help = 'Load sample tournament data for Stanford 2026'

    def handle(self, *args, **kwargs):
        # Create or get sample tournament director
        director, created = User.objects.get_or_create(
            username='tournament_director',
            defaults={
                'first_name': 'Sarah',
                'last_name': 'Chen',
                'email': 'schen@stanford.edu',
                'bio': 'Tournament director for Stanford Science Bowl. Former competitor and current graduate student in Physics.',
                'school': 'Stanford University',
            }
        )

        if created:
            director.set_password('temp_password_123')
            director.save()
            self.stdout.write(self.style.SUCCESS(f'Created tournament director: {director.username}'))
        else:
            self.stdout.write(self.style.WARNING(f'Tournament director already exists: {director.username}'))
        # Create Stanford 2026 Collegiate Tournament
        collegiate_tournament, created = Tournament.objects.get_or_create(
            name='Stanford 2026 Collegiate Tournament',
            defaults={
                'description': 'Annual collegiate quiz bowl tournament hosted by Stanford University. Features teams from top universities competing in science knowledge.',
                'division': 'COLLEGIATE',
                'format': 'ROUND_ROBIN',
                'status': 'REGISTRATION',
                'tournament_date': date(2026, 3, 15),
                'registration_deadline': date(2026, 2, 28),
                'location': 'Stanford, CA',
                'venue': 'Stanford University Campus',
                'host_organization': 'Stanford University Science Quiz Bowl',
                'tournament_director': director,
                'max_teams': 24,
                'current_teams': 8,
                'website_url': 'https://stanford.edu/sciencebowl',
                'registration_url': 'https://forms.stanford.edu/sciencebowl-register',
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created: {collegiate_tournament.name}'))
        else:
            self.stdout.write(self.style.WARNING(f'Already exists: {collegiate_tournament.name}'))

        # Create Stanford 2026 High School Tournament
        high_school_tournament, created = Tournament.objects.get_or_create(
            name='Stanford 2026 High School Tournament',
            defaults={
                'description': 'Premier high school science quiz bowl competition. Open to all high school teams in the western region.',
                'division': 'HIGH_SCHOOL',
                'format': 'DOUBLE_ELIM',
                'status': 'REGISTRATION',
                'tournament_date': date(2026, 4, 12),
                'registration_deadline': date(2026, 3, 30),
                'location': 'Stanford, CA',
                'venue': 'Stanford University Campus',
                'host_organization': 'Stanford University Science Quiz Bowl',
                'tournament_director': director,
                'max_teams': 32,
                'current_teams': 12,
                'website_url': 'https://stanford.edu/sciencebowl/hs',
                'registration_url': 'https://forms.stanford.edu/sciencebowl-hs-register',
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created: {high_school_tournament.name}'))
        else:
            self.stdout.write(self.style.WARNING(f'Already exists: {high_school_tournament.name}'))

        # Create an upcoming tournament
        upcoming_tournament, created = Tournament.objects.get_or_create(
            name='MIT Science Bowl Invitational 2026',
            defaults={
                'description': 'Competitive science bowl tournament featuring challenging questions across all science categories.',
                'division': 'HIGH_SCHOOL',
                'format': 'SWISS',
                'status': 'UPCOMING',
                'tournament_date': date(2026, 5, 20),
                'registration_deadline': date(2026, 5, 1),
                'location': 'Cambridge, MA',
                'venue': 'MIT Campus',
                'host_organization': 'MIT Science Bowl Club',
                'tournament_director': director,
                'max_teams': 20,
                'current_teams': 0,
                'website_url': 'https://mit.edu/sciencebowl',
                'registration_url': '',
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created: {upcoming_tournament.name}'))
        else:
            self.stdout.write(self.style.WARNING(f'Already exists: {upcoming_tournament.name}'))

        self.stdout.write(self.style.SUCCESS('\nSample tournaments loaded successfully!'))
