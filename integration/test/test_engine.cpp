#include <gmock/gmock.h>

// Mockaccino-generated mocks. These declare the Display_Mock / Rng_Mock gmock
// classes and (via the matching .cc files) provide the C-linkage definitions of
// display_* / rng_*, replacing the real display.c / rng.c in this binary.
#include "display_mock.h"
#include "rng_mock.h"

extern "C" {
#include "board.h"
#include "engine.h"
}

using ::testing::_;
using ::testing::AnyNumber;
using ::testing::InSequence;
using ::testing::Return;

// engine_render must clear, draw every cell, then present — in that order.
TEST(EngineRenderTest, ClearsDrawsEveryCellThenPresents)
{
    Display_Mock display;
    Board board;
    board_init(&board, 3, 2);

    InSequence seq;
    EXPECT_CALL(display, display_clear());
    EXPECT_CALL(display, display_draw_cell(_, _, _)).Times(6); // 3 x 2 cells
    EXPECT_CALL(display, display_present());

    engine_render(&board);
}

// The alive flag for a specific coordinate is forwarded faithfully.
TEST(EngineRenderTest, ForwardsAliveFlagForLiveCell)
{
    Display_Mock display;
    Board board;
    board_init(&board, 3, 3);
    board_set(&board, 2, 1, 1);

    EXPECT_CALL(display, display_clear());
    EXPECT_CALL(display, display_present());
    EXPECT_CALL(display, display_draw_cell(_, _, _)).Times(AnyNumber());
    EXPECT_CALL(display, display_draw_cell(2, 1, 1)).Times(1);

    engine_render(&board);
}

// engine_randomize seeds the rng and fills the board from its bit stream,
// iterating row-major (x inner, y outer).
TEST(EngineRandomizeTest, SeedsRngAndFillsBoardFromStream)
{
    Rng_Mock rng;
    Board board;
    board_init(&board, 2, 2);

    EXPECT_CALL(rng, rng_seed(4242u));
    EXPECT_CALL(rng, rng_next())
        .WillOnce(Return(1u))  // (0,0) odd  -> alive
        .WillOnce(Return(2u))  // (1,0) even -> dead
        .WillOnce(Return(7u))  // (0,1) odd  -> alive
        .WillOnce(Return(0u)); // (1,1) even -> dead

    engine_randomize(&board, 4242u);

    EXPECT_EQ(board_get(&board, 0, 0), 1);
    EXPECT_EQ(board_get(&board, 1, 0), 0);
    EXPECT_EQ(board_get(&board, 0, 1), 1);
    EXPECT_EQ(board_get(&board, 1, 1), 0);
    EXPECT_EQ(board_population(&board), 2);
}
