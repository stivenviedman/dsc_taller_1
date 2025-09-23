package main

import (
	"back-end-todolist/asynqtasks"
	"back-end-todolist/bootstrap"
	"back-end-todolist/models"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"

	"github.com/hibiken/asynq"
)

func main() {
	db := bootstrap.InitDB()
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisHost + ":" + redisPort},
		asynq.Config{Concurrency: 5},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(asynqtasks.TypeProcessVideo, func(ctx context.Context, t *asynq.Task) error {
		var p asynqtasks.ProcessVideoPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}

		// Find video
		var video models.Video
		if err := db.First(&video, p.VideoID).Error; err != nil {
			return err
		}

		// Input route - (add "." because in DB it is stored as "/uploads/...")
		inputPath := "." + *video.OriginalURL

		// Output route
		publicOutput := fmt.Sprintf("/processed/%d_processed.mp4", p.VideoID)
		outputPath := "." + publicOutput

		// Process video with ffmpeg
		cmd := exec.Command("bash", "-c", fmt.Sprintf(`
# 1) Intro (2s, negro con texto ANB centrado)
ffmpeg -f lavfi -i color=c=black:s=1280x720:d=2 \
-vf "drawtext=text='ANB':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=72:fontcolor=white" \
-c:v libx264 -t 2 -preset fast -crf 23 intro.mp4 -y

# 2) Main video (30s, resize, marca ANB arriba izquierda, sin audio)
ffmpeg -i %s -t 30 \
-vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,drawtext=text='ANB':x=10:y=10:fontsize=24:fontcolor=white" \
-an -c:v libx264 -preset fast -crf 23 main.mp4 -y

# 3) Outro (2s, negro con texto ANB centrado)
ffmpeg -f lavfi -i color=c=black:s=1280x720:d=2 \
-vf "drawtext=text='ANB':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=72:fontcolor=white" \
-c:v libx264 -t 2 -preset fast -crf 23 outro.mp4 -y

# 4) Concatenar todo
echo -e "file 'intro.mp4'\nfile 'main.mp4'\nfile 'outro.mp4'" > files.txt
ffmpeg -f concat -safe 0 -i files.txt -c copy %s -y
`, inputPath, outputPath))

		if err := cmd.Run(); err != nil {
			return err
		}

		// Update state in DB
		status := "processed"
		now := time.Now()
		video.Status = &status
		video.ProcessedURL = &publicOutput
		video.ProcessedAt = &now

		if err := db.Save(&video).Error; err != nil {
			return err
		}

		log.Printf("Video %d processed", video.ID)
		return nil
	})

	if err := srv.Run(mux); err != nil {
		log.Fatal(err)
	}

}
