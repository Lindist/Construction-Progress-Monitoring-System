package repository

import (
	"backend/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresMediaFileRepository struct {
	db *gorm.DB
}

func NewPostgresMediaFileRepository(db *gorm.DB) domain.MediaFileRepository {
	return &postgresMediaFileRepository{db: db}
}

func (r *postgresMediaFileRepository) Create(media *domain.MediaFile) error {
	if r.db == nil {
		return nil // skip DB write to match Python backend behavior when db is offline
	}
	return r.db.Create(media).Error
}

func (r *postgresMediaFileRepository) FindByID(id uuid.UUID) (*domain.MediaFile, error) {
	if r.db == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var media domain.MediaFile
	err := r.db.First(&media, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &media, nil
}

func (r *postgresMediaFileRepository) FindAll() ([]domain.MediaFile, error) {
	if r.db == nil {
		return []domain.MediaFile{}, nil
	}
	var mediaFiles []domain.MediaFile
	err := r.db.Find(&mediaFiles).Error
	return mediaFiles, err
}

func (r *postgresMediaFileRepository) FindByProjectID(projectID uuid.UUID) ([]domain.MediaFile, error) {
	if r.db == nil {
		return []domain.MediaFile{}, nil
	}
	var mediaFiles []domain.MediaFile
	err := r.db.Where("project_id = ?", projectID).Find(&mediaFiles).Error
	return mediaFiles, err
}

