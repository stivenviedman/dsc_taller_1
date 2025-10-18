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
		asynq.Config{Concurrency: 5},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(asynqtasks.TypeProcessVideo, func(ctx context.Context, t *asynq.Task) error {
		var p asynqtasks.ProcessVideoPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}

		startTime := time.Now()
		log.Printf("[Video %d] Started processing at: %s", p.VideoID, startTime.Format(time.RFC3339))
		defer func() {
			endTime := time.Now()
			duration := endTime.Sub(startTime)
			log.Printf("[Video %d] Completed processing at: %s (Duration: %s)", p.VideoID, endTime.Format(time.RFC3339), duration)
		}()

		// Fetch video record
		var video models.Video
		if err := db.First(&video, p.VideoID).Error; err != nil {
			return err
		}

		// Prepare temp paths
		tempInputPath := filepath.Join(os.TempDir(), fmt.Sprintf("input_%d.mp4", p.VideoID))
		tempOutputPath := filepath.Join(os.TempDir(), fmt.Sprintf("%d_processed.mp4", p.VideoID))
		defer os.Remove(tempInputPath)
		defer os.Remove(tempOutputPath)
		os.Remove("intro.mp4")
		os.Remove("main.mp4")
		os.Remove("outro.mp4")
		os.Remove("files.txt")

		// Download original video
		if err := downloadFromS3(*video.OriginalURL, tempInputPath); err != nil {
			return fmt.Errorf("error downloading from S3: %w", err)
		}

		// Process video with ffmpeg
		cmd := exec.Command("bash", "-c", fmt.Sprintf(`
set -e
ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=black:s=1280x720:d=2 \
-vf "drawtext=text='ANB':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=72:fontcolor=white" \
-c:v libx264 -t 2 -preset fast -crf 23 intro.mp4 -y
ffmpeg -hide_banner -loglevel error -i "%s" -t 30 \
-vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,drawtext=text='ANB':x=10:y=10:fontsize=24:fontcolor=white" \
-an -c:v libx264 -preset fast -crf 23 main.mp4 -y
ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=black:s=1280x720:d=2 \
-vf "drawtext=text='ANB':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=72:fontcolor=white" \
-c:v libx264 -t 2 -preset fast -crf 23 outro.mp4 -y
echo "file 'intro.mp4'" > files.txt
echo "file 'main.mp4'" >> files.txt
echo "file 'outro.mp4'" >> files.txt
ffmpeg -hide_banner -loglevel error -f concat -safe 0 -i files.txt -c copy "%s" -y
rm -f intro.mp4 main.mp4 outro.mp4 files.txt
`, tempInputPath, tempOutputPath))

		if err := cmd.Run(); err != nil {
			return fmt.Errorf("error processing video: %w", err)
		}

		// Upload processed video to S3
		bucketName := os.Getenv("S3_BUCKET")
		region := os.Getenv("AWS_REGION")
		cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
		if err != nil {
			return fmt.Errorf("error loading AWS config: %w", err)
		}
		client := s3.NewFromConfig(cfg)

		f, err := os.Open(tempOutputPath)
		if err != nil {
			return fmt.Errorf("error opening processed file: %w", err)
		}
		defer f.Close()

		objectKey := fmt.Sprintf("processed/%d_processed.mp4", p.VideoID)
		if _, err := client.PutObject(ctx, &s3.PutObjectInput{
			Bucket: &bucketName,
			Key:    &objectKey,
			Body:   f,
		}); err != nil {
			return fmt.Errorf("error uploading to S3: %w", err)
		}

		publicURL := fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, objectKey)
		status := "processed"
		now := time.Now()
		video.Status = &status
		video.ProcessedURL = &publicURL
		video.ProcessedAt = &now
		if err := db.Save(&video).Error; err != nil {
			return fmt.Errorf("error updating DB: %w", err)
		}

		return nil
	})

	if err := srv.Run(mux); err != nil {
		log.Fatal(err)
	}
}

func downloadFromS3(s3URL, localPath string) error {
	resp, err := http.Get(s3URL)
	if err != nil {
		return fmt.Errorf("error downloading from S3: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}
	out, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("error creating local file: %w", err)
	}
	defer out.Close()
	if _, err = io.Copy(out, resp.Body); err != nil {
		return fmt.Errorf("error copying file content: %w", err)
	}
	return nil
}
