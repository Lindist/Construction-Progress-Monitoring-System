package repository

import (
	"backend/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresProgressReportRepository struct {
	db *gorm.DB
}

func NewPostgresProgressReportRepository(db *gorm.DB) domain.ProgressReportRepository {
	return &postgresProgressReportRepository{db: db}
}

func (r *postgresProgressReportRepository) Create(report *domain.ProgressReport) error {
	if r.db == nil {
		return nil // skip DB write if database is offline/unavailable
	}
	return r.db.Create(report).Error
}

func (r *postgresProgressReportRepository) FindByProjectID(projectID uuid.UUID) ([]domain.ProgressReport, error) {
	if r.db == nil {
		return []domain.ProgressReport{}, nil
	}
	var reports []domain.ProgressReport
	err := r.db.Where("project_id = ?", projectID).Order("generated_at desc").Find(&reports).Error
	return reports, err
}

func (r *postgresProgressReportRepository) FindByProjectIDAndType(projectID uuid.UUID, reportType string) (*domain.ProgressReport, error) {
	if r.db == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var report domain.ProgressReport
	err := r.db.Where("project_id = ? AND report_type = ?", projectID, reportType).Order("generated_at desc").First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *postgresProgressReportRepository) Update(report *domain.ProgressReport) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(report).Error
}
