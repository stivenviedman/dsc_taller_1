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

type UserRequest struct {
	Email     *string `json:"email"`
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Password1 *string `json:"password1"`
	Password2 *string `json:"password2"`
	City      *string `json:"city"`
	Country   *string `json:"country"`
	Type      *string `json:"type"`
}

/*---User functions----*/
func (r *Repository) CreateUser(context *fiber.Ctx) error {

	user := UserRequest{}

	err := context.BodyParser(&user)

	if err != nil {
		context.Status(http.StatusUnprocessableEntity).JSON(
			&fiber.Map{"message": "request failed"})

		return err
	}

	dbuserNames := []models.User{}
	query := r.DB.Where("Email = ?", user.Email).Find(&dbuserNames)

	if query.Error != nil {
		return context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "No se puede validar usuario existente"})
	}

	if query.RowsAffected != 0 {
		return context.Status(http.StatusConflict).JSON(
			&fiber.Map{"message": "Ya existen perfiles con ese email"})
	}

	fmt.Printf("Pass1: %s\n", *user.Password1)
	fmt.Printf("Pass2 %s\n", *user.Password2)
	if *user.Password1 != *user.Password2 {
		return context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "Contraseñas no coinciden"})
	}

	hashPasw, errPasw := middlewares.HashPassword(*user.Password1)

	if errPasw != nil {
		context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "No se procesar la contraseña"})
		return errPasw
	}

	hashedP := string(hashPasw)
	userInsert := models.User{
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Password:  &hashedP,
		City:      user.City,
		Country:   user.Country,
		Type:      user.Type,
	}

	errCreate := r.DB.Create(&userInsert).Error

	if errCreate != nil {
		context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "No se pudo crear el user"})

		return err
	}

	dbuser := models.User{}
	errSelect := r.DB.Where("Email = ?", user.Email).First(&dbuser).Error

	if errSelect != nil {
		context.Status(http.StatusBadRequest).JSON(
			&fiber.Map{"message": "No se pudo encontrar el usuario"})

		return errSelect
	}

	token, errToken := middlewares.GenerarToken(*user.Email, dbuser.ID)

	if errToken != nil {
		context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "No se pudo generar el token"})
		return errToken
	}

	return context.Status(http.StatusOK).JSON(
		&fiber.Map{"message": "Se creo el usuario correctamente",
			"token":      token,
			"token_type": "Bearer",
			"expires_in": 900})
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
	errSelect := r.DB.Where("Email = ?", user.Email).First(&dbuser).Error

	if errSelect != nil {
		context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "No se pudo encontrar el usuario"})

		return errSelect
	}

	fmt.Printf("Usuario: %s\n", *user.Password)
	fmt.Printf("Usuario DB %s\n", *dbuser.Password)

	if !(middlewares.CheckPasswordHash(*user.Password, *dbuser.Password)) {
		return context.Status(http.StatusForbidden).JSON(
			&fiber.Map{"message": "Contraseña incorrecta"})
	}

	token, errToken := middlewares.GenerarToken(*dbuser.Email, dbuser.ID)

	if errToken != nil {
		context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "No se pudo generar el token"})

		return errToken
	}

	return context.Status(http.StatusOK).JSON(
		&fiber.Map{"message": "Ingreso exitoso",
			"token":      token,
			"token_type": "Bearer",
			"expires_in": 900})
}

func (r *Repository) SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// User routes
	auth := api.Group("/auth")
	auth.Post("/signup", r.CreateUser)
	auth.Post("/login", r.LoginUser)

	// Video routes
	api.Post("/create_video", middlewares.AutValidation, r.CreateVideo)
	api.Get("/public/videos", r.getAllVideos)
	api.Post("/public/videos/:videoId/vote", middlewares.AutValidation, r.voteForVideo)

}
