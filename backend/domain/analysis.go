package domain

import (
	"github.com/google/uuid"
)

type ObjectCountDiff struct {
	ObjectType string `json:"object_type"`
	CountA     int    `json:"count_a"`
	CountB     int    `json:"count_b"`
	Difference int    `json:"difference"`
}

type AreaChange struct {
	ObjectType string  `json:"object_type"`
	AreaA      float64 `json:"area_a"`
	AreaB      float64 `json:"area_b"`
	Difference float64 `json:"difference"`
	Percent    float64 `json:"percent_change"`
}

type StructuralGrowth struct {
	Description      string  `json:"description"`
	GrowthPercentage float64 `json:"growth_percentage"`
	IsGrowing        bool    `json:"is_growing"`
}

type NewObject struct {
	ObjectType string `json:"object_type"`
	Count      int    `json:"count"`
}

type RemovedObject struct {
	ObjectType string `json:"object_type"`
	Count      int    `json:"count"`
}

type AnalysisResult struct {
	MediaIDA            uuid.UUID          `json:"media_id_a"`
	MediaIDB            uuid.UUID          `json:"media_id_b"`
	FrameID1            uuid.UUID          `json:"frame_id_a"`
	FrameID2            uuid.UUID          `json:"frame_id_b"`
	ProgressPercentageA float64            `json:"progress_percentage_a"`
	ProgressPercentageB float64            `json:"progress_percentage_b"`
	GrowthPercentage   float64            `json:"growth_percentage"`
	ChangeScore        float64            `json:"change_score"`
	ObjectCountDiffs   []ObjectCountDiff  `json:"object_count_diffs"`
	AreaChanges        []AreaChange       `json:"area_changes"`
	StructuralGrowth   StructuralGrowth   `json:"structural_growth"`
	NewObjects         []NewObject        `json:"new_objects"`
	RemovedObjects     []RemovedObject    `json:"removed_objects"`
}

type AnalysisUsecase interface {
	CompareMedia(mediaID1, mediaID2 uuid.UUID) (*AnalysisResult, error)
	CompareFrames(frameID1, frameID2 uuid.UUID) (*AnalysisResult, error)
}
