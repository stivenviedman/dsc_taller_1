package repository

import (
	"back-end-todolist/models"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"encoding/json"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// @Summary      Carga un video en el sistema
// @Description  Un usuario tipo player autenticado, puede subir un video
// @Tags         videos
// @Produce      json
// @Param        video  body  models.Video true  "Datos del video"
// @Success      200 {array}  models.Video
// @Router       /create_video [post]
func (r *Repository) UploadVideo(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(uint)

	// Get form-data video
	title := ctx.FormValue("title")
	file, err := ctx.FormFile("video_file")
	if err != nil {
		return ctx.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Missing video file",
		})
	}

	// Sanitize filename (remove spaces and keep extension)
	ext := filepath.Ext(file.Filename)
	name := strings.TrimSuffix(file.Filename, ext)
	safeName := strings.ReplaceAll(name, " ", "_")
	finalFilename := fmt.Sprintf("%d_%s%s", userID, safeName, ext)

	// Create temporary local file
	tempPath := filepath.Join(os.TempDir(), finalFilename)
	if err := ctx.SaveFile(file, tempPath); err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error saving video temporarily",
		})
	}
	defer os.Remove(tempPath)

	// --- Upload to S3 ---
	bucketName := os.Getenv("S3_BUCKET")
	region := os.Getenv("AWS_REGION")

	// Load AWS config
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
	)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error loading AWS config",
		})
	}

	client := s3.NewFromConfig(cfg)

	// Open file for reading
	f, err := os.Open(tempPath)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error opening temp file",
		})
	}
	defer f.Close()

	objectKey := fmt.Sprintf("uploads/%s", finalFilename)

	_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: &bucketName,
		Key:    &objectKey,
		Body:   f,
	})
	if err != nil {
		wrappedErr := fmt.Errorf("error uploading to S3: %w", err)
		fmt.Println(wrappedErr)
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error uploading to S3",
		})
	}

	publicURL := fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, objectKey)

	// --- Store video record in DB ---
	status := "uploaded"
	now := time.Now()
	video := models.Video{
		UserID:      userID,
		Title:       &title,
		OriginalURL: &publicURL,
		Status:      &status,
		UploadedAt:  &now,
	}

	if err := r.DB.Create(&video).Error; err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error storing in DB",
		})
	}

	// Enqueue task
	queueURL := os.Getenv("SQS_QUEUE_URL")

	cfg, err = config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
	)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error loading AWS config",
		})
	}
	sqsClient := sqs.NewFromConfig(cfg)

	payload := map[string]interface{}{
		"video_id": video.ID,
	}
	body, _ := json.Marshal(payload)

	resp, err := sqsClient.SendMessage(context.TODO(), &sqs.SendMessageInput{
		QueueUrl:    &queueURL,
		MessageBody: aws.String(string(body)),
	})
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error sending message to SQS",
		})
	}

	return ctx.JSON(fiber.Map{
		"message": "Stored video. Processing scheduled.",
		"video":   video,
		"task_id": resp.MessageId,
	})
}

func (r *Repository) UploadVideoFromURL(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(uint)

	videoURL := ctx.FormValue("video_url")
	title := ctx.FormValue("title")

	if videoURL == "" {
		return ctx.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Missing video_url field",
		})
	}

	// --- Download the video ---
	resp, err := http.Get(videoURL)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ctx.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Error downloading video from provided URL",
		})
	}
	defer resp.Body.Close()

	// Determine file extension
	ext := filepath.Ext(videoURL)
	if ext == "" {
		ct := resp.Header.Get("Content-Type")
		switch ct {
		case "video/mp4":
			ext = ".mp4"
		case "video/webm":
			ext = ".webm"
		case "video/ogg":
			ext = ".ogg"
		default:
			ext = ".mp4"
		}
	}

	safeName := strings.ReplaceAll(title, " ", "_")

	// ✅ Use UUID to ensure uniqueness
	uniqueID := uuid.NewString()
	finalFilename := fmt.Sprintf("%d_%s_%s%s", userID, safeName, uniqueID, ext)

	// --- Save temporarily ---
	tempPath := filepath.Join(os.TempDir(), finalFilename)
	out, err := os.Create(tempPath)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error creating temporary file",
		})
	}
	defer out.Close()
	defer os.Remove(tempPath)

	if _, err := io.Copy(out, resp.Body); err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error writing temporary file",
		})
	}

	// --- Upload to S3 ---
	bucketName := os.Getenv("S3_BUCKET")
	region := os.Getenv("AWS_REGION")

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
	)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error loading AWS config",
		})
	}

	client := s3.NewFromConfig(cfg)

	f, err := os.Open(tempPath)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error opening temp file",
		})
	}
	defer f.Close()

	objectKey := fmt.Sprintf("uploads/%s", finalFilename)
	_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: &bucketName,
		Key:    &objectKey,
		Body:   f,
	})
	if err != nil {
		wrappedErr := fmt.Errorf("error uploading to S3: %w", err)
		fmt.Println(wrappedErr)
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error uploading to S3",
		})
	}

	publicURL := fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, objectKey)

	// --- Save video record ---
	status := "uploaded"
	now := time.Now()
	video := models.Video{
		UserID:      userID,
		Title:       &title,
		OriginalURL: &publicURL,
		Status:      &status,
		UploadedAt:  &now,
	}

	if err := r.DB.Create(&video).Error; err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error storing in DB",
		})
	}

	// --- Enqueue background task ---
	queueURL := os.Getenv("SQS_QUEUE_URL")

	cfg, err = config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
	)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error loading AWS config",
		})
	}
	sqsClient := sqs.NewFromConfig(cfg)

	payload := map[string]interface{}{
		"video_id": video.ID,
	}
	body, _ := json.Marshal(payload)

	resp2, err := sqsClient.SendMessage(context.TODO(), &sqs.SendMessageInput{
		QueueUrl:    &queueURL,
		MessageBody: aws.String(string(body)),
	})
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error sending message to SQS",
		})
	}

	return ctx.JSON(fiber.Map{
		"message": "Stored video. Processing scheduled.",
		"video":   video,
		"task_id": resp2.MessageId,
	})
}

