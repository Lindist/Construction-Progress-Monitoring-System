"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { uploadMedia } from "@/lib/api";
import type { UploadedMedia } from "@/types/media";

const acceptedTypes = ["video/mp4", "video/quicktime", "video/webm", "image/jpeg", "image/png", "image/webp"];

const formatBytes = (bytes: number): string => {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

export const MediaUploader = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!selectedFile) {
      return null;
    }

    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUploadedMedia(null);
    setErrorMessage(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!acceptedTypes.includes(file.type)) {
      setSelectedFile(null);
      setErrorMessage("Please choose an MP4, MOV, WebM, JPG, PNG, or WebP file.");
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const media = await uploadMedia(selectedFile);
      setUploadedMedia(media);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  };

  const mediaSource = uploadedMedia?.url ?? previewUrl;
  const mediaType = uploadedMedia?.contentType ?? selectedFile?.type ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-border bg-panel p-6">
        <h2 className="text-xl font-semibold">Upload media</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Add a construction site video or image to start the monitoring pipeline.
        </p>

        <label className="mt-6 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary bg-panel-strong px-4 text-center transition hover:bg-[#e6f1f6]">
          <span className="text-sm font-semibold text-primary">Select video or image</span>
          <span className="mt-2 text-xs text-muted">MP4, MOV, WebM, JPG, PNG, WebP</span>
          <input className="sr-only" type="file" accept="video/*,image/*" onChange={handleFileChange} />
        </label>

        {selectedFile ? (
          <div className="mt-5 rounded-md bg-background p-4 text-sm">
            <p className="font-semibold">{selectedFile.name}</p>
            <p className="mt-1 text-muted">{formatBytes(selectedFile.size)}</p>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 rounded-md border border-danger bg-[#fff1f0] px-4 py-3 text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!selectedFile || isUploading}
          onClick={handleUpload}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-[#105a7c] disabled:cursor-not-allowed disabled:bg-[#9bb9c7]"
        >
          {isUploading ? "Uploading..." : "Upload to backend"}
        </button>
      </section>

      <section className="rounded-lg border border-border bg-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Media preview</h2>
            <p className="mt-2 text-sm text-muted">Preview appears before and after upload.</p>
          </div>
          {uploadedMedia ? (
            <span className="rounded-full bg-[#e8f6ef] px-3 py-1 text-xs font-semibold text-success">
              Saved
            </span>
          ) : null}
        </div>

        <div className="mt-6 flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-[#18242b]">
          {mediaSource && mediaType.startsWith("video/") ? (
            <video className="h-full w-full object-contain" src={mediaSource} controls />
          ) : null}
          {mediaSource && mediaType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="h-full w-full object-contain" src={mediaSource} alt="Uploaded construction media preview" />
          ) : null}
          {!mediaSource ? <p className="text-sm text-[#b7c8d1]">No media selected</p> : null}
        </div>

        {uploadedMedia ? (
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md bg-panel-strong p-3">
              <dt className="text-muted">File ID</dt>
              <dd className="mt-1 font-mono text-xs">{uploadedMedia.id}</dd>
            </div>
            <div className="rounded-md bg-panel-strong p-3">
              <dt className="text-muted">Uploaded</dt>
              <dd className="mt-1">{new Date(uploadedMedia.uploadedAt).toLocaleString()}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </div>
  );
};
