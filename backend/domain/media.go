package domain

import (
	"time"

	"github.com/google/uuid"
)

type Video struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID    *uuid.UUID `gorm:"type:uuid" json:"project_id"`
	OriginalName string     `gorm:"type:text;not null" json:"original_name"`
	FilePath     string     `gorm:"type:text;not null" json:"file_path"`
	ContentType  string     `gorm:"type:text;not null" json:"content_type"`
	SizeBytes    int64      `gorm:"type:bigint;not null" json:"size_bytes"`
	UploadedAt   time.Time  `gorm:"type:timestamptz;not null;default:now()" json:"uploaded_at"`
}

// TableName overrides the table name for GORM
func (Video) TableName() string {
	return "videos"
}

type VideoRepository interface {
	Create(video *Video) error
	FindByID(id uuid.UUID) (*Video, error)
	FindAll() ([]Video, error)
}
