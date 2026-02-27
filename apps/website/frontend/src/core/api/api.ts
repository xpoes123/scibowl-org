// API Service for connecting to Django backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STATS_BASE_URL = import.meta.env.VITE_STATS_URL || "";

const buildStatsUrl = (path: string) => {
  const trimmedStatsBaseUrl = STATS_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return trimmedStatsBaseUrl
    ? `${trimmedStatsBaseUrl}/stats/${normalizedPath}`
    : `${import.meta.env.BASE_URL}stats/${normalizedPath}`;
};

const parseJsonOrNullIfHtml = async <T,>(response: Response, label: string): Promise<T | null> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) return null;

  const bodyText = (await response.text()).trimStart();
  if (!bodyText) return null;
  if (bodyText.startsWith("<")) return null;

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error(`Failed to parse ${label}`);
  }
};

const readTextOrNullIfHtml = async (response: Response): Promise<string | null> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) return null;

  const bodyText = (await response.text()).trimStart();
  if (!bodyText) return null;
  if (bodyText.startsWith("<")) return null;
  return bodyText;
};

type TournamentStatsManifest = {
  schema_version: number;
  generated_at: string;
  tournament: { slug: string; name: string };
  views: {
    team_standings: string;
    individual_standings: string;
    category_standings?: Array<{
      category: string;
      key: string;
      team_standings: string;
      individual_standings: string;
    }>;
  };
};

const parseCsv = (raw: string, label: string): { headers: string[]; rows: string[][] } => {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const allRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          currentField += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (ch === "\n") {
      currentRow.push(currentField);
      currentField = "";
      allRows.push(currentRow);
      currentRow = [];
      continue;
    }

    currentField += ch;
  }

  if (inQuotes) throw new Error(`Failed to parse ${label} (malformed CSV)`);
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    allRows.push(currentRow);
  }

  const nonEmptyRows = allRows.filter((r) => r.some((cell) => cell !== ""));
  if (!nonEmptyRows.length) throw new Error(`Failed to parse ${label} (empty CSV)`);

  const headers = nonEmptyRows[0].map((h) => h.trim());
  const rows = nonEmptyRows.slice(1);
  return { headers, rows };
};

const csvRowsToObjects = (table: { headers: string[]; rows: string[][] }): Array<Record<string, string>> => {
  const { headers, rows } = table;
  return rows.map((row) => {
    const out: Record<string, string> = {};
    headers.forEach((header, idx) => {
      out[header] = row[idx] ?? "";
    });
    return out;
  });
};

const toInt = (raw: string): number => {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
};

const toFloat = (raw: string): number => {
  if (!raw) return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || 'API request failed');
  }
  return response.json();
};

// Auth API
export const authAPI = {
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    password_confirm: string;
    school?: string;
    grade_level?: number;
  }) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  login: async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await handleResponse(response);
    // Store tokens
    if (data.access) {
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
    }
    return data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  getProfile: async () => {
    const response = await fetch(`${API_BASE_URL}/api/profile/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateProfile: async (profileData: {
    email?: string;
    first_name?: string;
    last_name?: string;
    bio?: string;
    school?: string;
    grade_level?: number;
  }) => {
    const response = await fetch(`${API_BASE_URL}/api/profile/`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData),
    });
    return handleResponse(response);
  },

  getUserProfile: async (username: string) => {
    const response = await fetch(`${API_BASE_URL}/api/users/${username}/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// services/api.ts

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const unwrapList = <T,>(data: any): T[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.results)) return data.results;
  throw new Error("Unexpected questions response shape");
};


