# Development Guide for Claude

## Purpose of This Document

This document explains how Claude (AI assistant) should approach development on this project. It covers patterns, principles, and workflows that have been established.

---

## Project Overview

**NSB Arena** is a tournament management platform for quiz bowl competitions. It replaces Google Sheets for scoring/standings and provides live room visibility and post-tournament analytics.

**Key Systems:**
- **Arena** (this codebase) - Tournament UI, data model, visualization
- **MODAQ** (external) - Scoring/buzzing system that writes results to Arena's database

**Claude's Role:** Build the Arena platform. Never implement MODAQ scoring logic.

---

## Core Development Principles

### 1. **Unified Dashboard Architecture**

The tournament detail page is **the same for everyone**. Admins and students see the same view, with admin-only controls shown conditionally.

```typescript
// Check if current user is admin
const isAdmin = currentUser && tournament?.director && currentUser.id === tournament.director.id;

// Progressive disclosure pattern
{isAdmin && (
  <button onClick={handleEdit}>Edit</button>
)}
```

**Why:** Simplicity, consistency, seamless transitions, builds trust.

### 2. **Progressive Disclosure**

- Show everyone the same information
- Only show edit controls to admins
- Works for logged-out users (view-only)

### 3. **Optional Authentication**

Many endpoints should work without authentication for public viewing:

```typescript
const token = localStorage.getItem('access_token');
const headers: HeadersInit = {
  'Content-Type': 'application/json',
};

// Add auth header only if user is logged in
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

### 4. **Two-Phase Tournament Workflow**

**Phase 1: Pre-Tournament (Write-Heavy)**
- TDs configure pools, teams, schedule
- Manual controls, simple defaults, preview before committing
- Favor drag-and-drop and buttons over complex wizards

**Phase 2: During Tournament (Read-Heavy)**
- TDs monitor progress, don't micromanage
- Focus on visibility, not control
- MODAQ writes results, Arena displays them

### 5. **Simplicity Over Automation**

**DO:**
- ✅ Manual, explicit controls (drag-drop, buttons)
- ✅ Simple defaults that can be adjusted
- ✅ Preview before committing
- ✅ Clear visual feedback

**DON'T:**
- ❌ Complex auto-scheduling wizards with 50 options
- ❌ AI-powered algorithms
- ❌ Real-time editing during live tournament
- ❌ Over-automated workflows

---

## Technology Stack

**Backend:**
- Django 5.1.4 + Django REST Framework
- PostgreSQL 16
- ViewSets for API endpoints
- Docker for deployment

**Frontend:**
- React 19 + TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- No state management library (use React hooks)

---

## Code Patterns to Follow

### Backend Patterns

**1. Use ViewSets for CRUD:**
```python
class TeamViewSet(viewsets.ModelViewSet):
    """Full CRUD operations."""
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['get'])
    def players(self, request, pk=None):
        """Custom action for nested resources."""
        team = self.get_object()
        players = team.players.all()
        serializer = PlayerSerializer(players, many=True)
        return Response(serializer.data)
```

**2. Use SerializerMethodField for computed fields:**
```python
class TeamSerializer(serializers.ModelSerializer):
    players_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'school', 'players_count']

    def get_players_count(self, obj):
        return obj.players.count()
```

**3. Use transactions for multi-step operations:**
```python
with transaction.atomic():
    # Create multiple objects
    for team1, team2 in matchups:
        Game.objects.create(
            tournament=tournament,
            team1=team1,
            team2=team2
        )
```

### Frontend Patterns

**1. Master-Detail Layout:**
```typescript
// Left: List of items (clickable)
// Right: Details of selected item
const [selectedItem, setSelectedItem] = useState(null);
```

**2. Inline Editing:**
```typescript
const [editingItem, setEditingItem] = useState(null);

