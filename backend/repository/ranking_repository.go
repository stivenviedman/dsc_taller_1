package repository

import (
	"back-end-todolist/models"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

// @Summary      Obtiene los rankings de los videos votados
// @Tags         rankings
// @Produce      json
// @Success      200  {array}   models.RankingView
// @Router       /public/rankings [get]
func (r *Repository) getRankings(context *fiber.Ctx) error {

	rankings := []models.RankingView{}

	err := r.DB.Find(&rankings).Error

	if err != nil {
		return context.Status(http.StatusInternalServerError).JSON(
			&fiber.Map{"message": "Error al obtener los videos disponibles para votación"},
		)
	}

	context.Status(http.StatusOK).JSON(&fiber.Map{
		"message": "Se obtuvieron los rankings corretctamente",
		"data":    rankings,
	})

	return nil
}