// @Summary      Obtiene todos los videos disponibles para votar
// @Tags         videos
// @Produce      json
// @Success      200  {array}   models.Video
// @Router       /public/videos [get]
func (r *Repository) getAllVideos(context *fiber.Ctx) error {

	videos := &[]models.Video{}

	if err := r.DB.
		Preload("User").
		Where("status = 'processed'").
		Find(&videos).Error; err != nil {

		return context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "Error al obtener los videos disponibles para votación"},
		)
	}

	context.Status(http.StatusOK).JSON(&fiber.Map{
		"message": "Se obtuvieron los videos disponibles para votacion corretamente",
		"data":    videos,
	})

	return nil
}

// @Summary      Un usuario autenticado puede votar por un video
// @Tags         votes
// @Produce      json
// @Param        id   path      int  true  "ID del video"
// @Success 200 {string} string "voto registrado con exito"
// @Router       /public/videos/:videoId/vote [post]
func (r *Repository) voteForVideo(context *fiber.Ctx) error {

	videoId := context.Params("videoId")
	userId := context.Locals("userID").(uint)

	// Convertir videoId de string a uint
	var vid uint
	if v, err := strconv.ParseUint(videoId, 10, 32); err == nil {
		vid = uint(v)
	} else {
		return fiber.NewError(fiber.StatusBadRequest, "videoId inválido")
	}

	// Verificar si ya existe el voto
	var existingVote = models.Vote{}
	err := r.DB.Where("user_id = ? AND video_id = ?", userId, vid).Take(&existingVote).Error

	if err == nil {
		// Ya existe
		//return fiber.NewError(fiber.StatusConflict, "Ya votaste por este video")
		return context.Status(fiber.StatusConflict).JSON(fiber.Map{
			"message": "Ya votaste por este video",
		})
	}

	// Si no existe, crear el voto
	newVote := models.Vote{
		UserID:  userId,
		VideoID: vid,
	}
	if err := r.DB.Create(&newVote).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "No se pudo registrar el voto")
	}

	return context.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Voto registrado con éxito",
	})
}

// @Summary      Obtiene todos los videos del usuario autenticado
// @Tags         videos
// @Produce      json
// @Success      200  {array}   models.Video
// @Router       /videos [get]
func (r *Repository) getMyVideos(context *fiber.Ctx) error {
	// Obtiene el userId a partir del token
	userID := context.Locals("userID").(uint)

	videos := &[]models.Video{}

	if err := r.DB.
		Where("user_id = ?", userID).
		Order("uploaded_at DESC").
		Find(&videos).Error; err != nil {

		return context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "Error al obtener los videos del usuario"},
		)
	}

	// Formatear la respuesta según la especificación
	var responseVideos []map[string]interface{}
	for _, video := range *videos {
		videoData := map[string]interface{}{
			"video_id": video.ID,
			"title":    video.Title,
			"status":   video.Status,
		}

		if video.UploadedAt != nil {
			videoData["uploaded_at"] = *video.UploadedAt
		}

		if video.Status != nil && *video.Status == "processed" {
			if video.ProcessedAt != nil {
				videoData["processed_at"] = *video.ProcessedAt
			}
			if video.ProcessedURL != nil {
				videoData["processed_url"] = *video.ProcessedURL
			}
		}

		responseVideos = append(responseVideos, videoData)
	}

	context.Status(http.StatusOK).JSON(&fiber.Map{
		"message": "Videos del usuario obtenidos correctamente",
		"data":    responseVideos,
	})

	return nil
}

