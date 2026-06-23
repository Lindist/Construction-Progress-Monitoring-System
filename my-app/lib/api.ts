import type { UploadedMedia } from "@/types/media";
import { useAuthStore } from "./authStore";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

interface UploadApiResponse {
  id: string;
  project_id: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  url: string;
  thumbnail_url?: string;
  timeline_url?: string;
}

export const toUploadedMedia = (response: UploadApiResponse): UploadedMedia => ({
  id: response.id,
  projectId: response.project_id,
  originalName: response.original_name,
  contentType: response.content_type,
  sizeBytes: response.size_bytes,
  uploadedAt: response.uploaded_at,
  url: `${API_BASE_URL}${response.url}`,
  thumbnailUrl: response.thumbnail_url ? `${API_BASE_URL}${response.thumbnail_url}` : undefined,
  timelineUrl: response.timeline_url ? `${API_BASE_URL}${response.timeline_url}` : undefined,
});

// Helper for authenticated requests
const getHeaders = (headers: HeadersInit = {}) => {
  const token = useAuthStore.getState().token;
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const uploadMedia = async (file: File, projectId: string): Promise<UploadedMedia> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("project_id", projectId);

  const response = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Upload failed.");
  }

  const data = (await response.json()) as UploadApiResponse;
  return toUploadedMedia(data);
};

export const uploadMediaWithProgress = (
  file: File,
  projectId: string,
  onProgress: (progress: number) => void
): Promise<UploadedMedia> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", projectId);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded * 100) / event.total);
        onProgress(percentage);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as UploadApiResponse;
          resolve(toUploadedMedia(data));
        } catch (err) {
          reject(new Error("Failed to parse response from server."));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.detail || "Upload failed."));
        } catch {
          reject(new Error("Upload failed."));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted."));
    });

    xhr.open("POST", `${API_BASE_URL}/api/uploads`);
    
    // Add auth header if present
    const headers = getHeaders();
    const authHeaders = headers as Record<string, string>;
    if (authHeaders.Authorization) {
      xhr.setRequestHeader("Authorization", authHeaders.Authorization);
    }
    
    xhr.send(formData);
  });
};

export const listProjectMedia = async (projectId: string): Promise<UploadedMedia[]> => {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/media`, {
    headers: getHeaders({
      "Content-Type": "application/json",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to load project media.");
  }

  const data = (await response.json()) as UploadApiResponse[];
  return data.map(toUploadedMedia);
};

export interface Detection {
  id: string;
  frameId: string;
  objectType: string;
  confidence: number;
  boundingBox: number[]; // [xmin, ymin, xmax, ymax]
}

export interface VideoFrame {
  id: string;
  mediaId: string;
  timestamp: number;
  frameUrl: string;
  detections?: Detection[];
}

export const listMediaFrames = async (mediaId: string): Promise<VideoFrame[]> => {
  const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}/frames`, {
    headers: getHeaders({
      "Content-Type": "application/json",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to load media frames.");
  }

  const data = (await response.json()) as any[];
  return data.map((f) => ({
    id: f.id,
    mediaId: f.media_id,
    timestamp: f.timestamp,
    frameUrl: `${API_BASE_URL}${f.frame_url}`,
    detections: f.detections ? f.detections.map((d: any) => {
      let bbox: number[] = [];
      try {
        bbox = JSON.parse(d.bounding_box);
      } catch (err) {
        console.error("Failed to parse bounding box:", d.bounding_box, err);
      }
      return {
        id: d.id,
        frameId: d.frame_id,
        objectType: d.object_type,
        confidence: d.confidence,
        boundingBox: bbox,
      };
    }) : [],
  }));
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
