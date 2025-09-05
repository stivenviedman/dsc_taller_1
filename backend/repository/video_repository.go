package repository

import (
	"back-end-todolist/asynqtasks"
	"back-end-todolist/models"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/hibiken/asynq"
	"gorm.io/gorm"
)

/*---Video functions----*/
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
	finalFilename := safeName + ext

	// Final file path
	publicPath := fmt.Sprintf("/uploads/%d_%s", userID, finalFilename)
	savePath := "." + publicPath

	// Store in ./uploads
	if err := ctx.SaveFile(file, savePath); err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error saving video",
		})
	}

	status := "uploaded"
	now := time.Now()
	video := models.Video{
		UserID:      userID,
		Title:       &title,
		OriginalURL: &publicPath,
		Status:      &status,
		UploadedAt:  &now,
	}
	if err := r.DB.Create(&video).Error; err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error storing in DB",
		})
	}

	// Enqueue task
	task, _ := asynqtasks.NewProcessVideoTask(video.ID)
	client := asynq.NewClient(asynq.RedisClientOpt{Addr: "redis:6379"})
	defer client.Close()

	info, err := client.Enqueue(task)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error queueing task",
		})
	}

	// Ensure CreatedAt is loaded before returning
	var savedVideo models.Video
	if err := r.DB.First(&savedVideo, video.ID).Error; err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error fetching saved video",
		})
	}

	return ctx.JSON(fiber.Map{
		"message": "Stored video. Processing scheduled.",
		"task_id": info.ID,
		"video":   savedVideo,
	})
}

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
		return fiber.NewError(fiber.StatusConflict, "Ya votaste por este video")
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

/*---Get My Videos----*/
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

/*---Get Video Detail----*/
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

/*---Delete Video----*/
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

	// TODO: Aquí se debería eliminar también los archivos físicos del sistema de archivos
	// cuando implementemos el almacenamiento real

	context.Status(http.StatusOK).JSON(&fiber.Map{
		"message":  "El video ha sido eliminado exitosamente",
		"video_id": vid,
	})

	return nil
}
