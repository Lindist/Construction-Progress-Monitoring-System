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

func (r *postgresMediaFileRepository) Update(media *domain.MediaFile) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(media).Error
}

func (r *postgresMediaFileRepository) Delete(id uuid.UUID) error {
	if r.db == nil {
		return nil
	}

	// 1. Delete detections of frames of this media
	var frames []domain.Frame
	if err := r.db.Where("media_id = ?", id).Find(&frames).Error; err == nil {
		for _, f := range frames {
			r.db.Delete(&domain.Detection{}, "frame_id = ?", f.ID)
		}
	}

	// 2. Delete frames
	r.db.Delete(&domain.Frame{}, "media_id = ?", id)

	// 3. Delete jobs
	r.db.Delete(&domain.Job{}, "media_id = ?", id)

	// 4. Delete media file
	return r.db.Delete(&domain.MediaFile{}, "id = ?", id).Error
}

