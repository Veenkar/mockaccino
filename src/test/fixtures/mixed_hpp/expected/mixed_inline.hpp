#ifndef MIXED_HPP
#define MIXED_HPP

#include <cstddef>

/* C-style free functions: mocked the classic way (_mock.h/.cc) and stubbable
   (_stub.cc). Wrapped in extern "C" as a real mixed header would be. */
extern "C" {

int compute_checksum(const char *data, unsigned long len);
void reset_counters(void);
double scale_value(double value, int factor);

}

namespace telemetry {

/* Abstract interface: gmock class mock (_mock.hpp) alongside the C output. */
class ITransport {
public:
    virtual ~ITransport() = default;
    virtual bool send(const char *payload, unsigned long len) = 0;
    virtual int poll() const = 0;
};

/* Concrete, non-abstract class: NOT mocked under the defaults. */
class NullTransport {
public:
    void noop();
};

}  // namespace telemetry


// >>> MOCKACCINO INLINE MOCKS (generated; re-run to regenerate) >>>
#ifdef MOCKACCINO_INLINE_MOCKS
#include <gmock/gmock.h>

class telemetry_ITransport_Mock : public telemetry::ITransport {
public:
	MOCK_METHOD(bool, send, (const char *, unsigned long), (override));
	MOCK_METHOD(int, poll, (), (const, override));
};

#endif  // MOCKACCINO_INLINE_MOCKS
// <<< MOCKACCINO INLINE MOCKS (end) <<<

#endif /* MIXED_HPP */