// Show edit form or display view
{editingItem?.id === item.id ? (
  <EditForm />
) : (
  <DisplayView />
)}
```

**3. Conditional Rendering for Admin:**
```typescript
{isAdmin && (
  <button onClick={handleAdminAction}>Admin Action</button>
)}
```

**4. Loading States:**
```typescript
const [loading, setLoading] = useState(false);

{loading ? (
  <div className="animate-spin ...">Loading...</div>
) : (
  <Content />
)}
```

**5. Optimistic UI Updates:**
```typescript
// Update local state after successful API call
if (response.ok) {
  const newItem = await response.json();
  setItems([...items, newItem]);
}
```

### UI/UX Patterns

**Color Scheme:**
- Purple (`purple-500`) - Primary actions, active states
- Green (`green-600`) - Add/create actions (players)
- Blue (`blue-600`) - Secondary add actions (coaches)
- Red (`red-400`) - Delete/remove actions
- Slate (`slate-800/700/600`) - Backgrounds, borders, inactive states

**Common Components:**
- Cards with `bg-slate-800/50 border border-slate-700 rounded-lg`
- Buttons with hover states and transitions
- Forms with focus rings (`focus:ring-2 focus:ring-purple-500`)
- Drag-and-drop with visual feedback (`cursor-move`, `opacity-50`)

---

## File Organization

```
backend/
├── tournaments/
│   ├── models.py          # Database models
│   ├── serializers.py     # DRF serializers
│   ├── views.py           # ViewSets and endpoints
│   ├── urls.py            # URL routing
│   └── migrations/        # Database migrations

frontend/
├── src/
│   ├── core/
│   │   └── api/
│   │       └── api.ts     # API client functions
│   └── features/
│       └── tournaments/
│           ├── pages/     # Page components
│           ├── types.ts   # TypeScript types
│           └── TOURNAMENT.md  # Feature documentation
```

---

## Development Workflow

### Adding a New Feature

1. **Plan First** - Think through the user flow before coding
2. **Backend First** - Create models, serializers, views, URLs
3. **Run Migrations** - Use Docker: `docker-compose exec backend python manage.py makemigrations`
4. **Frontend API** - Add API methods to `api.ts`
5. **Frontend UI** - Build components using established patterns
6. **Test** - Manually test the full flow

### Making Database Changes

```bash
# Create migration
docker-compose exec backend python manage.py makemigrations tournaments

# Apply migration
docker-compose exec backend python manage.py migrate tournaments

# Check migration
docker-compose exec backend python manage.py showmigrations
```

### Common Commands

```bash
# Start services
docker-compose up

# Backend shell
docker-compose exec backend python manage.py shell

# Frontend dev server (if not using Docker)
cd frontend && npm run dev

# Create Django superuser
docker-compose exec backend python manage.py createsuperuser
```

---

## Handling User Requests

### When User Says "Can we add X feature?"

1. **Understand the requirement** - Ask clarifying questions if needed
2. **Check TOURNAMENT.md** - See if it fits the established architecture
3. **Use progressive disclosure** - Add to existing pages, don't create new ones
4. **Follow the patterns** - Use established UI/UX patterns
5. **Update documentation** - Update TOURNAMENT.md with new features

### When User Reports a Bug

1. **Reproduce the issue** - Understand what's broken
2. **Identify root cause** - Backend vs frontend, logic vs UI
3. **Fix minimal code** - Don't refactor unnecessarily
4. **Test the fix** - Ensure it works for all user types (admin, student, logged-out)

### When User Says "Keep going"

Continue with the current task or the next logical priority from TOURNAMENT.md's "Next Priorities" section.

---

## Key Design Decisions

### Why Unified Dashboard?

- **Maintainability**: One page instead of two
- **Consistency**: Everyone sees the same data
- **Trust**: Admins can see what students see
- **UX**: No confusing redirects or separate views

### Why Optional Authentication?

- **Public access**: Tournament rosters should be viewable by anyone
- **SEO**: Search engines can index content
- **Sharing**: Direct links work without login
- **Progressive enhancement**: Login adds capabilities, doesn't gate content

### Why Manual Controls Over Automation?

- **Flexibility**: TDs know their tournament better than algorithms
- **Predictability**: TDs can see exactly what will happen
- **Simplicity**: Less code, fewer edge cases
- **Trust**: TDs feel in control

### Why No State Management Library?

- **Simplicity**: React hooks are sufficient for current complexity
- **Learning curve**: Standard React patterns are more accessible
- **Bundle size**: One less dependency
- **Future**: Can add Redux/Zustand later if needed

---

## Anti-Patterns to Avoid

### Don't Create Separate Admin Views

```typescript
// ❌ BAD - Separate pages for admins and students
if (isAdmin) {
  return <AdminTournamentPage />;
} else {
  return <StudentTournamentPage />;
}

