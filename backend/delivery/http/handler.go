package http

import (
	"backend/config"
	"backend/usecase"
	"fmt"
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
}

func NewHandler(mu usecase.MediaUsecase, cfg *config.Config, db *gorm.DB) *Handler {
	return &Handler{
		mediaUsecase: mu,
		config:       cfg,
		db:           db,
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

		urlPath := fmt.Sprintf("/uploads/%s", filepath.Base(m.FilePath))
		responses[i] = UploadResponse{
			ID:           m.ID.String(),
			OriginalName: m.FileName,
			ContentType:  m.FileType,
			SizeBytes:    sizeBytes,
			UploadedAt:   m.UploadedAt.Format("2006-01-02T15:04:05.999Z07:00"),
			URL:          urlPath,
		}
	}

	c.JSON(http.StatusOK, responses)
}

