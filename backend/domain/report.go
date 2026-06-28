package domain

import (
	"time"

	"github.com/google/uuid"
)

type ProgressReport struct {
	ID                 uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID          uuid.UUID `gorm:"type:uuid;not null;index" json:"project_id"`
	ReportType         string    `gorm:"type:text;not null" json:"report_type"` // "daily", "weekly", "monthly"
	Summary            string    `gorm:"type:text;not null" json:"summary"`
	ProgressPercentage float64   `gorm:"type:numeric;not null" json:"progress_percentage"`
	GeneratedAt        time.Time `gorm:"type:timestamptz;not null;default:now()" json:"generated_at"`
}

// TableName overrides the table name for GORM
func (ProgressReport) TableName() string {
	return "progress_reports"
}

type ProgressReportRepository interface {
	Create(report *ProgressReport) error
	FindByProjectID(projectID uuid.UUID) ([]ProgressReport, error)
	FindByProjectIDAndType(projectID uuid.UUID, reportType string) (*ProgressReport, error)
	Update(report *ProgressReport) error
}

type ProgressReportUsecase interface {
	GetReportsByProject(projectID uuid.UUID) ([]ProgressReport, error)
	GenerateReport(projectID uuid.UUID, reportType string) (*ProgressReport, error)
}

