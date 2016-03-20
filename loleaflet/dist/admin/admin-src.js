/*
	Base.js, version 1.1a
	Copyright 2006-2010, Dean Edwards
	License: http://www.opensource.org/licenses/mit-license.php
*/

var Base = function() {
	// dummy
};

Base.extend = function(_instance, _static) { // subclass
	var extend = Base.prototype.extend;

	// build the prototype
	Base._prototyping = true;
	var proto = new this;
	extend.call(proto, _instance);
  proto.base = function() {
    // call this method from any other method to invoke that method's ancestor
  };
	delete Base._prototyping;

	// create the wrapper for the constructor function
	//var constructor = proto.constructor.valueOf(); //-dean
	var constructor = proto.constructor;
	var klass = proto.constructor = function() {
		if (!Base._prototyping) {
			if (this._constructing || this.constructor == klass) { // instantiation
				this._constructing = true;
				constructor.apply(this, arguments);
				delete this._constructing;
			} else if (arguments[0] != null) { // casting
				return (arguments[0].extend || extend).call(arguments[0], proto);
			}
		}
	};

	// build the class interface
	klass.ancestor = this;
	klass.extend = this.extend;
	klass.forEach = this.forEach;
	klass.implement = this.implement;
	klass.prototype = proto;
	klass.toString = this.toString;
	klass.valueOf = function(type) {
		//return (type == "object") ? klass : constructor; //-dean
		return (type == "object") ? klass : constructor.valueOf();
	};
	extend.call(klass, _static);
	// class initialisation
	if (typeof klass.init == "function") klass.init();
	return klass;
};

Base.prototype = {
	extend: function(source, value) {
		if (arguments.length > 1) { // extending with a name/value pair
			var ancestor = this[source];
			if (ancestor && (typeof value == "function") && // overriding a method?
				// the valueOf() comparison is to avoid circular references
				(!ancestor.valueOf || ancestor.valueOf() != value.valueOf()) &&
				/\bbase\b/.test(value)) {
				// get the underlying method
				var method = value.valueOf();
				// override
				value = function() {
					var previous = this.base || Base.prototype.base;
					this.base = ancestor;
					var returnValue = method.apply(this, arguments);
					this.base = previous;
					return returnValue;
				};
				// point to the underlying method
				value.valueOf = function(type) {
					return (type == "object") ? value : method;
				};
				value.toString = Base.toString;
			}
			this[source] = value;
		} else if (source) { // extending with an object literal
			var extend = Base.prototype.extend;
			// if this object has a customised extend method then use it
			if (!Base._prototyping && typeof this != "function") {
				extend = this.extend || extend;
			}
			var proto = {toSource: null};
			// do the "toString" and other methods manually
			var hidden = ["constructor", "toString", "valueOf"];
			// if we are prototyping then include the constructor
			var i = Base._prototyping ? 0 : 1;
			while (key = hidden[i++]) {
				if (source[key] != proto[key]) {
					extend.call(this, key, source[key]);

				}
			}
			// copy each of the source object's properties to this object
			for (var key in source) {
				if (!proto[key]) extend.call(this, key, source[key]);
			}
		}
		return this;
	}
};

// initialise
Base = Base.extend({
	constructor: function() {
		this.extend(arguments[0]);
	}
}, {
	ancestor: Object,
	version: "1.1",

	forEach: function(object, block, context) {
		for (var key in object) {
			if (this.prototype[key] === undefined) {
				block.call(context, object[key], key, object);
			}
		}
	},

	implement: function() {
		for (var i = 0; i < arguments.length; i++) {
			if (typeof arguments[i] == "function") {
				// if it's a function, call it
				arguments[i](this.prototype);
			} else {
				// add the interface using the extend method
				this.prototype.extend(arguments[i]);
			}
		}
		return this;
	},

	toString: function() {
		return String(this.valueOf());
	}
});



/*
	Utility class
*/
/* global Base */
var Util = Base.extend({
	constructor: null

}, { // class itnerface

	humanize: function humanFileSize(kbytes) {
		var unit = 1000;
		var units = ['kB', 'MB', 'GB', 'TB'];
		for (var i = 0; Math.abs(kbytes) >= unit && i < units.length; i++) {
			kbytes /= unit;
		}

		return kbytes.toFixed(1) + ' ' + units[i];
	}
});


/*
	Abstract class
*/

