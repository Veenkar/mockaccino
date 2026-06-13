#include <gtest/gtest.h>
#include <string>

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

// Each stub also logs a trace line via <STUB>_PRINT_INFO() (std::cout). That is
// runtime behaviour, so it is checked here by capturing stdout — naming the
// stubbed function plus a "stub called" / "Stub location:" marker.

TEST(DisplayStubLog, VoidStubLogsTraceLineNamingTheFunction)
{
    testing::internal::CaptureStdout();
    display_clear();
    const std::string out = testing::internal::GetCapturedStdout();
    EXPECT_NE(out.find("display_clear"), std::string::npos) << out;
    EXPECT_NE(out.find("stub called"), std::string::npos) << out;
    EXPECT_NE(out.find("Stub location:"), std::string::npos) << out;
}

TEST(RngStubLog, NonVoidStubLogsBeforeReturningTheSafeDefault)
{
    testing::internal::CaptureStdout();
    const unsigned int value = rng_next();   // value stub: logs, then returns 0
    const std::string out = testing::internal::GetCapturedStdout();
    EXPECT_EQ(value, 0u);
    EXPECT_NE(out.find("rng_next"), std::string::npos) << out;
    EXPECT_NE(out.find("stub called"), std::string::npos) << out;
}
