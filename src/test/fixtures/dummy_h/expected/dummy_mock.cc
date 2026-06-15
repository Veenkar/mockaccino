/*===========================================================================*
 * dummy mock generated with:
 *
 *  _____ ______   ________  ________  ___  __    ________
 * |\   _ \  _   \|\   __  \|\   ____\|\  \|\  \ |\   __  \
 * \ \  \\\__\ \  \ \  \|\  \ \  \___|\ \  \/  /|\ \  \|\  \
 *  \ \  \\|__| \  \ \  \\\  \ \  \    \ \   ___  \ \   __  \
 *   \ \  \    \ \  \ \  \\\  \ \  \____\ \  \\ \  \ \  \ \  \
 *    \ \__\    \ \__\ \_______\ \_______\ \__\\ \__\ \__\ \__\
 *     \|__|     \|__|\|_______|\|_______|\|__| \|__|\|__|\|__|
 *                        ________  ________  ___  ________   ________
 *                       |\   ____\|\   ____\|\  \|\   ___  \|\   __  \
 *                       \ \  \___|\ \  \___|\ \  \ \  \\ \  \ \  \|\  \
 *                        \ \  \    \ \  \    \ \  \ \  \\ \  \ \  \\\  \
 *                         \ \  \____\ \  \____\ \  \ \  \\ \  \ \  \\\  \
 *                          \ \_______\ \_______\ \__\ \__\\ \__\ \_______\
 *                           \|_______|\|_______|\|__|\|__| \|__|\|_______|
 *                              by SelerLabs
 */
/**
 * DESCRIPTION:
 * Mock code for dummy.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v1.10.1
 * INPUT: dummy.h
 * TIME: 2026-06-13 19:13:15
 *
 * COPYRIGHT:
 * Copyright (c) 2026 [INPUT FILE OWNER]. All rights reserved.
 *
 * WARNING:
 * PLEASE REPLACE COPYRIGHT STATEMENT IN MOCKACCINO SETTINGS!
 *
 * WARNING:
 * THIS IS AN AUTOMATICALLY GENERATED FILE.
 * Editing it manually might result in loss of changes.
 **/

/*===========================================================================*
 * Include headers
 *===========================================================================*/
#include <cassert>
#include "dummy_mock.h"

/*===========================================================================*
 * Define macros
 *===========================================================================*/
#define DUMMY_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	"No mock instance found when calling mocked function. " \
	"Instantiate mock first!"

#define DUMMY_MOCK_ASSERT_NO_INSTANCE_WARN \
	"Mock instance already exists!"

/*===========================================================================*
 * Function-like macros
 *===========================================================================*/
#define DUMMY_MOCK_ASSERT(exp, msg) \
	assert((static_cast<void>("Dummy_Mock: " msg), exp))

#define DUMMY_MOCK_ASSERT_INSTANCE_EXISTS() \
	DUMMY_MOCK_ASSERT( \
		(nullptr != dummy_mock_), \
		DUMMY_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	)

#define DUMMY_MOCK_ASSERT_NO_INSTANCE() \
	DUMMY_MOCK_ASSERT( \
		(nullptr == dummy_mock_), \
		DUMMY_MOCK_ASSERT_NO_INSTANCE_WARN \
	)

/*===========================================================================*
 * Object definitions
 *===========================================================================*/
static Dummy_Mock * dummy_mock_ = nullptr;

/*===========================================================================*
 * Constructor and Destructor
 *===========================================================================*/
Dummy_Mock::Dummy_Mock()
{
	DUMMY_MOCK_ASSERT_NO_INSTANCE();
	dummy_mock_ = this;
}

Dummy_Mock::~Dummy_Mock()
{
	dummy_mock_ = nullptr;
}

/*===========================================================================*
 * Mocked function implementations
 *===========================================================================*/
int dummy(const SomeType_T argc, char argv[])
{
	DUMMY_MOCK_ASSERT_INSTANCE_EXISTS();
	return dummy_mock_->dummy(argc, argv);
}

void dummy2(const SomeType_T argc, char argv[])
{
	DUMMY_MOCK_ASSERT_INSTANCE_EXISTS();
	return dummy_mock_->dummy2(argc, argv);
}

int dummy3(const SomeType_T argc, char argv[])
{
	DUMMY_MOCK_ASSERT_INSTANCE_EXISTS();
	return dummy_mock_->dummy3(argc, argv);
}

int * dummy4(const SomeType_T argc, char argv[])
{
	DUMMY_MOCK_ASSERT_INSTANCE_EXISTS();
	return dummy_mock_->dummy4(argc, argv);
}

const int main2(const int argc, char argv[])
{
	DUMMY_MOCK_ASSERT_INSTANCE_EXISTS();
	return dummy_mock_->main2(argc, argv);
}

/*===========================================================================*/
/**
 * DESCRIPTION:
 * Mock code for dummy.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v1.10.1
 * INPUT: dummy.h
 * TIME: 2026-06-13 19:13:15
 *
 * WARNING:
 * THIS IS AN AUTOMATICALLY GENERATED FILE.
 * Editing it manually might result in loss of changes.
 *
 * The Mockaccino extension can be found at:
 * MARKETPLACE:
 * https://marketplace.visualstudio.com/items?itemName=SelerLabs.mockaccino
 *
 * GITHUB:
 * https://github.com/Veenkar/mockaccino
 *
 *===========================================================================*/
