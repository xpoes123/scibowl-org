// API Service for connecting to Django backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
};

// services/api.ts

type Paginated<T> = {
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

export default {
  auth: authAPI,
  questions: questionsAPI,
};
