#ifndef ENGINE_H
#define ENGINE_H

#include "board.h"

/* Glue between the pure board logic and its I/O dependencies (display, rng).
   Compiled for real in both the game and the tests; in the tests its calls to
   display_* / rng_* are satisfied by the generated mocks. */

void engine_render(const Board *board);
void engine_randomize(Board *board, unsigned int seed);
void engine_run(Board *board, int generations, int delay_ms);

#endif /* ENGINE_H */
