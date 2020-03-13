/* global require */

var tasks = require('./tasks');

function plugin(on, config) {
	on('task', {
		copyFile: tasks.copyFile,
		failed: require('cypress-failed-log/src/failed')()
	});

	return config;
}

module.exports = plugin;
