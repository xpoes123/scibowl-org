from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from datetime import date
from tournaments.models import Tournament, Team, Player, Room, Round

User = get_user_model()


class Command(BaseCommand):
    help = 'Load sample data for a live tournament with 16 teams, players, rooms, and rounds'

    def handle(self, *args, **kwargs):
        # Team names - creative science-themed names
        team_names = [
            ("Quantum Quizzers", "MIT"),
            ("Atomic Aces", "Stanford"),
            ("Neural Networks", "UC Berkeley"),
            ("Periodic Panthers", "Caltech"),
            ("Genomic Giants", "Harvard"),
            ("Photon Phasers", "Princeton"),
            ("Molecular Mavericks", "Yale"),
            ("Cosmic Crusaders", "Cornell"),
            ("Electron Eagles", "Columbia"),
            ("Particle Prodigies", "Carnegie Mellon"),
            ("Galactic Geniuses", "Duke"),
            ("Chemical Champions", "Northwestern"),
            ("Velocity Victors", "UChicago"),
            ("Thermal Titans", "Georgia Tech"),
            ("Nucleus Knights", "Rice"),
            ("Plasma Pioneers", "Johns Hopkins"),
        ]

        # Get or create tournament director
        director, _ = User.objects.get_or_create(
            username='tournament_director',
            defaults={
                'first_name': 'Sarah',
                'last_name': 'Chen',
                'email': 'schen@stanford.edu',
                'bio': 'Tournament director for Stanford Science Bowl.',
                'school': 'Stanford University',
            }
        )

        # Get the Stanford 2026 High School Tournament and set it to live
        try:
            tournament = Tournament.objects.get(name='Stanford 2026 High School Tournament')
            # Update tournament to be live
            tournament.status = 'IN_PROGRESS'
            tournament.format = 'ROUND_ROBIN'
            tournament.max_teams = 16
            tournament.current_teams = 16
            tournament.save()

            self.stdout.write(self.style.SUCCESS(f'Found tournament: {tournament.name}'))
            self.stdout.write(self.style.SUCCESS(f'Set status to: IN_PROGRESS'))

            # Clear existing data for this tournament
            tournament.teams.all().delete()
            tournament.rooms.all().delete()
            tournament.rounds.all().delete()
            self.stdout.write(self.style.WARNING('Cleared existing tournament data'))
        except Tournament.DoesNotExist:
            self.stdout.write(self.style.ERROR('Stanford 2026 High School Tournament not found!'))
            self.stdout.write(self.style.ERROR('Please run: python manage.py load_sample_tournaments first'))
            return

        # Create 16 teams with 5 players each, assigned to 4 pools (A, B, C, D)
        teams = []
        pools = ['A', 'B', 'C', 'D']
        for idx, (team_name, school) in enumerate(team_names, 1):
            # Assign teams to pools: seeds 1,5,9,13 to Pool A, 2,6,10,14 to Pool B, etc.
            pool = pools[(idx - 1) % 4]
            team = Team.objects.create(
                tournament=tournament,
                name=team_name,
                school=school,
                seed=idx,
                pool=pool,
            )
            teams.append(team)

            # Create 5 players for each team
            positions = ['Captain', 'Vice Captain', 'Member', 'Member', 'Alternate']
            for player_idx in range(5):
                Player.objects.create(
                    team=team,
                    name=f"{team_name.split()[0]} Player {player_idx + 1}",
                    grade_level=str(11 if player_idx < 3 else 10),
                    total_points=0,
                    tossups_heard=0,
                    correct_buzzes=0,
                    incorrect_buzzes=0,
                )

            self.stdout.write(self.style.SUCCESS(f'Created team: {team_name} with 5 players'))

        # Create 8 rooms
        room_names = [
            "Physics Lab A",
            "Chemistry Lab B",
            "Biology Lab C",
            "Math Room 201",
            "Earth Science 305",
            "Energy Lab D",
            "Auditorium East",
            "Auditorium West",
        ]

        rooms = []
        for room_name in room_names:
            room = Room.objects.create(
                tournament=tournament,
                name=room_name,
                status='IN_PROGRESS',
                current_round=2,  # Currently in round 2
            )
            rooms.append(room)
            self.stdout.write(self.style.SUCCESS(f'Created room: {room_name}'))

        # Create 5 rounds with packet assignments
        rounds_data = [
            (1, "Round 1 - Pool Play", "NSB 2024 Regionals Set 1"),
            (2, "Round 2 - Pool Play", "NSB 2024 Regionals Set 2"),
            (3, "Round 3 - Pool Play", "NSB 2024 Nationals Prelim"),
            (4, "Round 4 - Semifinals", "NSB 2025 Regionals Set 1"),
            (5, "Round 5 - Finals", "NSB 2025 Nationals Finals"),
        ]

        for round_num, round_name, packet_name in rounds_data:
            Round.objects.create(
                tournament=tournament,
                round_number=round_num,
                name=round_name,
                packet_name=packet_name,
            )
            self.stdout.write(self.style.SUCCESS(f'Created round: {round_name}'))

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Live tournament data loaded successfully!'
            f'\n   - 16 teams created'
            f'\n   - 80 players created (5 per team)'
            f'\n   - 8 rooms created'
            f'\n   - 5 rounds created'
        ))
