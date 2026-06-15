#ifndef IFACE_HPP
#define IFACE_HPP

namespace app {

// Abstract interface -> mocked by default.
class Sensor {
public:
    virtual ~Sensor() = default;
    virtual int read() const = 0;
    virtual void calibrate(double factor) = 0;
};

// Nested inside a struct inside a namespace -> fully-qualified mock.
struct Devices {
    class IClock {
    public:
        virtual unsigned long now() noexcept = 0;
        virtual void reset() = 0;
    };
};

// Concrete-with-virtual whose name contains "interface": NOT mocked under the
// defaults (name matching is off — cpp.interfaceNamePatterns is empty by default).
class WidgetInterface {
public:
    virtual void draw(int x, int y);
    void flush();
};

// Concrete-with-virtual, non-abstract -> NOT mocked under the defaults.
class Logger {
public:
    virtual void log(const char* msg);
};

}  // namespace app

#endif /* IFACE_HPP */
