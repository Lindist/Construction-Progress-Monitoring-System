package http

import (
	"backend/domain"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ReportHandler struct {
	reportUsecase domain.ProgressReportUsecase
}

func NewReportHandler(ru domain.ProgressReportUsecase) *ReportHandler {
	return &ReportHandler{reportUsecase: ru}
}

func (h *ReportHandler) List(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid project ID"})
		return
	}

	reports, err := h.reportUsecase.GetReportsByProject(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, reports)
}

func (h *ReportHandler) Generate(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid project ID"})
		return
	}

	reportType := c.DefaultQuery("type", "weekly")
	if reportType != "daily" && reportType != "weekly" && reportType != "monthly" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid report type. Allowed values: daily, weekly, monthly"})
		return
	}

	report, err := h.reportUsecase.GenerateReport(projectID, reportType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}
