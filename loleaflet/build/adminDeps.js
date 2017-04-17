var adminDeps = {
	AdminCore: {
		src: ['admin/Base.js',
		      'admin/Admin.js',
		      'admin/AdminSocketBase.js'],
		desc: 'Core admin scripts infrastructure'
	},

	Util: {
		src: ['admin/Util.js'],
		desc: 'Utility class',
		deps: ['AdminCore']
	},

	AdminSocketOverview: {
		src: ['admin/AdminSocketOverview.js'],
		desc: 'Socket to handle messages in overview page.',
		deps: ['AdminCore']
	},

	AdminSocketAnalytics: {
		src: ['admin/AdminSocketAnalytics.js'],
		desc: 'Socket to handle messages in analytics page.',
		deps: ['AdminCore']
	},

	AdminSocketSettings: {
		src: ['admin/AdminSocketSettings.js'],
		desc: 'Socket to handle settings from server',
		deps: ['AdminCore']
	},

 	AdminSocketHistory: {
		src: ['admin/AdminSocketHistory.js'],
		desc: 'Socket to query document history.',
		deps: ['AdminCore']
	}
};

if (typeof exports !== 'undefined') {
	exports.adminDeps = adminDeps;
}
