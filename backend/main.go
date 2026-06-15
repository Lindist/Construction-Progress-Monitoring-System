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
		err = db.AutoMigrate(&domain.Video{})
		if err != nil {
			log.Printf("Warning: auto-migration failed: %v\n", err)
		}
	}

	videoRepo := repository.NewPostgresVideoRepository(db)
	mediaUsecase := usecase.NewMediaUsecase(videoRepo, cfg)
	handler := delivery.NewHandler(mediaUsecase, cfg, db)
	router := delivery.SetupRouter(handler, cfg)

	log.Printf("Starting backend server on port %s...\n", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v\n", err)
	}
}
