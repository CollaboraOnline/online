/*
	Socket to be intialized on opening the analytics page in Admin console
	containing various graphs to show to the user on specified interval
*/

/* global d3 Util AdminSocketBase */
/* eslint no-unused-vars:0 */
var AdminSocketAnalytics = AdminSocketBase.extend({
	constructor: function(host) {
		this.base(host);
	},

	_memStatsData: [],
	_cpuStatsData: [],

	_memStatsSize: 0,
	_memStatsInterval: 0,

	_cpuStatsSize: 0,
	_cpuStatsInterval: 0,

	_initMemStatsData: function(memStatsSize, memStatsInterval, reset) {
		if (reset) {
			this._memStatsData = [];
		}

		var offset = this._memStatsData.length * memStatsInterval;
		for (var i = 0; i < memStatsSize; i++) {
			this._memStatsData.unshift({time: -(offset), value: 0});
			offset += memStatsInterval;
		}
	},

	_initCpuStatsData: function() {
		for (var i = 0; i < this._cpuStatsSize; i++) {
			this._cpuStatsData.push({time: -((this._cpuStatsSize - i - 1) * this._cpuStatsInterval), value: 0});
		}
	},

	onSocketOpen: function() {
		// Base class' onSocketOpen handles authentication
		this.base.call(this);

		this.socket.send('subscribe mem_stats cpu_stats settings');
		this.socket.send('settings');
		this.socket.send('mem_stats');
	},

	_createMemData: function() {
		for (var i = this._memStatsRawData.length - 1, j = this._memStatsData.length - 1; i >= 0 && j >= 0; i--, j--) {
			this._memStatsData[j].value = parseInt(this._memStatsRawData[i]);
		}
	},

	_d3xAxis: null,
	_d3yAxis: null,
	_d3line: null,
	_xScale: null,
	_yScale: null,

	_graphWidth: 1000,
	_graphHeight: 500,
	_graphMargins: {
		top: 20,
		right: 20,
		bottom: 20,
		left: 100
	},

	_setUpAxis: function() {
		this._xScale = d3.scale.linear().range([this._graphMargins.left, this._graphWidth - this._graphMargins.right]).domain([d3.min(this._memStatsData, function(d) {
			return d.time;
		}), d3.max(this._memStatsData, function(d) {
			return d.time;
		})]);


		this._yScale = d3.scale.linear().range([this._graphHeight - this._graphMargins.bottom, this._graphMargins.top]).domain([d3.min(this._memStatsData, function(d) {
			return d.value;
		}), d3.max(this._memStatsData, function(d) {
			return d.value;
		})]);

		this._d3xAxis = d3.svg.axis()
			.scale(this._xScale)
			.tickFormat(function(d) {
				d = Math.abs(d / 1000);
				var units = ['s', 'min', 'hr'];
				for (var i = 0; i < units.length && Math.abs(d) >= 60; i++) {
					d = parseInt(d / 60);
				}
				return parseInt(d) + units[i] + ' ago';
			});

		this._d3yAxis = d3.svg.axis()
			.scale(this._yScale)
			.tickFormat(function (d) {
				return Util.humanizeMem(d);
			})
			.orient('left');

		var xScale = this._xScale;
		var yScale = this._yScale;

		this._d3line = d3.svg.line()
			.x(function(d) {
				return xScale(d.time);
			})
			.y(function(d) {
				return yScale(d.value);
			});
	},

	_createMemGraph: function() {
		var vis = d3.select('#visualisation');

		this._setUpAxis();

		vis.append('svg:g')
		.attr('class', 'x-axis')
		.attr('transform', 'translate(0,' + (this._graphHeight - this._graphMargins.bottom) + ')')
		.call(this._d3xAxis);

		vis.append('svg:g')
		.attr('class', 'y-axis')
		.attr('transform', 'translate(' + this._graphMargins.left + ',0)')
		.call(this._d3yAxis);

		vis.append('svg:path')
			.attr('d', this._d3line(this._memStatsData))
			.attr('class', 'line')
			.attr('stroke', 'blue')
			.attr('stroke-width', 2)
			.attr('fill', 'none');
	},

	_addNewMemData: function(data) {
		// make a space for new data
		for (var i = this._memStatsData.length - 1; i > 0; i--) {
			this._memStatsData[i].time = this._memStatsData[i - 1].time;
		}

		// push new data at time '0'
		this._memStatsData.push({time: 0, value: parseInt(data)});

		// remove extra items
		if (this._memStatsData.length > this._memStatsSize) {
			this._memStatsData.shift();
		}
	},

	_updateMemGraph: function() {
		var svg = d3.select('#visualisation');

		this._setUpAxis();

		svg.select('.line')
		.attr('d', this._d3line(this._memStatsData));

		svg.select('.x-axis')
		.call(this._d3xAxis);

		svg.select('.y-axis')
		.call(this._d3yAxis);
	},

	onSocketMessage: function(e) {
		var textMsg;
		if (typeof e.data === 'string') {
			textMsg = e.data;
		}
		else {
			textMsg = '';
		}


		if (textMsg.startsWith('settings')) {
			textMsg = textMsg.substring('settings '.length);
			textMsg = textMsg.split(' ');

			//TODO: Add CPU statistics
			var memStatsSize, memStatsInterval, cpuStatsSize, cpuStatsInterval;
			var i, j, data;
			memStatsSize = this._memStatsSize;
			memStatsInterval = this._memStatsInterval;
			cpuStatsSize = this._cpuStatsSize;
			cpuStatsInterval = this._cpuStatsInterval;
			for (i = 0; i < textMsg.length; i++) {
				var setting = textMsg[i].split('=');
				if (setting[0] === 'mem_stats_size') {
					memStatsSize = parseInt(setting[1]);
				}
				else if (setting[0] === 'mem_stats_interval') {
					memStatsInterval = parseInt(setting[1]);
				}
				else if (setting[0] === 'cpu_stats_size') {
					cpuStatsSize = parseInt(setting[1]);
				}
				else if (setting[0] === 'cpu_stats_interval') {
					cpuStatsInterval = parseInt(setting[1]);
				}
			}

			// Fix the axes according to changed data
			if (memStatsInterval !== this._memStatsInterval) {
				// We can possibly reuse the data with a bit of work
				this._initMemStatsData(memStatsSize, memStatsInterval, true);
			}
			else if (memStatsSize > this._memStatsSize) {
				this._initMemStatsData(memStatsSize - this._memStatsSize, memStatsInterval, false);
			}
			else {
				// just strip the extra items
				for (i = 0; i < this._memStatsSize - memStatsSize; i++) {
					this._memStatsData.shift();
				}
			}

			this._memStatsSize = memStatsSize;
			this._memStatsInterval = memStatsInterval;
			this._cpuStatsSize = cpuStatsSize;
			this._cpuStatsInterval = cpuStatsInterval;
		}
		else if (textMsg.startsWith('mem_stats') ||
			textMsg.startsWith('cpu_stats')) {
			textMsg = textMsg.split(' ')[1];
			if (textMsg.endsWith(',')) {
				// This is the result of query, not notification
				data = textMsg.substring(0, textMsg.length - 1).split(',');
				for (i = this._memStatsData.length - 1, j = data.length - 1; i >= 0 && j >= 0; i--, j--) {
					this._memStatsData[i].value = parseInt(data[j]);
				}

				//this._createMemData(data);
				this._createMemGraph();
			}
			else {
				// this is a notification data; append to _memStatsData
				data = textMsg.trim();
				this._addNewMemData(data);
				this._updateMemGraph();
			}
		}
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
	}
});

Admin.Analytics = function(host) {
	return new AdminSocketAnalytics(host);
};
