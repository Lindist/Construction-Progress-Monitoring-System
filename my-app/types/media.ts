export interface UploadedMedia {
  id: string;
  projectId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
  thumbnailUrl?: string;
  timelineUrl?: string;
}
