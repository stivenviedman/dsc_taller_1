package repository

import (
	"back-end-todolist/models"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

/*---Ranking view functions----*/
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
