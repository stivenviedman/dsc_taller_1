package middlewares

import (
	"fmt"
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

	fmt.Println(Token)
	if claims, ok := Token.Claims.(jwt.MapClaims); ok && Token.Valid {
		fmt.Println("Claims:", claims)
		fmt.Println("Usuario:", claims["username"])
	}

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

func GenerarToken(username string, id uint) (string, error) {

	datos := jwt.MapClaims{
		"username": username,
		"userId":   id,
		"exp":      time.Now().Add(time.Minute * 15).Unix(),
		"iat":      time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, datos)

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
