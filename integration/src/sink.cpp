#include "sink.hpp"

namespace metrics {

int run_pipeline(ISink& sink, const int* values, int count) {
    for (int i = 0; i < count; ++i) {
        sink.publish(values[i]);
    }
    return sink.total();
}

}  // namespace metrics
