package config

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName      string
	Port         string
	DBConnStr    string
	StorageRoot  string
	CorsOrigins  []string
	AIServiceURL string
	RedisURL     string
}

func LoadConfig() *Config {
	// Try loading .env file from the current directory or parent directories
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found or error loading, using system environment variables")
	}

	appName := os.Getenv("APP_NAME")
	if appName == "" {
		appName = "Construction Progress Monitoring API"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	dbConnStr := os.Getenv("DATABASE_URL")
	if dbConnStr == "" {
		dbConnStr = "postgresql://postgres:postgres@localhost:5432/construction_progress?sslmode=disable"
	}

	storageRoot := os.Getenv("STORAGE_ROOT")
	if storageRoot == "" {
		storageRoot = "../storage"
	}
	
	// Convert to absolute path
	absStorageRoot, err := filepath.Abs(storageRoot)
	if err == nil {
		storageRoot = absStorageRoot
	}

	corsOriginsStr := os.Getenv("CORS_ORIGINS")
	var corsOrigins []string
	if corsOriginsStr != "" {
		corsOrigins = strings.Split(corsOriginsStr, ",")
	} else {
		corsOrigins = []string{"http://localhost:3000", "http://localhost:3001"}
	}

	aiServiceURL := os.Getenv("AI_SERVICE_URL")
	if aiServiceURL == "" {
		aiServiceURL = "http://localhost:8001"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	return &Config{
		AppName:      appName,
		Port:         port,
		DBConnStr:    dbConnStr,
		StorageRoot:  storageRoot,
		CorsOrigins:  corsOrigins,
		AIServiceURL: aiServiceURL,
		RedisURL:     redisURL,
	}
}

func (c *Config) UploadsDir() string {
	return filepath.Join(c.StorageRoot, "uploads")
}

func (c *Config) MetadataDir() string {
	return filepath.Join(c.StorageRoot, "metadata")
}
