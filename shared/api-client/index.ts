// Shared API client utilities

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export interface FetchOptions extends RequestInit {
    baseURL?: string;
}

export async function apiCall<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const { baseURL = API_BASE_URL, ...fetchOptions } = options;

    // Add auth token if available
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseURL}${endpoint}`, {
        ...fetchOptions,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
}

export async function apiGet<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return apiCall<T>(endpoint, { ...options, method: "GET" });
}

export async function apiPost<T>(
    endpoint: string,
    data: unknown,
    options?: FetchOptions
): Promise<T> {
    return apiCall<T>(endpoint, {
        ...options,
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function apiPut<T>(
    endpoint: string,
    data: unknown,
    options?: FetchOptions
): Promise<T> {
    return apiCall<T>(endpoint, {
        ...options,
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export async function apiDelete<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return apiCall<T>(endpoint, { ...options, method: "DELETE" });
}
