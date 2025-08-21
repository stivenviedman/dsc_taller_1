package models

import (
	"gorm.io/gorm"
)

type User struct {
	ID        uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	Email     *string `json:"email"`
	FirstName *string `json:"firstName"`
	LastName  *string `json:"lastName"`
	Password  *string `json:"password"`
	City      *string `json:"city"`
	Country   *string `json:"country"`
	Type      *string `json:"type"`

	Videos []Video `json:"-"`
	Votes  []Vote  `json:"-"`
}

func MigrateUsers(db *gorm.DB) error {

	err := db.AutoMigrate(&User{})

	return err
}
