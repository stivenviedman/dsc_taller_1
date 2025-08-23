package models

type RankingView struct {
	UserID int    `gorm:"column:user_id"`
	Email  string `gorm:"column:email"`
	City   string `gorm:"column:city"`
	Votes  int    `gorm:"column:votes"`
}

func (RankingView) TableName() string {
	return "ranking_view"
}
