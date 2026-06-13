#include <gtest/gtest.h>

extern "C" {
#include "display.h"
#include "rng.h"
}

// The stubbed functions are provided by the Mockaccino-generated display_stub.cc
// and rng_stub.cc (linked into this binary instead of the real display.c / rng.c).
//
// Unlike the mock tests, there are no interactions to verify: a stub *replaces* a
// dependency you don't want to run. These tests prove the stub output compiles,
// links, and returns the documented safe defaults — static_cast<T>(0) for scalars,
// nullptr for pointers, and nothing for void (the call simply runs).

TEST(RngStub, ReturnsZeroDefaults)
{
    rng_seed(7u);                   // void stub: must link and run, returns nothing
    EXPECT_EQ(rng_next(), 0u);      // static_cast<unsigned int>(0)
    EXPECT_EQ(rng_range(5, 10), 0); // static_cast<int>(0)
}

TEST(DisplayStub, RunsVoidStubsAndReturnsZeroDefaults)
{
    // All of these are void stubs; the point is that they link and run.
    display_init();
    display_clear();
    display_draw_cell(1, 2, 1);
    display_present();
    display_draw_row(0, "##  ");

    DisplayViewport viewport;
    viewport.origin_x = 3;
    viewport.origin_y = 4;
    display_set_viewport(viewport); // struct-by-value arg stub

    display_shutdown();

    EXPECT_EQ(display_width(), 0);               // static_cast<int>(0)
    EXPECT_EQ(display_backend_name(), nullptr);  // pointer return stub -> nullptr
}
