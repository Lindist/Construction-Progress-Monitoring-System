package http

import (
	"backend/config"
	"backend/usecase"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
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

	video, urlPath, err := h.mediaUsecase.UploadMedia(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, UploadResponse{
		ID:           video.ID.String(),
		OriginalName: video.OriginalName,
		ContentType:  video.ContentType,
		SizeBytes:    video.SizeBytes,
		UploadedAt:   video.UploadedAt.Format("2006-01-02T15:04:05.999Z07:00"),
		URL:          urlPath,
	})
}
