package usecase

import (
	"backend/config"
	"backend/domain"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type MediaUsecase interface {
	UploadMedia(fileHeader *multipart.FileHeader, projectID uuid.UUID) (*domain.MediaFile, string, error)
	ListProjectMedia(projectID uuid.UUID) ([]domain.MediaFile, error)
}

type mediaUsecase struct {
	repo   domain.MediaFileRepository
	config *config.Config
}

func NewMediaUsecase(repo domain.MediaFileRepository, cfg *config.Config) MediaUsecase {
	return &mediaUsecase{
		repo:   repo,
		config: cfg,
	}
}

type FileMetadata struct {
	ID           string    `json:"id"`
	ProjectID    string    `json:"project_id"`
	OriginalName string    `json:"original_name"`
	ContentType  string    `json:"content_type"`
	SizeBytes    int64     `json:"size_bytes"`
	UploadedAt   string    `json:"uploaded_at"`
	FilePath     string    `json:"file_path"`
	URL          string    `json:"url"`
}

func (u *mediaUsecase) UploadMedia(fileHeader *multipart.FileHeader, projectID uuid.UUID) (*domain.MediaFile, string, error) {
	// Ensure directories exist
	uploadsDir := u.config.UploadsDir()
	metadataDir := u.config.MetadataDir()
	
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		return nil, "", fmt.Errorf("failed to create uploads directory: %w", err)
	}
	if err := os.MkdirAll(metadataDir, 0755); err != nil {
		return nil, "", fmt.Errorf("failed to create metadata directory: %w", err)
	}

	// Generate UUID
	fileID := uuid.New()
	
	// Suffix logic
	suffix := filepath.Ext(fileHeader.Filename)
	if suffix == "" {
		suffix = ".bin"
	}
	
	destFilename := fmt.Sprintf("%s%s", fileID.String(), suffix)
	destPath := filepath.Join(uploadsDir, destFilename)

	// Save file
	src, err := fileHeader.Open()
	if err != nil {
		return nil, "", fmt.Errorf("failed to open upload source: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return nil, "", fmt.Errorf("failed to copy file: %w", err)
	}

	// Retrieve file stats
	stat, err := dst.Stat()
	sizeBytes := fileHeader.Size
	if err == nil {
		sizeBytes = stat.Size()
	}

	now := time.Now().UTC()
	
	// Create domain model
	media := &domain.MediaFile{
		ID:         fileID,
		ProjectID:  projectID,
		FileName:   fileHeader.Filename,
		FileType:   fileHeader.Header.Get("Content-Type"),
		FilePath:   destPath,
		UploadedAt: now,
		SizeBytes:  sizeBytes,
	}

	// Create JSON Metadata
	urlPath := fmt.Sprintf("/uploads/%s", destFilename)
	metadata := FileMetadata{
		ID:           fileID.String(),
		ProjectID:    projectID.String(),
		OriginalName: media.FileName,
		ContentType:  media.FileType,
		SizeBytes:    media.SizeBytes,
		UploadedAt:   media.UploadedAt.Format(time.RFC3339),
		FilePath:     media.FilePath,
		URL:          urlPath,
	}

	metadataJSON, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return nil, "", fmt.Errorf("failed to serialize metadata: %w", err)
	}

	metadataPath := filepath.Join(metadataDir, fmt.Sprintf("%s.json", fileID.String()))
	if err := os.WriteFile(metadataPath, metadataJSON, 0644); err != nil {
		return nil, "", fmt.Errorf("failed to write metadata file: %w", err)
	}

	// Save to DB
	if err := u.repo.Create(media); err != nil {
		return nil, "", fmt.Errorf("failed to save media file in database: %w", err)
	}

	return media, urlPath, nil
}

func (u *mediaUsecase) ListProjectMedia(projectID uuid.UUID) ([]domain.MediaFile, error) {
	return u.repo.FindByProjectID(projectID)
}

