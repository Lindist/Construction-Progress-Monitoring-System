package domain

import (
	"time"

	"github.com/google/uuid"
)

type Detection struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	FrameID     uuid.UUID `gorm:"type:uuid;not null;index" json:"frame_id"`
	ObjectType  string    `gorm:"type:text;not null" json:"object_type"`
	Confidence  float64   `gorm:"type:numeric;not null" json:"confidence"`
	BoundingBox string    `gorm:"type:text;not null" json:"bounding_box"`
	CreatedAt   time.Time `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
}

func (Detection) TableName() string {
	return "detections"
}

type DetectionRepository interface {
	Create(detection *Detection) error
	FindByFrameID(frameID uuid.UUID) ([]Detection, error)
}
