/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.StateChanges stores the state changes commands coming from core
 * LOK_CALLBACK_STATE_CHANGED callback
 */
/* global $ app */
/*eslint no-extend-native:0*/
L.Map.mergeOptions({
	stateChangeHandler: true
});

L.Map.StateChangeHandler = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
		// Contains the items for which state will be tracked
		// Stores the last received value from core ('true', 'false', 'enabled', 'disabled')
		this._items = {};
	},

	addHooks: function () {
		this._map.on('commandstatechanged', this._onStateChanged, this);
	},

	removeHooks: function () {
		this._map.off('commandstatechanged', this._onStateChanged, this);
	},

	_onStateChanged: function(e) {
		var slideMasterPageItem = this._map['stateChangeHandler'].getItemValue('.uno:SlideMasterPage');
		var state;

		if (typeof (e.state) == 'object') {
			state = e.state;
		} else if (typeof (e.state) == 'string') {
			var firstIndex = e.state.indexOf('{');
			var lastIndex = e.state.lastIndexOf('}');

			if (firstIndex !== -1 && lastIndex !== -1) {
				state = JSON.parse(e.state.substring(firstIndex, lastIndex + 1));
			} else {
				state = e.state;
			}
		}
		const commandName = this.ensureUnoCommandPrefix(e.commandName);

		this._items[commandName] = state;
		if (e.commandName === '.uno:CurrentTrackedChangeId') {
			var redlineId = 'change-' + state;
			const annotations = app.sectionContainer.getSectionWithName(L.CSections.CommentList.name);
			if (annotations) annotations.selectById(redlineId);
			else console.error('_onStateChanged: section "CommentList" missing');
		}

		if (e.commandName === '.uno:SlideMasterPage') {
			this._map._docLayer._selectedMode = (state === true || state === 'true') ? 1 : 0;
		}

		if (e.commandName === '.uno:FormatPaintbrush') {
			if (state === 'true')
				$('.leaflet-pane.leaflet-map-pane').addClass('bucket-cursor');
			else
				$('.leaflet-pane.leaflet-map-pane').removeClass('bucket-cursor');
		}

		if (e.commandName === '.uno:StartWithPresentation' && (state === true || state === 'true')) {
			let startPresentationParam = window.coolParams.get('startPresentation');
			if (startPresentationParam === '' || startPresentationParam === 'true' || startPresentationParam === '1') {
				app.dispatcher.dispatch('presentation');
			}
		}

		$('#document-container').removeClass('slide-master-mode');
		$('#document-container').addClass('slide-normal-mode');
		if (slideMasterPageItem) {
			$('#document-container').removeClass('slide-normal-mode');
			$('#document-container').addClass('slide-master-mode');
		}
		if (!slideMasterPageItem || slideMasterPageItem == 'false' || slideMasterPageItem == 'undefined') {
			$('#document-container').removeClass('slide-master-mode');
			$('#document-container').addClass('slide-normal-mode');
		}
	},

	getItems: function() {
		return this._items;
	},

	getItemValue: function(unoCmd) {
		unoCmd = this.ensureUnoCommandPrefix(unoCmd);

		return this._items[unoCmd];
	},

	setItemValue: function(unoCmd, value) {
		unoCmd = this.ensureUnoCommandPrefix(unoCmd);

		this._items[unoCmd] = value;
	},

	ensureUnoCommandPrefix(unoCmd) {
		if (unoCmd && unoCmd.substring(0, 5) !== '.uno:') {
			return '.uno:' + unoCmd;
		}
		return unoCmd;
	}
});

L.Map.addInitHook('addHandler', 'stateChangeHandler', L.Map.StateChangeHandler);
