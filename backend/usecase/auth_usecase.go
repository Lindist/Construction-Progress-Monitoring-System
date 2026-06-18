package usecase

import (
	"backend/domain"
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthUsecase interface {
	Register(req *domain.RegisterRequest) (*domain.AuthResponse, error)
	Login(req *domain.LoginRequest) (*domain.AuthResponse, error)
	GetProfile(userID uuid.UUID) (*domain.User, error)
}

type authUsecase struct {
	userRepo domain.UserRepository
}

func NewAuthUsecase(repo domain.UserRepository) AuthUsecase {
	return &authUsecase{userRepo: repo}
}

func (u *authUsecase) Register(req *domain.RegisterRequest) (*domain.AuthResponse, error) {
	// Check if user already exists
	existingUser, err := u.userRepo.FindByEmail(req.Email)
	if err == nil && existingUser != nil {
		return nil, errors.New("user with this email already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	user := &domain.User{
		ID:           uuid.New(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FullName:     req.FullName,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := u.userRepo.Create(user); err != nil {
		return nil, err
	}

	token, err := domain.GenerateToken(user.ID, user.Email)
	if err != nil {
		return nil, err
	}

	return &domain.AuthResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (u *authUsecase) Login(req *domain.LoginRequest) (*domain.AuthResponse, error) {
	user, err := u.userRepo.FindByEmail(req.Email)
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	token, err := domain.GenerateToken(user.ID, user.Email)
	if err != nil {
		return nil, err
	}

	return &domain.AuthResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (u *authUsecase) GetProfile(userID uuid.UUID) (*domain.User, error) {
	return u.userRepo.FindByID(userID)
}
