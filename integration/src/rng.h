#ifndef RNG_H
#define RNG_H

/* Random number source. Mocked in the unit tests so board seeding is
   deterministic. Covers unsigned args/returns and a multi-arg int function. */

void rng_seed(unsigned int seed);
unsigned int rng_next(void);
int rng_range(int lo, int hi);

#endif /* RNG_H */
