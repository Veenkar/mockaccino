/*===========================================================================*
 * mixed mock generated with:
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
 * Mock code for mixed.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v2.0.2
 * INPUT: mixed.hpp
 * TIME: 2026-06-15 23:44:34
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
#include "mixed_mock.h"

/*===========================================================================*
 * Define macros
 *===========================================================================*/
#define MIXED_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	"No mock instance found when calling mocked function. " \
	"Instantiate mock first!"

#define MIXED_MOCK_ASSERT_NO_INSTANCE_WARN \
	"Mock instance already exists!"

/*===========================================================================*
 * Function-like macros
 *===========================================================================*/
#define MIXED_MOCK_ASSERT(exp, msg) \
	assert((static_cast<void>("Mixed_Mock: " msg), exp))

#define MIXED_MOCK_ASSERT_INSTANCE_EXISTS() \
	MIXED_MOCK_ASSERT( \
		(nullptr != mixed_mock_), \
		MIXED_MOCK_ASSERT_INSTANCE_EXISTS_WARN \
	)

#define MIXED_MOCK_ASSERT_NO_INSTANCE() \
	MIXED_MOCK_ASSERT( \
		(nullptr == mixed_mock_), \
		MIXED_MOCK_ASSERT_NO_INSTANCE_WARN \
	)

/*===========================================================================*
 * Object definitions
 *===========================================================================*/
static Mixed_Mock * mixed_mock_ = nullptr;

/*===========================================================================*
 * Constructor and Destructor
 *===========================================================================*/
Mixed_Mock::Mixed_Mock()
{
	MIXED_MOCK_ASSERT_NO_INSTANCE();
	mixed_mock_ = this;
}

Mixed_Mock::~Mixed_Mock()
{
	mixed_mock_ = nullptr;
}

/*===========================================================================*
 * Mocked function implementations
 *===========================================================================*/
int compute_checksum(const char *data, unsigned long len)
{
	MIXED_MOCK_ASSERT_INSTANCE_EXISTS();
	return mixed_mock_->compute_checksum(data, len);
}

void reset_counters()
{
	MIXED_MOCK_ASSERT_INSTANCE_EXISTS();
	return mixed_mock_->reset_counters();
}

double scale_value(double value, int factor)
{
	MIXED_MOCK_ASSERT_INSTANCE_EXISTS();
	return mixed_mock_->scale_value(value, factor);
}

/*===========================================================================*/
/**
 * DESCRIPTION:
 * Mock code for mixed.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v2.0.2
 * INPUT: mixed.hpp
 * TIME: 2026-06-15 23:44:34
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
