#include <gmock/gmock.h>

// The Mockaccino-generated mock provides the Display_Mock class, the C-linkage
// display_* wrappers, and the runtime instance-presence asserts exercised here.
#include "display_mock.h"

#if defined(_WIN32)
#include <stdlib.h>
#endif

// Mockaccino guards the generated mock against misuse with assert():
//   - calling a mocked C function while no mock instance is alive, and
//   - constructing a second mock instance while one already exists.
// assert() is compiled out by NDEBUG, so the rest of the suite (Release) never
// exercises these. This target is built with assertions forced on (-UNDEBUG),
// and uses gtest death tests — a firing assert() calls abort() — to prove the
// guards actually fire. The happy path is checked too, confirming the asserts
// do NOT fire in correct use.

using ::testing::AnyNumber;

TEST(DisplayMockAsserts, CallingMockedFunctionWithoutInstanceAborts)
{
    // No Display_Mock is alive, so the wrapper's ASSERT_INSTANCE_EXISTS must
    // abort rather than dereference a null mock pointer.
    EXPECT_DEATH({ display_clear(); }, "");
}

TEST(DisplayMockAsserts, ConstructingASecondInstanceAborts)
{
    Display_Mock first;   // claims the single instance slot
    // A second instance trips ASSERT_NO_INSTANCE in the constructor.
    EXPECT_DEATH({ Display_Mock second; }, "");
}

TEST(DisplayMockAsserts, OneInstanceAndForwardedCallsPassTheAsserts)
{
    // Correct use: exactly one instance, and a forwarded call — both asserts
    // hold, so nothing aborts (the happy path Release builds compile out).
    Display_Mock display;
    EXPECT_CALL(display, display_clear()).Times(AnyNumber());
    display_clear();
}

int main(int argc, char** argv)
{
#if defined(_WIN32)
    // Route assert()/abort() to stderr without dialogs so death tests run
    // non-interactively.
    _set_error_mode(_OUT_TO_STDERR);
    _set_abort_behavior(0, _WRITE_ABORT_MSG | _CALL_REPORTFAULT);
#endif
    ::testing::InitGoogleMock(&argc, argv);
    return RUN_ALL_TESTS();
}
