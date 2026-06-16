/*===========================================================================*
 * gadget mock generated with:
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
 * Mock code for gadget.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v2.0.2
 * INPUT: gadget.c
 * TIME: 2026-06-17 00:23:38
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
#include "gadget_mock.hpp"

/*===========================================================================*
 * Define macros
 *===========================================================================*/
#define GADGET_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	"No mock instance found when calling mocked function. " \
	"Instantiate mock first!"

#define GADGET_MOCK_ASSERT_NO_INSTANCE_WARN \
	"Mock instance already exists!"

/*===========================================================================*
 * Function-like macros
 *===========================================================================*/
#define GADGET_MOCK_ASSERT(exp, msg) \
	assert((static_cast<void>("Gadget_Mock: " msg), exp))

#define GADGET_MOCK_ASSERT_INSTANCE_EXISTS() \
	GADGET_MOCK_ASSERT( \
		(nullptr != gadget_mock_), \
		GADGET_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	)

#define GADGET_MOCK_ASSERT_NO_INSTANCE() \
	GADGET_MOCK_ASSERT( \
		(nullptr == gadget_mock_), \
		GADGET_MOCK_ASSERT_NO_INSTANCE_WARN \
	)

/*===========================================================================*
 * Object definitions
 *===========================================================================*/
static Gadget_Mock * gadget_mock_ = nullptr;

/*===========================================================================*
 * Constructor and Destructor
 *===========================================================================*/
Gadget_Mock::Gadget_Mock()
{
	GADGET_MOCK_ASSERT_NO_INSTANCE();
	gadget_mock_ = this;
}

Gadget_Mock::~Gadget_Mock()
{
	gadget_mock_ = nullptr;
}

/*===========================================================================*
 * Mocked function implementations
 *===========================================================================*/
int gadget_add(int a, int b)
{
	GADGET_MOCK_ASSERT_INSTANCE_EXISTS();
	return gadget_mock_->gadget_add(a, b);
}

void gadget_reset()
{
	GADGET_MOCK_ASSERT_INSTANCE_EXISTS();
	return gadget_mock_->gadget_reset();
}

/*===========================================================================*/
/**
 * DESCRIPTION:
 * Mock code for gadget.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v2.0.2
 * INPUT: gadget.c
 * TIME: 2026-06-17 00:23:38
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
