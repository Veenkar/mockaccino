#include "rng.h"

#include <stdlib.h>

void rng_seed(unsigned int seed)
{
    srand(seed);
}

unsigned int rng_next(void)
{
    return (unsigned int)rand();
}

int rng_range(int lo, int hi)
{
    if (hi <= lo) {
        return lo;
    }
    return lo + (int)(rng_next() % (unsigned int)(hi - lo + 1));
}
