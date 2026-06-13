#ifndef DISPLAY_H
#define DISPLAY_H

/* Console rendering backend. In the real game this draws to the terminal;
   in the unit tests it is replaced by a Mockaccino-generated gmock.

   The signatures here are deliberately varied so the generated mock exercises
   several of Mockaccino's parsing/stringify paths:
     - void return, void args
     - void return, several scalar args
     - non-void scalar return, no args
     - pointer (const char *) return
     - struct-by-value argument
     - int + const-pointer arguments */

typedef struct {
    int origin_x;
    int origin_y;
} DisplayViewport;

void display_init(void);
void display_shutdown(void);
void display_clear(void);
void display_draw_cell(int x, int y, int alive);
void display_present(void);
const char *display_backend_name(void);
void display_set_viewport(DisplayViewport viewport);
void display_draw_row(int y, const char *row);
int display_width(void);

#endif /* DISPLAY_H */
