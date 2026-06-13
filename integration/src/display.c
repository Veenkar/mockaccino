#include "display.h"

#include <stdio.h>
#include <string.h>

/* A tiny double-buffered ANSI console renderer used by the real game binary.
   The unit tests never link this file — the generated display_mock.cc provides
   the C-linkage definitions instead. */

#define DISPLAY_BUFFER_W 256
#define DISPLAY_BUFFER_H 256

static char g_frame[DISPLAY_BUFFER_H][DISPLAY_BUFFER_W];
static int g_max_x;
static int g_max_y;
static DisplayViewport g_viewport;

void display_init(void)
{
    g_viewport.origin_x = 0;
    g_viewport.origin_y = 0;
    display_clear();
    fputs("\033[2J", stdout); /* clear the terminal once on start */
    fflush(stdout);
}

void display_shutdown(void)
{
    fputc('\n', stdout);
    fflush(stdout);
}

void display_clear(void)
{
    memset(g_frame, ' ', sizeof(g_frame));
    g_max_x = 0;
    g_max_y = 0;
}

void display_draw_cell(int x, int y, int alive)
{
    x += g_viewport.origin_x;
    y += g_viewport.origin_y;
    if (x < 0 || y < 0 || x >= DISPLAY_BUFFER_W || y >= DISPLAY_BUFFER_H) {
        return;
    }
    g_frame[y][x] = alive ? '#' : ' ';
    if (x > g_max_x) {
        g_max_x = x;
    }
    if (y > g_max_y) {
        g_max_y = y;
    }
}

void display_present(void)
{
    fputs("\033[H", stdout); /* move cursor home, draw over the previous frame */
    for (int y = 0; y <= g_max_y; ++y) {
        fwrite(g_frame[y], 1, (size_t)(g_max_x + 1), stdout);
        fputc('\n', stdout);
    }
    fflush(stdout);
}

const char *display_backend_name(void)
{
    return "ansi-console";
}

void display_set_viewport(DisplayViewport viewport)
{
    g_viewport = viewport;
}

void display_draw_row(int y, const char *row)
{
    if (row == NULL) {
        return;
    }
    for (int x = 0; row[x] != '\0'; ++x) {
        display_draw_cell(x, y, row[x] != ' ');
    }
}

int display_width(void)
{
    return g_max_x + 1;
}
