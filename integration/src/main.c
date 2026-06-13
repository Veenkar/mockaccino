#include "board.h"
#include "engine.h"
#include "display.h"

#include <stdlib.h>

/* Console Game of Life entry point.

   Usage: game_of_life [generations] [delay_ms]
   Defaults run a glider across a 20x12 board for 16 generations. With a delay
   of 0 it renders every frame back-to-back and exits, which is what the
   integration harness uses to prove the real binary compiles and runs. */

static void seed_glider(Board *board)
{
    board_set(board, 1, 0, 1);
    board_set(board, 2, 1, 1);
    board_set(board, 0, 2, 1);
    board_set(board, 1, 2, 1);
    board_set(board, 2, 2, 1);
}

int main(int argc, char **argv)
{
    int generations = (argc > 1) ? atoi(argv[1]) : 16;
    int delay_ms = (argc > 2) ? atoi(argv[2]) : 100;

    Board board;
    board_init(&board, 20, 12);
    seed_glider(&board);

    display_init();
    display_set_viewport((DisplayViewport){ .origin_x = 0, .origin_y = 0 });
    engine_run(&board, generations, delay_ms);
    display_shutdown();

    return 0;
}
