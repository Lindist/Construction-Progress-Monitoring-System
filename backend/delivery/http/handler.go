package http

import (
	"backend/config"
	"backend/usecase"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	mediaUsecase usecase.MediaUsecase
	config       *config.Config
	db           *gorm.DB
	broker       *EventBroker
}

func NewHandler(mu usecase.MediaUsecase, cfg *config.Config, db *gorm.DB, broker *EventBroker) *Handler {
	return &Handler{
		mediaUsecase: mu,
		config:       cfg,
		db:           db,
		broker:       broker,
	}
}

type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Storage  string `json:"storage"`
}

func (h *Handler) Health(c *gin.Context) {
	storageStatus := "missing"
	if _, err := os.Stat(h.config.UploadsDir()); err == nil {
		storageStatus = "ready"
	}

	databaseStatus := "unavailable"
	if h.db != nil {
		sqlDB, err := h.db.DB()
		if err == nil && sqlDB.Ping() == nil {
			databaseStatus = "connected"
		}
	}

	c.JSON(http.StatusOK, HealthResponse{
		Status:   "ok",
		Database: databaseStatus,
		Storage:  storageStatus,
	})
}

type UploadResponse struct {
	ID           string `json:"id"`
	OriginalName string `json:"original_name"`
	ContentType  string `json:"content_type"`
	SizeBytes    int64  `json:"size_bytes"`
	UploadedAt   string `json:"uploaded_at"`
	URL          string `json:"url"`
	ThumbnailURL string `json:"thumbnail_url,omitempty"`
	TimelineURL  string `json:"timeline_url,omitempty"`
}

var allowedContentTypes = map[string]bool{
	"video/mp4":       true,
	"video/quicktime": true,
	"video/webm":      true,
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
}

func (h *Handler) UploadMedia(c *gin.Context) {
	// Retrieve project_id from form body or query params
	projectIDStr := c.PostForm("project_id")
	if projectIDStr == "" {
		projectIDStr = c.Query("project_id")
	}

	if projectIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "project_id is required."})
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid project_id UUID format."})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "No file uploaded."})
		return
	}

	contentType := file.Header.Get("Content-Type")
	if !allowedContentTypes[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Unsupported file type."})
		return
	}

	media, urlPath, err := h.mediaUsecase.UploadMedia(file, projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, UploadResponse{
		ID:           media.ID.String(),
		OriginalName: media.FileName,
		ContentType:  media.FileType,
		SizeBytes:    media.SizeBytes,
		UploadedAt:   media.UploadedAt.Format("2006-01-02T15:04:05.999Z07:00"),
		URL:          urlPath,
	})
}

func (h *Handler) ListProjectMedia(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid project ID"})
		return
	}

	mediaFiles, err := h.mediaUsecase.ListProjectMedia(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	responses := make([]UploadResponse, len(mediaFiles))
	for i, m := range mediaFiles {
		var sizeBytes int64
		// Dynamically read size from disk if possible
		if stat, err := os.Stat(m.FilePath); err == nil {
			sizeBytes = stat.Size()
		}

		// Dynamically check if thumbnail/timeline exist
		thumbnailPath := filepath.Join(h.config.UploadsDir(), "frames", m.ID.String(), "thumbnail.jpg")
		var thumbnailURL string
		if _, err := os.Stat(thumbnailPath); err == nil {
			thumbnailURL = fmt.Sprintf("/uploads/frames/%s/thumbnail.jpg", m.ID.String())
		}

		timelinePath := filepath.Join(h.config.UploadsDir(), "frames", m.ID.String(), "timeline.jpg")
		var timelineURL string
		if _, err := os.Stat(timelinePath); err == nil {
			timelineURL = fmt.Sprintf("/uploads/frames/%s/timeline.jpg", m.ID.String())
		}

		urlPath := fmt.Sprintf("/uploads/%s", filepath.Base(m.FilePath))
		responses[i] = UploadResponse{
			ID:           m.ID.String(),
			OriginalName: m.FileName,
			ContentType:  m.FileType,
			SizeBytes:    sizeBytes,
			UploadedAt:   m.UploadedAt.Format("2006-01-02T15:04:05.999Z07:00"),
			URL:          urlPath,
			ThumbnailURL: thumbnailURL,
			TimelineURL:  timelineURL,
		}
	}

	c.JSON(http.StatusOK, responses)
}

type DetectionResponse struct {
	ID          string  `json:"id"`
	FrameID     string  `json:"frame_id"`
	ObjectType  string  `json:"object_type"`
	Confidence  float64 `json:"confidence"`
	BoundingBox string  `json:"bounding_box"`
}

type FrameResponse struct {
	ID         string              `json:"id"`
	MediaID    string              `json:"media_id"`
	Timestamp  float64             `json:"timestamp"`
	FrameURL   string              `json:"frame_url"`
	Detections []DetectionResponse `json:"detections"`
}

func (h *Handler) GetMediaFrames(c *gin.Context) {
	mediaIDStr := c.Param("id")
	mediaID, err := uuid.Parse(mediaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid media ID format."})
		return
	}

	frames, err := h.mediaUsecase.GetMediaFrames(mediaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	responses := make([]FrameResponse, len(frames))
	for i, f := range frames {
		frameURL := fmt.Sprintf("/uploads/frames/%s/%s", mediaID.String(), filepath.Base(f.FramePath))
		
		detResponses := make([]DetectionResponse, len(f.Detections))
		for j, d := range f.Detections {
			detResponses[j] = DetectionResponse{
				ID:          d.ID.String(),
				FrameID:     d.FrameID.String(),
				ObjectType:  d.ObjectType,
				Confidence:  d.Confidence,
				BoundingBox: d.BoundingBox,
			}
		}
		
		responses[i] = FrameResponse{
			ID:         f.ID.String(),
			MediaID:    f.MediaID.String(),
			Timestamp:  f.Timestamp,
			FrameURL:   frameURL,
			Detections: detResponses,
		}
	}

	c.JSON(http.StatusOK, responses)
}

func (h *Handler) MediaEvents(c *gin.Context) {
	v := make(chan string)
	h.broker.newClients <- v
	defer func() {
		h.broker.closingClients <- v
	}()

	// SSE Headers
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")

	c.Stream(func(w io.Writer) bool {
		if msg, ok := <-v; ok {
			c.SSEvent("message", msg)
			return true
		}
		return false
	})
}
