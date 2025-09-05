package models

import (
	"time"

	"gorm.io/gorm"
)

type Video struct {
	ID           uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	ProcessedURL *string `json:"processedUrl"`
	OriginalURL  *string `json:"originalUrl"`
	Title        *string `json:"title"`
	Status       *string `json:"status"`

	UploadedAt  *time.Time `json:"createdAt"`
	ProcessedAt *time.Time `json:"processedAt"`

	//Relacion con User
	UserID uint `json:"user_id"`
	User   User `gorm:"foreignKey:UserID"`

	Votes []Vote `json:"-"`
}

func MigrateVideos(db *gorm.DB) error {

	err := db.AutoMigrate(&Video{})

	return err
}
