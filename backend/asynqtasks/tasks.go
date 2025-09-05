package asynqtasks

import (
	"encoding/json"

	"github.com/hibiken/asynq"
)

const TypeProcessVideo = "video:process"

type ProcessVideoPayload struct {
	VideoID uint `json:"video_id"`
}

func NewProcessVideoTask(videoID uint) (*asynq.Task, error) {
	payload, err := json.Marshal(ProcessVideoPayload{VideoID: videoID})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeProcessVideo, payload), nil
}
