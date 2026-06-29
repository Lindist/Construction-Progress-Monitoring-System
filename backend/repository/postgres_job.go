package repository

import (
	"backend/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresJobRepository struct {
	db *gorm.DB
}

func NewPostgresJobRepository(db *gorm.DB) domain.JobRepository {
	return &postgresJobRepository{db: db}
}

func (r *postgresJobRepository) Create(job *domain.Job) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(job).Error
}

func (r *postgresJobRepository) FindByID(id uuid.UUID) (*domain.Job, error) {
	if r.db == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var job domain.Job
	err := r.db.First(&job, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *postgresJobRepository) FindByMediaID(mediaID uuid.UUID) ([]domain.Job, error) {
	if r.db == nil {
		return []domain.Job{}, nil
	}
	var jobs []domain.Job
	err := r.db.Where("media_id = ?", mediaID).Order("created_at DESC").Find(&jobs).Error
	return jobs, err
}

func (r *postgresJobRepository) Update(job *domain.Job) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(job).Error
}

func (r *postgresJobRepository) ListAll() ([]domain.Job, error) {
	if r.db == nil {
		return []domain.Job{}, nil
	}
	var jobs []domain.Job
	err := r.db.Order("created_at DESC").Find(&jobs).Error
	return jobs, err
}
