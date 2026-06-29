package domain

import (
	"time"

	"github.com/google/uuid"
)

type Job struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	MediaID      uuid.UUID `gorm:"type:uuid;index;not null" json:"media_id"`
	Status       string    `gorm:"type:varchar(50);not null;default:'pending'" json:"status"` // "pending", "processing", "completed", "failed"
	Retries      int       `gorm:"type:integer;default:0" json:"retries"`
	MaxRetries   int       `gorm:"type:integer;default:3" json:"max_retries"`
	ErrorMessage string    `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt    time.Time `gorm:"column:created_at;type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;type:timestamptz;not null;default:now()" json:"updated_at"`
}

// TableName overrides the table name for GORM
func (Job) TableName() string {
	return "jobs"
}

type JobRepository interface {
	Create(job *Job) error
	FindByID(id uuid.UUID) (*Job, error)
	FindByMediaID(mediaID uuid.UUID) ([]Job, error)
	Update(job *Job) error
	ListAll() ([]Job, error)
}
