package usecase

import (
	"backend/domain"
	"encoding/json"
	"errors"
	"fmt"
	"math"

	"github.com/google/uuid"
)

type analysisUsecase struct {
	frameRepo domain.FrameRepository
	mediaRepo domain.MediaFileRepository
}

func NewAnalysisUsecase(frameRepo domain.FrameRepository, mediaRepo domain.MediaFileRepository) domain.AnalysisUsecase {
	return &analysisUsecase{
		frameRepo: frameRepo,
		mediaRepo: mediaRepo,
	}
}

func (u *analysisUsecase) CompareMedia(mediaID1, mediaID2 uuid.UUID) (*domain.AnalysisResult, error) {
	// Find frames for Media 1
	frames1, err := u.frameRepo.FindByMediaID(mediaID1)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch frames for media A: %w", err)
	}
	if len(frames1) == 0 {
		return nil, errors.New("no frames processed yet for media A")
	}

	// Find frames for Media 2
	frames2, err := u.frameRepo.FindByMediaID(mediaID2)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch frames for media B: %w", err)
	}
	if len(frames2) == 0 {
		return nil, errors.New("no frames processed yet for media B")
	}

	// Use the last frame of each media as the representative state for comparison
	frameA := frames1[len(frames1)-1]
	frameB := frames2[len(frames2)-1]

	result, err := u.compareFramesInternal(frameA, frameB)
	if err != nil {
		return nil, err
	}

	result.MediaIDA = mediaID1
	result.MediaIDB = mediaID2
	return result, nil
}

func (u *analysisUsecase) CompareFrames(frameID1, frameID2 uuid.UUID) (*domain.AnalysisResult, error) {
	frameA, err := u.frameRepo.FindByID(frameID1)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch frame A: %w", err)
	}
	frameB, err := u.frameRepo.FindByID(frameID2)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch frame B: %w", err)
	}

	result, err := u.compareFramesInternal(*frameA, *frameB)
	if err != nil {
		return nil, err
	}

	result.MediaIDA = frameA.MediaID
	result.MediaIDB = frameB.MediaID
	return result, nil
}

func parseBoundingBox(bboxStr string) ([]float64, error) {
	var coords []float64
	err := json.Unmarshal([]byte(bboxStr), &coords)
	if err != nil {
		return nil, err
	}
	if len(coords) < 4 {
		return nil, errors.New("invalid bounding box coordinates count")
	}
	return coords, nil
}

func calculateBBoxArea(coords []float64) float64 {
	if len(coords) < 4 {
		return 0.0
	}
	xmin, ymin, xmax, ymax := coords[0], coords[1], coords[2], coords[3]
	w := xmax - xmin
	h := ymax - ymin
	if w <= 0 || h <= 0 {
		return 0.0
	}
	return w * h
}

func calculateProgress(detections []domain.Detection) float64 {
	pillars := 0
	walls := 0
	hasEquipment := false
	hasWorkers := false

	for _, d := range detections {
		switch d.ObjectType {
		case "Pillar":
			pillars++
		case "Wall":
			walls++
		case "Crane", "Excavator", "Scaffolding":
			hasEquipment = true
		case "Worker":
			hasWorkers = true
		}
	}

	progress := 0.0
	if hasWorkers {
		progress += 10.0
	}
	progress += float64(pillars) * 12.0
	progress += float64(walls) * 18.0
	if hasEquipment {
		progress += 10.0
	}

	if progress > 100.0 {
		progress = 100.0
	}

	// Fallback baseline progress if active workers/machinery are on site but no structures completed
	if progress == 0 && (hasWorkers || hasEquipment) {
		progress = 15.0
	}

	return progress
}

