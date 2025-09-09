package middlewares

import (
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = []byte(os.Getenv("KEY_TOKEN"))

func AutValidation(c *fiber.Ctx) error {
	token := c.Get("Authorization")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Falta Token",
		})
	}

	parts := strings.Split(token, " ")
	var StringTok string
	if len(parts) == 2 && parts[0] == "Bearer" {
		StringTok = parts[1]
	}

	Token, err := jwt.Parse(StringTok, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !Token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Token inválido",
		})
	}

	claims := Token.Claims.(jwt.MapClaims)
	userID := uint(claims["userId"].(float64))

	c.Locals("userID", userID)

	return c.Next()
}

func GenerarToken(username string, id uint) (string, int64, error) {

	minutes := time.Duration(60) * time.Minute
	time_exp := int64(minutes.Seconds())
	datos := jwt.MapClaims{
		"username": username,
		"userId":   id,
		"exp":      time.Now().Add(minutes).Unix(),
		"iat":      time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, datos)

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", 0, err
	}

	return tokenString, time_exp, nil
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
