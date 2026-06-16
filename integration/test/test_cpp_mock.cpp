// Proves the generated C++ class mock (sink_mock.h) compiles and works with gmock:
// the mock derives from metrics::ISink (fully-qualified, flat name
// metrics_ISink_Mock), EXPECT_CALLs verify interactions, and the real consumer
// run_pipeline drives it. Built once per backend, so regex and clang must emit an
// interchangeable mock (same class name + MOCK_METHOD signatures).

#include "sink_mock.h"

#include <gmock/gmock.h>
#include <gtest/gtest.h>

using ::testing::Return;

TEST(CppMockTest, RunPipelineDrivesTheMockedSink) {
    metrics_ISink_Mock sink;

    EXPECT_CALL(sink, publish(1));
    EXPECT_CALL(sink, publish(2));
    EXPECT_CALL(sink, publish(3));
    EXPECT_CALL(sink, total()).WillOnce(Return(6));

    const int values[] = {1, 2, 3};
    EXPECT_EQ(metrics::run_pipeline(sink, values, 3), 6);
}
