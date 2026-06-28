package usecase

import (
	"bytes"
	"backend/config"
	"backend/domain"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"time"

	"github.com/google/uuid"
)

type reportUsecase struct {
	reportRepo      domain.ProgressReportRepository
	projectRepo     domain.ProjectRepository
	mediaRepo       domain.MediaFileRepository
	frameRepo       domain.FrameRepository
	analysisUsecase domain.AnalysisUsecase
	config          *config.Config
}

func NewReportUsecase(
	reportRepo domain.ProgressReportRepository,
	projectRepo domain.ProjectRepository,
	mediaRepo domain.MediaFileRepository,
	frameRepo domain.FrameRepository,
	analysisUsecase domain.AnalysisUsecase,
	cfg *config.Config,
) domain.ProgressReportUsecase {
	return &reportUsecase{
		reportRepo:      reportRepo,
		projectRepo:     projectRepo,
		mediaRepo:       mediaRepo,
		frameRepo:       frameRepo,
		analysisUsecase: analysisUsecase,
		config:          cfg,
	}
}

func (u *reportUsecase) GetReportsByProject(projectID uuid.UUID) ([]domain.ProgressReport, error) {
	return u.reportRepo.FindByProjectID(projectID)
}

type ObjectDiff struct {
	ObjectType string `json:"object_type"`
	CountA     int    `json:"count_a"`
	CountB     int    `json:"count_b"`
	Difference int    `json:"difference"`
}

type SummarizeRequest struct {
	ProjectName          string       `json:"project_name"`
	ReportType           string       `json:"report_type"`
	CurrentProgress      float64      `json:"current_progress"`
	PreviousProgress     float64      `json:"previous_progress"`
	Growth               float64      `json:"growth"`
	StructuralGrowthDesc string       `json:"structural_growth_desc"`
	ObjectDiffs          []ObjectDiff `json:"object_diffs"`
}

type SummarizeResponse struct {
	Summary            string  `json:"summary"`
	ProgressPercentage float64 `json:"progress_percentage"`
}

