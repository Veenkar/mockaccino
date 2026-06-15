#ifndef SINK_HPP
#define SINK_HPP

/* A C++ interface (plus a small consumer) exercised by the C++ class-mock path of
   the integration suite. Mockaccino generates `sink_mock.hpp` from this with both
   backends; the test mocks ISink, sets EXPECT_CALLs, and drives run_pipeline. */

namespace metrics {

class ISink {
public:
    virtual ~ISink() = default;
    virtual void publish(int value) = 0;
    virtual int total() const = 0;
};

/* Real code under test: pushes each value into the sink, then reads the total. */
int run_pipeline(ISink& sink, const int* values, int count);

}  // namespace metrics

#endif /* SINK_HPP */
