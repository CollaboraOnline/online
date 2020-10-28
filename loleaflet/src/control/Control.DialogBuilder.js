/* -*- mode: js; js-indent-level: 8 -*- */
/*
 * L.Control.DialogBuilder.
 */

L.Control.DialogBuilder = L.Control.JSDialogBuilder.extend({

	_setup: function(options) {
		this._clearColorPickers();
		this.wizard = options.mobileWizard;
		this._map = options.map;
		this.callback = this._defaultCallbackHandler;

		this._controlHandlers['borderwindow'] = this._containerHandler;
		this._controlHandlers['modaldialog'] = this._containerHandler;
		this._controlHandlers['tabdialog'] = this._containerHandler;
		this._controlHandlers['container'] = this._containerHandler;
		this._controlHandlers['tabpage'] = this._containerHandler;
		this._controlHandlers['window'] = this._containerHandler;

		this._controlHandlers['scrollbar'] = this._ignoreHandler;

		this._controlHandlers['frame'] = this._frameHandler;

		this._controlHandlers['multilineedit'] = this._multiLineEditControl;

		this._controlHandlers['tabcontrol'] = this._tabsControlHandler;

		this._controlHandlers['grid'] = this._gridHandler;

		this._controlHandlers['fixedtext'] = this._fixedtextControl;

		this._controlHandlers['pushbutton'] = this._pushbuttonControl;
		this._controlHandlers['radiobutton'] = this._radiobuttonControl;
		this._controlHandlers['okbutton'] = this._pushbuttonControl;
		this._controlHandlers['helpbutton'] = this._pushbuttonControl;
		this._controlHandlers['cancelbutton'] = this._pushbuttonControl;

		this._controlHandlers['treelistbox'] = this._treelistboxControl;

		this._currentDepth = 0;
	},

	_defaultCallbackHandler: function(objectType, eventType, object, target, builder) {
		builder.wizard.setCurrentScrollPosition();
		this._map.fire('dialogaction', {dialogid: builder.wizard._container.dialogid,
						controlid: object.id, object: object, data: target});
	},

	_frameHandler: function(parentContainer, data) {
		if (data.children.length > 1) {
			return true;
		}

		return false;
	},

	_fillProperties: function(node, entry) {
		for (var key in entry) {
			node.setAttribute('data-' + key, entry[key]);
		}
	},

	_fillTreeListBox: function(parent, entries, builder) {
		var node, span, entry;

		for (var index in entries) {
			entry = entries[index];
			if (entry.entries && L.Util.isArray(entry.entries)) {
				node = L.DomUtil.create('li', '', parent);
				span = L.DomUtil.create('span',
							builder.wizard.options.nameElement + '-bullet', node);
				span.innerHTML = builder._cleanText(entry.text);
				L.DomEvent.on(span, 'click', function () {
					node.classList.toggle(builder.wizard.options.nameElement + '-active');
					this.classList.toggle(builder.wizard.options.nameElement + '-down');
				});
				node = L.DomUtil.create('ul', builder.wizard.options.nameElement + '-sublist', node);
				builder._fillTreeListBox(node, entry.entries, builder);
				delete entry.entries;
				delete entry.text;
			} else {
				node = L.DomUtil.create('li', '', parent);
				node.innerHTML = builder._cleanText(entry.text);
				delete entry.text;
			}
			builder._fillProperties(node, entry);
		}
	},

	_treelistboxControl: function(parent, data, builder) {
		if (data.entries && L.Util.isArray(data.entries)) {
			var container = L.DomUtil.create('ul',
							 builder.wizard.options.nameElement + '-treelistbox', parent);
			container.id = data.id;
			L.DomEvent.on(container, 'click', function (e) {
				builder.callback('treelistbox', 'click', container,
						 (e.target || e.srcElement), builder);
			});
			builder._fillTreeListBox(container, data.entries, builder);
		}

		return false;
	}

});

L.control.dialogBuilder = function (options) {
	var builder = new L.Control.DialogBuilder(options);
	builder._setup(options);
	return builder;
};
