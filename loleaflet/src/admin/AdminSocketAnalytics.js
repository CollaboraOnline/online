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

	_initStatsData: function(option, size, interval, reset) {
		var actualData;

		if (reset) {
			actualData = [];
		}

		var offset = actualData.length * interval;
		for (var i = 0; i < size; i++) {
			actualData.unshift({time: -(offset), value: 0});
			offset += interval;
		}

		if (option === 'mem')
			this._memStatsData = actualData;
		else if (option === 'cpu')
			this._cpuStatsData = actualData;
	},

	onSocketOpen: function() {
		// Base class' onSocketOpen handles authentication
		this.base.call(this);

		this.socket.send('subscribe mem_stats cpu_stats settings');
		this.socket.send('settings');
		this.socket.send('mem_stats');
		this.socket.send('cpu_stats');
	},

	_d3MemXAxis: null,
	_d3MemYAxis: null,
	_d3MemLine: null,
	_xMemScale: null,
	_yMemScale: null,

	_d3CpuXAxis: null,
	_d3CpuYAxis: null,
	_d3CpuLine: null,
	_xCpuScale: null,
	_yCpuScale: null,

	_graphWidth: 1000,
	_graphHeight: 500,
	_graphMargins: {
		top: 20,
		right: 20,
		bottom: 20,
		left: 100
	},

	_setUpAxis: function(option) {

		if (option === 'mem')
			data = this._memStatsData;
		else if (option === 'cpu')
			data = this._cpuStatsData;

		xScale = d3.scale.linear().range([this._graphMargins.left, this._graphWidth - this._graphMargins.right]).domain([d3.min(data, function(d) {
			return d.time;
		}), d3.max(data, function(d) {
			return d.time;
		})]);


		yScale = d3.scale.linear().range([this._graphHeight - this._graphMargins.bottom, this._graphMargins.top]).domain([d3.min(data, function(d) {
			return d.value;
		}), d3.max(data, function(d) {
			return d.value;
		})]);

		d3XAxis = d3.svg.axis()
			.scale(xScale)
			.tickFormat(function(d) {
				d = Math.abs(d / 1000);
				var units = ['s', 'min', 'hr'];
				for (var i = 0; i < units.length && Math.abs(d) >= 60; i++) {
					d = parseInt(d / 60);
				}
				return parseInt(d) + units[i] + ' ago';
			});

		d3Line = d3.svg.line()
			.x(function(d) {
				return xScale(d.time);
			})
			.y(function(d) {
				return yScale(d.value);
			})
			.interpolate('basis');

		if (option === 'mem') {
			this._xMemScale = xScale;
			this._yMemScale = yScale;
			this._d3MemXAxis = d3XAxis;
			this._d3MemYAxis = d3.svg.axis()
				.scale(this._yMemScale)
				.tickFormat(function (d) {
					return Util.humanizeMem(d);
				})
				.orient('left');
			this._d3MemLine = d3Line;
		}
		else if (option === 'cpu') {
			this._xCpuScale = xScale;
			this._yCpuScale = yScale;
			this._d3CpuXAxis = d3XAxis;
			this._d3CpuYAxis = d3.svg.axis()
				.scale(this._yCpuScale)
				.tickFormat(function (d) {
					return d + '%';
				})
				.orient('left');
			this._d3CpuLine = d3Line;
		}
	},

	_createGraph: function(option) {
		if (option === 'mem') {
			var vis = d3.select('#MemVisualisation');
			this._setUpAxis('mem');
			xAxis = this._d3MemXAxis;
			yAxis = this._d3MemYAxis;
			line = this._d3MemLine;
			data = this._memStatsData;
		}
		else if (option === 'cpu') {
			var vis = d3.select('#CpuVisualisation');
			this._setUpAxis('cpu');
			xAxis = this._d3CpuXAxis;
			yAxis = this._d3CpuYAxis;
			line = this._d3CpuLine;
			data = this._cpuStatsData;
		}

		vis.append('svg:g')
		.attr('class', 'x-axis')
		.attr('transform', 'translate(0,' + (this._graphHeight - this._graphMargins.bottom) + ')')
		.call(xAxis);

		vis.append('svg:g')
		.attr('class', 'y-axis')
		.attr('transform', 'translate(' + this._graphMargins.left + ',0)')
		.call(yAxis);

		vis.append('svg:path')
			.attr('d', line(data))
			.attr('class', 'line')
			.attr('stroke', 'blue')
			.attr('stroke-width', 2)
			.attr('fill', 'none');
	},

	_addNewData: function(oldData, newData) {
		// make a space for new data
		for (var i = oldData.length - 1; i > 0; i--) {
			oldData[i].time = oldData[i - 1].time;
		}

		// push new data at time '0'
		oldData.push({time: 0, value: parseInt(newData)});

		// remove extra items
		if (oldData.length > this._memStatsSize) {
			oldData.shift();
		}
	},

	_updateMemGraph: function() {
		svg = d3.select('#MemVisualisation');

		this._setUpAxis('mem');

		svg.select('.line')
		.attr('d', this._d3MemLine(this._memStatsData));

		svg.select('.x-axis')
		.call(this._d3MemXAxis);

		svg.select('.y-axis')
		.call(this._d3MemYAxis);
	},

	_updateCpuGraph: function() {
		svg = d3.select('#CpuVisualisation');

		this._setUpAxis('cpu');

		svg.select('.line')
		.attr('d', this._d3CpuLine(this._cpuStatsData));

		svg.select('.x-axis')
		.call(this._d3CpuXAxis);

		svg.select('.y-axis')
		.call(this._d3CpuYAxis);
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
				this._initStatsData('mem', memStatsSize, memStatsInterval, true);
			}
			else if (memStatsSize > this._memStatsSize) {
				this._initStatsData('mem', memStatsSize - this._memStatsSize, memStatsInterval, false);
			}
			else {
				// just strip the extra items
				for (i = 0; i < this._memStatsSize - memStatsSize; i++) {
					this._memStatsData.shift();
				}
			}

			this._memStatsSize = memStatsSize;
			this._memStatsInterval = memStatsInterval;

			// Similar Logic as above for CPU stats
			if (cpuStatsInterval !== this._cpuStatsInterval) {
				this._initStatsData('cpu', cpuStatsSize, cpuStatsInterval, true);
			}
			else if (cpuStatsSize > this._cpuStatsSize) {
				this._initStatsData('cpu', cpuStatsSize - this._cpuStatsSize, cpuStatsInterval, false);
			}
			else {
				for (i = 0; i < this._cpuStatsSize - cpuStatsSize; i++) {
					this._cpuStatsData.shift();
				}
			}

			this._cpuStatsSize = cpuStatsSize;
			this._cpuStatsInterval = cpuStatsInterval;
		}
		else if (textMsg.startsWith('mem_stats')) {
			textMsg = textMsg.split(' ')[1];
			if (textMsg.endsWith(',')) {
				// This is the result of query, not notification
				data = textMsg.substring(0, textMsg.length - 1).split(',');
				for (i = this._memStatsData.length - 1, j = data.length - 1; i >= 0 && j >= 0; i--, j--) {
					this._memStatsData[i].value = parseInt(data[j]);
				}

				this._createGraph('mem');
			}
			else {
				// this is a notification data; append to _memStatsData
				data = textMsg.trim();
				this._addNewData(this._memStatsData, data);
				this._updateMemGraph();
			}
		}
		else if (textMsg.startsWith('cpu_stats')) {
			textMsg = textMsg.split(' ')[1];
			if (textMsg.endsWith(',')) {
				// This is the result of query, not notification
				data = textMsg.substring(0, textMsg.length - 1).split(',');

				for (i = this._cpuStatsData.length - 1, j = data.length - 1; i >= 0 && j >= 0; i--, j--) {
					this._cpuStatsData[i].value = parseInt(data[j]);
				}

				this._createGraph('cpu');
			}
			else {
				// this is a notification data; append to _cpuStatsData
				data = textMsg.trim();
				this._addNewData(this._cpuStatsData, data);
				this._updateCpuGraph();
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
