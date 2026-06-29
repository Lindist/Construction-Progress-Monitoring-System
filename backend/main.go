package main

import (
	"backend/config"
	delivery "backend/delivery/http"
	"backend/domain"
	"backend/repository"
	"backend/usecase"
	"log"
	"os"

	"github.com/google/uuid"
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
		err = db.AutoMigrate(&domain.User{}, &domain.Project{}, &domain.MediaFile{}, &domain.Frame{}, &domain.Detection{}, &domain.ProgressReport{}, &domain.Job{})
		if err != nil {
			log.Printf("Warning: auto-migration failed: %v\n", err)
		}
	}

	userRepo := repository.NewPostgresUserRepository(db)
	projectRepo := repository.NewPostgresProjectRepository(db)
	mediaRepo := repository.NewPostgresMediaFileRepository(db)
	frameRepo := repository.NewPostgresFrameRepository(db)
	detectionRepo := repository.NewPostgresDetectionRepository(db)
	reportRepo := repository.NewPostgresProgressReportRepository(db)
	jobRepo := repository.NewPostgresJobRepository(db)

	broker := delivery.NewEventBroker()
	authUsecase := usecase.NewAuthUsecase(userRepo)
	projectUsecase := usecase.NewProjectUsecase(projectRepo, mediaRepo, cfg)
	analysisUsecase := usecase.NewAnalysisUsecase(frameRepo, mediaRepo)
	reportUsecase := usecase.NewReportUsecase(reportRepo, projectRepo, mediaRepo, frameRepo, analysisUsecase, cfg)

	// Redis Queue Manager
	queueMgr, qErr := repository.NewRedisQueueManager(cfg.RedisURL)
	if qErr != nil {
		log.Printf("Warning: Failed to initialize Redis Queue Manager: %v\n", qErr)
	}

	onProcessComplete := func(mediaIDStr string) {
		broker.Notifier <- mediaIDStr
		
		// Trigger automatic report generation in background
		go func() {
			mediaID, err := uuid.Parse(mediaIDStr)
			if err != nil {
				return
			}
			media, err := mediaRepo.FindByID(mediaID)
			if err != nil || media == nil {
				return
			}
			log.Printf("Main: Automatically generating daily, weekly, monthly progress reports for project %s after media processing complete", media.ProjectID)
			for _, rType := range []string{"daily", "weekly", "monthly"} {
				_, err := reportUsecase.GenerateReport(media.ProjectID, rType)
				if err != nil {
					log.Printf("Main: Failed to auto-generate %s report: %v", rType, err)
				}
			}
		}()
	}

	jobUsecase := usecase.NewJobUsecase(jobRepo, mediaRepo, frameRepo, detectionRepo, queueMgr, onProcessComplete)
	mediaUsecase := usecase.NewMediaUsecase(mediaRepo, frameRepo, detectionRepo, projectRepo, cfg, jobUsecase, onProcessComplete)

	authHandler := delivery.NewAuthHandler(authUsecase)
	projectHandler := delivery.NewProjectHandler(projectUsecase)
	handler := delivery.NewHandler(mediaUsecase, cfg, db, broker)
	analysisHandler := delivery.NewAnalysisHandler(analysisUsecase)
	dashboardUsecase := usecase.NewDashboardUsecase(db, projectRepo)
	dashboardHandler := delivery.NewDashboardHandler(dashboardUsecase)
	reportHandler := delivery.NewReportHandler(reportUsecase)
	jobHandler := delivery.NewJobHandler(jobUsecase)

	router := delivery.SetupRouter(handler, authHandler, projectHandler, analysisHandler, dashboardHandler, reportHandler, jobHandler, cfg)

	log.Printf("Starting backend server on port %s...\n", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v\n", err)
	}
}