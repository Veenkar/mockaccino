#include <stdio.h>
#define FUNC(type, modifier, mem) \
    modifier type

typedef struct 
{
    int x;
} SomeType_T;

int dummy(const SomeType_T argc, char argv[]);
void dummy2(const SomeType_T argc, char argv[]);
dummy3(const SomeType_T argc, char argv[]);
int * dummy4(const SomeType_T argc, char argv[]);

FUNC(int, const, RAM) main2(const int argc, char argv[]);
