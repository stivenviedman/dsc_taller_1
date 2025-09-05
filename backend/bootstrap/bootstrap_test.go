package bootstrap

import (
	"back-end-todolist/storage"
	"testing"

	"gorm.io/gorm"
)

func TestInitDB_Success(t *testing.T) {
	// Override DB connection with mock
	newConnection = func(cfg *storage.Config) (*gorm.DB, error) {
		return &gorm.DB{}, nil
	}
	defer func() { newConnection = storage.NewConnection }() // reset after test

	db := InitDB()
	if db == nil {
		t.Fatal("expected db instance, got nil")
	}
}
