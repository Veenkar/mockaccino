/*===========================================================================*
 * ker mock generated with:
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
 * Mock code for ker.
 *
 * GENERATOR: Mockaccino
 * VERSION: v1.10.1
 * INPUT: ker.c
 * TIME: 2026-06-13 19:26:15
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
#include "ker_mock.h"

/*===========================================================================*
 * Define macros
 *===========================================================================*/
#define KER_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	"No mock instance found when calling mocked function. " \
	"Instantiate mock first!"

#define KER_MOCK_ASSERT_NO_INSTANCE_WARN \
	"Mock instance already exists!"

/*===========================================================================*
 * Function-like macros
 *===========================================================================*/
#define KER_MOCK_ASSERT(exp, msg) \
	assert((static_cast<void>("Ker_Mock: " msg), exp))

#define KER_MOCK_ASSERT_INSTANCE_EXISTS() \
	KER_MOCK_ASSERT( \
		(nullptr != ker_mock_), \
		KER_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	)

#define KER_MOCK_ASSERT_NO_INSTANCE() \
	KER_MOCK_ASSERT( \
		(nullptr == ker_mock_), \
		KER_MOCK_ASSERT_NO_INSTANCE_WARN \
	)

/*===========================================================================*
 * Object definitions
 *===========================================================================*/
static Ker_Mock * ker_mock_ = nullptr;

/*===========================================================================*
 * Constructor and Destructor
 *===========================================================================*/
Ker_Mock::Ker_Mock()
{
	KER_MOCK_ASSERT_NO_INSTANCE();
	ker_mock_ = this;
}

Ker_Mock::~Ker_Mock()
{
	ker_mock_ = nullptr;
}

/*===========================================================================*
 * Mocked function implementations
 *===========================================================================*/
int MODULE_AUTHOR("Ruan de Bruyn")
{
	KER_MOCK_ASSERT_INSTANCE_EXISTS();
	return ker_mock_->MODULE_AUTHOR("Ruan de Bruyn");
}

int MODULE_DESCRIPTION("Hello world driver")
{
	KER_MOCK_ASSERT_INSTANCE_EXISTS();
	return ker_mock_->MODULE_DESCRIPTION("Hello world driver");
}

int MODULE_LICENSE("GPL")
{
	KER_MOCK_ASSERT_INSTANCE_EXISTS();
	return ker_mock_->MODULE_LICENSE("GPL");
}

int custom_init()
{
	KER_MOCK_ASSERT_INSTANCE_EXISTS();
	return ker_mock_->custom_init();
}

void custom_exit()
{
	KER_MOCK_ASSERT_INSTANCE_EXISTS();
	return ker_mock_->custom_exit();
}

/*===========================================================================*/
/**
 * DESCRIPTION:
 * Mock code for ker.
 *
 * GENERATOR: Mockaccino
 * VERSION: v1.10.1
 * INPUT: ker.c
 * TIME: 2026-06-13 19:26:15
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
