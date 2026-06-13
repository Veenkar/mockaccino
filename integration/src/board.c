#include "board.h"

void board_init(Board *board, int width, int height)
{
    if (width < 1) {
        width = 1;
    }
    if (height < 1) {
        height = 1;
    }
    if (width > BOARD_MAX_WIDTH) {
        width = BOARD_MAX_WIDTH;
    }
    if (height > BOARD_MAX_HEIGHT) {
        height = BOARD_MAX_HEIGHT;
    }
    board->width = width;
    board->height = height;
    board_clear(board);
}

void board_clear(Board *board)
{
    for (int y = 0; y < BOARD_MAX_HEIGHT; ++y) {
        for (int x = 0; x < BOARD_MAX_WIDTH; ++x) {
            board->cells[y][x] = 0;
        }
    }
}

int board_get(const Board *board, int x, int y)
{
    if (x < 0 || y < 0 || x >= board->width || y >= board->height) {
        return 0;
    }
    return board->cells[y][x] ? 1 : 0;
}

void board_set(Board *board, int x, int y, int alive)
{
    if (x < 0 || y < 0 || x >= board->width || y >= board->height) {
        return;
    }
    board->cells[y][x] = (unsigned char)(alive ? 1 : 0);
}

/* Counts the eight neighbours of (x, y) on a toroidal (wrapping) board. */
int board_count_neighbors(const Board *board, int x, int y)
{
    int count = 0;
    for (int dy = -1; dy <= 1; ++dy) {
        for (int dx = -1; dx <= 1; ++dx) {
            if (dx == 0 && dy == 0) {
                continue;
            }
            int nx = (x + dx + board->width) % board->width;
            int ny = (y + dy + board->height) % board->height;
            count += board->cells[ny][nx] ? 1 : 0;
        }
    }
    return count;
}

void board_step(const Board *current, Board *next)
{
    next->width = current->width;
    next->height = current->height;
    for (int y = 0; y < current->height; ++y) {
        for (int x = 0; x < current->width; ++x) {
            int neighbors = board_count_neighbors(current, x, y);
            int alive = current->cells[y][x] ? 1 : 0;
            int born = (neighbors == 3) || (alive && neighbors == 2);
            next->cells[y][x] = (unsigned char)(born ? 1 : 0);
        }
    }
}

int board_population(const Board *board)
{
    int count = 0;
    for (int y = 0; y < board->height; ++y) {
        for (int x = 0; x < board->width; ++x) {
            count += board->cells[y][x] ? 1 : 0;
        }
    }
    return count;
}
