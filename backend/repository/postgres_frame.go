package repository

import (
	"backend/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresFrameRepository struct {
	db *gorm.DB
}

func NewPostgresFrameRepository(db *gorm.DB) domain.FrameRepository {
	return &postgresFrameRepository{db: db}
}

func (r *postgresFrameRepository) Create(frame *domain.Frame) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(frame).Error
}

func (r *postgresFrameRepository) FindByMediaID(mediaID uuid.UUID) ([]domain.Frame, error) {
	if r.db == nil {
		return []domain.Frame{}, nil
	}
	var frames []domain.Frame
	err := r.db.Preload("Detections").Where("media_id = ?", mediaID).Order("timestamp asc").Find(&frames).Error
	return frames, err
}

func (r *postgresFrameRepository) FindByID(id uuid.UUID) (*domain.Frame, error) {
	if r.db == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var frame domain.Frame
	err := r.db.Preload("Detections").First(&frame, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &frame, nil
}
