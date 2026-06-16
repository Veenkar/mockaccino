#ifndef DUMMY_MOCK_H
#define DUMMY_MOCK_H
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
 * VERSION: v2.0.2
 * INPUT: dummy.h
 * TIME: 2026-06-16 21:58:32
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
#include <gmock/gmock.h>
#ifdef __cplusplus
extern "C" {
#endif
#include "dummy.h"
#ifdef __cplusplus
}
#endif

/*===========================================================================*
 * Mock class declarations for global functions
 *===========================================================================*/
class Dummy_Mock {
public:
	Dummy_Mock();
	virtual ~Dummy_Mock();
	MOCK_METHOD(int, dummy, (const SomeType_T, char[]));
	MOCK_METHOD(void, dummy2, (const SomeType_T, char[]));
	MOCK_METHOD(int, dummy3, (const SomeType_T, char[]));
	MOCK_METHOD(int *, dummy4, (const SomeType_T, char[]));
	MOCK_METHOD(const int, main2, (const int, char[]));
};

/*===========================================================================*/
/**
 * DESCRIPTION:
 * Mock code for dummy.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v2.0.2
 * INPUT: dummy.h
 * TIME: 2026-06-16 21:58:32
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
#endif /* DUMMY_MOCK_H */