func (u *reportUsecase) GenerateReport(projectID uuid.UUID, reportType string) (*domain.ProgressReport, error) {
	// 1. Get Project
	project, err := u.projectRepo.FindByID(projectID)
	projectName := "Project Workspace"
	if err == nil && project != nil {
		projectName = project.Name
	}

	// 2. Fetch Media Files
	mediaFiles, err := u.mediaRepo.FindByProjectID(projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch project media files: %w", err)
	}
	if len(mediaFiles) == 0 {
		return nil, errors.New("no media files uploaded yet in this project")
	}

	// Sort media files by UploadedAt descending (newest first)
	sort.Slice(mediaFiles, func(i, j int) bool {
		return mediaFiles[i].UploadedAt.After(mediaFiles[j].UploadedAt)
	})

	latestMedia := mediaFiles[0]

	// 3. Find baseline media file based on reportType
	var baselineMedia *domain.MediaFile
	for i := 1; i < len(mediaFiles); i++ {
		m := mediaFiles[i]
		diff := latestMedia.UploadedAt.Sub(m.UploadedAt)

		if reportType == "daily" && diff >= 18*time.Hour {
			baselineMedia = &m
			break
		} else if reportType == "weekly" && diff >= 6*24*time.Hour {
			baselineMedia = &m
			break
		} else if reportType == "monthly" && diff >= 25*24*time.Hour {
			baselineMedia = &m
			break
		}
	}

	// Fallback to the second latest media file if no file matches the timeline gap exactly
	if baselineMedia == nil && len(mediaFiles) > 1 {
		baselineMedia = &mediaFiles[1]
	}

	var currentProgress float64
	var previousProgress float64
	var growth float64
	var structuralDesc string
	var objectDiffs []ObjectDiff

	// 4. Run Comparison
	if baselineMedia != nil {
		analysis, err := u.analysisUsecase.CompareMedia(baselineMedia.ID, latestMedia.ID)
		if err == nil && analysis != nil {
			currentProgress = analysis.ProgressPercentageB
			previousProgress = analysis.ProgressPercentageA
			growth = analysis.GrowthPercentage
			structuralDesc = analysis.StructuralGrowth.Description

			for _, diff := range analysis.ObjectCountDiffs {
				objectDiffs = append(objectDiffs, ObjectDiff{
					ObjectType: diff.ObjectType,
					CountA:     diff.CountA,
					CountB:     diff.CountB,
					Difference: diff.Difference,
				})
			}
		} else {
			log.Printf("ReportUsecase: failed to CompareMedia (%s vs %s): %v. Using fallback single-media analysis.", baselineMedia.ID, latestMedia.ID, err)
			baselineMedia = nil
		}
	}

	// If no baseline was found or comparison failed, compute baseline analysis
	if baselineMedia == nil {
		frames, err := u.frameRepo.FindByMediaID(latestMedia.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch latest media frames: %w", err)
		}
		if len(frames) == 0 {
			return nil, errors.New("no frames processed yet for latest media")
		}

		lastFrame := frames[len(frames)-1]
		currentProgress = domain.CalculateProgress(lastFrame.Detections)
		previousProgress = 0.0
		growth = currentProgress
		structuralDesc = "Initial inspection completed. Structural progress baseline established."

		counts := make(map[string]int)
		for _, d := range lastFrame.Detections {
			counts[d.ObjectType]++
		}

		objectTypes := []string{
			"Worker", "Helmet", "Truck", "Crane", "Excavator",
			"Scaffolding", "Pillar", "Wall", "Construction Equipment",
		}
		for _, ot := range objectTypes {
			cnt := counts[ot]
			objectDiffs = append(objectDiffs, ObjectDiff{
				ObjectType: ot,
				CountA:     0,
				CountB:     cnt,
				Difference: cnt,
			})
		}
	}

	// 5. Send Summarize request to Python service
	reqBody := SummarizeRequest{
		ProjectName:          projectName,
		ReportType:           reportType,
		CurrentProgress:      currentProgress,
		PreviousProgress:     previousProgress,
		Growth:               growth,
		StructuralGrowthDesc: structuralDesc,
		ObjectDiffs:          objectDiffs,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal summarize request: %w", err)
	}

	url := fmt.Sprintf("%s/api/summarize", u.config.AIServiceURL)
	log.Printf("ReportUsecase: Sending summarize request to AI service: %s\n", url)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to call AI service summarize endpoint: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("AI service summarize returned non-OK status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var sumResp SummarizeResponse
	if err := json.NewDecoder(resp.Body).Decode(&sumResp); err != nil {
		return nil, fmt.Errorf("failed to decode AI service summarize response: %w", err)
	}

	// 6. Save or update Report
	var report *domain.ProgressReport
	existingReport, err := u.reportRepo.FindByProjectIDAndType(projectID, reportType)
	if err == nil && existingReport != nil {
		// Update existing report
		report = existingReport
		report.Summary = sumResp.Summary
		report.ProgressPercentage = sumResp.ProgressPercentage
		report.GeneratedAt = time.Now().UTC()
		
		if err := u.reportRepo.Update(report); err != nil {
			return nil, fmt.Errorf("failed to update progress report in database: %w", err)
		}
	} else {
		// Create new report
		report = &domain.ProgressReport{
			ID:                 uuid.New(),
			ProjectID:          projectID,
			ReportType:         reportType,
			Summary:            sumResp.Summary,
			ProgressPercentage: sumResp.ProgressPercentage,
			GeneratedAt:        time.Now().UTC(),
		}

		if err := u.reportRepo.Create(report); err != nil {
			return nil, fmt.Errorf("failed to save progress report in database: %w", err)
		}
	}

	return report, nil
}
