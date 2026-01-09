#!/usr/bin/env node

/**
 * Tournament Data Validator
 *
 * Validates tournament JSON data against the schema.
 * Run: node tournaments/validate.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOURNAMENTS_FILE = path.join(__dirname, '../apps/website/frontend/src/features/tournaments/data/tournaments.json');

// IANA timezone database (common US timezones)
const VALID_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

const VALID_DIVISIONS = ['MS', 'HS', 'OPEN', 'UG'];
const VALID_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const VALID_MODES = ['IN_PERSON', 'ONLINE'];
const VALID_CONTACT_TYPES = ['EMAIL', 'DISCORD', 'PHONE', 'OTHER'];
const VALID_LINK_TYPES = ['WEBSITE', 'RESULTS', 'PACKETS', 'STATS', 'OTHER'];
const VALID_REG_METHODS = ['FORM', 'EMAIL', 'WEBSITE', 'OTHER'];

let errorCount = 0;
let warningCount = 0;

function error(tournamentSlug, message) {
  console.error(`❌ [${tournamentSlug || 'UNKNOWN'}] ${message}`);
  errorCount++;
}

function warn(tournamentSlug, message) {
  console.warn(`⚠️  [${tournamentSlug || 'UNKNOWN'}] ${message}`);
  warningCount++;
}

function validateDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function validateSlug(slug) {
  const regex = /^[a-z0-9-]+$/;
  return regex.test(slug);
}

function validateTournament(tournament, index) {
  const slug = tournament.slug || `TOURNAMENT_${index}`;

  // Required fields
  if (!tournament.slug) {
    error(slug, 'Missing required field: slug');
  } else if (!validateSlug(tournament.slug)) {
    error(slug, 'Invalid slug format (must be lowercase letters, numbers, and hyphens only)');
  }

  if (!tournament.name) error(slug, 'Missing required field: name');
  if (!tournament.status) error(slug, 'Missing required field: status');
  if (!tournament.mode) error(slug, 'Missing required field: mode');
  if (!tournament.timezone) error(slug, 'Missing required field: timezone');
  if (!tournament.dates) error(slug, 'Missing required field: dates');
  if (!tournament.divisions) error(slug, 'Missing required field: divisions');
  if (!tournament.format) error(slug, 'Missing required field: format');

  // Validate status
  if (tournament.status && !VALID_STATUSES.includes(tournament.status)) {
    error(slug, `Invalid status: ${tournament.status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // Validate mode
  if (tournament.mode && !VALID_MODES.includes(tournament.mode)) {
    error(slug, `Invalid mode: ${tournament.mode}. Must be one of: ${VALID_MODES.join(', ')}`);
  }

  // Validate timezone
  if (tournament.timezone && !VALID_TIMEZONES.includes(tournament.timezone)) {
    warn(slug, `Uncommon timezone: ${tournament.timezone}. Consider using a standard US timezone.`);
  }

  // Validate dates
  if (tournament.dates) {
    if (!tournament.dates.start) {
      error(slug, 'Missing dates.start');
    } else if (!validateDate(tournament.dates.start)) {
      error(slug, `Invalid date format for dates.start: ${tournament.dates.start} (use YYYY-MM-DD)`);
    }

    if (!tournament.dates.end) {
      error(slug, 'Missing dates.end');
    } else if (!validateDate(tournament.dates.end)) {
      error(slug, `Invalid date format for dates.end: ${tournament.dates.end} (use YYYY-MM-DD)`);
    }

    if (tournament.dates.start && tournament.dates.end) {
      const start = new Date(tournament.dates.start);
      const end = new Date(tournament.dates.end);
      if (end < start) {
        error(slug, 'End date is before start date');
      }
    }
  }

  // Validate divisions
  if (tournament.divisions) {
    if (!Array.isArray(tournament.divisions)) {
      error(slug, 'divisions must be an array');
    } else if (tournament.divisions.length === 0) {
      error(slug, 'divisions array is empty');
    } else {
      tournament.divisions.forEach(div => {
        if (!VALID_DIVISIONS.includes(div)) {
          error(slug, `Invalid division: ${div}. Must be one of: ${VALID_DIVISIONS.join(', ')}`);
        }
      });
    }
  }

  // Validate location (required for IN_PERSON, must be omitted for ONLINE)
  if (tournament.mode === 'IN_PERSON') {
    if (!tournament.location) {
      error(slug, 'location is required for IN_PERSON tournaments');
    } else {
      if (!tournament.location.city) error(slug, 'location.city is required for IN_PERSON tournaments');
      if (!tournament.location.state) error(slug, 'location.state is required for IN_PERSON tournaments');
      if (tournament.location.state && tournament.location.state.length !== 2) {
        error(slug, `location.state must be a 2-letter state code, got: ${tournament.location.state}`);
      }
      // address is optional for IN_PERSON tournaments
    }
  }

  if (tournament.mode === 'ONLINE' && tournament.location) {
    error(slug, 'ONLINE tournament must not have location field (should be omitted or null)');
  }

  // Validate format
  if (tournament.format) {
    if (!tournament.format.summary) {
      error(slug, 'format.summary is required');
    }
    if (tournament.format.rounds_guaranteed && typeof tournament.format.rounds_guaranteed !== 'number') {
      error(slug, 'format.rounds_guaranteed must be a number');
    }
  }

  // Validate contacts
  if (tournament.contacts) {
    if (!Array.isArray(tournament.contacts)) {
      error(slug, 'contacts must be an array');
    } else {
      tournament.contacts.forEach((contact, i) => {
        if (!contact.type) error(slug, `contacts[${i}] missing type`);
        if (!contact.value) error(slug, `contacts[${i}] missing value`);
        if (contact.type && !VALID_CONTACT_TYPES.includes(contact.type)) {
          error(slug, `contacts[${i}] invalid type: ${contact.type}`);
        }
        if (contact.type === 'EMAIL' && contact.value && !contact.value.includes('@')) {
          warn(slug, `contacts[${i}] type is EMAIL but value doesn't look like an email`);
        }
      });
    }
  } else {
    warn(slug, 'No contacts provided (recommended to have at least one contact method)');
  }

  // Validate links
  if (tournament.links) {
    if (!Array.isArray(tournament.links)) {
      error(slug, 'links must be an array');
    } else {
      tournament.links.forEach((link, i) => {
        if (!link.type) error(slug, `links[${i}] missing type`);
        if (!link.url) error(slug, `links[${i}] missing url`);
        if (!link.label) error(slug, `links[${i}] missing label`);
        if (link.type && !VALID_LINK_TYPES.includes(link.type)) {
          error(slug, `links[${i}] invalid type: ${link.type}`);
        }
        if (link.url && !validateUrl(link.url)) {
          error(slug, `links[${i}] invalid URL: ${link.url}`);
        }
      });
    }
  }

  // Validate registration
  if (tournament.registration) {
    const reg = tournament.registration;
    if (!reg.method) error(slug, 'registration.method is required');
    if (!reg.instructions) error(slug, 'registration.instructions is required');
    if (!reg.deadlines) error(slug, 'registration.deadlines is required');

    if (reg.method && !VALID_REG_METHODS.includes(reg.method)) {
      error(slug, `Invalid registration.method: ${reg.method}`);
    }

    if (reg.url && !validateUrl(reg.url)) {
      error(slug, `Invalid registration.url: ${reg.url}`);
    }

    if (reg.deadlines) {
      if (!Array.isArray(reg.deadlines)) {
        error(slug, 'registration.deadlines must be an array');
      } else {
        reg.deadlines.forEach((deadline, i) => {
          if (!deadline.label) error(slug, `registration.deadlines[${i}] missing label`);
          if (!deadline.date) error(slug, `registration.deadlines[${i}] missing date`);
        });
      }
    }
  }
}

function main() {
  console.log('🔍 Validating tournament data...\n');

  // Check if file exists
  if (!fs.existsSync(TOURNAMENTS_FILE)) {
    console.error(`❌ Tournaments file not found: ${TOURNAMENTS_FILE}`);
    process.exit(1);
  }

  // Read and parse JSON
  let tournaments;
  try {
    const data = fs.readFileSync(TOURNAMENTS_FILE, 'utf8');
    tournaments = JSON.parse(data);
  } catch (err) {
    console.error(`❌ Failed to parse tournaments.json: ${err.message}`);
    process.exit(1);
  }

  // Validate it's an array
  if (!Array.isArray(tournaments)) {
    console.error('❌ tournaments.json must contain an array of tournaments');
    process.exit(1);
  }

  console.log(`Found ${tournaments.length} tournaments\n`);

  // Check for duplicate slugs
  const slugs = new Set();
  tournaments.forEach((t, i) => {
    if (t.slug) {
      if (slugs.has(t.slug)) {
        error(t.slug, 'Duplicate slug found');
      }
      slugs.add(t.slug);
    }
  });

  // Validate each tournament
  tournaments.forEach((tournament, index) => {
    validateTournament(tournament, index);
  });

  // Print summary
  console.log('\n' + '='.repeat(50));
  if (errorCount === 0 && warningCount === 0) {
    console.log('✅ All tournaments are valid!');
    process.exit(0);
  } else {
    if (errorCount > 0) {
      console.log(`❌ Found ${errorCount} error(s)`);
    }
    if (warningCount > 0) {
      console.log(`⚠️  Found ${warningCount} warning(s)`);
    }
    if (errorCount > 0) {
      process.exit(1);
    } else {
      console.log('\n✅ No errors found (warnings are informational only)');
      process.exit(0);
    }
  }
}

main();