// @Summary      Obtiene un video por id
// @Tags         videos
// @Produce      json
// @Param        id   path      int  true  "ID del video"
// @Success      200  {object}  models.Video
// @Router       /videos/:video_id [get]
func (r *Repository) getVideoDetail(context *fiber.Ctx) error {
	// Obtiene el userId a partir del token
	userID := context.Locals("userID").(uint)
	videoID := context.Params("video_id")

	// Convertir videoID de string a uint
	var vid uint
	if v, err := strconv.ParseUint(videoID, 10, 32); err == nil {
		vid = uint(v)
	} else {
		return fiber.NewError(fiber.StatusBadRequest, "video_id inválido")
	}

	video := models.Video{}

	// Buscar el video y verificar que pertenece al usuario autenticado
	if err := r.DB.Where("id = ? AND user_id = ?", vid, userID).First(&video).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return context.Status(http.StatusNotFound).JSON(&fiber.Map{
				"message": "Video no encontrado o no tienes permisos para acceder a él",
			})
		}
		return context.Status(http.StatusInternalServerError).JSON(&fiber.Map{
			"message": "Error al obtener el video",
		})
	}

	// Contar votos del video
	var voteCount int64
	r.DB.Model(&models.Vote{}).Where("video_id = ?", vid).Count(&voteCount)

	// Formatear la respuesta según la especificación
	response := map[string]interface{}{
		"video_id": video.ID,
		"title":    video.Title,
		"status":   video.Status,
		"votes":    voteCount,
	}

	if video.UploadedAt != nil {
		response["uploaded_at"] = *video.UploadedAt
	}

	if video.OriginalURL != nil {
		response["original_url"] = *video.OriginalURL
	}

	if video.Status != nil && *video.Status == "processed" {
		if video.ProcessedAt != nil {
			response["processed_at"] = *video.ProcessedAt
		}
		if video.ProcessedURL != nil {
			response["processed_url"] = *video.ProcessedURL
		}
	}

	context.Status(http.StatusOK).JSON(&fiber.Map{
		"message": "Detalle del video obtenido correctamente",
		"data":    response,
	})

	return nil
}

// @Summary      Elimina un video por id
// @Tags         videos
// @Produce      json
// @Param        id   path      int  true  "ID del video"
// @Success      200  {string}  "video eliminado"
// @Router       /videos/:video_id [delete]
func (r *Repository) deleteVideo(context *fiber.Ctx) error {
	// Obtiene el userId a partir del token
	userID := context.Locals("userID").(uint)
	videoID := context.Params("video_id")

	// Convertir videoID de string a uint
	var vid uint
	if v, err := strconv.ParseUint(videoID, 10, 32); err == nil {
		vid = uint(v)
	} else {
		return fiber.NewError(fiber.StatusBadRequest, "video_id inválido")
	}

	video := models.Video{}

	// Buscar el video y verificar que pertenece al usuario autenticado
	if err := r.DB.Where("id = ? AND user_id = ?", vid, userID).First(&video).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return context.Status(http.StatusNotFound).JSON(&fiber.Map{
				"message": "Video no encontrado o no tienes permisos para eliminarlo",
			})
		}
		return context.Status(http.StatusInternalServerError).JSON(&fiber.Map{
			"message": "Error al obtener el video",
		})
	}

	// Verificar que el video no haya sido publicado para votación
	// Un video está "publicado" si tiene votos o si su status es "processed"
	var voteCount int64
	r.DB.Model(&models.Vote{}).Where("video_id = ?", vid).Count(&voteCount)

	if voteCount > 0 {
		return context.Status(http.StatusBadRequest).JSON(&fiber.Map{
			"message": "No se puede eliminar el video porque ya tiene votos",
		})
	}

	if video.Status != nil && *video.Status == "processed" {
		return context.Status(http.StatusBadRequest).JSON(&fiber.Map{
			"message": "No se puede eliminar el video porque ya ha sido procesado",
		})
	}

	// Eliminar el video de la base de datos
	if err := r.DB.Delete(&video).Error; err != nil {
		return context.Status(http.StatusInternalServerError).JSON(&fiber.Map{
			"message": "Error al eliminar el video",
		})
	}

	// Eliminar archivos físicos asociados (original y procesado) si existen
	if video.OriginalURL != nil && *video.OriginalURL != "" {
		path := "." + *video.OriginalURL
		fsPath := filepath.FromSlash(path)
		if err := os.Remove(fsPath); err != nil && !os.IsNotExist(err) {
			log.Printf("No se pudo eliminar archivo original %s: %v", fsPath, err)
		}
	}

	if video.ProcessedURL != nil && *video.ProcessedURL != "" {
		path := "." + *video.ProcessedURL
		fsPath := filepath.FromSlash(path)
		if err := os.Remove(fsPath); err != nil && !os.IsNotExist(err) {
			log.Printf("No se pudo eliminar archivo procesado %s: %v", fsPath, err)
		}
	}

	context.Status(http.StatusOK).JSON(&fiber.Map{
		"message":  "El video ha sido eliminado exitosamente",
		"video_id": vid,
	})

	return nil
}
