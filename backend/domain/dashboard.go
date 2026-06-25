package domain

import (
	"time"

	"github.com/google/uuid"
)

type ProgressDataPoint struct {
	ProjectID   string    `json:"project_id"`
	ProjectName string    `json:"project_name"`
	Date        time.Time `json:"date"`
	Progress    float64   `json:"progress"`
}

type ActivityDataPoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type DashboardStats struct {
	TotalProjects     int64                  `json:"total_projects"`
	TotalVideos       int64                  `json:"total_videos"`
	TotalImages       int64                  `json:"total_images"`
	TotalDetections   int64                  `json:"total_detections"`
	AverageProgress   float64                `json:"average_progress"`
	ProgressOverTime  []ProgressDataPoint    `json:"progress_over_time"`
	DetectionStats    map[string]int64       `json:"detection_stats"`
	ActivityTrends    []ActivityDataPoint    `json:"activity_trends"`
}

type DashboardUsecase interface {
	GetStats(userID uuid.UUID) (*DashboardStats, error)
}
