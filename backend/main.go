package main

import (
	"back-end-todolist/models"
	"back-end-todolist/storage"
	"log"
	"os"

	"back-end-todolist/repository"

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

	if errMigrateUsers != nil {
		log.Fatal("Error migrando la base de datos")
	}

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
