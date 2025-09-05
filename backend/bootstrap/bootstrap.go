package bootstrap

import (
	"back-end-todolist/storage"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func InitDB() *gorm.DB {
	// Load environment variables
	err := godotenv.Load(".env")
	if err != nil {
		log.Fatal("Error cargando el archivo .env")
	}

	// Database config
	config := &storage.Config{
		Host:     os.Getenv("DB_HOST"),
		Port:     os.Getenv("DB_PORT"),
		Password: os.Getenv("DB_PASSWORD"),
		User:     os.Getenv("DB_USER"),
		SSLMode:  os.Getenv("DB_SSLMODE"),
		DBName:   os.Getenv("DB_NAME"),
	}

	// Connect to DB
	db, err := storage.NewConnection(config)
	if err != nil {
		log.Fatal("Error cargando la base de datos")
	}

	return db
}
