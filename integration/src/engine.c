#include "engine.h"

#include "display.h"
#include "rng.h"

#ifdef _WIN32
#include <windows.h>
static void engine_sleep_ms(int ms)
{
    Sleep((DWORD)ms);
}
#else
#include <time.h>
static void engine_sleep_ms(int ms)
{
    struct timespec ts;
    ts.tv_sec = ms / 1000;
    ts.tv_nsec = (long)(ms % 1000) * 1000000L;
    nanosleep(&ts, NULL);
}
#endif

void engine_render(const Board *board)
{
    display_clear();
    for (int y = 0; y < board->height; ++y) {
        for (int x = 0; x < board->width; ++x) {
            display_draw_cell(x, y, board_get(board, x, y));
        }
    }
    display_present();
}

void engine_randomize(Board *board, unsigned int seed)
{
    rng_seed(seed);
    for (int y = 0; y < board->height; ++y) {
        for (int x = 0; x < board->width; ++x) {
            board_set(board, x, y, (int)(rng_next() & 1u));
        }
    }
}

void engine_run(Board *board, int generations, int delay_ms)
{
    Board scratch;
    for (int g = 0; g < generations; ++g) {
        engine_render(board);
        board_step(board, &scratch);
        *board = scratch;
        if (delay_ms > 0) {
            engine_sleep_ms(delay_ms);
        }
    }
    engine_render(board); /* final frame */
}
