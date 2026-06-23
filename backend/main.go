package main

import (
	"backend/config"
	delivery "backend/delivery/http"
	"backend/domain"
	"backend/repository"
	"backend/usecase"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	cfg := config.LoadConfig()

	// Ensure uploads and metadata storage directories exist
	if err := os.MkdirAll(cfg.UploadsDir(), 0755); err != nil {
		log.Printf("Warning: failed to create uploads directory: %v\n", err)
	}
	if err := os.MkdirAll(cfg.MetadataDir(), 0755); err != nil {
		log.Printf("Warning: failed to create metadata directory: %v\n", err)
	}

	var db *gorm.DB
	var err error

	log.Printf("Connecting to database: %s\n", cfg.DBConnStr)
	db, err = gorm.Open(postgres.Open(cfg.DBConnStr), &gorm.Config{})
	if err != nil {
		log.Printf("Warning: failed to connect to database: %v. Database functionality will be unavailable.\n", err)
	} else {
		log.Println("Database connection successful. Running auto-migrations...")
		err = db.AutoMigrate(&domain.User{}, &domain.Project{}, &domain.MediaFile{}, &domain.Frame{}, &domain.Detection{})
		if err != nil {
			log.Printf("Warning: auto-migration failed: %v\n", err)
		}
	}

	userRepo := repository.NewPostgresUserRepository(db)
	projectRepo := repository.NewPostgresProjectRepository(db)
	mediaRepo := repository.NewPostgresMediaFileRepository(db)
	frameRepo := repository.NewPostgresFrameRepository(db)
	detectionRepo := repository.NewPostgresDetectionRepository(db)

	broker := delivery.NewEventBroker()

	authUsecase := usecase.NewAuthUsecase(userRepo)
	projectUsecase := usecase.NewProjectUsecase(projectRepo)
	mediaUsecase := usecase.NewMediaUsecase(mediaRepo, frameRepo, detectionRepo, cfg, func(mediaID string) {
		broker.Notifier <- mediaID
	})

	authHandler := delivery.NewAuthHandler(authUsecase)
	projectHandler := delivery.NewProjectHandler(projectUsecase)
	handler := delivery.NewHandler(mediaUsecase, cfg, db, broker)
	router := delivery.SetupRouter(handler, authHandler, projectHandler, cfg)

	log.Printf("Starting backend server on port %s...\n", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v\n", err)
	}
}