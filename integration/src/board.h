#ifndef BOARD_H
#define BOARD_H

/* Conway's Game of Life board. Pure logic, no I/O — this is the
   "code under test" that is compiled for real (never mocked). */

#define BOARD_MAX_WIDTH  256
#define BOARD_MAX_HEIGHT 256

typedef struct {
    int width;
    int height;
    unsigned char cells[BOARD_MAX_HEIGHT][BOARD_MAX_WIDTH];
} Board;

void board_init(Board *board, int width, int height);
void board_clear(Board *board);
int  board_get(const Board *board, int x, int y);
void board_set(Board *board, int x, int y, int alive);
int  board_count_neighbors(const Board *board, int x, int y);
void board_step(const Board *current, Board *next);
int  board_population(const Board *board);

#endif /* BOARD_H */
