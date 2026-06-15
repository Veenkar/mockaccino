#ifndef KER_MOCK_H
#define KER_MOCK_H
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
 * MODE: regex
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
#include <gmock/gmock.h>
extern "C" {
	#include "ker.h"
}

/*===========================================================================*
 * Mock class declaration
 *===========================================================================*/
class Ker_Mock {
public:
	Ker_Mock();
	virtual ~Ker_Mock();
	MOCK_METHOD(int, MODULE_AUTHOR, ("Ruan de Bruyn"));
	MOCK_METHOD(int, MODULE_DESCRIPTION, ("Hello world driver"));
	MOCK_METHOD(int, MODULE_LICENSE, ("GPL"));
	MOCK_METHOD(int, custom_init, ());
	MOCK_METHOD(void, custom_exit, ());
};

/*===========================================================================*/
/**
 * DESCRIPTION:
 * Mock code for ker.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
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
#endif /* KER_MOCK_H */
