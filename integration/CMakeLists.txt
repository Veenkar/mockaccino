cmake_minimum_required(VERSION 3.20)
project(mockaccino_integration LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(SRC_DIR ${CMAKE_CURRENT_SOURCE_DIR}/src)
set(GEN_DIR ${CMAKE_CURRENT_SOURCE_DIR}/generated)

# The mocks are produced by Mockaccino before CMake runs (see run.js). Fail
# early with a clear message if generation was skipped.
foreach(f display_mock.h display_mock.cc rng_mock.h rng_mock.cc)
    if(NOT EXISTS ${GEN_DIR}/${f})
        message(FATAL_ERROR
            "Generated mock '${f}' not found in ${GEN_DIR}.\n"
            "Generate the mocks first:  node integration/run.js  (or npm run test:integration)")
    endif()
endforeach()

# --- GoogleTest / gmock via FetchContent --------------------------------------
include(FetchContent)
FetchContent_Declare(
    googletest
    URL https://github.com/google/googletest/archive/refs/tags/v1.15.2.zip
)
# Keep the CRT consistent with the rest of the build on Windows.
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

# --- The real console game (real display + rng) -------------------------------
add_executable(game_of_life
    ${SRC_DIR}/main.c
    ${SRC_DIR}/board.c
    ${SRC_DIR}/engine.c
    ${SRC_DIR}/display.c
    ${SRC_DIR}/rng.c
)
target_include_directories(game_of_life PRIVATE ${SRC_DIR})

# --- Unit tests (Mockaccino-generated mocks instead of display.c / rng.c) ------
enable_testing()
add_executable(unit_tests
    ${CMAKE_CURRENT_SOURCE_DIR}/test/test_board.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/test/test_engine.cpp
    ${SRC_DIR}/board.c
    ${SRC_DIR}/engine.c
    ${GEN_DIR}/display_mock.cc
    ${GEN_DIR}/rng_mock.cc
)
target_include_directories(unit_tests PRIVATE ${SRC_DIR} ${GEN_DIR})
target_link_libraries(unit_tests PRIVATE gmock gmock_main)

include(GoogleTest)
gtest_discover_tests(unit_tests)
