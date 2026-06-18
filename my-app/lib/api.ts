import type { UploadedMedia } from "@/types/media";
import { useAuthStore } from "./authStore";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

interface UploadApiResponse {
  id: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  url: string;
}

export const toUploadedMedia = (response: UploadApiResponse): UploadedMedia => ({
  id: response.id,
  originalName: response.original_name,
  contentType: response.content_type,
  sizeBytes: response.size_bytes,
  uploadedAt: response.uploaded_at,
  url: `${API_BASE_URL}${response.url}`,
});

// Helper for authenticated requests
const getHeaders = (headers: HeadersInit = {}) => {
  const token = useAuthStore.getState().token;
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const uploadMedia = async (file: File): Promise<UploadedMedia> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Upload failed.");
  }

  const data = (await response.json()) as UploadApiResponse;
  return toUploadedMedia(data);
};

// Project API interface
export interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectParams {
  name: string;
  description: string;
}

export const listProjects = async (): Promise<Project[]> => {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    headers: getHeaders({
      "Content-Type": "application/json",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to load projects.");
  }

  return response.json();
};

export const createProject = async (params: CreateProjectParams): Promise<Project> => {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: getHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to create project.");
  }

  return response.json();
};

export const updateProject = async (id: string, params: CreateProjectParams): Promise<Project> => {
  const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
    method: "PUT",
    headers: getHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update project.");
  }

  return response.json();
};

export const deleteProject = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to delete project.");
  }
};
