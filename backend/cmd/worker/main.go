package main

import (
	"back-end-todolist/asynqtasks"
	"back-end-todolist/models"
	"back-end-todolist/storage"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"

	"github.com/hibiken/asynq"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load(".env")

	if err != nil {
		log.Fatal("Error cargando el archivo .env")
	}

	config := &storage.Config{
		Host:     os.Getenv("DB_HOST"),
		Port:     os.Getenv("DB_PORT"),
		Password: os.Getenv("DB_PASSWORD"),
		User:     os.Getenv("DB_USER"),
		SSLMode:  os.Getenv("DB_SSLMODE"),
		DBName:   os.Getenv("DB_NAME"),
	}
	db, _ := storage.NewConnection(config)

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: "redis:6379"},
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
		cmd := exec.Command("ffmpeg",
			"-i", inputPath,
			"-t", "30", // 30 seconds length
			"-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,drawtext=text='ANB':x=10:y=10:fontsize=24:fontcolor=white",
			"-an",             // Remove audio
			"-c:v", "libx264", // Encode
			"-preset", "fast", // Speed
			"-crf", "23", // Quality / compression balanced for storage optimization
			outputPath,
		)

		if err := cmd.Run(); err != nil {
			return err
		}

		// Update state in DB
		status := "processed"
		video.Status = &status
		video.ProcessedURL = &publicOutput
		db.Save(&video)

		log.Printf("Video %d processed", video.ID)
		return nil
	})

	if err := srv.Run(mux); err != nil {
		log.Fatal(err)
	}
}
