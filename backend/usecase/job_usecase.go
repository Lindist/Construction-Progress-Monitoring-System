package usecase

import (
	"context"
	"backend/domain"
	"backend/repository"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
)

type JobUsecase interface {
	GetJobByID(id uuid.UUID) (*domain.Job, error)
	ListAllJobs() ([]domain.Job, error)
	GetJobsByMediaID(mediaID uuid.UUID) ([]domain.Job, error)
	CreateJob(mediaID uuid.UUID, filePath string) (*domain.Job, error)
	UpdateJobStatus(id uuid.UUID, status string, errMsg string) error
	SubmitJobResults(id uuid.UUID, results *JobResultPayload) error
	RetryJob(id uuid.UUID) error
}

type jobUsecase struct {
	jobRepo           domain.JobRepository
	mediaRepo         domain.MediaFileRepository
	frameRepo         domain.FrameRepository
	detectionRepo     domain.DetectionRepository
	queueMgr          repository.QueueManager
	onProcessComplete func(mediaID string)
}

type DetectionPayload struct {
	ObjectType  string    `json:"object_type"`
	Confidence  float64   `json:"confidence"`
	BoundingBox []float64 `json:"bounding_box"`
}

type FramePayload struct {
	Timestamp  float64            `json:"timestamp"`
	FramePath  string             `json:"frame_path"`
	Detections []DetectionPayload `json:"detections"`
}

type JobResultPayload struct {
	MediaID string         `json:"media_id"`
	Frames  []FramePayload `json:"frames"`
}

type JobQueuePayload struct {
	JobID    string  `json:"job_id"`
	MediaID  string  `json:"media_id"`
	FilePath string  `json:"file_path"`
	Interval float64 `json:"interval"`
}

func NewJobUsecase(
	jobRepo domain.JobRepository,
	mediaRepo domain.MediaFileRepository,
	frameRepo domain.FrameRepository,
	detectionRepo domain.DetectionRepository,
	queueMgr repository.QueueManager,
	onProcessComplete func(mediaID string),
) JobUsecase {
	return &jobUsecase{
		jobRepo:           jobRepo,
		mediaRepo:         mediaRepo,
		frameRepo:         frameRepo,
		detectionRepo:     detectionRepo,
		queueMgr:          queueMgr,
		onProcessComplete: onProcessComplete,
	}
}

func (u *jobUsecase) GetJobByID(id uuid.UUID) (*domain.Job, error) {
	return u.jobRepo.FindByID(id)
}

func (u *jobUsecase) ListAllJobs() ([]domain.Job, error) {
	return u.jobRepo.ListAll()
}

func (u *jobUsecase) GetJobsByMediaID(mediaID uuid.UUID) ([]domain.Job, error) {
	return u.jobRepo.FindByMediaID(mediaID)
}

