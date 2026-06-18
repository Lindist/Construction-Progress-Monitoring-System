package domain

import (
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	OwnerID     uuid.UUID `gorm:"type:uuid;not null" json:"owner_id"`
	CreatedAt   time.Time `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt   time.Time `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
}

// TableName overrides the table name for GORM
func (Project) TableName() string {
	return "projects"
}

type ProjectRepository interface {
	Create(project *Project) error
	Update(project *Project) error
	Delete(id uuid.UUID) error
	FindByID(id uuid.UUID) (*Project, error)
	FindByOwnerID(ownerID uuid.UUID) ([]Project, error)
}

type CreateProjectRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type UpdateProjectRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}
