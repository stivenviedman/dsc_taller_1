package models

import (
	"gorm.io/gorm"
)

type Video struct {
	ID           uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	ProcessedURL *string `json:"processedUrl"`
	OriginalURL  *string `json:"originalUrl"`
	Title        *string `json:"title"`
	UploadedAt   *string `json:"uploadedAt"`
	ProcessedAt  *string `json:"processedAt"`
	Status       *string `json:"status"`

	//Relacion con User
	UserID uint `json:"user_id"`
	User   User `gorm:"foreignKey:UserID"`

	Votes []Vote `json:"-"`
}

func MigrateVideos(db *gorm.DB) error {

	err := db.AutoMigrate(&Video{})

	return err
}
