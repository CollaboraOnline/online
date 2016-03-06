var adminDeps = {
	Base: {
		src: ['admin/Base.js'],
		desc: 'Base.js used for JS Inheritence.'
	},

	Util: {
		src: ['admin/Util.js'],
		desc: 'Utility class',
		deps: ['Base']
	},

	AdminSocketBase: {
		src: ['admin/AdminSocketBase.js'],
		desc: 'Abstract base class for Admin sockets',
		deps: ['Base']
	},

	AdminSocketOverview: {
		src: ['admin/AdminSocketOverview.js'],
		desc: 'Socket to handle messages in overview page.',
		deps: ['AdminSocketBase']
	},

	AdminSocketAnalytics: {
		src: ['admin/AdminSocketAnalytics.js'],
		desc: 'Socket to handle messages in analytics page.',
		deps: ['AdminSocketBase']
	},

	AdminSocketSettings: {
		src: ['admin/AdminSocketSettings.js'],
		desc: 'Socket to handle settings from server',
		deps: ['AdminSocketBase']
	}
};

if (typeof exports !== 'undefined') {
	exports.adminDeps = adminDeps;
}
