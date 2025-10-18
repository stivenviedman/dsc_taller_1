package repository

import (
	"back-end-todolist/middlewares"
	"back-end-todolist/models"
	"net/http"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/hibiken/asynq"
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

// @Summary      Obtiene métricas del worker
// @Description  Devuelve estadísticas de la cola de Redis/Asynq para monitoreo del worker
// @Tags         health
// @Produce      json
// @Success      200
// @Router       /health/worker [get]
func (r *Repository) getWorkerMetrics(ctx *fiber.Ctx) error {
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")

	if redisHost == "" || redisPort == "" {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Redis configuration not found",
		})
	}

	inspector := asynq.NewInspector(
		asynq.RedisClientOpt{Addr: redisHost + ":" + redisPort},
	)
	defer inspector.Close()

	// Obtener estadísticas de las colas
	queueStats, err := inspector.GetQueueInfo("default")
	if err != nil {
		return ctx.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get queue stats",
		})
	}

	// Calcular tasa de éxito/fallo
	totalProcessed := queueStats.Processed
	totalFailed := queueStats.Failed

	successRate := 0.0
	failureRate := 0.0
	if totalProcessed+totalFailed > 0 {
		successRate = float64(totalProcessed) / float64(totalProcessed+totalFailed) * 100
		failureRate = float64(totalFailed) / float64(totalProcessed+totalFailed) * 100
	}

	return ctx.JSON(fiber.Map{
		"queue": fiber.Map{
			"pending":   queueStats.Pending,
			"active":    queueStats.Active,
			"processed": queueStats.Processed,
			"failed":    queueStats.Failed,
			"archived":  queueStats.Archived,
		},
		"metrics": fiber.Map{
			"success_rate":    successRate,
			"failure_rate":    failureRate,
			"total_processed": totalProcessed,
			"total_failed":    totalFailed,
		},
	})
}

func (r *Repository) SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// User routes
	auth := api.Group("/auth")
	auth.Post("/signup", r.CreateUser)
	auth.Post("/login", r.LoginUser)

	// Video routes
	api.Post("/create_video", middlewares.AutValidation, r.UploadVideo)
	api.Get("/videos", middlewares.AutValidation, r.getMyVideos)              // Mis videos del usuario
	api.Get("/videos/:video_id", middlewares.AutValidation, r.getVideoDetail) // Detalle de video específico
	api.Delete("/videos/:video_id", middlewares.AutValidation, r.deleteVideo) // Eliminar video
	api.Get("/public/videos", r.getAllVideos)
	api.Post("/public/videos/:videoId/vote", middlewares.AutValidation, r.voteForVideo)

	// Ranking routes
	api.Get("/public/rankings", r.getRankings)

	// Health check
	api.Get("/health/check", r.HealthCheck)
	api.Get("/health/worker", r.getWorkerMetrics)
}
