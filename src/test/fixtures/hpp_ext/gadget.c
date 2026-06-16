/* Fixture for the mockHeaderExtension=hpp setting: a plain C source whose mock
   header must be emitted as gadget_mock.hpp (with a _HPP include guard) and whose
   gadget_mock.cc must #include that .hpp. See config.json. */

int gadget_add(int a, int b)
{
    return a + b;
}

void gadget_reset(void)
{
}
