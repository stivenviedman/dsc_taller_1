package repository

import (
	"back-end-todolist/middlewares"
	"back-end-todolist/models"
	"fmt"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type Repository struct {
	DB *gorm.DB
}

/*---User functions----*/
func (r *Repository) CreateUser(context *fiber.Ctx) error {

	user := models.User{}

	err := context.BodyParser(&user)

	if err != nil {
		context.Status(http.StatusUnprocessableEntity).JSON(
			&fiber.Map{"message": "request failed"})

		return err
	}

	errCreate := r.DB.Create(&user).Error

	if errCreate != nil {
		context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "No se pudo crear el user"})

		return err
	}

	dbuser := models.User{}
	errSelect := r.DB.Where("email = ?", user.Email).First(&dbuser).Error

	if errSelect != nil {
		context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "No se pudo encontrar el usuario"})

		return errSelect
	}

	token, errToken := middlewares.GenerarToken(*user.Email, dbuser.ID)

	if errToken != nil {
		context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "No se pudo generar el token"})
		return errToken
	}

	return context.Status(http.StatusOK).JSON(
		&fiber.Map{"message": "Se creo el user correctamente",
			"token": token})
}

func (r *Repository) LoginUser(context *fiber.Ctx) error {

	user := models.User{}

	err := context.BodyParser(&user)

	if err != nil {
		context.Status(http.StatusUnprocessableEntity).JSON(
			&fiber.Map{"message": "Datos inválidos"})

		return err
	}

	dbuser := models.User{}
	errSelect := r.DB.Where("email = ?", user.Email).First(&dbuser).Error

	if errSelect != nil {
		context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "No se pudo encontrar el usuario"})

		return errSelect
	}
	fmt.Printf("Usuario: %s\n", *user.Password)
	fmt.Printf("Usuario DB %s\n", *dbuser.Password)
	if *dbuser.Password != *user.Password {
		return context.Status(http.StatusForbidden).JSON(
			&fiber.Map{"message": "Contraseña incorrecta"})
	}

	token, errToken := middlewares.GenerarToken(*dbuser.Email, dbuser.ID)

	if errToken != nil {
		context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "No se pudo generar el token"})

		return errToken
	}

	return context.Status(http.StatusOK).JSON(
		&fiber.Map{"message": "Ingreso exitoso",
			"token": token})
}

func (r *Repository) SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// User routes
	api.Post("/create_users", r.CreateUser)
	api.Post("/login_users", r.LoginUser)

	// Video routes
	api.Post("/create_video", middlewares.AutValidation, r.CreateVideo)
	api.Get("/videos", middlewares.AutValidation, r.getMyVideos)              // Mis videos del usuario
	api.Get("/videos/:video_id", middlewares.AutValidation, r.getVideoDetail) // Detalle de video específico
	api.Delete("/videos/:video_id", middlewares.AutValidation, r.deleteVideo) // Eliminar video
	api.Get("/public/videos", r.getAllVideos)
	api.Post("/public/videos/:videoId/vote", middlewares.AutValidation, r.voteForVideo)

	// Ranking routes
	api.Get("/public/rankings", r.getRankings)

}