// Questions API
export const questionsAPI = {
  getQuestions: async (filters?: {
    category?: string;
    question_type?: string;
    question_style?: string;
    source?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.question_type) params.append("question_type", filters.question_type);
    if (filters?.question_style) params.append("question_style", filters.question_style);
    if (filters?.source) params.append("source", filters.source);
    if (filters?.search) params.append("search", filters.search);

    const response = await fetch(`${API_BASE_URL}/api/questions/?${params.toString()}`, {
      headers: getAuthHeaders(),
    });

    const data = await handleResponse(response);
    return unwrapList<any>(data); // later replace `any` with your API question type
  },


  getQuestion: async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/api/questions/${id}/`, {
      headers: getAuthHeaders(),
    });
    console.log(response);
    return handleResponse(response);
  },

  submitAnswer: async (questionId: number, userAnswer: string, isCorrect: boolean, timeTaken?: number) => {
    const response = await fetch(`${API_BASE_URL}/api/questions/history/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        question_id: questionId,
        user_answer: userAnswer,
        is_correct: isCorrect,
        time_taken: timeTaken,
      }),
    });
    return handleResponse(response);
  },

  getHistory: async () => {
    const response = await fetch(`${API_BASE_URL}/api/questions/history/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  createBookmark: async (questionId: number, notes?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/questions/bookmarks/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        question_id: questionId,
        notes,
      }),
    });
    return handleResponse(response);
  },

  getBookmarks: async () => {
    const response = await fetch(`${API_BASE_URL}/api/questions/bookmarks/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Tournaments API
export const tournamentsAPI = {
  getTournaments: async (filters?: {
    status?: string;
    division?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.division) params.append("division", filters.division);

    const response = await fetch(`${API_BASE_URL}/api/tournaments/?${params.toString()}`, {
      headers: getAuthHeaders(),
    });

    const data = await handleResponse(response);
    return unwrapList<any>(data);
  },

  getTournament: async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/api/tournaments/${id}/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getTournamentStatsManifest: async (slug: string): Promise<TournamentStatsManifest | null> => {
    const encodedSlug = encodeURIComponent(slug);
    const statsUrl = buildStatsUrl(`${encodedSlug}/manifest.json`);

    const response = await fetch(statsUrl, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to load stats manifest");
    return parseJsonOrNullIfHtml(response, "stats manifest");
  },

  getTournamentStandings: async (slug: string, files?: { team: string; individual: string } | null) => {
    const encodedSlug = encodeURIComponent(slug);
    let teamFile = files?.team ?? "";
    let individualFile = files?.individual ?? "";

    if (!teamFile || !individualFile) {
      const manifest = await tournamentsAPI.getTournamentStatsManifest(slug);
      teamFile = teamFile || manifest?.views?.team_standings || "team_standings.csv";
      individualFile = individualFile || manifest?.views?.individual_standings || "individual_standings.csv";
    }

    const teamUrl = buildStatsUrl(`${encodedSlug}/${teamFile}`);
    const individualUrl = buildStatsUrl(`${encodedSlug}/${individualFile}`);

    const [teamResp, individualResp] = await Promise.all([
      fetch(teamUrl, { headers: { Accept: "text/csv" } }),
      fetch(individualUrl, { headers: { Accept: "text/csv" } }),
    ]);

    if (teamResp.status === 404 || individualResp.status === 404) return null;
    if (!teamResp.ok) throw new Error("Failed to load standings");
    if (!individualResp.ok) throw new Error("Failed to load standings");

    const teamText = await readTextOrNullIfHtml(teamResp);
    const individualText = await readTextOrNullIfHtml(individualResp);
    if (!teamText || !individualText) throw new Error("Failed to load standings");

    const teamRows = csvRowsToObjects(parseCsv(teamText, "team standings"));
    const individualRows = csvRowsToObjects(parseCsv(individualText, "individual standings"));

    const team_standings = teamRows.map((row) => ({
      rank: toInt(row.rank),
      team_id: toInt(row.team_id),
      name: row.name ?? "",
      wins: toInt(row.wins),
      losses: toInt(row.losses),
      points_per_game: toFloat(row.points_per_game),
      "4s": toInt(row["4s"]),
      "-4s": toInt(row["-4s"]),
      "0s": toInt(row["0s"]),
      tossups_heard: toInt(row.tossups_heard),
      bonuses_heard: toInt(row.bonuses_heard),
      bonus_points: toInt(row.bonus_points),
      points_per_bonus: toFloat(row.points_per_bonus),
    }));

    const individual_standings = individualRows.map((row) => ({
      rank: toInt(row.rank),
      player_id: toInt(row.player_id),
      name: row.name ?? "",
      team: row.team ?? "",
      games_played: toInt(row.games_played),
      "4s": toInt(row["4s"]),
      "-4s": toInt(row["-4s"]),
      "0s": toInt(row["0s"]),
      tossups_heard: toInt(row.tossups_heard),
      tossup_points: toInt(row.tossup_points),
      points_per_game: toFloat(row.points_per_game),
    }));

    return {
      tournament: { id: 0, slug, name: slug },
      team_standings,
      individual_standings,
    };
  },

  getTournamentField: async (slug: string) => {
    const encodedSlug = encodeURIComponent(slug);
    const statsUrl = buildStatsUrl(`${encodedSlug}/field.json`);

    const response = await fetch(statsUrl, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to load field");
    return parseJsonOrNullIfHtml(response, "field");
  },

  getRosterIndex: async () => {
    const statsUrl = buildStatsUrl("rosters/index.json");
    const response = await fetch(statsUrl, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to load roster index");
    return parseJsonOrNullIfHtml(response, "roster index");
  },

  getTournamentTeams: async (tournamentId: number) => {
    const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/teams/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getTournamentRooms: async (tournamentId: number) => {
    const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/rooms/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getTournamentRounds: async (tournamentId: number) => {
    const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/rounds/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getTournamentGames: async (tournamentId: number) => {
    const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/games/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  updateTeamPool: async (teamId: number, pool: string) => {
    const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}/`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pool }),
    });
    return handleResponse(response);
  },

  generateSchedule: async (tournamentId: number) => {
    const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/generate_schedule/`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getTeamCoaches: async (teamId: number) => {
    const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}/coaches/`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  addCoach: async (coachData: { name: string; email?: string; phone?: string; team: number }) => {
    const response = await fetch(`${API_BASE_URL}/api/coaches/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(coachData),
    });
    return handleResponse(response);
  },

  updateCoach: async (coachId: number, coachData: { name?: string; email?: string; phone?: string }) => {
    const response = await fetch(`${API_BASE_URL}/api/coaches/${coachId}/`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(coachData),
    });
    return handleResponse(response);
  },

  deleteCoach: async (coachId: number) => {
    const response = await fetch(`${API_BASE_URL}/api/coaches/${coachId}/`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to delete coach');
    }
    return;
  },
};

export default {
  auth: authAPI,
  questions: questionsAPI,
  tournaments: tournamentsAPI,
};
