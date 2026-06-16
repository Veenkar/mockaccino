#ifndef GADGET_MOCK_HPP
#define GADGET_MOCK_HPP
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
#include <gmock/gmock.h>
#ifdef __cplusplus
extern "C" {
#endif
#include "gadget.h"
#ifdef __cplusplus
}
#endif

/*===========================================================================*
 * Mock class declarations for global functions
 *===========================================================================*/
class Gadget_Mock {
public:
	Gadget_Mock();
	virtual ~Gadget_Mock();
	MOCK_METHOD(int, gadget_add, (int, int));
	MOCK_METHOD(void, gadget_reset, ());
};

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
#endif /* GADGET_MOCK_HPP */
