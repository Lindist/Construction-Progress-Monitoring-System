package repository

import (
	"backend/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresUserRepository struct {
	db *gorm.DB
}

func NewPostgresUserRepository(db *gorm.DB) domain.UserRepository {
	return &postgresUserRepository{db: db}
}

func (r *postgresUserRepository) Create(user *domain.User) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(user).Error
}

func (r *postgresUserRepository) FindByEmail(email string) (*domain.User, error) {
	if r.db == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var user domain.User
	err := r.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *postgresUserRepository) FindByID(id uuid.UUID) (*domain.User, error) {
	if r.db == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var user domain.User
	err := r.db.First(&user, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}
