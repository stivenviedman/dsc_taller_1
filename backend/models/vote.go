package models

import (
	"gorm.io/gorm"
)

type Vote struct {
	//Relacion con User
	UserID uint `json:"user_id" gorm:"primaryKey"`
	User   User `gorm:"foreignKey:UserID"`

	//Relacion con Video
	VideoID uint  `json:"video_id" gorm:"primaryKey"`
	Video   Video `gorm:"foreignKey:VideoID	"`
}

func MigrateVotes(db *gorm.DB) error {

	err := db.AutoMigrate(&Vote{})

	return err
}
