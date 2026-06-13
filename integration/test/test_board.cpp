#include <gtest/gtest.h>

extern "C" {
#include "board.h"
}

// Pure-logic tests for the Game of Life rules. No mocks here — board.c is the
// real code under test. These guard the behaviour the mocked tests rely on.

TEST(BoardTest, GetAndSetRoundTrip)
{
    Board board;
    board_init(&board, 8, 8);
    EXPECT_EQ(board_get(&board, 3, 4), 0);
    board_set(&board, 3, 4, 1);
    EXPECT_EQ(board_get(&board, 3, 4), 1);
    board_set(&board, 3, 4, 0);
    EXPECT_EQ(board_get(&board, 3, 4), 0);
}

TEST(BoardTest, OutOfRangeReadsAreDeadAndWritesIgnored)
{
    Board board;
    board_init(&board, 5, 5);
    EXPECT_EQ(board_get(&board, -1, 0), 0);
    EXPECT_EQ(board_get(&board, 5, 0), 0);
    board_set(&board, 99, 99, 1); // must not crash or corrupt
    EXPECT_EQ(board_population(&board), 0);
}

TEST(BoardTest, CountsNeighborsWithToroidalWrap)
{
    Board board;
    board_init(&board, 5, 5);
    board_set(&board, 1, 1, 1);
    board_set(&board, 2, 1, 1);
    board_set(&board, 1, 2, 1);
    EXPECT_EQ(board_count_neighbors(&board, 2, 2), 3);

    // A live corner sees its wrapped neighbours on the opposite edges.
    Board edge;
    board_init(&edge, 3, 3);
    board_set(&edge, 2, 2, 1);
    EXPECT_EQ(board_count_neighbors(&edge, 0, 0), 1);
}

TEST(BoardTest, BlinkerOscillates)
{
    Board a;
    Board b;
    board_init(&a, 5, 5);
    board_init(&b, 5, 5);

    // Vertical blinker centred at column 2.
    board_set(&a, 2, 1, 1);
    board_set(&a, 2, 2, 1);
    board_set(&a, 2, 3, 1);

    board_step(&a, &b);

    // After one step it becomes a horizontal bar on row 2.
    EXPECT_EQ(board_population(&b), 3);
    EXPECT_EQ(board_get(&b, 1, 2), 1);
    EXPECT_EQ(board_get(&b, 2, 2), 1);
    EXPECT_EQ(board_get(&b, 3, 2), 1);
    EXPECT_EQ(board_get(&b, 2, 1), 0);
    EXPECT_EQ(board_get(&b, 2, 3), 0);

    // And back again.
    board_step(&b, &a);
    EXPECT_EQ(board_get(&a, 2, 1), 1);
    EXPECT_EQ(board_get(&a, 2, 2), 1);
    EXPECT_EQ(board_get(&a, 2, 3), 1);
}

TEST(BoardTest, BlockIsStillLife)
{
    Board a;
    Board b;
    board_init(&a, 6, 6);
    board_init(&b, 6, 6);

    board_set(&a, 1, 1, 1);
    board_set(&a, 2, 1, 1);
    board_set(&a, 1, 2, 1);
    board_set(&a, 2, 2, 1);

    board_step(&a, &b);

    EXPECT_EQ(board_population(&b), 4);
    EXPECT_EQ(board_get(&b, 1, 1), 1);
    EXPECT_EQ(board_get(&b, 2, 1), 1);
    EXPECT_EQ(board_get(&b, 1, 2), 1);
    EXPECT_EQ(board_get(&b, 2, 2), 1);
}
