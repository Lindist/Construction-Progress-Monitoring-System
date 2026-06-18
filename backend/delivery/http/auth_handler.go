package http

import (
	"backend/domain"
	"backend/usecase"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authUsecase usecase.AuthUsecase
}

func NewAuthHandler(au usecase.AuthUsecase) *AuthHandler {
	return &AuthHandler{authUsecase: au}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req domain.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	res, err := h.authUsecase.Register(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, res)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	res, err := h.authUsecase.Login(&req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *AuthHandler) Me(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Invalid user ID context"})
		return
	}

	user, err := h.authUsecase.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}
