package domain

import (
	"time"

	"github.com/google/uuid"
)

type MediaFile struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID    uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	FileName     string    `gorm:"column:file_name;type:text;not null" json:"original_name"`
	FileType     string    `gorm:"column:file_type;type:text;not null" json:"content_type"`
	FilePath     string    `gorm:"column:file_path;type:text;not null" json:"file_path"`
	UploadedAt   time.Time `gorm:"column:uploaded_at;type:timestamptz;not null;default:now()" json:"uploaded_at"`
	SizeBytes    int64     `gorm:"-" json:"size_bytes"` // Ignored by GORM database schema to match PDF columns exactly, but included in API responses
	ThumbnailURL string    `gorm:"-" json:"thumbnail_url,omitempty"`
	TimelineURL  string    `gorm:"-" json:"timeline_url,omitempty"`
}

// TableName overrides the table name for GORM
func (MediaFile) TableName() string {
	return "media_files"
}

type MediaFileRepository interface {
	Create(media *MediaFile) error
	FindByID(id uuid.UUID) (*MediaFile, error)
	FindAll() ([]MediaFile, error)
	FindByProjectID(projectID uuid.UUID) ([]MediaFile, error)
	Update(media *MediaFile) error
	Delete(id uuid.UUID) error
}
