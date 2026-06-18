package http

import (
	"backend/config"

	"github.com/gin-gonic/gin"
)

func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowed := false
		for _, o := range allowedOrigins {
			if o == "*" || o == origin {
				allowed = true
				break
			}
		}
		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else if len(allowedOrigins) > 0 && allowedOrigins[0] == "*" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func SetupRouter(handler *Handler, authHandler *AuthHandler, projectHandler *ProjectHandler, cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// CORS Middleware
	r.Use(CORSMiddleware(cfg.CorsOrigins))

	// Static files for uploads (equivalent to FastAPI app.mount("/uploads"))
	r.Static("/uploads", cfg.UploadsDir())

	// API routes
	api := r.Group("/api")
	{
		api.GET("/health", handler.Health)
		api.POST("/uploads", handler.UploadMedia)

		// Auth routes
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.GET("/me", AuthMiddleware(), authHandler.Me)
		}

		// Project routes
		projects := api.Group("/projects")
		projects.Use(AuthMiddleware())
		{
			projects.POST("", projectHandler.Create)
			projects.GET("", projectHandler.List)
			projects.GET("/:id", projectHandler.GetByID)
			projects.PUT("/:id", projectHandler.Update)
			projects.DELETE("/:id", projectHandler.Delete)
		}
	}

	return r
}
