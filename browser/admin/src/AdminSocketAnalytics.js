/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * Socket to be intialized on opening the analytics page in Admin console
 * containing various graphs to show to the user on specified interval
 */

/* global _ d3 Util AdminSocketBase $ Admin */
var AdminSocketAnalytics = AdminSocketBase.extend({
	constructor: function(host) {
		this.base(host);
	},

	_memStatsData: [],
	_cpuStatsData: [],
	_sentStatsData: [],
	_recvStatsData: [],

	_memStatsSize: 0,
	_memStatsInterval: 0,

	_cpuStatsSize: 0,
	_cpuStatsInterval: 0,

	_netStatsSize: 0,
	_netStatsInterval: 0,

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
		else if (option === 'sent')
			this._sentStatsData = actualData;
		else if (option === 'recv')
			this._recvStatsData = actualData;
	},

	onSocketOpen: function() {
		// Base class' onSocketOpen handles authentication
		this.base.call(this);

		this.socket.send('subscribe mem_stats cpu_stats sent_activity recv_activity settings');
		this.socket.send('settings');
		this.socket.send('sent_activity');
		this.socket.send('recv_activity');
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

	_d3NetXAxis: null,
	_d3NetYAxis: null,
	_d3NetSentLine: null,
	_d3NetRecvLine: null,
	_xNetScale: null,
	_yNetScale: null,

	_graphWidth: 1000,
	_graphHeight: 500,
	_graphMargins: {
		top: 20,
		right: 20,
		bottom: 20,
		left: 100
	},

	_setUpAxis: function(option) {
		var data, xScale, yScale, d3XAxis, d3Line;

		if (option === 'mem')
			data = this._memStatsData;
		else if (option === 'cpu')
			data = this._cpuStatsData;
		else if (option === 'net')
			data = this._sentStatsData.concat(this._recvStatsData);

		xScale = d3.scaleLinear().range([this._graphMargins.left, this._graphWidth - this._graphMargins.right]).domain([d3.min(data, function(d) {
			return d.time;
		}), d3.max(data, function(d) {
			return d.time;
		})]);


		yScale = d3.scaleLinear().range([this._graphHeight - this._graphMargins.bottom, this._graphMargins.top]).domain([d3.min(data, function(d) {
			return d.value;
		}), d3.max(data, function(d) {
			return d.value;
		})]);

		d3XAxis = d3.axisBottom(xScale)
			.tickFormat(function(d) {
				d = Math.abs(d / 1000);
				var sUnit = 0;
				var i = 0;
				var units = ['s', 'min', 'hr'];
				for (i  = 0; i < units.length && Math.abs(d) >= 60; i++) {
					sUnit = parseInt(d % 60);
					d = parseInt(d / 60);
				}
				if (i !== 0 && sUnit !== 0) {
					return d + units[i][0] + ' ' + sUnit + units[i-1][0];
				}
				else
					return d + units[i];
			});

		d3Line = d3.line()
			.x(function(d) {
				return xScale(d.time);
			})
			.y(function(d) {
				return yScale(d.value);
			})
			.curve(d3.curveMonotoneX);

		if (option === 'mem') {
			this._xMemScale = xScale;
			this._yMemScale = yScale;
			this._d3MemXAxis = d3XAxis;
			this._d3MemYAxis = d3.axisLeft(this._yMemScale)
				.tickFormat(function (d) {
					return Util.humanizeMem(d);
				});
			this._d3MemLine = d3Line;
		}
		else if (option === 'cpu') {
			this._xCpuScale = xScale;
			this._yCpuScale = yScale;
			this._d3CpuXAxis = d3XAxis;
			this._d3CpuYAxis = d3.axisLeft(this._yCpuScale)
				.tickFormat(function (d) {
					return d + '%';
				});
			this._d3CpuLine = d3Line;
		}
		else if (option === 'net') {
			this._xNetScale = xScale;
			this._yNetScale = yScale;
			this._d3NetXAxis = d3XAxis;
			this._d3NetYAxis = d3.axisLeft(this._yNetScale)
				.tickFormat(function (d) {
					return Util.humanizeMem(d/1000) + '/sec';
				});
			this._d3NetSentLine = d3Line;
			this._d3NetRecvLine = d3Line;

		}
	},

	_createGraph: function(option) {
		var vis, xAxis, yAxis, line, data;

		if (option === 'mem') {
			vis = d3.select('#MemVisualisation');
			this._setUpAxis('mem');
			xAxis = this._d3MemXAxis;
			yAxis = this._d3MemYAxis;
			line = this._d3MemLine;
			data = this._memStatsData;
		}
		else if (option === 'cpu') {
			vis = d3.select('#CpuVisualisation');
			this._setUpAxis('cpu');
			xAxis = this._d3CpuXAxis;
			yAxis = this._d3CpuYAxis;
			line = this._d3CpuLine;
			data = this._cpuStatsData;
		}
		else if (option === 'net') {
			vis = d3.select('#NetVisualisation');
			this._setUpAxis('net');
			xAxis = this._d3NetXAxis;
			yAxis = this._d3NetYAxis;

			var legend = vis.append('g')
				.attr('x', this._graphWidth - 70)
				.attr('y', 50)
				.style('font-size', '17px');

			var legendData = [
				{
					text: _('Received'),
					color: 'green'
				},
				{
					text: _('Sent'),
					color: 'red'
				}
			];
			var legendSpacing = 20;

			for (var i = legendData.length - 1; i >= 0; i--) {

				legend.append('text')
					.attr('x', this._graphWidth - 70)
					.attr('y', 80 + i * legendSpacing)
					.text(legendData[i].text);
				legend.append('rect')
					.attr('x', this._graphWidth - 90)
					.attr('y', 67 + i * legendSpacing)
					.attr('width', 15)
					.attr('height', 15)
					.style('fill', legendData[i].color)
					.style('stroke', 'black');
			}
		}

		vis.append('svg:g')
			.attr('class', 'x-axis axis')
			.attr('transform', 'translate(0,' + (this._graphHeight - this._graphMargins.bottom) + ')')
			.call(xAxis);

		vis.append('svg:g')
			.attr('class', 'y-axis axis')
			.attr('transform', 'translate(' + this._graphMargins.left + ',0)')
			.call(yAxis);

		if (option === 'cpu' || option === 'mem') {

			vis.append('svg:path')
				.attr('d', line(data))
				.attr('class', 'line')
				.attr('stroke', 'blue')
				.attr('stroke-width', 1)
				.attr('fill', 'none');
		}
		else if (option === 'net') {

			vis.append('svg:path')
				.attr('d', this._d3NetSentLine(this._sentStatsData))
				.attr('class', 'lineSent')
				.attr('stroke', 'red')
				.attr('stroke-width', 1)
				.attr('fill', 'none');

			vis.append('svg:path')
				.attr('d', this._d3NetRecvLine(this._recvStatsData))
				.attr('class', 'lineRecv')
				.attr('stroke', 'green')
				.attr('stroke-width', 1)
				.attr('fill', 'none');
		}

	},

	_addNewData: function(oldData, newData, option) {
		var size, graphName, line, elemSize;
		elemSize = this._graphWidth - this._graphMargins['left'] - this._graphMargins['right'];

		if (option === 'mem') {
			size = this._memStatsSize;
			graphName = '#MemVisualisation';
			line = 'line';
		}
		else if (option === 'cpu') {
			size = this._cpuStatsSize;
			graphName = '#CpuVisualisation';
			line = 'line';
		}
		else if (option === 'sent' || option === 'recv')
			size = this._netStatsSize;

		if (graphName === '#MemVisualisation' || graphName === '#CpuVisualisation' ||
				graphName === '#NetVisualisation') {
			d3.select(graphName)
				.select('.' + line)
				.attr('transform', 'translate(' + elemSize/size + ')')
				.transition()
				.attr('transform', 'translate(' + 0 + ')');
		}

		// make a space for new data
		for (var i = oldData.length - 1; i > 0; i--) {
			oldData[i].time = oldData[i - 1].time;
		}

		// push new data at time '0'
		oldData.push({time: 0, value: parseInt(newData)});

		// remove extra items
		if (oldData.length > size) {
			oldData.shift();
		}
	},

	_updateMemGraph: function() {
		var svg = d3.select('#MemVisualisation');

		this._setUpAxis('mem');

		svg.select('.line')
			.attr('d', this._d3MemLine(this._memStatsData));

		svg.select('.x-axis')
			.call(this._d3MemXAxis);

		svg.transition()
			.duration(500)
			.select('.y-axis')
			.call(this._d3MemYAxis);
	},

	_updateCpuGraph: function() {
		var svg = d3.select('#CpuVisualisation');

		this._setUpAxis('cpu');

		svg.select('.line')
			.attr('d', this._d3CpuLine(this._cpuStatsData));

		svg.select('.x-axis')
			.call(this._d3CpuXAxis);

		svg.transition()
			.select('.y-axis')
			.duration(500)
			.call(this._d3CpuYAxis);
	},

	_updateNetGraph: function() {
		var svg = d3.select('#NetVisualisation');

		this._setUpAxis('net');

		svg.select('.lineSent')
			.attr('d', this._d3NetSentLine(this._sentStatsData));
		svg.select('.lineRecv')
			.attr('d', this._d3NetRecvLine(this._recvStatsData));

		svg.select('.x-axis')
			.call(this._d3NetXAxis);

		svg.transition()
			.select('.y-axis')
			.duration(500)
			.call(this._d3NetYAxis);
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
				else if (setting[0] === 'net_stats_size') {
					this._netStatsSize = parseInt(setting[1]);
				}
				else if (setting[0] === 'net_stats_interval') {
					this._netStatsInterval = parseInt(setting[1]);
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

			this._initStatsData('sent', this._netStatsSize, this._netStatsInterval, true);
			this._initStatsData('recv', this._netStatsSize, this._netStatsInterval, true);

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
				this._addNewData(this._memStatsData, data, 'mem');
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
				this._addNewData(this._cpuStatsData, data, 'cpu');
				this._updateCpuGraph();
			}
		}
		else if (textMsg.startsWith('sent_activity')) {
			textMsg = textMsg.split(' ')[1];
			if (textMsg.endsWith(',')) {
				// This is the result of query, not notification
				data = textMsg.substring(0, textMsg.length - 1).split(',');

				for (i = this._sentStatsData.length - 1, j = data.length - 1; i >= 0 && j >= 0; i--, j--) {
					this._sentStatsData[i].value = parseInt(data[j]);
				}

				if ($('#NetVisualisation').html() === '')
					this._createGraph('net');
			}
			else {
				// this is a notification data; append to _sentStatsData
				data = textMsg.trim();
				this._addNewData(this._sentStatsData, parseInt(data), 'sent');
				this._updateNetGraph();
			}
		}
		else if (textMsg.startsWith('recv_activity')) {
			textMsg = textMsg.split(' ')[1];
			if (textMsg.endsWith(',')) {
				// This is the result of query, not notification
				data = textMsg.substring(0, textMsg.length - 1).split(',');

				for (i = this._recvStatsData.length - 1, j = data.length - 1; i >= 0 && j >= 0; i--, j--) {
					this._recvStatsData[i].value = parseInt(data[j]);
				}

				if ($('#NetVisualisation').html() === '')
					this._createGraph('net');
			}
			else {
				// this is a notification data; append to _recvStatsData
				data = textMsg.trim();
				this._addNewData(this._recvStatsData, parseInt(data), 'recv');
				this._updateNetGraph();
			}
		}
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
		this.base.call(this);
	}
});

Admin.Analytics = function(host) {
	return new AdminSocketAnalytics(host);
};
