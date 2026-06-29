package usecase

import (
	"backend/config"
	"backend/domain"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type ProjectUsecase interface {
	CreateProject(ownerID uuid.UUID, req *domain.CreateProjectRequest) (*domain.Project, error)
	UpdateProject(ownerID uuid.UUID, projectID uuid.UUID, req *domain.UpdateProjectRequest) (*domain.Project, error)
	DeleteProject(ownerID uuid.UUID, projectID uuid.UUID) error
	GetProjectByID(ownerID uuid.UUID, projectID uuid.UUID) (*domain.Project, error)
	GetProjectsByOwner(ownerID uuid.UUID) ([]domain.Project, error)
}

type projectUsecase struct {
	projectRepo domain.ProjectRepository
	mediaRepo   domain.MediaFileRepository
	config      *config.Config
}

func NewProjectUsecase(repo domain.ProjectRepository, mediaRepo domain.MediaFileRepository, cfg *config.Config) ProjectUsecase {
	return &projectUsecase{
		projectRepo: repo,
		mediaRepo:   mediaRepo,
		config:      cfg,
	}
}

func (u *projectUsecase) CreateProject(ownerID uuid.UUID, req *domain.CreateProjectRequest) (*domain.Project, error) {
	now := time.Now().UTC()
	project := &domain.Project{
		ID:          uuid.New(),
		Name:        req.Name,
		Description: req.Description,
		OwnerID:     ownerID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := u.projectRepo.Create(project); err != nil {
		return nil, err
	}

	return project, nil
}

func (u *projectUsecase) UpdateProject(ownerID uuid.UUID, projectID uuid.UUID, req *domain.UpdateProjectRequest) (*domain.Project, error) {
	project, err := u.projectRepo.FindByID(projectID)
	if err != nil {
		return nil, err
	}

	if project.OwnerID != ownerID {
		return nil, errors.New("unauthorized to update this project")
	}

	project.Name = req.Name
	project.Description = req.Description
	project.UpdatedAt = time.Now().UTC()

	if err := u.projectRepo.Update(project); err != nil {
		return nil, err
	}

	return project, nil
}

func (u *projectUsecase) DeleteProject(ownerID uuid.UUID, projectID uuid.UUID) error {
	project, err := u.projectRepo.FindByID(projectID)
	if err != nil {
		return err
	}

	if project.OwnerID != ownerID {
		return errors.New("unauthorized to delete this project")
	}

	// 1. Delete all associated media files locally
	mediaFiles, err := u.mediaRepo.FindByProjectID(projectID)
	if err == nil {
		for _, m := range mediaFiles {
			// Remove the main media file
			if m.FilePath != "" {
				_ = os.Remove(m.FilePath)
			}
			// Remove metadata JSON
			metadataPath := filepath.Join(u.config.MetadataDir(), fmt.Sprintf("%s.json", m.ID.String()))
			_ = os.Remove(metadataPath)
			// Remove keyframes directory
			framesDir := filepath.Join(u.config.UploadsDir(), "frames", m.ID.String())
			_ = os.RemoveAll(framesDir)

			// Delete from DB (which cleans up related DB tables via our repository delete)
			_ = u.mediaRepo.Delete(m.ID)
		}
	}

	return u.projectRepo.Delete(projectID)
}

func (u *projectUsecase) GetProjectByID(ownerID uuid.UUID, projectID uuid.UUID) (*domain.Project, error) {
	project, err := u.projectRepo.FindByID(projectID)
	if err != nil {
		return nil, err
	}

	if project.OwnerID != ownerID {
		return nil, errors.New("unauthorized to view this project")
	}

	return project, nil
}

func (u *projectUsecase) GetProjectsByOwner(ownerID uuid.UUID) ([]domain.Project, error) {
	return u.projectRepo.FindByOwnerID(ownerID)
}
