package repository

import (
	"backend/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresProjectRepository struct {
	db *gorm.DB
}

func NewPostgresProjectRepository(db *gorm.DB) domain.ProjectRepository {
	return &postgresProjectRepository{db: db}
}

func (r *postgresProjectRepository) Create(project *domain.Project) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(project).Error
}

func (r *postgresProjectRepository) Update(project *domain.Project) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(project).Error
}

func (r *postgresProjectRepository) Delete(id uuid.UUID) error {
	if r.db == nil {
		return nil
	}
	return r.db.Delete(&domain.Project{}, "id = ?", id).Error
}

func (r *postgresProjectRepository) FindByID(id uuid.UUID) (*domain.Project, error) {
	if r.db == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var project domain.Project
	err := r.db.First(&project, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *postgresProjectRepository) FindByOwnerID(ownerID uuid.UUID) ([]domain.Project, error) {
	if r.db == nil {
		return []domain.Project{}, nil
	}
	var projects []domain.Project
	err := r.db.Where("owner_id = ?", ownerID).Find(&projects).Error
	return projects, err
}
