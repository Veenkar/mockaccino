#ifndef ${instance.caps_mock_name}_H
#define ${instance.caps_mock_name}_H
/*===========================================================================*
 * ${instance.name} ${header_type_name_lower} generated with:
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
 * ${header_type_name} code for ${instance.name}.
 *
 * GENERATOR: Mockaccino
 * VERSION: v${instance.version}
 * INPUT: ${instance.filename}
 * TIME: ${instance.localTime}
 *
 * COPYRIGHT:
${instance.copyright}
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
	#include "${instance.header_name}"
}

/*===========================================================================*
 * ${header_type_name} class declaration
 *===========================================================================*/
class ${instance.mock_name} {
public:
	${instance.mock_name}();
	virtual ~${instance.mock_name}();
${mock_strings}
};

/*===========================================================================*/
/**
 * DESCRIPTION:
 * ${header_type_name} code for ${instance.name}.
 *
 * GENERATOR: Mockaccino
 * VERSION: v${instance.version}
 * INPUT: ${instance.filename}
 * TIME: ${instance.localTime}
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
#endif /* ${instance.caps_mock_name}_H */
