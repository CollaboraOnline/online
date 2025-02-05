class LOUtilTestData {
	public static tree = {
		'id': 'level0',
		'children': [
			{
				'id': 'level1_1',
				'children': [
					{
						'id': 'level2',
						'children': [
							{
								'id': 'level3_0',
								'data': 4321,
							},
							{
								'id': 'level3',
								'children': [
									{
										'id': 'level4',
										'data': 1234,
									},
								],
							},
						],
					},
				],
			},
			{
				'id': 'level1_2',
			},
		],
	};

	public static shortTree = {
		id: 'level0',
		children: [
			{ 'class': 'abc', 'name': 'ABC', },
			{ 'class': 'abc', 'name': 'ABC1', },
			{ 'class': 'bac', 'name': 'BAC', },
			{ 'class': 'bac', 'name': 'BAC1', },
			{ 'class': 'cab', 'name': 'CAB', },
		],
	};
}