func (u *jobUsecase) CreateJob(mediaID uuid.UUID, filePath string) (*domain.Job, error) {
	job := &domain.Job{
		ID:         uuid.New(),
		MediaID:    mediaID,
		Status:     "pending",
		Retries:    0,
		MaxRetries: 3,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := u.jobRepo.Create(job); err != nil {
		return nil, fmt.Errorf("failed to create job in database: %w", err)
	}

	// Push job to Redis queue
	payload := JobQueuePayload{
		JobID:    job.ID.String(),
		MediaID:  mediaID.String(),
		FilePath: filePath,
		Interval: 5.0, // default interval
	}

	if u.queueMgr != nil {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
		defer cancel()
		if err := u.queueMgr.EnqueueJob(ctx, "video_processing_queue", payload); err != nil {
			log.Printf("JobUsecase: failed to enqueue job %s to Redis: %v\n", job.ID, err)
			return job, fmt.Errorf("failed to enqueue job to Redis: %w", err)
		}
	} else {
		return job, fmt.Errorf("queue manager not initialized")
	}

	return job, nil
}

func (u *jobUsecase) UpdateJobStatus(id uuid.UUID, status string, errMsg string) error {
	job, err := u.jobRepo.FindByID(id)
	if err != nil {
		return fmt.Errorf("job not found: %w", err)
	}

	job.Status = status
	job.ErrorMessage = errMsg
	job.UpdatedAt = time.Now()

	// Handle retries on failure
	if status == "failed" {
		if job.Retries < job.MaxRetries {
			job.Retries++
			job.Status = "pending"
			job.ErrorMessage = fmt.Sprintf("Attempt %d failed: %s", job.Retries, errMsg)
			
			// Save updated job state first
			if err := u.jobRepo.Update(job); err != nil {
				return fmt.Errorf("failed to update job retry state: %w", err)
			}

			// Find media to get file path
			media, mErr := u.mediaRepo.FindByID(job.MediaID)
			if mErr != nil {
				return fmt.Errorf("failed to find media for job retry: %w", mErr)
			}

			// Push back to Redis
			payload := JobQueuePayload{
				JobID:    job.ID.String(),
				MediaID:  job.MediaID.String(),
				FilePath: media.FilePath,
				Interval: 5.0,
			}

			if u.queueMgr != nil {
				ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
				defer cancel()
				if err := u.queueMgr.EnqueueJob(ctx, "video_processing_queue", payload); err != nil {
					log.Printf("JobUsecase: failed to re-enqueue retry job %s: %v\n", job.ID, err)
					return fmt.Errorf("failed to re-enqueue retry job: %w", err)
				}
				log.Printf("JobUsecase: Re-enqueued job %s for retry (Attempt %d/%d)\n", job.ID, job.Retries, job.MaxRetries)
			}
			return nil
		}
	}

	return u.jobRepo.Update(job)
}

func (u *jobUsecase) SubmitJobResults(id uuid.UUID, results *JobResultPayload) error {
	job, err := u.jobRepo.FindByID(id)
	if err != nil {
		return fmt.Errorf("job not found: %w", err)
	}

	log.Printf("JobUsecase: Saving %d frames for job %s\n", len(results.Frames), id)

	mediaID, err := uuid.Parse(results.MediaID)
	if err != nil {
		return fmt.Errorf("invalid media ID format: %w", err)
	}

	for _, f := range results.Frames {
		frame := &domain.Frame{
			ID:        uuid.New(),
			MediaID:   mediaID,
			Timestamp: f.Timestamp,
			FramePath: f.FramePath,
		}

		if err := u.frameRepo.Create(frame); err != nil {
			log.Printf("JobUsecase: Warning: failed to save frame record at %f seconds: %v\n", f.Timestamp, err)
			continue
		}

		for _, d := range f.Detections {
			bboxJSON, err := json.Marshal(d.BoundingBox)
			if err != nil {
				log.Printf("JobUsecase: Warning: failed to marshal bounding box: %v\n", err)
				bboxJSON = []byte("[]")
			}

			det := &domain.Detection{
				ID:          uuid.New(),
				FrameID:     frame.ID,
				ObjectType:  d.ObjectType,
				Confidence:  d.Confidence,
				BoundingBox: string(bboxJSON),
			}
			if err := u.detectionRepo.Create(det); err != nil {
				log.Printf("JobUsecase: Warning: failed to save detection %s: %v\n", d.ObjectType, err)
			}
		}
	}

	// Update job status to completed
	job.Status = "completed"
	job.ErrorMessage = ""
	job.UpdatedAt = time.Now()
	if err := u.jobRepo.Update(job); err != nil {
		return fmt.Errorf("failed to update job status to completed: %w", err)
	}

	// Trigger callback (SSE notification + report generation)
	if u.onProcessComplete != nil {
		go u.onProcessComplete(mediaID.String())
	}

	return nil
}

func (u *jobUsecase) RetryJob(id uuid.UUID) error {
	job, err := u.jobRepo.FindByID(id)
	if err != nil {
		return fmt.Errorf("job not found: %w", err)
	}

	media, err := u.mediaRepo.FindByID(job.MediaID)
	if err != nil {
		return fmt.Errorf("media not found: %w", err)
	}

	job.Status = "pending"
	job.Retries = 0
	job.ErrorMessage = "Manually retried"
	job.UpdatedAt = time.Now()

	if err := u.jobRepo.Update(job); err != nil {
		return fmt.Errorf("failed to update job status: %w", err)
	}

	payload := JobQueuePayload{
		JobID:    job.ID.String(),
		MediaID:  job.MediaID.String(),
		FilePath: media.FilePath,
		Interval: 5.0,
	}

	if u.queueMgr != nil {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
		defer cancel()
		return u.queueMgr.EnqueueJob(ctx, "video_processing_queue", payload)
	}

	return fmt.Errorf("queue manager not initialized")
}
