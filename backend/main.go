package main

import (
	"back-end-todolist/models"
	"back-end-todolist/repository"
	"back-end-todolist/storage"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {

	err := godotenv.Load(".env")

	if err != nil {
		log.Fatal("Error cargando el archivo .env")
	}

	config := &storage.Config{
		Host:     os.Getenv("DB_HOST"),
		Port:     os.Getenv("DB_PORT"),
		Password: os.Getenv("DB_PASSWORD"),
		User:     os.Getenv("DB_USER"),
		SSLMode:  os.Getenv("DB_SSLMODE"),
		DBName:   os.Getenv("DB_NAME"),
	}
	db, err := storage.NewConnection(config)

	if err != nil {
		log.Fatal("Error cargando la base de datos")
	}

	errMigrateUsers := models.MigrateUsers(db)
	errMigrateVideos := models.MigrateVideos(db)
	errMigrateVotes := models.MigrateVotes(db)

	if errMigrateUsers != nil || errMigrateVideos != nil || errMigrateVotes != nil {
		log.Fatal("Error migrando la base de datos")
	}

	// Crear vista materializada
	createView := `
		CREATE MATERIALIZED VIEW IF NOT EXISTS ranking_view AS
		SELECT
			u.id AS user_id,
			u.email,
			u.city,
			COUNT(vt.video_id) AS votes
		FROM videos v
		JOIN users u ON v.user_id = u.id
		LEFT JOIN votes vt ON v.id = vt.video_id
		GROUP BY u.id, u.email, u.city
		ORDER BY votes DESC;
		`
	if err := db.Exec(createView).Error; err != nil {
		log.Printf("No se pudo crear la vista materializada: %v", err)
	} else {
		log.Println("Vista materializada ranking_view creada (si no existía)")

	}

	createIndex := `
	CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_view_user ON ranking_view(user_id);
	`
	if err := db.Exec(createIndex).Error; err != nil {
		log.Printf("No se pudo crear índice de ranking_view: %v", err)
	} else {
		log.Println("Índice ranking_view creado (si no existía)")
	}

	// Refrescar la vista materializada cada 2 minutos en segundo plano
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			if err := db.Exec("REFRESH MATERIALIZED VIEW ranking_view;").Error; err != nil {
				log.Println("Error refrescando ranking_view:", err)
			} else {
				log.Println("ranking_view refrescada con éxito")
			}
		}
	}()

	r := repository.Repository{DB: db}

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000, http://127.0.0.1:3000",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Authorization",
		ExposeHeaders:    "Content-Type",
		AllowCredentials: false,
	}))

	r.SetupRoutes(app)
	app.Listen(":8080")
}
