package repository

import (
	"back-end-todolist/models"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

/*---Video functions----*/
func (r *Repository) CreateVideo(context *fiber.Ctx) error {

	/*Obtiene el userId a partir del token*/
	userID := context.Locals("userID").(uint)
	log.Printf("El usuario con id %d va a crear un video'", userID)

	video := models.Video{}

	err := context.BodyParser(&video)

	if err != nil {
		context.Status(http.StatusUnprocessableEntity).JSON(
			&fiber.Map{"message": "request failed"})

		return err
	}

	//Asigna el id
	video.UserID = userID

	// Validar que el User existe
	user := models.User{}
	if err := r.DB.First(&user, userID).Error; err != nil {
		return context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "Usuario no encontrado"},
		)
	}

	errCreate := r.DB.Create(&video).Error

	if errCreate != nil {
		context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "No se pudo crear el video"})

		return err
	}

	context.Status(http.StatusOK).JSON(
		&fiber.Map{"message": "Se creo el video correctamente"})

	return nil
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
	err := r.DB.Where("user_id = ? AND video_id = ?", userId, vid).First(&existingVote).Error
	if err == nil {
		// Ya existe
		return fiber.NewError(fiber.StatusConflict, "Ya votaste por este video")
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		// Otro error de DB
		return fiber.NewError(fiber.StatusInternalServerError, "Error al verificar voto")
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
