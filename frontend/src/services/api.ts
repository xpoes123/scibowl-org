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
};

// Questions API
export const questionsAPI = {
  getQuestions: async (filters?: {
    category?: string;
    question_type?: string;
    difficulty?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.question_type) params.append('question_type', filters.question_type);
    if (filters?.difficulty) params.append('difficulty', filters.difficulty);
    if (filters?.search) params.append('search', filters.search);

    const response = await fetch(
      `${API_BASE_URL}/api/questions/?${params.toString()}`,
      {
        headers: getAuthHeaders(),
      }
    );
    return handleResponse(response);
  },

  getQuestion: async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/api/questions/${id}/`, {
      headers: getAuthHeaders(),
    });
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
