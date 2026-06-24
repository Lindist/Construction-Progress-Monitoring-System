package domain

import (
	"time"

	"github.com/google/uuid"
)

type Frame struct {
	ID         uuid.UUID   `gorm:"type:uuid;primaryKey" json:"id"`
	MediaID    uuid.UUID   `gorm:"type:uuid;not null;index" json:"media_id"`
	Timestamp  float64     `gorm:"type:numeric;not null" json:"timestamp"`
	FramePath  string      `gorm:"type:text;not null" json:"frame_path"`
	Detections []Detection `gorm:"foreignKey:FrameID;constraint:OnDelete:CASCADE" json:"detections,omitempty"`
	CreatedAt  time.Time   `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
}

func (Frame) TableName() string {
	return "frames"
}

type FrameRepository interface {
	Create(frame *Frame) error
	FindByMediaID(mediaID uuid.UUID) ([]Frame, error)
	FindByID(id uuid.UUID) (*Frame, error)
}
