#ifndef IFACE_MOCK_HPP
#define IFACE_MOCK_HPP
/*===========================================================================*
 * iface C++ class mocks generated with:
 *
 *  _____ ______   ________  ________  ___  __    ________
 * |\   _ \  _   \|\   __  \|\   ____\|\  \|\  \ |\   __  \
 * \ \  \\\__\ \  \ \  \|\  \ \  \___|\ \  \/  /|\ \  \|\  \
 *  \ \  \\|__| \  \ \  \\\  \ \  \    \ \   ___  \ \   __  \
 *   \ \  \    \ \  \ \  \\\  \ \  \____\ \  \\ \  \ \  \ \  \
 *    \ \__\    \ \__\ \_______\ \_______\ \__\\ \__\ \__\ \__\
 *     \|__|     \|__|\|_______|\|_______|\|__| \|__|\|__|\|__|
 *                              by SelerLabs
 */
/**
 * DESCRIPTION:
 * gmock mock classes for the C++ interfaces declared in iface.hpp.
 *
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v1.0.0
 * INPUT: iface.hpp
 * TIME: 2026-06-15 18:07:09
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
 * Mock class declarations
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
 * GENERATOR: Mockaccino
 * MODE: regex
 * VERSION: v1.0.0
 * INPUT: iface.hpp
 * TIME: 2026-06-15 18:07:09
 *
 * The Mockaccino extension can be found at:
 * MARKETPLACE:
 * https://marketplace.visualstudio.com/items?itemName=SelerLabs.mockaccino
 *
 * GITHUB:
 * https://github.com/Veenkar/mockaccino
 *
 *===========================================================================*/
#endif /* IFACE_MOCK_HPP */
