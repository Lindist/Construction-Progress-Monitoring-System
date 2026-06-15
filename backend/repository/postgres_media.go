package repository

import (
	"backend/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresVideoRepository struct {
	db *gorm.DB
}

func NewPostgresVideoRepository(db *gorm.DB) domain.VideoRepository {
	return &postgresVideoRepository{db: db}
}

func (r *postgresVideoRepository) Create(video *domain.Video) error {
	if r.db == nil {
		return nil // skip DB write to match Python backend behavior when db is offline
	}
	return r.db.Create(video).Error
}

func (r *postgresVideoRepository) FindByID(id uuid.UUID) (*domain.Video, error) {
	if r.db == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var video domain.Video
	err := r.db.First(&video, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &video, nil
}

func (r *postgresVideoRepository) FindAll() ([]domain.Video, error) {
	if r.db == nil {
		return []domain.Video{}, nil
	}
	var videos []domain.Video
	err := r.db.Find(&videos).Error
	return videos, err
}
