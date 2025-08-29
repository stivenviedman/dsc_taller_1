package repository

import (
	"back-end-todolist/asynqtasks"
	"back-end-todolist/models"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/hibiken/asynq"
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

	// Original file path
	publicPath := fmt.Sprintf("/uploads/%d_%s", userID, file.Filename)
	savePath := "." + publicPath

	// Store in ./uploads
	if err := ctx.SaveFile(file, savePath); err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error saving video",
		})
	}

	status := "uploaded"
	video := models.Video{
		UserID:      userID,
		Title:       &title,
		OriginalURL: &publicPath,
		Status:      &status,
	}
	if err := r.DB.Create(&video).Error; err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error storing in DB",
		})
	}

	// Encolar tarea
	task, _ := asynqtasks.NewProcessVideoTask(video.ID)
	client := asynq.NewClient(asynq.RedisClientOpt{Addr: "redis:6379"})
	defer client.Close()

	info, err := client.Enqueue(task)
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Error queueing task",
		})
	}

	return ctx.JSON(fiber.Map{
		"message": "Stored video. Processing scheduled.",
		"task_id": info.ID,
		"video":   video,
	})
}

func (r *Repository) getAllVideos(context *fiber.Ctx) error {

	videos := &[]models.Video{}

	if err := r.DB.
		Preload("User").
		Where("status IN ?", []string{"uploaded", "processed"}).
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