// ✅ GOOD - Same page with conditional controls
return (
  <TournamentPage>
    {isAdmin && <AdminControls />}
  </TournamentPage>
);
```

### Don't Require Auth for Public Data

```typescript
// ❌ BAD - Always require authentication
const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}` // Will fail if no token
  }
});

// ✅ GOOD - Optional authentication
const headers: HeadersInit = { 'Content-Type': 'application/json' };
if (token) headers['Authorization'] = `Bearer ${token}`;
```

### Don't Over-Engineer

```typescript
// ❌ BAD - Complex abstraction for simple task
const usePoolDistribution = (teams, poolCount) => {
  const [strategy, setStrategy] = useState('balanced');
  const distributor = useMemo(() =>
    PoolDistributorFactory.create(strategy), [strategy]
  );
  return distributor.distribute(teams, poolCount);
};

// ✅ GOOD - Simple, direct code
const teamsPerPool = Math.floor(teams.length / poolCount);
const remainder = teams.length % poolCount;
// ... distribute teams
```

### Don't Make Assumptions About MODAQ

```python
# ❌ BAD - Calculating scores in Arena
def calculate_game_score(game):
    score = sum(player.correct_buzzes * 10 for player in game.players)
    return score

# ✅ GOOD - Display scores provided by MODAQ
# Arena never calculates scores, only displays them
```

---

## Testing Guidelines

### Manual Testing Checklist

For any new feature, test:

1. **As Admin** - Can perform admin actions
2. **As Logged-In Student** - Can view, cannot edit
3. **As Logged-Out User** - Can view public data
4. **Edge Cases** - Empty states, zero teams, one team, etc.

### UI Testing

- Click all buttons
- Check all form validations
- Test drag-and-drop
- Verify loading states
- Check error messages
- Test on narrow viewports (responsive)

---

## Communication Style

When responding to user requests:

- Be concise and direct
- Explain what you did and why
- Point to specific files and line numbers
- Use code references like `[file.ts:42](file.ts#L42)`
- Summarize changes at the end
- Don't over-explain obvious things

---

## Current State (January 2025)

### ✅ What's Built

1. Tournament list page with filters
2. Tournament detail page with 4 tabs (Overview, Teams, Pools, Contact)
3. Team roster management (players and coaches)
4. Pool configuration with drag-and-drop
5. Round-robin schedule generation
6. Database models for tournaments, teams, coaches, players, rooms, rounds, games
7. Full CRUD API for teams, players, coaches

### 🚧 Next Priorities

1. Room & match assignment UI
2. Tournament publishing/locking
3. Live room monitoring dashboard
4. MODAQ integration endpoint
5. Post-tournament analytics

See [TOURNAMENT.md](frontend/src/features/tournaments/TOURNAMENT.md) for detailed status.

---

## Final Reminders

- **Read TOURNAMENT.md first** - Understand the vision and constraints
- **Follow established patterns** - Consistency matters
- **Keep it simple** - If it feels complex, it probably is
- **Test as you go** - Don't wait until the end
- **Update docs** - Keep TOURNAMENT.md current
- **Ask when unclear** - Better to clarify than guess

---

**Document Version:** 1.0 (January 2025)
**Last Updated:** After implementing coach support and unified dashboard
