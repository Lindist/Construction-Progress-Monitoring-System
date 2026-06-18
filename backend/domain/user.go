package domain

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Email        string    `gorm:"type:text;uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"type:text;not null" json:"-"`
	FullName     string    `gorm:"type:text" json:"full_name"`
	CreatedAt    time.Time `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt    time.Time `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
}

// TableName overrides the table name for GORM
func (User) TableName() string {
	return "users"
}

type UserRepository interface {
	Create(user *User) error
	FindByEmail(email string) (*User, error)
	FindByID(id uuid.UUID) (*User, error)
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FullName string `json:"full_name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