/* global vex Base */
/* exported AdminSocketBase */
var AdminSocketBase = Base.extend({
	socket: null,

	constructor: function(host) {
		// because i am abstract
		if (this.constructor === AdminSocketBase) {
			throw new Error('Cannot instantiate abstract class');
		}

		// We do not allow such child class to instantiate websocket that do not implement
		// onSocketMessage and onSocketOpen.
		if (typeof this.onSocketMessage === 'function' && typeof this.onSocketOpen === 'function') {
			this.socket = new WebSocket(host);
			this.socket.onopen = this.onSocketOpen.bind(this);
			this.socket.onclose = this.onSocketClose.bind(this);
			this.socket.onmessage = this.onSocketMessage.bind(this);
			this.socket.onerror = this.onSocketError.bind(this);
			this.socket.binaryType = 'arraybuffer';
		}
	},

	onSocketOpen: function() {
		/* Implemented by child */
	},

	onSocketMessage: function() {
		/* Implemented by child */
	},

	onSocketClose: function() {
		this.socket.onerror = function() {};
		this.socket.onclose = function() {};
		this.socket.onmessage = function() {};
		this.socket.close();
	},

	onSocketError: function() {
		vex.dialog.alert('Connection error');
	}
});


/*
	Socket to be intialized on opening the overview page in Admin console
*/
/* global vex $ Util AdminSocketBase */
var AdminSocketOverview = AdminSocketBase.extend({
	constructor: function(host) {
		this.base(host);
	},

	_basicStatsIntervalId: 0,

	_getBasicStats: function() {
		this.socket.send('total_mem');
		this.socket.send('active_docs_count');
		this.socket.send('active_users_count');
	},

	onSocketOpen: function() {
		this.socket.send('documents');
		this.socket.send('subscribe document addview rmview rmdoc');

		this._getBasicStats();
		var socketOverview = this;
		this._basicStatsIntervalId =
		setInterval(function() {
			return socketOverview._getBasicStats();
		}, 5000);

		// Allow table rows to have a context menu for killing children
		$('body').on('contextmenu', 'table tr', function(ev) {
			$('#rowContextMenu').css({
				display: 'block',
				left: ev.pageX,
				top: ev.pageY
			})
			.data('rowToKill', ev.target.parentElement.id);

			return false;
		})
		.click(function() {
			$('#rowContextMenu').hide();
		});

		$('#rowContextMenu').on('click', 'a', function() {
			vex.dialog.confirm({
				message: 'Are you sure you want to kill this child ?',
				callback: function(value) {
					if (value) {
						var killPid = ($('#rowContextMenu').data('rowToKill')).substring('doc'.length);
						socketOverview.socket.send('kill ' + killPid);
					}
					$('#rowContextMenu').hide();
				}
			});
		});
	},

	onSocketMessage: function(e) {
		var textMsg;
		if (typeof e.data === 'string') {
			textMsg = e.data;
		}
		else {
			textMsg = '';
		}

		var tableContainer = document.getElementById('doclist');
		var rowContainer;
		var pidEle, urlEle, viewsEle, memEle, docEle;
		var nViews, nTotalViews;
		var docProps, sPid, sUrl, sViews, sMem;
		if (textMsg.startsWith('documents')) {
			var documents = textMsg.substring('documents'.length);
			documents = documents.trim().split('\n');
			for (var i = 0; i < documents.length; i++) {
				if (documents[i] === '') {
					continue;
				}
				docProps = documents[i].trim().split(' ');
				sPid = docProps[0];
				sUrl = docProps[1];
				sViews = docProps[2];
				sMem = docProps[3];
				if (sUrl === '0') {
					continue;
				}
				rowContainer = document.createElement('tr');
				rowContainer.id = 'doc' + sPid;
				tableContainer.appendChild(rowContainer);

				pidEle = document.createElement('td');
				pidEle.innerHTML = sPid;
				rowContainer.appendChild(pidEle);

				urlEle = document.createElement('td');
				urlEle.innerHTML = sUrl;
				rowContainer.appendChild(urlEle);

				viewsEle = document.createElement('td');
				viewsEle.id = 'docview' + sPid;
				viewsEle.innerHTML = sViews;
				rowContainer.appendChild(viewsEle);

				memEle = document.createElement('td');
				memEle.innerHTML = Util.humanize(parseInt(sMem));
				rowContainer.appendChild(memEle);
			}
		}
		else if (textMsg.startsWith('addview')) {
			sPid = textMsg.substring('addview'.length).trim().split(' ')[0];
			nViews = parseInt(document.getElementById('docview' + sPid).innerHTML);
			document.getElementById('docview' + sPid).innerHTML = nViews + 1;
			nTotalViews = parseInt(document.getElementById('active_users_count').innerHTML);
			document.getElementById('active_users_count').innerHTML = nTotalViews + 1;
		}
		else if (textMsg.startsWith('rmview')) {
			sPid = textMsg.substring('addview'.length).trim().split(' ')[0];
			nViews = parseInt(document.getElementById('docview' + sPid).innerHTML);
			document.getElementById('docview' + sPid).innerHTML = nViews - 1;
			nTotalViews = parseInt(document.getElementById('active_users_count').innerHTML);
			document.getElementById('active_users_count').innerHTML = nTotalViews - 1;
		}
		else if (textMsg.startsWith('document')) {
			textMsg = textMsg.substring('document'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			sUrl = docProps[1];
			sMem = docProps[2];

			docEle = document.getElementById('doc' + sPid);
			if (docEle) {
				tableContainer.removeChild(docEle);
			}
			if (sUrl === '0') {
				return;
			}

			rowContainer = document.createElement('tr');
			rowContainer.id = 'doc' + docProps[0];
			tableContainer.appendChild(rowContainer);

			pidEle = document.createElement('td');
			pidEle.innerHTML = docProps[0];
			rowContainer.appendChild(pidEle);

			urlEle = document.createElement('td');
			urlEle.innerHTML = docProps[1];
			rowContainer.appendChild(urlEle);

			viewsEle = document.createElement('td');
			viewsEle.innerHTML = 0;
			viewsEle.id = 'docview' + docProps[0];
			rowContainer.appendChild(viewsEle);

			memEle = document.createElement('td');
			memEle.innerHTML = Util.humanize(parseInt(sMem));
			rowContainer.appendChild(memEle);

			var totalUsersEle = document.getElementById('active_docs_count');
			totalUsersEle.innerHTML = parseInt(totalUsersEle.innerHTML) + 1;
		}
		else if (textMsg.startsWith('total_mem') ||
			textMsg.startsWith('active_docs_count') ||
			textMsg.startsWith('active_users_count'))
		{
			textMsg = textMsg.split(' ');
			var sCommand = textMsg[0];
			var nData = parseInt(textMsg[1]);

			if (sCommand === 'total_mem') {
				nData = Util.humanize(nData);
			}
			document.getElementById(sCommand).innerHTML = nData;
		}
		else if (textMsg.startsWith('rmdoc')) {
			textMsg = textMsg.substring('rmdoc'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			docEle = document.getElementById('doc' + sPid);
			if (docEle) {
				tableContainer.removeChild(docEle);
			}
		}
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
	}
});


/*
	Socket to be intialized on opening the analytics page in Admin console
	containing various graphs to show to the user on specified interval
*/

/* global d3 Util AdminSocketBase */
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
				return Util.humanize(d);
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


/*
	Socket to be intialized on opening the settings page in Admin console
*/
/* global $ AdminSocketBase */
var AdminSocketSettings = AdminSocketBase.extend({
	constructor: function(host) {
		this.base(host);
		this._init();
	},

	_init: function() {
		var socketSettings = this.socket;
		$(document).ready(function() {
			$('#admin_settings').on('submit', function(e) {
				e.preventDefault();
				var memStatsSize = $('#mem_stats_size').val();
				var memStatsInterval = $('#mem_stats_interval').val();
				var cpuStatsSize = $('#cpu_stats_size').val();
				var cpuStatsInterval = $('#cpu_stats_interval').val();
				var command = 'set';
				command += ' mem_stats_size=' + memStatsSize;
				command += ' mem_stats_interval=' + memStatsInterval;
				command += ' cpu_stats_size=' + cpuStatsSize;
				command += ' cpu_stats_interval=' + cpuStatsInterval;
				socketSettings.send(command);
			});
		});
	},

	onSocketOpen: function() {
		this.socket.send('subscribe settings');
		this.socket.send('settings');
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
			var settings = textMsg.split(' ');
			for (var i = 0; i < settings.length; i++) {
				var setting = settings[i].split('=');
				var settingKey = setting[0];
				var settingVal = setting[1];
				document.getElementById(settingKey).value = settingVal;
			}
		}
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
	}
});


