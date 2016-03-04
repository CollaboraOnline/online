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
	Abstract class
*/
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

		$('#rowContextMenu').on('click', 'a', function(e) {
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
		else
			textMsg = '';

		var tableContainer = document.getElementById('doclist');
		if (textMsg.startsWith('documents')) {
			var documents = textMsg.substring('documents'.length);
			documents = documents.trim().split('\n');
			for (var i = 0; i < documents.length; i++) {
				if (documents[i] == '')
					continue;
				var docProps = documents[i].trim().split(' ');
				var sPid = docProps[0];
				var sUrl = docProps[1];
				var sViews = docProps[2];
				var sMem = docProps[3];
				if (sUrl === '0') {
					continue;
				}
				var rowContainer = document.createElement('tr');
				rowContainer.id = 'doc' + sPid;
				tableContainer.appendChild(rowContainer);

				var pidEle = document.createElement('td');
				pidEle.innerHTML = sPid;
				rowContainer.appendChild(pidEle);
				var urlEle = document.createElement('td');
				urlEle.innerHTML = sUrl;
				rowContainer.appendChild(urlEle);
				var viewsEle = document.createElement('td');
				viewsEle.id = 'docview' + sPid;
				viewsEle.innerHTML = sViews;
				rowContainer.appendChild(viewsEle);
				var memEle = document.createElement('td');
				memEle.innerHTML = sMem;
				rowContainer.appendChild(memEle);
			}
		}
		else if (textMsg.startsWith('addview')) {
			var sPid = textMsg.substring('addview'.length).trim().split(' ')[0];
			var nViews = parseInt(document.getElementById('docview' + sPid).innerHTML);
			document.getElementById('docview' + sPid).innerHTML = nViews + 1;
			var nTotalViews = parseInt(document.getElementById('active_users_count').innerHTML);
			document.getElementById('active_users_count').innerHTML = nTotalViews + 1;
		}
		else if (textMsg.startsWith('rmview')) {
			var sPid = textMsg.substring('addview'.length).trim().split(' ')[0];
			var nViews = parseInt(document.getElementById('docview' + sPid).innerHTML);
			document.getElementById('docview' + sPid).innerHTML = nViews - 1;
			var nTotalViews = parseInt(document.getElementById('active_users_count').innerHTML);
			document.getElementById('active_users_count').innerHTML = nTotalViews - 1;
		}
		else if (textMsg.startsWith('document')) {
			textMsg = textMsg.substring('document'.length);
			var docProps = textMsg.trim().split(' ');
			var sPid = docProps[0];
			var sUrl = docProps[1];
			var sMem = docProps[2];
			var docEle = document.getElementById('doc' + sPid);
			if (docEle) {
				tableContainer.removeChild(docEle);
			}
			if (sUrl === '0') {
				return;
			}
			var rowContainer = document.createElement('tr');
			rowContainer.id = 'doc' + docProps[0];
			tableContainer.appendChild(rowContainer);

			var pidEle = document.createElement('td');
			pidEle.innerHTML = docProps[0];
			rowContainer.appendChild(pidEle);
			var urlEle = document.createElement('td');
			urlEle.innerHTML = docProps[1];
			rowContainer.appendChild(urlEle);
			var viewsEle = document.createElement('td');
			viewsEle.innerHTML = 0;
			viewsEle.id = 'docview' + docProps[0];
			rowContainer.appendChild(viewsEle);
			var memEle = document.createElement('td');
			memEle.innerHTML = sMem;
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

			document.getElementById(sCommand).innerHTML = nData;
		}
		else if (textMsg.startsWith('rmdoc')) {
			textMsg = textMsg.substring('rmdoc'.length);
			var docProps = textMsg.trim().split(' ');
			var sPid = docProps[0];
			var docEle = document.getElementById('doc' + sPid);
			if (docEle) {
				tableContainer.removeChild(docEle);
			}
		}
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
	}
});
