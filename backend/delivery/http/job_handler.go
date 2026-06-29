package http

import (
	"backend/usecase"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type JobHandler struct {
	usecase usecase.JobUsecase
}

func NewJobHandler(u usecase.JobUsecase) *JobHandler {
	return &JobHandler{usecase: u}
}

func (h *JobHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid job ID"})
		return
	}

	job, err := h.usecase.GetJobByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

func (h *JobHandler) List(c *gin.Context) {
	mediaIDStr := c.Query("media_id")
	if mediaIDStr != "" {
		mediaID, err := uuid.Parse(mediaIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid media ID format"})
			return
		}
		jobs, err := h.usecase.GetJobsByMediaID(mediaID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
			return
		}
		c.JSON(http.StatusOK, jobs)
		return
	}

	jobs, err := h.usecase.ListAllJobs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, jobs)
}

func (h *JobHandler) Retry(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid job ID"})
		return
	}

	if err := h.usecase.RetryJob(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "retrying"})
}

type StatusUpdateRequest struct {
	Status       string `json:"status" binding:"required"`
	ErrorMessage string `json:"error_message"`
}

func (h *JobHandler) UpdateStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid job ID"})
		return
	}

	var req StatusUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	if err := h.usecase.UpdateJobStatus(id, req.Status, req.ErrorMessage); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func (h *JobHandler) SubmitResults(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid job ID"})
		return
	}

	var payload usecase.JobResultPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	if err := h.usecase.SubmitJobResults(id, &payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "results_saved"})
}
