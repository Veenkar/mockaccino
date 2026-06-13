#include <stdio.h>
#define FUNC(type, modifier, mem) \
    modifier type

typedef struct 
{
    int x;
} SomeType_T;

static int * main1x(const SomeType_T argc, char argv[]);

FUNC(int, const, RAM) main2(const int argc, char argv[]);