func (u *analysisUsecase) compareFramesInternal(frameA, frameB domain.Frame) (*domain.AnalysisResult, error) {
	// 1. Compute Object Counts and Areas
	countsA := make(map[string]int)
	countsB := make(map[string]int)
	areasA := make(map[string]float64)
	areasB := make(map[string]float64)

	objectTypes := []string{
		"Worker", "Helmet", "Truck", "Crane", "Excavator",
		"Scaffolding", "Pillar", "Wall", "Construction Equipment",
	}

	// Initialize maps
	for _, ot := range objectTypes {
		countsA[ot] = 0
		countsB[ot] = 0
		areasA[ot] = 0.0
		areasB[ot] = 0.0
	}

	// Accumulate Frame A
	for _, det := range frameA.Detections {
		countsA[det.ObjectType]++
		coords, err := parseBoundingBox(det.BoundingBox)
		if err == nil {
			areasA[det.ObjectType] += calculateBBoxArea(coords)
		}
	}

	// Accumulate Frame B
	for _, det := range frameB.Detections {
		countsB[det.ObjectType]++
		coords, err := parseBoundingBox(det.BoundingBox)
		if err == nil {
			areasB[det.ObjectType] += calculateBBoxArea(coords)
		}
	}

	// 2. Generate Object Count Differences and Area Changes
	var objectCountDiffs []domain.ObjectCountDiff
	var areaChanges []domain.AreaChange
	var newObjects []domain.NewObject
	var removedObjects []domain.RemovedObject

	for _, ot := range objectTypes {
		cntA := countsA[ot]
		cntB := countsB[ot]
		diff := cntB - cntA

		// Count differences
		objectCountDiffs = append(objectCountDiffs, domain.ObjectCountDiff{
			ObjectType: ot,
			CountA:     cntA,
			CountB:     cntB,
			Difference: diff,
		})

		// Area differences
		aA := areasA[ot]
		aB := areasB[ot]
		areaDiff := aB - aA
		pctChange := 0.0
		if aA > 0 {
			pctChange = (areaDiff / aA) * 100.0
		} else if aB > 0 {
			pctChange = 100.0
		}

		areaChanges = append(areaChanges, domain.AreaChange{
			ObjectType: ot,
			AreaA:      aA,
			AreaB:      aB,
			Difference: areaDiff,
			Percent:    pctChange,
		})

		// New/Removed objects categorizations
		if cntA == 0 && cntB > 0 {
			newObjects = append(newObjects, domain.NewObject{
				ObjectType: ot,
				Count:      cntB,
			})
		} else if cntA > 0 && cntB == 0 {
			removedObjects = append(removedObjects, domain.RemovedObject{
				ObjectType: ot,
				Count:      cntA,
			})
		}
	}

	// 3. Compute Structural Growth (Pillars, Walls, Scaffolding)
	structA := areasA["Pillar"] + areasA["Wall"] + areasA["Scaffolding"]
	structB := areasB["Pillar"] + areasB["Wall"] + areasB["Scaffolding"]
	structDiff := structB - structA
	structPct := 0.0
	if structA > 0 {
		structPct = (structDiff / structA) * 100.0
	} else if structB > 0 {
		structPct = 100.0
	}

	var description string
	if structDiff > 0 {
		description = fmt.Sprintf("Structural components (pillars, walls, scaffolding) coverage expanded by %.1f%%.", structPct)
	} else if structDiff < 0 {
		description = fmt.Sprintf("Structural components coverage decreased by %.1f%% due to layout alteration or temporary scaffolding removal.", math.Abs(structPct))
	} else {
		description = "No structural growth detected."
	}

	structuralGrowth := domain.StructuralGrowth{
		Description:      description,
		GrowthPercentage: structPct,
		IsGrowing:        structDiff > 0,
	}

	// 4. Compute Metrics
	progressA := calculateProgress(frameA.Detections)
	progressB := calculateProgress(frameB.Detections)
	growth := progressB - progressA

	// Calculate Change Score (0-100) based on differences in object presence
	totalDetections := len(frameA.Detections) + len(frameB.Detections)
	changeScore := 0.0
	if totalDetections > 0 {
		sumDiffs := 0.0
		for _, ot := range objectTypes {
			diff := float64(countsB[ot] - countsA[ot])
			sumDiffs += math.Abs(diff)
		}
		// Scale factor to map differences nicely to a percentage score
		changeScore = (sumDiffs / float64(totalDetections)) * 100.0
		if changeScore > 100.0 {
			changeScore = 100.0
		}
	}

	return &domain.AnalysisResult{
		FrameID1:            frameA.ID,
		FrameID2:            frameB.ID,
		ProgressPercentageA: progressA,
		ProgressPercentageB: progressB,
		GrowthPercentage:   growth,
		ChangeScore:        changeScore,
		ObjectCountDiffs:   objectCountDiffs,
		AreaChanges:        areaChanges,
		StructuralGrowth:   structuralGrowth,
		NewObjects:         newObjects,
		RemovedObjects:     removedObjects,
	}, nil
}
