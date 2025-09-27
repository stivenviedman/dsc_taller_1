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

		mode := os.Getenv("MODE")
		fileServerHost := os.Getenv("FILE_SERVER_HOST")

		if mode != "LOCAL" {

			// 2. Ejecutar scp para traer el archivo desde B a C
			srcIP := fileServerHost // IP privada de la EC2 B
			srcUser := "ec2-user"
			srcPath := "/home/ec2-user" + *video.OriginalURL
			keyPath := "/app/nfs-server-pairkeys.pem"

			// Carpeta donde lo guardas en el contenedor C
			localPath := "/app" + *video.OriginalURL

			cmd := exec.Command("scp",
				"-o", "StrictHostKeyChecking=no",
				"-i", keyPath,
				fmt.Sprintf("%s@%s:%s", srcUser, srcIP, srcPath),
				localPath,
			)

			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			fmt.Println("Ejecutando SCP desde B hacia C...")

			if err := cmd.Run(); err != nil {
				fmt.Println("Error ejecutando scp:", err)
				return err
			}

		}
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

		if mode != "LOCAL" {
			// Store in ./processed in the EC2 NFS
			// 2. Ejecutar scp para copiar a la otra EC2
			destIP := fileServerHost // IP privada de la EC2 destino
			destUser := "ec2-user"
			destPath := "/home/ec2-user/processed/"
			keyPath := "/app/nfs-server-pairkeys.pem"

			cmd := exec.Command("scp",
				"-o", "StrictHostKeyChecking=no",
				"-i", keyPath,
				outputPath,
				fmt.Sprintf("%s@%s:%s", destUser, destIP, destPath))

			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			fmt.Println("Copio en processed del NFS exitosamente")

			if err := cmd.Run(); err != nil {
				fmt.Println("entro al error")
				fmt.Println(err)
				return err
			}

			// Despues de llevarlo al NFS Borra el archivo temporal que se guardo en /uploads
			// Ruta absoluta dentro del contenedor
			localPath := "/app" + *video.OriginalURL
			// Intentar borrar el archivo
			if err := os.Remove(localPath); err != nil {
				fmt.Println("error eliminando el video")
				fmt.Println(err)
			} else {
				fmt.Println("archivo temporal borrado exitosamente de /uploads")
			}

			// Despues de llevarlo al NFS Borra el archivo temporal que se guardo en /processed
			// Ruta absoluta dentro del contenedor
			// Intentar borrar el archivo
			if err := os.Remove("/app" + publicOutput); err != nil {
				fmt.Println("error eliminando el video")
				fmt.Println(err)
			} else {
				fmt.Println("archivo temporal borrado exitosamente de /processed")
			}

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
