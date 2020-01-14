/* global require */

var tasks = require('./tasks');

function plugin(on, config) {
	on('task', {
		copyFile: tasks.copyFile
	});

	return config;
}

module.exports = plugin;
