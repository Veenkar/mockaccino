/*===========================================================================*
 * ${instance.name} ${header_type_name_lower} generated with:
 *
${instance.ascii_art}
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
#include <cassert>
#include "${instance.name}_mock.h"

/*===========================================================================*
 * Define macros
 *===========================================================================*/
#define ${instance.caps_mock_name}_ASSERT_INSTANCE_EXISTS_WARN \\
	"No mock instance found when calling mocked function. " \\
	"Instantiate mock first!"

#define ${instance.caps_mock_name}_ASSERT_NO_INSTANCE_WARN \\
	"Mock instance already exists!"

/*===========================================================================*
 * Function-like macros
 *===========================================================================*/
#define ${instance.caps_mock_name}_ASSERT(exp, msg) \\
	assert((static_cast<void>("${instance.mock_name}: " msg), exp))

#define ${instance.caps_mock_name}_ASSERT_INSTANCE_EXISTS() \\
	${instance.caps_mock_name}_ASSERT( \\
		(nullptr != ${instance.mock_instance_name}), \\
		${instance.caps_mock_name}_ASSERT_INSTANCE_EXISTS_WARN \\
	)

#define ${instance.caps_mock_name}_ASSERT_NO_INSTANCE() \\
	${instance.caps_mock_name}_ASSERT( \\
		(nullptr == ${instance.mock_instance_name}), \\
		${instance.caps_mock_name}_ASSERT_NO_INSTANCE_WARN \\
	)

/*===========================================================================*
 * Object definitions
 *===========================================================================*/
static ${instance.mock_name} * ${instance.mock_instance_name} = nullptr;

/*===========================================================================*
 * Constructor and Destructor
 *===========================================================================*/
${instance.mock_name}::${instance.mock_name}()
{
	${instance.caps_mock_name}_ASSERT_NO_INSTANCE();
	${instance.mock_instance_name} = this;
}

${instance.mock_name}::~${instance.mock_name}()
{
	${instance.mock_instance_name} = nullptr;
}

/*===========================================================================*
 * Mocked function implementations
 *===========================================================================*/
${impl_strings}
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
