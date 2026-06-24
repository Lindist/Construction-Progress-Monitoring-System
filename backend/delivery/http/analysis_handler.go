package http

import (
	"backend/domain"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AnalysisHandler struct {
	analysisUsecase domain.AnalysisUsecase
}

func NewAnalysisHandler(au domain.AnalysisUsecase) *AnalysisHandler {
	return &AnalysisHandler{analysisUsecase: au}
}

func (h *AnalysisHandler) Compare(c *gin.Context) {
	frameIDAStr := c.Query("frame_id_a")
	frameIDBStr := c.Query("frame_id_b")

	if frameIDAStr != "" && frameIDBStr != "" {
		frameIDA, err := uuid.Parse(frameIDAStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid frame_id_a UUID format"})
			return
		}
		frameIDB, err := uuid.Parse(frameIDBStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid frame_id_b UUID format"})
			return
		}

		result, err := h.analysisUsecase.CompareFrames(frameIDA, frameIDB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
			return
		}

		c.JSON(http.StatusOK, result)
		return
	}

	mediaIDAStr := c.Query("media_id_a")
	mediaIDBStr := c.Query("media_id_b")

	if mediaIDAStr != "" && mediaIDBStr != "" {
		mediaIDA, err := uuid.Parse(mediaIDAStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid media_id_a UUID format"})
			return
		}
		mediaIDB, err := uuid.Parse(mediaIDBStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid media_id_b UUID format"})
			return
		}

		result, err := h.analysisUsecase.CompareMedia(mediaIDA, mediaIDB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
			return
		}

		c.JSON(http.StatusOK, result)
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"detail": "Must provide either (frame_id_a AND frame_id_b) OR (media_id_a AND media_id_b)"})
}
