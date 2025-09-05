package bootstrap

import (
	"back-end-todolist/storage"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

// Can be replaced in tests
var newConnection = storage.NewConnection

func InitDB() *gorm.DB {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: Error cargando el archivo .env")
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

	// Connect to DB (via variable, not direct call)
	db, err := newConnection(config)
	if err != nil {
		log.Fatal("Error cargando la base de datos")
	}

	return db
}
