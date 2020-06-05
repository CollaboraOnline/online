var testBlackLists = {
	'master': [
		['mobile/writer/table_properties_spec.js',
			[]
		],
		['mobile/writer/shape_properties_spec.js',
			[
				'Change size with keep ratio enabled.',
				'Change line color',
				'Change line style',
				'Change line width',
				'Change line transparency',
				'Arrow style items are hidden.'
			]
		],
		['mobile/writer/apply_paragraph_properties_spec.js',
			[
				'Apply default bulleting.',
				'Apply default numbering.',
				'Apply background color.'
			]
		],
		['mobile/writer/insert_object_spec.js',
			[
				'Insert default table.',
				'Insert custom table.'
			]
		],
		['mobile/writer/apply_font_spec.js',
			[
				'Insert default table.',
				'Insert custom table.'
			]
		],
		['mobile/calc/number_format_spec.js',
			[
				'Select percent format from list.',
				'Push percent button.',
				'Select currency format from list.',
				'Push currency button.',
				'Push number button.'
			]
		],
	]
};

module.exports.testBlackLists = testBlackLists;
