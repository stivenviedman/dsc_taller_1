package repository

import "testing"

func TestDummySum(t *testing.T) {
	expected := 2
	got := DummySum()

	if got != expected {
		t.Errorf("DummySum() = %d; want %d", got, expected)
	}
}
