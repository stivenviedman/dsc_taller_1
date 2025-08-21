package models

import (
	"gorm.io/gorm"
)

type User struct {
	ID       uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	Username *string `json:"username"`
	Password *string `json:"password"`
	ImageP   *string `json:"image"`
}

func MigrateUsers(db *gorm.DB) error {

	err := db.AutoMigrate(&User{})

	return err
}
