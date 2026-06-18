// Proves the INLINE-generated mock compiles and works. Mockaccino's mockInline()
// injected the metrics_ISink_Mock class into a copy of sink.hpp (written to
// sink_inline.hpp), wrapped in `#ifdef MOCKACCINO_INLINE_MOCKS`. Defining that
// macro and including the rewritten header therefore yields both the interface
// and its gmock mock from a single file. Built once per backend, so the regex and
// clang inline output must be interchangeable (same class + MOCK_METHOD signatures).

#define MOCKACCINO_INLINE_MOCKS
#include "sink_inline.hpp"

#include <gmock/gmock.h>
#include <gtest/gtest.h>

using ::testing::Return;

TEST(CppInlineMockTest, InlineMockDrivesTheConsumer) {
    metrics_ISink_Mock sink;

    EXPECT_CALL(sink, publish(10));
    EXPECT_CALL(sink, publish(20));
    EXPECT_CALL(sink, total()).WillOnce(Return(30));

    const int values[] = {10, 20};
    EXPECT_EQ(metrics::run_pipeline(sink, values, 2), 30);
}
