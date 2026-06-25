package usecase

import (
	"backend/domain"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type dashboardUsecase struct {
	db          *gorm.DB
	projectRepo domain.ProjectRepository
}

func NewDashboardUsecase(db *gorm.DB, projectRepo domain.ProjectRepository) domain.DashboardUsecase {
	return &dashboardUsecase{
		db:          db,
		projectRepo: projectRepo,
	}
}

func (u *dashboardUsecase) GetStats(userID uuid.UUID) (*domain.DashboardStats, error) {
	stats := &domain.DashboardStats{
		DetectionStats:   make(map[string]int64),
		ProgressOverTime: make([]domain.ProgressDataPoint, 0),
		ActivityTrends:   make([]domain.ActivityDataPoint, 0),
	}

	if u.db == nil {
		return stats, nil
	}

	// 1. Total Projects
	var totalProjects int64
	err := u.db.Model(&domain.Project{}).Where("owner_id = ?", userID).Count(&totalProjects).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count projects: %w", err)
	}
	stats.TotalProjects = totalProjects

	if totalProjects == 0 {
		return stats, nil
	}

	// 2. Uploaded Videos & Images
	var totalVideos int64
	err = u.db.Model(&domain.MediaFile{}).
		Joins("JOIN projects ON media_files.project_id = projects.id").
		Where("projects.owner_id = ? AND media_files.file_type LIKE ?", userID, "video/%").
		Count(&totalVideos).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count videos: %w", err)
	}
	stats.TotalVideos = totalVideos

	var totalImages int64
	err = u.db.Model(&domain.MediaFile{}).
		Joins("JOIN projects ON media_files.project_id = projects.id").
		Where("projects.owner_id = ? AND media_files.file_type LIKE ?", userID, "image/%").
		Count(&totalImages).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count images: %w", err)
	}
	stats.TotalImages = totalImages

	// 3. Total Detections
	var totalDetections int64
	err = u.db.Model(&domain.Detection{}).
		Joins("JOIN frames ON detections.frame_id = frames.id").
		Joins("JOIN media_files ON frames.media_id = media_files.id").
		Joins("JOIN projects ON media_files.project_id = projects.id").
		Where("projects.owner_id = ?", userID).
		Count(&totalDetections).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count detections: %w", err)
	}
	stats.TotalDetections = totalDetections

	// 4. Detection Stats (Group by object type)
	type typeCount struct {
		ObjectType string
		Count      int64
	}
	var counts []typeCount
	err = u.db.Model(&domain.Detection{}).
		Select("detections.object_type, COUNT(detections.id) as count").
		Joins("JOIN frames ON detections.frame_id = frames.id").
		Joins("JOIN media_files ON frames.media_id = media_files.id").
		Joins("JOIN projects ON media_files.project_id = projects.id").
		Where("projects.owner_id = ?", userID).
		Group("detections.object_type").
		Scan(&counts).Error
	if err == nil {
		for _, c := range counts {
			stats.DetectionStats[c.ObjectType] = c.Count
		}
	}

	// 5. Activity Trends (Uploads over last 30 days)
	type dailyCount struct {
		Date  time.Time
		Count int64
	}
	var dailyUploads []dailyCount
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	err = u.db.Model(&domain.MediaFile{}).
		Select("DATE(media_files.uploaded_at) as date, COUNT(media_files.id) as count").
		Joins("JOIN projects ON media_files.project_id = projects.id").
		Where("projects.owner_id = ? AND media_files.uploaded_at >= ?", userID, thirtyDaysAgo).
		Group("DATE(media_files.uploaded_at)").
		Order("date ASC").
		Scan(&dailyUploads).Error
	if err == nil {
		for _, du := range dailyUploads {
			stats.ActivityTrends = append(stats.ActivityTrends, domain.ActivityDataPoint{
				Date:  du.Date.Format("2006-01-02"),
				Count: du.Count,
			})
		}
	}

	// 6. Progress Over Time & Average Progress
	projects, err := u.projectRepo.FindByOwnerID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user projects: %w", err)
	}

	var projectProgressSum float64
	var projectsWithProgressCount int

	for _, proj := range projects {
		var mediaFiles []domain.MediaFile
		err = u.db.Where("project_id = ?", proj.ID).Order("uploaded_at ASC").Find(&mediaFiles).Error
		if err != nil {
			continue
		}

		var latestProgress float64
		var hasAnyProgress bool

		for _, m := range mediaFiles {
			var frames []domain.Frame
			err = u.db.Preload("Detections").Where("media_id = ?", m.ID).Order("timestamp ASC").Find(&frames).Error
			if err != nil || len(frames) == 0 {
				continue
			}

			latestFrame := frames[len(frames)-1]
			progress := domain.CalculateProgress(latestFrame.Detections)

			stats.ProgressOverTime = append(stats.ProgressOverTime, domain.ProgressDataPoint{
				ProjectID:   proj.ID.String(),
				ProjectName: proj.Name,
				Date:        m.UploadedAt,
				Progress:    progress,
			})

			latestProgress = progress
			hasAnyProgress = true
		}

		if hasAnyProgress {
			projectProgressSum += latestProgress
			projectsWithProgressCount++
		}
	}

	if projectsWithProgressCount > 0 {
		stats.AverageProgress = projectProgressSum / float64(projectsWithProgressCount)
	}

	return stats, nil
}
