# Contributing to NSB Arena

Thank you for your interest in contributing to SciBowl! This document explains how to add tournament listings and contribute to the project.

## Adding a Tournament

SciBowl uses a **hardcoded tournament listing system**. This means tournaments are stored in the codebase and managed through pull requests, similar to how the [college quizbowl calendar](https://www.collegeqb.org/) works.

### Why Hardcoded?

- **Human review**: Every tournament is reviewed before appearing on the site
- **Spam prevention**: No fake or duplicate tournaments
- **Simplicity**: No complex moderation system needed
- **Audit trail**: Git history shows all changes
- **Works at scale**: Science Bowl has low tournament volume (~10-20 per season)

### How to Add Your Tournament

#### Step 1: Fork the Repository

1. Go to [github.com/xpoes123/nsb-arena](https://github.com/xpoes123/nsb-arena)
2. Click the "Fork" button in the top-right corner
3. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nsb-arena.git
   cd nsb-arena
   ```

#### Step 2: Edit the Tournament File

1. Open `apps/website/frontend/src/features/tournaments/data/tournaments.ts`
2. Add your tournament to the appropriate section:
   - **LIVE TOURNAMENTS** - Currently happening
   - **UPCOMING TOURNAMENTS** - Not yet started
   - **FINISHED TOURNAMENTS** - Already completed

3. Use this template:
   ```typescript
   {
     id: "unique-id-here", // Use format: "NNN" (e.g., "213", "302")
     name: "Your Tournament Name",
     location_city: "City Name",
     location_state: "STATE", // Two-letter code (e.g., "CA", "NY")
     start_date: "YYYY-MM-DD", // ISO format
     end_date: "YYYY-MM-DD", // Optional, for multi-day tournaments
     level: ["HS"], // or ["MS"] or ["HS", "MS"]
     status: "UPCOMING", // or "LIVE" or "FINISHED"
     updated_at: "2026-01-06T10:00:00Z", // Current timestamp in ISO format
     is_published: true,
   },
   ```

#### Step 3: Choose a Unique ID

IDs follow this pattern:
- **100-199**: Live tournaments
- **200-299**: Upcoming tournaments
- **300-399**: Finished tournaments

Pick the next available number in your status range. For example, if the last upcoming tournament is `212`, use `213`.

#### Step 4: Example Tournament Entry

```typescript
{
  id: "213",
  name: "2026 Northern California Regional",
  location_city: "Berkeley",
  location_state: "CA",
  start_date: "2026-03-15",
  end_date: "2026-03-15",
  level: ["HS"],
  status: "UPCOMING",
  updated_at: "2026-01-06T10:00:00Z",
  is_published: true,
},
```

#### Step 5: Submit Your Pull Request

1. Commit your changes:
   ```bash
   git add apps/website/frontend/src/features/tournaments/data/tournaments.ts
   git commit -m "Add [Tournament Name] to listings"
   ```

2. Push to your fork:
   ```bash
   git push origin main
   ```

3. Go to GitHub and click "Create Pull Request"

4. Fill in the PR template:
   - **Title**: "Add [Tournament Name] to tournament listings"
   - **Description**: Include tournament details (date, location, level)

#### Step 6: Wait for Review

A maintainer will review your PR and:
- ✅ Merge it if everything looks good
- 💬 Ask for changes if needed (duplicate ID, formatting issues, etc.)

Once merged, your tournament will appear on the site within minutes!

### Updating an Existing Tournament

To update tournament info (change date, status, etc.):

1. Find your tournament in `tournaments.ts`
2. Edit the relevant fields
3. Update the `updated_at` timestamp to now
4. Submit a PR with title "Update [Tournament Name] details"

### Common Status Changes

**Before tournament starts:**
```typescript
status: "UPCOMING"
```

**Tournament is happening now:**
```typescript
status: "LIVE"
```

**Tournament is over:**
```typescript
status: "FINISHED"
end_date: "2026-03-15", // Add if missing
```

---

## Other Contributions

### Bug Reports

Found a bug? [Open an issue](https://github.com/xpoes123/nsb-arena/issues/new) with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)

### Feature Requests

Have an idea? [Open an issue](https://github.com/xpoes123/nsb-arena/issues/new) and describe:
- What you want to add
- Why it would be useful
- How you imagine it working

### Code Contributions

Want to contribute code? Great! Here's the workflow:

1. Check existing issues or create a new one to discuss your idea
2. Fork the repository
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes following the patterns in [CLAUDE.md](CLAUDE.md)
5. Test your changes locally
6. Submit a PR with a clear description

### Development Setup

See [README.md](README.md) for instructions on running NSB Arena locally.

---

## Questions?

- **General questions**: Open a [GitHub Discussion](https://github.com/xpoes123/nsb-arena/discussions)
- **Tournament-specific**: Contact the tournament director
- **Bug reports**: [Open an issue](https://github.com/xpoes123/nsb-arena/issues)

---

Thank you for contributing to NSB Arena!
