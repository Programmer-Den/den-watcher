package router

import (
	"testing"
	"time"
)

func TestRate64TakesADecreaseAsAReset(t *testing.T) {
	var c counter
	now := time.Now()
	c.rate64(3_000_000_000, now, false)
	if rate, ok := c.rate64(1_000_000, now.Add(5*time.Second), false); ok {
		t.Errorf("a reset counted %v bytes per second", rate)
	}
	if rate, ok := c.rate64(1_500_000, now.Add(10*time.Second), false); !ok || rate != 100_000 {
		t.Errorf("got %v, %v", rate, ok)
	}
	// A 32-bit counter wraps around.
	var w counter
	w.rate(1<<32-1000, now, false)
	if rate, ok := w.rate(1000, now.Add(time.Second), false); !ok || rate != 2000 {
		t.Errorf("got %v, %v", rate, ok)
	}
}

func TestTotalGoesOnGrowingWhenA32BitCounterWraps(t *testing.T) {
	var c counter
	now := time.Now()
	c.rate(1<<32-1000, now, false)
	if c.total != 1<<32-1000 {
		t.Errorf("total of the first reading = %d, want the counter", c.total)
	}
	// Prometheus would read a counter that went down as a reset.
	c.rate(1000, now.Add(time.Second), false)
	if c.total != 1<<32+1000 {
		t.Errorf("total after the wrap = %d, want %d", c.total, uint64(1<<32+1000))
	}
	c.rate(3000, now.Add(2*time.Second), false)
	if c.total != 1<<32+3000 {
		t.Errorf("total after it grew = %d, want %d", c.total, uint64(1<<32+3000))
	}
	// A reset, from below 2^31, or a restart starts over at the counter.
	c.rate(500, now.Add(3*time.Second), false)
	if c.total != 500 {
		t.Errorf("total after a reset = %d, want 500", c.total)
	}
	c.rate(800, now.Add(4*time.Second), true)
	if c.total != 800 {
		t.Errorf("total after a restart = %d, want 800", c.total)
	}
}

func TestASpeedTooLowOnlyTellsAWrapFromAReset(t *testing.T) {
	// A bridge that reports 10 Mbit/s carries 100 Mbit/s.
	c := counter{limit: 10e6 / 8 * 2}
	now := time.Now()
	c.rate(1<<32-200_000_000, now, false)
	if rate, ok := c.rate(1<<32-75_000_000, now.Add(10*time.Second), false); !ok || rate != 12_500_000 {
		t.Errorf("growth faster than the speed: got %v, %v", rate, ok)
	}
	// It wraps as fast as before: a wrap, not a reset.
	if rate, ok := c.rate(50_000_000, now.Add(20*time.Second), false); !ok || rate != 12_500_000 {
		t.Errorf("wrap as fast as before: got %v, %v", rate, ok)
	}
	if c.total != 1<<32+50_000_000 {
		t.Errorf("total = %d, want %d", c.total, uint64(1<<32+50_000_000))
	}
}
