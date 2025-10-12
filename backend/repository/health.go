package repository

import (
	"net/http"

	"github.com/gofiber/fiber/v2"
)

// @Summary      Health check
// @Tags         health
// @Produce      json
// @Success      200  {string}  "Healh check passed"
// @Router       /health/check
func (r *Repository) HealthCheck(context *fiber.Ctx) error {
	context.Status(http.StatusOK).JSON(&fiber.Map{
		"message": "Healh check passed",
	})

	return nil
}
