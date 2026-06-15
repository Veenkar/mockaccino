#ifndef MAIN_MOCK_H
#define MAIN_MOCK_H
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
 * MODE: regex
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
#include <gmock/gmock.h>
extern "C" {
	#include "main.h"
}

/*===========================================================================*
 * Mock class declaration
 *===========================================================================*/
class Main_Mock {
public:
	Main_Mock();
	virtual ~Main_Mock();
	MOCK_METHOD(float, main2, (const intx * const, char[]));
	MOCK_METHOD(int, implicitReturnTypeFunction, (int));
};

/*===========================================================================*/
/**
 * DESCRIPTION:
 * Mock code for main.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
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
#endif /* MAIN_MOCK_H */
