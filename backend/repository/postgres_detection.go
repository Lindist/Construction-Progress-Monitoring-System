package repository

import (
	"backend/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresDetectionRepository struct {
	db *gorm.DB
}

func NewPostgresDetectionRepository(db *gorm.DB) domain.DetectionRepository {
	return &postgresDetectionRepository{db: db}
}

func (r *postgresDetectionRepository) Create(detection *domain.Detection) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(detection).Error
}

func (r *postgresDetectionRepository) FindByFrameID(frameID uuid.UUID) ([]domain.Detection, error) {
	if r.db == nil {
		return []domain.Detection{}, nil
	}
	var detections []domain.Detection
	err := r.db.Where("frame_id = ?", frameID).Find(&detections).Error
	return detections, err
}
