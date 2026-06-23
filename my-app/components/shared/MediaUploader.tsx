"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { uploadMediaWithProgress, listProjects, listProjectMedia, listMediaFrames, Project, VideoFrame, Detection, API_BASE_URL } from "@/lib/api";
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

  // Inspector Modal State
  const [selectedFrame, setSelectedFrame] = useState<VideoFrame | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<Record<string, boolean>>({
    Worker: true,
    Helmet: true,
    Truck: true,
    Crane: true,
    Excavator: true,
    Scaffolding: true,
    Pillar: true,
    Wall: true,
    "Construction Equipment": true,
  });

  const getDetectionCounts = (detections?: Detection[]) => {
    if (!detections) return {};
    const counts: Record<string, number> = {};
    detections.forEach(d => {
      counts[d.objectType] = (counts[d.objectType] || 0) + 1;
    });
    return counts;
  };

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
                              {mediaFrames[media.id]?.map((frame) => {
                                const counts = getDetectionCounts(frame.detections);
                                return (
                                  <div
                                    key={frame.id}
                                    onClick={() => setSelectedFrame(frame)}
                                    className="w-48 shrink-0 bg-panel border border-border/60 hover:border-primary/55 rounded-lg overflow-hidden transition shadow-sm hover:scale-[1.02] duration-200 cursor-pointer"
                                  >
                                    <div className="aspect-video relative bg-black/80 flex items-center justify-center overflow-hidden border-b border-border/30">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={frame.frameUrl}
                                        alt={`Frame at ${frame.timestamp.toFixed(2)}s`}
                                        className="object-contain w-full h-full"
                                      />
                                    </div>
                                    <div className="p-2.5 space-y-2">
                                      <div className="flex justify-between items-center">
                                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                          {frame.timestamp.toFixed(2)}s
                                        </span>
                                        {frame.detections && frame.detections.length > 0 && (
                                          <span className="text-[10px] text-muted-foreground font-semibold">
                                            {frame.detections.length} objects
                                          </span>
                                        )}
                                      </div>
                                      {/* Small badges showing object counts */}
                                      {frame.detections && frame.detections.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1 justify-center border-t border-border/20">
                                          {Object.entries(counts).map(([type, count]) => {
                                            let emoji = "📦";
                                            if (type === "Worker") emoji = "👷";
                                            else if (type === "Helmet") emoji = "🪖";
                                            else if (type === "Truck") emoji = "🚚";
                                            else if (type === "Crane") emoji = "🏗️";
                                            else if (type === "Excavator") emoji = "🚜";
                                            else if (type === "Scaffolding") emoji = "🪜";
                                            else if (type === "Pillar") emoji = "🧱";
                                            else if (type === "Wall") emoji = "🚧";
                                            else if (type === "Construction Equipment") emoji = "🛠️";
                                            return (
                                              <span 
                                                key={type} 
                                                className="inline-flex items-center gap-0.5 rounded bg-panel-strong px-1.5 py-0.5 text-[9px] font-medium text-foreground border border-border/30"
                                                title={`${count} ${type}(s)`}
                                              >
                                                {emoji} {count}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
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
      {/* Interactive Frame Inspector Modal */}
      {selectedFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-6 transition-all duration-300">
          <div className="relative flex flex-col md:flex-row w-full max-w-5xl h-[85vh] bg-panel border border-border rounded-2xl overflow-hidden shadow-2xl">
            {/* Header info for mobile */}
            <div className="flex md:hidden items-center justify-between p-4 border-b border-border bg-panel-strong w-full">
              <div>
                <h3 className="font-bold text-foreground">Frame Inspector</h3>
                <p className="text-xs text-muted">Timestamp: {selectedFrame.timestamp.toFixed(2)}s</p>
              </div>
              <button 
                onClick={() => setSelectedFrame(null)}
                className="p-1 rounded-md hover:bg-border text-muted hover:text-foreground text-sm font-semibold"
              >
                Close
              </button>
            </div>

            {/* Left: Frame Image Canvas Area */}
            <div className="relative flex-1 bg-black flex items-center justify-center p-4 overflow-hidden select-none">
              <div className="relative max-w-full max-h-full aspect-video border border-border/20 rounded-lg overflow-hidden shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedFrame.frameUrl}
                  alt={`Inspected Frame at ${selectedFrame.timestamp.toFixed(2)}s`}
                  className="w-full h-full object-contain pointer-events-none"
                  style={{ maxHeight: "70vh" }}
                />

                {/* Bounding Box Overlays */}
                {selectedFrame.detections?.map((det) => {
                  if (!activeCategoryFilter[det.objectType]) return null;

                  const [xmin, ymin, xmax, ymax] = det.boundingBox;
                  const left = `${xmin * 100}%`;
                  const top = `${ymin * 100}%`;
                  const width = `${(xmax - xmin) * 100}%`;
                  const height = `${(ymax - ymin) * 100}%`;

                  // Determine class colors
                  let colorClass = "border-amber-500 text-amber-500 bg-amber-500/10";
                  if (det.objectType === "Helmet") {
                    colorClass = "border-green-500 text-green-500 bg-green-500/10";
                  } else if (det.objectType === "Truck") {
                    colorClass = "border-blue-500 text-blue-500 bg-blue-500/10";
                  } else if (det.objectType === "Crane") {
                    colorClass = "border-purple-500 text-purple-500 bg-purple-500/10";
                  } else if (det.objectType === "Excavator") {
                    colorClass = "border-cyan-500 text-cyan-500 bg-cyan-500/10";
                  } else if (det.objectType === "Scaffolding") {
                    colorClass = "border-indigo-500 text-indigo-500 bg-indigo-500/10";
                  } else if (det.objectType === "Pillar") {
                    colorClass = "border-pink-500 text-pink-500 bg-pink-500/10";
                  } else if (det.objectType === "Wall") {
                    colorClass = "border-orange-500 text-orange-500 bg-orange-500/10";
                  } else if (det.objectType === "Construction Equipment") {
                    colorClass = "border-teal-500 text-teal-500 bg-teal-500/10";
                  }

                  return (
                    <div
                      key={det.id}
                      className={`absolute border-2 transition-all duration-200 group/box hover:border-white hover:z-10 cursor-pointer ${colorClass}`}
                      style={{ left, top, width, height }}
                    >
                      {/* Bounding box label */}
                      <span className="absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-bold bg-black/90 text-white rounded border border-inherit shadow whitespace-nowrap opacity-0 group-hover/box:opacity-100 transition-opacity duration-200 pointer-events-none">
                        {det.objectType} ({(det.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Side Panel Controls */}
            <div className="w-full md:w-80 bg-panel-strong border-t md:border-t-0 md:border-l border-border p-5 flex flex-col justify-between shrink-0">
              <div className="space-y-6">
                <div className="hidden md:flex items-center justify-between">
                  <div className="text-left">
                    <h3 className="font-bold text-lg text-foreground">Frame Inspector</h3>
                    <p className="text-xs text-muted">Keyframe at {selectedFrame.timestamp.toFixed(2)}s</p>
                  </div>
                  <button
                    onClick={() => setSelectedFrame(null)}
                    className="p-1 rounded hover:bg-border text-muted hover:text-foreground text-sm font-semibold transition"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted text-left">
                    Object Detections ({selectedFrame.detections?.length ?? 0})
                  </h4>
                  {selectedFrame.detections?.length === 0 ? (
                    <p className="text-xs text-muted text-left">No objects detected in this frame.</p>
                  ) : (
                    <div className="max-h-[35vh] overflow-y-auto space-y-2 pr-1 border border-border/30 rounded-lg p-2 bg-background/50">
                      {selectedFrame.detections?.map((det) => {
                        const isViolated = det.objectType === "Worker" && 
                          !selectedFrame.detections?.some(
                            (h) => h.objectType === "Helmet" && 
                            Math.abs(h.boundingBox[0] - det.boundingBox[0]) < 0.15 &&
                            h.boundingBox[1] < det.boundingBox[1] &&
                            h.boundingBox[3] < det.boundingBox[3]
                          );
                        return (
                          <div
                            key={det.id}
                            className={`flex items-center justify-between p-2 rounded-md border text-xs transition hover:bg-panel ${
                              isViolated && det.objectType === "Worker" 
                                ? "bg-danger/5 border-danger/25 text-danger font-semibold" 
                                : "bg-panel-strong border-border/40 text-foreground"
                            }`}
                          >
                            <span className="font-medium flex items-center gap-1.5">
                              {det.objectType === "Worker" ? "👷" : 
                               det.objectType === "Helmet" ? "🪖" : 
                               det.objectType === "Truck" ? "🚚" : 
                               det.objectType === "Crane" ? "🏗️" : 
                               det.objectType === "Excavator" ? "🚜" : 
                               det.objectType === "Scaffolding" ? "🪜" : 
                               det.objectType === "Pillar" ? "🧱" : 
                               det.objectType === "Wall" ? "🚧" : "🛠️"}{" "}
                              {det.objectType}
                              {isViolated && det.objectType === "Worker" && (
                                <span className="ml-1 px-1 rounded bg-danger/10 text-danger text-[9px] font-bold border border-danger/20">
                                  No Helmet!
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-muted text-[10px]">
                              {(det.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted text-left">
                    Filter Bounding Boxes
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(activeCategoryFilter).map((category) => {
                      const hasCount = selectedFrame.detections?.some((d) => d.objectType === category) ?? false;
                      return (
                        <button
                          key={category}
                          onClick={() =>
                            setActiveCategoryFilter((prev) => ({
                              ...prev,
                              [category]: !prev[category],
                            }))
                          }
                          disabled={!hasCount}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-medium text-left transition disabled:opacity-30 disabled:cursor-not-allowed ${
                            activeCategoryFilter[category] && hasCount
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-background border-border/40 text-muted"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full" style={{
                            backgroundColor: 
                              category === "Worker" ? "#f59e0b" : 
                              category === "Helmet" ? "#22c55e" : 
                              category === "Truck" ? "#3b82f6" : 
                              category === "Crane" ? "#a855f7" : 
                              category === "Excavator" ? "#06b6d4" : 
                              category === "Scaffolding" ? "#6366f1" : 
                              category === "Pillar" ? "#ec4899" : 
                              category === "Wall" ? "#f97316" : "#14b8a6"
                          }} />
                          <span className="truncate">{category}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/40 text-[10px] text-muted text-left">
                Tip: Hover over bounding boxes in the frame viewport to reveal details.
              </div>
            </div>
          </div>
        </div>
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
