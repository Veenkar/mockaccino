#ifndef IFACE_MOCK_H
#define IFACE_MOCK_H
/*===========================================================================*
 * iface mock generated with:
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
 * Mock code for iface.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v2.0.2
 * INPUT: iface.hpp
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
#include "iface.hpp"

/*===========================================================================*
 * Mock class declarations for interfaces
 *===========================================================================*/
class app_Sensor_Mock : public app::Sensor {
public:
	MOCK_METHOD(int, read, (), (const, override));
	MOCK_METHOD(void, calibrate, (double), (override));
};

class app_Devices_IClock_Mock : public app::Devices::IClock {
public:
	MOCK_METHOD(unsigned long, now, (), (override, noexcept));
	MOCK_METHOD(void, reset, (), (override));
};

/*===========================================================================*/
/**
 * DESCRIPTION:
 * Mock code for iface.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v2.0.2
 * INPUT: iface.hpp
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
#endif /* IFACE_MOCK_H */
