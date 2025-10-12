package main

import (
	"back-end-todolist/asynqtasks"
	"back-end-todolist/bootstrap"
	"back-end-todolist/models"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/hibiken/asynq"
)

func main() {
	db := bootstrap.InitDB()
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisHost + ":" + redisPort},
		asynq.Config{
			Concurrency: 5,
			// LogLevel:    asynq.DebugLevel,
		},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(asynqtasks.TypeProcessVideo, func(ctx context.Context, t *asynq.Task) error {
		log.Printf("Processing video task...")

		var p asynqtasks.ProcessVideoPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			log.Printf("Error unmarshaling payload: %v", err)
			return err
		}

		log.Printf("Processing video ID: %d", p.VideoID)

		// Find video
		var video models.Video
		if err := db.First(&video, p.VideoID).Error; err != nil {
			log.Printf("Error finding video: %v", err)
			return err
		}

		// Download original video from S3 to temp file
		tempInputPath := filepath.Join(os.TempDir(), fmt.Sprintf("input_%d.mp4", p.VideoID))
		log.Printf("Downloading video from S3: %s to %s", *video.OriginalURL, tempInputPath)

		if err := downloadFromS3(*video.OriginalURL, tempInputPath); err != nil {
			wrappedErr := fmt.Errorf("error downloading from S3: %w", err)
			fmt.Println(wrappedErr)
			return wrappedErr
		}
		defer os.Remove(tempInputPath)

		// Create temp output path
		tempOutputPath := filepath.Join(os.TempDir(), fmt.Sprintf("%d_processed.mp4", p.VideoID))
		defer os.Remove(tempOutputPath)

		// Clean up any existing temp files
		os.Remove("intro.mp4")
		os.Remove("main.mp4")
		os.Remove("outro.mp4")
		os.Remove("files.txt")

		log.Printf("Processing video with ffmpeg...")

		// Process video with ffmpeg - Execute commands sequentially
		cmd := exec.Command("bash", "-c", fmt.Sprintf(`
set -e  # Exit on any error

# 1) Intro (2s, negro con texto ANB centrado)
ffmpeg -f lavfi -i color=c=black:s=1280x720:d=2 \
-vf "drawtext=text='ANB':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=72:fontcolor=white" \
-c:v libx264 -t 2 -preset fast -crf 23 intro.mp4 -y

# 2) Main video (30s, resize, marca ANB arriba izquierda, sin audio)
ffmpeg -i "%s" -t 30 \
-vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,drawtext=text='ANB':x=10:y=10:fontsize=24:fontcolor=white" \
-an -c:v libx264 -preset fast -crf 23 main.mp4 -y

# 3) Outro (2s, negro con texto ANB centrado)
ffmpeg -f lavfi -i color=c=black:s=1280x720:d=2 \
-vf "drawtext=text='ANB':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=72:fontcolor=white" \
-c:v libx264 -t 2 -preset fast -crf 23 outro.mp4 -y

# 4) Concatenar todo
echo "file 'intro.mp4'" > files.txt
echo "file 'main.mp4'" >> files.txt
echo "file 'outro.mp4'" >> files.txt
ffmpeg -f concat -safe 0 -i files.txt -c copy "%s" -y

# Clean up temp files
rm -f intro.mp4 main.mp4 outro.mp4 files.txt
`, tempInputPath, tempOutputPath))

		// Capture command output for debugging
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			log.Printf("Error running ffmpeg: %v", err)
			return fmt.Errorf("error processing video: %w", err)
		}

		log.Printf("Video processing complete, uploading to S3...")

		// Upload processed video to S3
		bucketName := os.Getenv("S3_BUCKET")
		region := os.Getenv("AWS_REGION")

		// Load AWS config
		cfg, err := config.LoadDefaultConfig(ctx,
			config.WithRegion(region),
		)
		if err != nil {
			log.Printf("Error loading AWS config: %v", err)
			return fmt.Errorf("error loading AWS config: %w", err)
		}

		client := s3.NewFromConfig(cfg)

		// Open processed video file
		f, err := os.Open(tempOutputPath)
		if err != nil {
			log.Printf("Error opening processed file: %v", err)
			return fmt.Errorf("error opening processed file: %w", err)
		}
		defer f.Close()

		// Upload to S3 in processed folder
		objectKey := fmt.Sprintf("processed/%d_processed.mp4", p.VideoID)

		log.Printf("Uploading to S3: bucket=%s, key=%s", bucketName, objectKey)

		_, err = client.PutObject(ctx, &s3.PutObjectInput{
			Bucket: &bucketName,
			Key:    &objectKey,
			Body:   f,
		})
		if err != nil {
			log.Printf("Error uploading to S3: %v", err)
			return fmt.Errorf("error uploading to S3: %w", err)
		}

		// Generate public URL
		publicURL := fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, objectKey)

		// Update state in DB
		status := "processed"
		now := time.Now()
		video.Status = &status
		video.ProcessedURL = &publicURL
		video.ProcessedAt = &now

		if err := db.Save(&video).Error; err != nil {
			log.Printf("Error updating DB: %v", err)
			return fmt.Errorf("error updating DB: %w", err)
		}

		log.Printf("Video %d processed and uploaded to S3 successfully", video.ID)
		return nil
	})

	log.Println("Starting Asynq server...")
	if err := srv.Run(mux); err != nil {
		log.Fatal(err)
	}
}

// downloadFromS3 downloads a file from S3 URL to local path
func downloadFromS3(s3URL, localPath string) error {
	// Create HTTP request to download the file
	resp, err := http.Get(s3URL)
	if err != nil {
		return fmt.Errorf("error downloading from S3: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	// Create local file
	out, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("error creating local file: %w", err)
	}
	defer out.Close()

	// Copy content
	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return fmt.Errorf("error copying file content: %w", err)
	}

	return nil
}
