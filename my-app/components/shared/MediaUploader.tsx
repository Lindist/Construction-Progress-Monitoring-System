"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { uploadMediaWithProgress, listProjects, listProjectMedia, listMediaFrames, Project, VideoFrame, API_BASE_URL } from "@/lib/api";
import type { UploadedMedia } from "@/types/media";
import { useSearchParams } from "next/navigation";
import { Loader2, UploadCloud, Film, Image, CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff, Calendar, HardDrive } from "lucide-react";

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

const MediaUploaderInner = () => {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId") ?? "";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  
  // Upload Progress State
  const [uploadProgress, setUploadProgress] = useState(0);

  // Project selection states
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Workspace Media States
  const [projectMedia, setProjectMedia] = useState<UploadedMedia[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  // Frame Expansion States
  const [expandedMediaId, setExpandedMediaId] = useState<string | null>(null);
  const [mediaFrames, setMediaFrames] = useState<Record<string, VideoFrame[]>>({});
  const [isLoadingFrames, setIsLoadingFrames] = useState(false);

  // Load project context
  useEffect(() => {
    if (urlProjectId) {
      setSelectedProjectId(urlProjectId);
    } else {
      setIsLoadingProjects(true);
      listProjects()
        .then((data) => {
          setProjects(data);
          if (data.length > 0) {
            setSelectedProjectId(data[0].id);
          }
        })
        .catch((err) => {
          console.error("Failed to load projects:", err);
          setErrorMessage("Failed to load projects. Please create a project first.");
        })
        .finally(() => {
          setIsLoadingProjects(false);
        });
    }
  }, [urlProjectId]);

  // Load media when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      fetchMedia(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Listen for real-time SSE events to auto-refresh media list when backend completes processing
  useEffect(() => {
    if (!selectedProjectId) return;

    console.log("SSE: Connecting to backend event stream...");
    const eventSource = new EventSource(`${API_BASE_URL}/api/media/events`);

    eventSource.onmessage = (event) => {
      console.log("SSE: Event received, media processing completed:", event.data);
      // Trigger media list refresh automatically
      fetchMedia(selectedProjectId);

      // If we currently have this media's frame track expanded, auto-reload the frames too!
      if (expandedMediaId && event.data === expandedMediaId) {
        setIsLoadingFrames(true);
        listMediaFrames(expandedMediaId)
          .then((frames) => {
            setMediaFrames((prev) => ({ ...prev, [expandedMediaId]: frames }));
          })
          .catch((err) => {
            console.error("SSE: Failed to reload frames for expanded media:", err);
          })
          .finally(() => {
            setIsLoadingFrames(false);
          });
      }
    };

    eventSource.onerror = (err) => {
      console.warn("SSE: Connection warning/disconnect. Reconnecting in background...", err);
      // The browser automatically attempts reconnection for SSE, but we close to avoid leaks if context changes
    };

    return () => {
      console.log("SSE: Closing event stream connection");
      eventSource.close();
    };
  }, [selectedProjectId, expandedMediaId]);

  const fetchMedia = (projectId: string) => {
    if (!projectId) return;
    setIsLoadingMedia(true);
    listProjectMedia(projectId)
      .then((data) => {
        setProjectMedia(data);
      })
      .catch((err) => {
        console.error("Failed to load project media:", err);
      })
      .finally(() => {
        setIsLoadingMedia(false);
      });
  };

  const handleToggleFrames = (mediaId: string) => {
    if (expandedMediaId === mediaId) {
      setExpandedMediaId(null);
      return;
    }
    
    setExpandedMediaId(mediaId);
    if (!mediaFrames[mediaId]) {
      setIsLoadingFrames(true);
      listMediaFrames(mediaId)
        .then((frames) => {
          setMediaFrames(prev => ({ ...prev, [mediaId]: frames }));
        })
        .catch((err) => {
          console.error("Failed to load media frames:", err);
        })
        .finally(() => {
          setIsLoadingFrames(false);
        });
    }
  };

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

  // Handle standard file selection
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUploadedMedia(null);
    setErrorMessage(null);
    setUploadProgress(0);

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

  // Drag handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadedMedia(null);
    setErrorMessage(null);
    setUploadProgress(0);

    const file = e.dataTransfer.files?.[0] ?? null;
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

  // Perform progress upload
  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    if (!selectedProjectId) {
      setErrorMessage("Please select a target project before uploading.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(0);

    try {
      const media = await uploadMediaWithProgress(
        selectedFile,
        selectedProjectId,
        (progress) => {
          setUploadProgress(progress);
        }
      );
      setUploadedMedia(media);
      setSelectedFile(null);
      setUploadProgress(0);
      // Reload assets list
      fetchMedia(selectedProjectId);
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
    <div className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-border bg-panel p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Upload media</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Add a construction site video or image to start the monitoring pipeline.
          </p>

          {/* Project Selector */}
          {!urlProjectId && (
            <div className="mt-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Target Project</label>
              {isLoadingProjects ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Fetching projects...</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="mt-2 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  <AlertCircle className="h-4 w-4" />
                  <span>No projects found. Please create a project first.</span>
                </div>
              ) : (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  disabled={isUploading}
                  className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Drag and Drop Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center transition ${
              isDragging
                ? "border-primary bg-primary/5 text-primary scale-[0.99]"
                : "border-border bg-panel-strong hover:bg-border/20 text-muted"
            }`}
          >
            <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center py-6">
              <UploadCloud className={`h-10 w-10 transition ${isDragging ? "text-primary animate-bounce" : "text-muted/80"}`} />
              <span className="mt-3 text-sm font-semibold text-foreground">
                {isDragging ? "Drop your file here" : "Select or drag video or image"}
              </span>
              <span className="mt-1 text-xs text-muted">MP4, MOV, WebM, JPG, PNG, WebP</span>
              <input
                className="sr-only"
                type="file"
                accept="video/*,image/*"
                disabled={isUploading}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {selectedFile ? (
            <div className="mt-5 flex items-center gap-3 rounded-md bg-background p-4 text-sm border border-border">
              {selectedFile.type.startsWith("video/") ? (
                <Film className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Image className="h-5 w-5 text-primary shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate text-foreground">{selectedFile.name}</p>
                <p className="mt-0.5 text-xs text-muted">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>
          ) : null}

          {/* Error Notification */}
          {errorMessage ? (
            <div className="mt-4 flex gap-2.5 rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm text-danger">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {/* Progress bar */}
          {isUploading && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-semibold text-muted mb-2">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  Uploading...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-[#18242b] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-100 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!selectedFile || isUploading || !selectedProjectId}
            onClick={handleUpload}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40 disabled:text-primary-foreground/60 cursor-pointer"
          >
            {isUploading ? "Uploading to workspace..." : "Upload to backend"}
          </button>
        </section>

        <section className="rounded-lg border border-border bg-panel p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Media preview</h2>
              <p className="mt-2 text-sm text-muted">Preview appears before and after upload.</p>
            </div>
            {uploadedMedia ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success border border-success/20">
                <CheckCircle className="h-3.5 w-3.5" />
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
              <div className="rounded-md bg-panel-strong p-3 border border-border/40">
                <dt className="text-xs font-medium text-muted uppercase tracking-wider">File ID</dt>
                <dd className="mt-1 font-mono text-xs text-foreground truncate">{uploadedMedia.id}</dd>
              </div>
              <div className="rounded-md bg-panel-strong p-3 border border-border/40">
                <dt className="text-xs font-medium text-muted uppercase tracking-wider">Uploaded At</dt>
                <dd className="mt-1 text-xs text-foreground">{new Date(uploadedMedia.uploadedAt).toLocaleString()}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      </div>

      {/* Workspace Media Section */}
      {selectedProjectId && (
        <section className="rounded-lg border border-border bg-panel p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Project Workspace Media</h2>
              <p className="text-sm text-muted">Uploaded monitoring videos and images for auditing</p>
            </div>
            <button
              onClick={() => fetchMedia(selectedProjectId)}
              disabled={isLoadingMedia}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-panel-strong cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingMedia ? "animate-spin text-primary" : ""}`} />
              Sync Media
            </button>
          </div>

          {isLoadingMedia && projectMedia.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-muted">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <span>Fetching project files...</span>
            </div>
          ) : projectMedia.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center text-center rounded-lg border border-dashed border-border bg-panel-strong mt-6 p-6">
              <Film className="h-8 w-8 text-muted mb-2" />
              <p className="text-sm font-semibold">No media in this project</p>
              <p className="text-xs text-muted mt-1">Upload files using the panel above to begin progress tracking.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {projectMedia.map((media) => {
                const isVideo = media.contentType.startsWith("video/");
                const isProcessed = isVideo && (media.thumbnailUrl || media.timelineUrl);
                const isCurrentlyExpanded = expandedMediaId === media.id;

                return (
                  <div
                    key={media.id}
                    className="group border border-border/80 bg-panel-strong hover:border-border rounded-xl overflow-hidden shadow-sm transition duration-300"
                  >
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Metadata info */}
                      <div className="flex items-start gap-3">
                        {isVideo ? (
                          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0 mt-0.5">
                            <Film className="h-5 w-5" />
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-success/10 border border-success/20 text-success shrink-0 mt-0.5">
                            <Image className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-semibold text-foreground truncate max-w-md" title={media.originalName}>
                            {media.originalName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted">
                            <span className="flex items-center gap-1">
                              <HardDrive className="h-3.5 w-3.5" />
                              {formatBytes(media.sizeBytes)}
                            </span>
                            <span className="text-border/40">•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(media.uploadedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions / Badges */}
                      <div className="flex items-center gap-3 shrink-0">
                        {isVideo && !isProcessed && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning border border-warning/20 animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing Video Pipeline...
                          </span>
                        )}
                        {isProcessed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success border border-success/20">
                            <CheckCircle className="h-3 w-3" />
                            Processed
                          </span>
                        )}
                        <a
                          href={media.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-panel-strong transition"
                        >
                          View Original
                        </a>
                        {isVideo && isProcessed && (
                          <button
                            onClick={() => handleToggleFrames(media.id)}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition shadow cursor-pointer"
                          >
                            {isCurrentlyExpanded ? (
                              <>
                                <EyeOff className="h-3.5 w-3.5" />
                                Hide Timeline
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                Inspect Timeline
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Previews / Timeline Montage section */}
                    <div className="border-t border-border/40 bg-background/50 p-5 space-y-4">
                      {/* Render direct visual timeline strip montage if processed */}
                      {isVideo && media.timelineUrl && (
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                            Timeline Snapshot (Composite Montage Strip)
                          </label>
                          <div className="relative overflow-hidden rounded-lg border border-border bg-panel-strong shadow-inner">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={media.timelineUrl}
                              alt="Video timeline composite montage"
                              className="w-full max-h-24 object-cover"
                            />
                          </div>
                        </div>
                      )}

                      {/* Expanded Frames scroll track */}
                      {isCurrentlyExpanded && (
                        <div className="border-t border-border/40 pt-4 space-y-3">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">
                            Extracted Key Frames
                          </h5>

                          {isLoadingFrames && !mediaFrames[media.id] ? (
                            <div className="flex py-6 justify-center items-center text-xs text-muted gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span>Loading frames data...</span>
                            </div>
                          ) : mediaFrames[media.id]?.length === 0 ? (
                            <div className="text-xs text-muted py-2">No frames extracted for this video.</div>
                          ) : (
                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                              {mediaFrames[media.id]?.map((frame) => (
                                <div
                                  key={frame.id}
                                  className="w-48 shrink-0 bg-panel border border-border/60 hover:border-primary/55 rounded-lg overflow-hidden transition shadow-sm hover:scale-[1.02] duration-200"
                                >
                                  <div className="aspect-video relative bg-black/80 flex items-center justify-center overflow-hidden border-b border-border/30">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={frame.frameUrl}
                                      alt={`Frame at ${frame.timestamp.toFixed(2)}s`}
                                      className="object-contain w-full h-full"
                                    />
                                  </div>
                                  <div className="p-2.5 text-center">
                                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                      {frame.timestamp.toFixed(2)}s
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export const MediaUploader = () => {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-panel">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <MediaUploaderInner />
    </Suspense>
  );
};
