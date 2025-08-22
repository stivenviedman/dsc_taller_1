package repository

import (
	"back-end-todolist/models"
	"log"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

/*---Task functions----*/
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
