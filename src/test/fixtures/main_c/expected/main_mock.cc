/*===========================================================================*
 * main mock generated with:
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
 * Mock code for main.
 *
 * GENERATOR: Mockaccino
 * VERSION: v1.10.1
 * INPUT: main.c
 * TIME: 2026-06-13 19:11:26
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
#include "main_mock.h"

/*===========================================================================*
 * Define macros
 *===========================================================================*/
#define MAIN_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	"No mock instance found when calling mocked function. " \
	"Instantiate mock first!"

#define MAIN_MOCK_ASSERT_NO_INSTANCE_WARN \
	"Mock instance already exists!"

/*===========================================================================*
 * Function-like macros
 *===========================================================================*/
#define MAIN_MOCK_ASSERT(exp, msg) \
	assert((static_cast<void>("Main_Mock: " msg), exp))

#define MAIN_MOCK_ASSERT_INSTANCE_EXISTS() \
	MAIN_MOCK_ASSERT( \
		(nullptr != main_mock_), \
		MAIN_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	)

#define MAIN_MOCK_ASSERT_NO_INSTANCE() \
	MAIN_MOCK_ASSERT( \
		(nullptr == main_mock_), \
		MAIN_MOCK_ASSERT_NO_INSTANCE_WARN \
	)

/*===========================================================================*
 * Object definitions
 *===========================================================================*/
static Main_Mock * main_mock_ = nullptr;

/*===========================================================================*
 * Constructor and Destructor
 *===========================================================================*/
Main_Mock::Main_Mock()
{
	MAIN_MOCK_ASSERT_NO_INSTANCE();
	main_mock_ = this;
}

Main_Mock::~Main_Mock()
{
	main_mock_ = nullptr;
}

/*===========================================================================*
 * Mocked function implementations
 *===========================================================================*/
float main2(const intx * const argc, char argv[])
{
	MAIN_MOCK_ASSERT_INSTANCE_EXISTS();
	return main_mock_->main2(argc, argv);
}

int implicitReturnTypeFunction(int arg)
{
	MAIN_MOCK_ASSERT_INSTANCE_EXISTS();
	return main_mock_->implicitReturnTypeFunction(arg);
}

/*===========================================================================*/
/**
 * DESCRIPTION:
 * Mock code for main.
 *
 * GENERATOR: Mockaccino
 * VERSION: v1.10.1
 * INPUT: main.c
 * TIME: 2026-06-13 19:11:26
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
