package http

import (
	"backend/domain"
	"backend/usecase"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ProjectHandler struct {
	projectUsecase usecase.ProjectUsecase
}

func NewProjectHandler(pu usecase.ProjectUsecase) *ProjectHandler {
	return &ProjectHandler{projectUsecase: pu}
}

func (h *ProjectHandler) Create(c *gin.Context) {
	userIDVal, _ := c.Get("userID")
	userID := userIDVal.(uuid.UUID)

	var req domain.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	project, err := h.projectUsecase.CreateProject(userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, project)
}

func (h *ProjectHandler) Update(c *gin.Context) {
	userIDVal, _ := c.Get("userID")
	userID := userIDVal.(uuid.UUID)

	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid project ID"})
		return
	}

	var req domain.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	project, err := h.projectUsecase.UpdateProject(userID, projectID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) Delete(c *gin.Context) {
	userIDVal, _ := c.Get("userID")
	userID := userIDVal.(uuid.UUID)

	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid project ID"})
		return
	}

	err = h.projectUsecase.DeleteProject(userID, projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

func (h *ProjectHandler) GetByID(c *gin.Context) {
	userIDVal, _ := c.Get("userID")
	userID := userIDVal.(uuid.UUID)

	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid project ID"})
		return
	}

	project, err := h.projectUsecase.GetProjectByID(userID, projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) List(c *gin.Context) {
	userIDVal, _ := c.Get("userID")
	userID := userIDVal.(uuid.UUID)

	projects, err := h.projectUsecase.GetProjectsByOwner(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, projects)
}
