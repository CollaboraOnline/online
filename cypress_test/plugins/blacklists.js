var nextcloudBlackList = [
	['mobile/writer/focus_spec.js', []],
	['mobile/calc/focus_spec.js', []],
	['mobile/impress/impress_focus_spec.js', []],
	['desktop/writer/focus_spec.js', []],
	['desktop/calc/focus_spec.js', []],
	['mobile/calc/hamburger_menu_spec.js',
		[
			'Print',
			'Save'
		]
	],
	['mobile/writer/hamburger_menu_spec.js',
		[
			'Print',
			'Save',
			'Automatic spell checking.'
		]
	],
	['mobile/writer/spellchecking_spec.js',
		[]
	],
	['mobile/impress/hamburger_menu_spec.js',
		[
			'Print',
			'Save'
		]
	],
	['mobile/writer/annotation_spec.js',
		[
			'Saving comment.'
		]
	],
	['mobile/impress/annotation_spec.js',
		[
			'Saving comment.'
		]
	],
	['desktop/writer/top_toolbar_spec.js',
		[
			'Insert image.',
			'Save.',
			'Print'
		]
	],
	['desktop/calc/top_toolbar_spec.js',
		[
			'Save.',
			'Print'
		]
	],
	['desktop/calc/macro_spec.js',
		[]
	],
	['multiuser/calc/sheet_operations_user1_spec.js',
		[]
	],
	['multiuser/calc/sheet_operations_user2_spec.js',
		[]
	],
	['multiuser/impress/slide_operations_user1_spec.js',
		[]
	],
	['multiuser/impress/slide_operations_user2_spec.js',
		[]
	],
	['multiuser/writer/paragraph_prop_user1_spec.js',
		[]
	],
	['multiuser/writer/paragraph_prop_user2_spec.js',
		[]
	],
	['multiuser/writer/sidebar_visibility_user1_spec.js',
		[]
	],
	['multiuser/writer/sidebar_visibility_user2_spec.js',
		[]
	],
	['multiuser/writer/simultaneous_typing_user1_spec.js',
		[]
	],
	['multiuser/writer/simultaneous_typing_user2_spec.js',
		[]
	],
	['multiuser/writer/top_toolbar_interfer_user1_spec.js',
		[]
	],
	['multiuser/writer/top_toolbar_interfer_user2_spec.js',
		[]
	],
];

var phpProxyBlackList = [
	['mobile/calc/insertion_wizard_spec.js',
		[
			'Inset local image.'
		]
	],
	['mobile/writer/insert_object_spec.js',
		[
			'Insert local image.'
		]
	],
	['mobile/impress/insertion_wizard_spec.js',
		[
			'Insert local image.'
		]
	],
	['mobile/calc/hamburger_menu_spec.js',
		[
			'Save'
		]
	],
	['mobile/calc/focus_spec.js',
		[
			'Formula-bar focus'
		]
	],
	['mobile/calc/formulabar_spec.js',
		[]
	],
	['mobile/writer/hamburger_menu_spec.js',
		[
			'Save'
		]
	],
	['mobile/impress/hamburger_menu_spec.js',
		[
			'Save'
		]
	],
	['mobile/writer/annotation_spec.js',
		[
			'Saving comment.'
		]
	],
	['mobile/impress/annotation_spec.js',
		[
			'Saving comment.'
		]
	],
	['desktop/calc/focus_spec.js',
		[]
	],
	['desktop/writer/top_toolbar_spec.js',
		[
			'Insert image.',
			'Save.'
		]
	],
	['desktop/calc/top_toolbar_spec.js',
		[
			'Save.'
		]
	],
	['multiuser/calc/sheet_operations_user1_spec.js',
		[]
	],
	['multiuser/calc/sheet_operations_user2_spec.js',
		[]
	],
	['multiuser/impress/slide_operations_user1_spec.js',
		[]
	],
	['multiuser/impress/slide_operations_user2_spec.js',
		[]
	],
	['multiuser/writer/paragraph_prop_user1_spec.js',
		[]
	],
	['multiuser/writer/paragraph_prop_user2_spec.js',
		[]
	],
	['multiuser/writer/sidebar_visibility_user1_spec.js',
		[]
	],
	['multiuser/writer/sidebar_visibility_user2_spec.js',
		[]
	],
	['multiuser/writer/simultaneous_typing_user1_spec.js',
		[]
	],
	['multiuser/writer/simultaneous_typing_user2_spec.js',
		[]
	],
	['multiuser/writer/top_toolbar_interfer_user1_spec.js',
		[]
	],
	['multiuser/writer/top_toolbar_interfer_user2_spec.js',
		[]
	],
];

var nextcloudOnlyList = [
	['mobile/writer/nextcloud_spec.js', []],
	['mobile/calc/nextcloud_spec.js', []],
	['mobile/impress/nextcloud_spec.js', []],
];

var updateScreenshotList = [
	['desktop/writer/help_dialog_update_spec.js', []],
	['desktop/calc/help_dialog_update_spec.js', []],
];

module.exports.nextcloudBlackList = nextcloudBlackList;
module.exports.nextcloudOnlyList = nextcloudOnlyList;
module.exports.phpProxyBlackList = phpProxyBlackList;
module.exports.updateScreenshotList = updateScreenshotList;
