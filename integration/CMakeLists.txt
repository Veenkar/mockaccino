cmake_minimum_required(VERSION 3.20)
project(mockaccino_integration LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(SRC_DIR ${CMAKE_CURRENT_SOURCE_DIR}/src)
set(TEST_DIR ${CMAKE_CURRENT_SOURCE_DIR}/test)
set(GEN_DIR ${CMAKE_CURRENT_SOURCE_DIR}/generated)
set(GEN_CLANG_DIR ${CMAKE_CURRENT_SOURCE_DIR}/generated_clang)

# The mocks are produced by Mockaccino (both backends) before CMake runs (see
# run.js). Fail early with a clear message if generation was skipped.
foreach(dir ${GEN_DIR} ${GEN_CLANG_DIR})
    foreach(f display_mock.h display_mock.cc rng_mock.h rng_mock.cc display_stub.cc rng_stub.cc sink_mock.h)
        if(NOT EXISTS ${dir}/${f})
            message(FATAL_ERROR
                "Generated mock '${f}' not found in ${dir}.\n"
                "Generate the mocks first:  node integration/run.js  (or npm run test:integration)")
        endif()
    endforeach()
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

# --- Per-backend test targets -------------------------------------------------
# The same test sources are built against EACH backend's generated mocks/stubs,
# so both backends must produce interchangeable output (same class names, same
# MOCK_METHOD signatures, same C-linkage symbols). ctest names are prefixed with
# the backend, e.g. "regex.EngineRenderTest.*" and "clang.EngineRenderTest.*".
enable_testing()
include(GoogleTest)

function(add_backend_tests backend gen_dir)
    # Unit tests: generated mocks replace the real display.c / rng.c; interactions
    # are verified via EXPECT_CALL.
    add_executable(unit_tests_${backend}
        ${TEST_DIR}/test_board.cpp
        ${TEST_DIR}/test_engine.cpp
        ${SRC_DIR}/board.c
        ${SRC_DIR}/engine.c
        ${gen_dir}/display_mock.cc
        ${gen_dir}/rng_mock.cc
    )
    target_include_directories(unit_tests_${backend} PRIVATE ${SRC_DIR} ${gen_dir})
    target_link_libraries(unit_tests_${backend} PRIVATE gmock gmock_main)

    # Stub tests: generated *_stub.cc (no gmock). A separate binary because a stub
    # and mock can't define the same symbol together. Prove the stub links,
    # returns the safe defaults, and logs its trace line.
    add_executable(stub_tests_${backend}
        ${TEST_DIR}/test_stub.cpp
        ${gen_dir}/display_stub.cc
        ${gen_dir}/rng_stub.cc
    )
    target_include_directories(stub_tests_${backend} PRIVATE ${SRC_DIR} ${gen_dir})
    target_link_libraries(stub_tests_${backend} PRIVATE gtest_main)

    # Mock assertion (death) tests: the generated mock's assert() guards are
    # NDEBUG-gated, so force assertions on (-UNDEBUG / MSVC /UNDEBUG) and use gtest
    # death tests to prove they abort. test_mock_asserts.cpp provides its own main.
    add_executable(mock_assert_tests_${backend}
        ${TEST_DIR}/test_mock_asserts.cpp
        ${gen_dir}/display_mock.cc
    )
    target_include_directories(mock_assert_tests_${backend} PRIVATE ${SRC_DIR} ${gen_dir})
    target_link_libraries(mock_assert_tests_${backend} PRIVATE gmock)
    target_compile_options(mock_assert_tests_${backend} PRIVATE
        $<$<CXX_COMPILER_ID:MSVC>:/UNDEBUG>
        $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-UNDEBUG>
    )

    # C++ class-mock tests: the generated sink_mock.h (a gmock class deriving from
    # metrics::ISink) is driven via EXPECT_CALL against the real consumer sink.cpp.
    add_executable(cpp_mock_tests_${backend}
        ${TEST_DIR}/test_cpp_mock.cpp
        ${SRC_DIR}/sink.cpp
    )
    target_include_directories(cpp_mock_tests_${backend} PRIVATE ${SRC_DIR} ${gen_dir})
    target_link_libraries(cpp_mock_tests_${backend} PRIVATE gmock gmock_main)

    gtest_discover_tests(unit_tests_${backend} TEST_PREFIX "${backend}.")
    gtest_discover_tests(stub_tests_${backend} TEST_PREFIX "${backend}.")
    gtest_discover_tests(mock_assert_tests_${backend} TEST_PREFIX "${backend}.")
    gtest_discover_tests(cpp_mock_tests_${backend} TEST_PREFIX "${backend}.")
endfunction()

add_backend_tests(regex ${GEN_DIR})
add_backend_tests(clang ${GEN_CLANG_DIR})
