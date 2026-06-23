package usecase

import (
	"bytes"
	"backend/config"
	"backend/domain"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

type MediaUsecase interface {
	UploadMedia(fileHeader *multipart.FileHeader, projectID uuid.UUID) (*domain.MediaFile, string, error)
	ListProjectMedia(projectID uuid.UUID) ([]domain.MediaFile, error)
	GetMediaFrames(mediaID uuid.UUID) ([]domain.Frame, error)
	ProcessVideo(mediaID uuid.UUID, filePath string) error
}

type mediaUsecase struct {
	repo              domain.MediaFileRepository
	frameRepo         domain.FrameRepository
	detectionRepo     domain.DetectionRepository
	config            *config.Config
	onProcessComplete func(mediaID string)
}

func NewMediaUsecase(repo domain.MediaFileRepository, frameRepo domain.FrameRepository, detectionRepo domain.DetectionRepository, cfg *config.Config, onProcessComplete func(mediaID string)) MediaUsecase {
	return &mediaUsecase{
		repo:              repo,
		frameRepo:         frameRepo,
		detectionRepo:     detectionRepo,
		config:            cfg,
		onProcessComplete: onProcessComplete,
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

type ProcessRequest struct {
	MediaID  string `json:"media_id"`
	FilePath string `json:"file_path"`
}

type ProcessResponseDetection struct {
	ObjectType  string    `json:"object_type"`
	Confidence  float64   `json:"confidence"`
	BoundingBox []float64 `json:"bounding_box"`
}

type ProcessResponseFrame struct {
	Timestamp  float64                    `json:"timestamp"`
	FramePath  string                     `json:"frame_path"`
	Detections []ProcessResponseDetection `json:"detections"`
}

type ProcessResponse struct {
	MediaID string                 `json:"media_id"`
	Frames  []ProcessResponseFrame `json:"frames"`
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

	// Trigger processing in a background goroutine if it's a video file
	if strings.HasPrefix(media.FileType, "video/") {
		go func() {
			log.Printf("Usecase: Starting background video processing for %s (%s)\n", media.ID, media.FileName)
			if err := u.ProcessVideo(media.ID, media.FilePath); err != nil {
				log.Printf("Usecase: Background processing failed for video %s: %v\n", media.ID, err)
			} else {
				log.Printf("Usecase: Background processing completed successfully for video %s\n", media.ID)
			}
		}()
	}

	return media, urlPath, nil
}

func (u *mediaUsecase) ListProjectMedia(projectID uuid.UUID) ([]domain.MediaFile, error) {
	return u.repo.FindByProjectID(projectID)
}

func (u *mediaUsecase) GetMediaFrames(mediaID uuid.UUID) ([]domain.Frame, error) {
	return u.frameRepo.FindByMediaID(mediaID)
}

func (u *mediaUsecase) ProcessVideo(mediaID uuid.UUID, filePath string) error {
	reqBody := ProcessRequest{
		MediaID:  mediaID.String(),
		FilePath: filePath,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal process request: %w", err)
	}

	url := fmt.Sprintf("%s/api/process", u.config.AIServiceURL)
	log.Printf("Usecase: Sending video processing request to AI service: %s\n", url)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to call AI service process endpoint: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("AI service returned non-OK status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var processResp ProcessResponse
	if err := json.NewDecoder(resp.Body).Decode(&processResp); err != nil {
		return fmt.Errorf("failed to decode AI service process response: %w", err)
	}

	log.Printf("Usecase: AI service returned %d frames for video %s. Saving to database...\n", len(processResp.Frames), mediaID)

	for _, f := range processResp.Frames {
		frame := &domain.Frame{
			ID:        uuid.New(),
			MediaID:   mediaID,
			Timestamp: f.Timestamp,
			FramePath: f.FramePath,
		}

		if err := u.frameRepo.Create(frame); err != nil {
			log.Printf("Usecase: Warning: failed to save frame record at %f seconds in DB: %v\n", f.Timestamp, err)
			continue
		}

		for _, d := range f.Detections {
			bboxJSON, err := json.Marshal(d.BoundingBox)
			if err != nil {
				log.Printf("Usecase: Warning: failed to marshal bounding box %v: %v\n", d.BoundingBox, err)
				bboxJSON = []byte("[]")
			}

			det := &domain.Detection{
				ID:          uuid.New(),
				FrameID:     frame.ID,
				ObjectType:  d.ObjectType,
				Confidence:  d.Confidence,
				BoundingBox: string(bboxJSON),
			}
			if err := u.detectionRepo.Create(det); err != nil {
				log.Printf("Usecase: Warning: failed to save detection %s in DB: %v\n", d.ObjectType, err)
			}
		}
	}

	// Trigger callback to notify clients via SSE
	if u.onProcessComplete != nil {
		u.onProcessComplete(mediaID.String())
	}

	return nil
}
