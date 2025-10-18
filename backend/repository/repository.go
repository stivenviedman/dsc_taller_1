package repository

import (
	"back-end-todolist/middlewares"
	"back-end-todolist/models"
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

type LoginRequest struct {
	Email    *string `json:"email"`
	Password *string `json:"password"`
}

// @Summary      Registra un nuevo usuario
// @Description  Se registra un usuario (player/fan)
// @Tags         users
// @Produce      json
// @Param        user  body  models.User true  "Datos del usuario"
// @Success      200 {object}  models.User
// @Router       /auth/signup [post]
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

	if user.Password1 == nil || user.Password2 == nil {
		return context.Status(http.StatusBadRequest).JSON(
			fiber.Map{"message": "Debe enviar password1 y password2"})
	}

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

	userType := ""
	if user.Type == nil {
		userType = "player"
	} else {
		userType = *user.Type
	}

	userInsert := models.User{
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Password:  &hashedP,
		City:      user.City,
		Country:   user.Country,
		Type:      &userType,
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

	token, time, errToken := middlewares.GenerarToken(*user.Email, dbuser.ID)

	if errToken != nil {
		context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "No se pudo generar el token"})
		return errToken
	}

	return context.Status(http.StatusOK).JSON(
		&fiber.Map{"message": "Se creo el usuario correctamente",
			"token":      token,
			"token_type": "Bearer",
			"expires_in": time})
}

// @Summary      Inicia sesion un usuario
// @Description  Inicia sesion un usuario (player/fan)
// @Tags         users
// @Produce      json
// @Success      200 {object}  models.User
// @Router       /auth/login [post]
func (r *Repository) LoginUser(context *fiber.Ctx) error {

	user := LoginRequest{}

	err := context.BodyParser(&user)

	if err != nil {
		context.Status(http.StatusUnprocessableEntity).JSON(
			&fiber.Map{"message": "Datos inválidos"})

		return err
	}

	dbuser := models.User{}
	errSelect := r.DB.Where("Email = ?", user.Email).First(&dbuser).Error

	if errSelect != nil {
		if errSelect == gorm.ErrRecordNotFound {
			return context.Status(fiber.StatusNotFound).JSON(
				fiber.Map{"message": "Correo incorrecto"},
			)
		}
		context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "No se pudo encontrar el usuario"})

		return errSelect
	}

	if !(middlewares.CheckPasswordHash(*user.Password, *dbuser.Password)) {
		return context.Status(http.StatusForbidden).JSON(
			&fiber.Map{"message": "Contraseña incorrecta"})
	}

	token, time, errToken := middlewares.GenerarToken(*dbuser.Email, dbuser.ID)

	if errToken != nil {
		context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "No se pudo generar el token"})

		return errToken
	}

	return context.Status(http.StatusOK).JSON(
		&fiber.Map{"message": "Ingreso exitoso",
			"token":      token,
			"token_type": "Bearer",
			"expires_in": time})
}

func (r *Repository) SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// User routes
	auth := api.Group("/auth")
	auth.Post("/signup", r.CreateUser)
	auth.Post("/login", r.LoginUser)

	// Video routes
	api.Post("/create_video", middlewares.AutValidation, r.UploadVideo)
	api.Post("/create_video_test", middlewares.AutValidation, r.UploadVideoFromURL)
	api.Get("/videos", middlewares.AutValidation, r.getMyVideos)              // Mis videos del usuario
	api.Get("/videos/:video_id", middlewares.AutValidation, r.getVideoDetail) // Detalle de video específico
	api.Delete("/videos/:video_id", middlewares.AutValidation, r.deleteVideo) // Eliminar video
	api.Get("/public/videos", r.getAllVideos)
	api.Post("/public/videos/:videoId/vote", middlewares.AutValidation, r.voteForVideo)

	// Ranking routes
	api.Get("/public/rankings", r.getRankings)

	// Health check
	api.Get("/health/check", r.HealthCheck)
}
