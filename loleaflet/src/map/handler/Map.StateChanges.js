/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.StateChanges stores the state changes commands coming from core
 * LOK_CALLBACK_STATE_CHANGED callback
 */
 /* global $ */
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
		var state;

		if (typeof(e.state) == 'object') {
			state = e.state;
		} else if (typeof(e.state) == 'string') {
			var isLanguageStatus = e.commandName === 'LanguageStatus';
			var index = e.state.indexOf('{') && !isLanguageStatus;
			try {
				state = index !== -1 ? JSON.parse(e.state.substring(index)) : e.state;
			} catch (exception) {
				state = e.state;
			}
		}

		this._items[e.commandName] = state;
		if (e.commandName === '.uno:CurrentTrackedChangeId') {
			var redlineId = 'change-' + state;
			this._map._docLayer._annotations.selectById(redlineId);
		}
		$('#document-container').removeClass('slide-master-mode');
		$('#document-container').addClass('slide-normal-mode');

		if (e.commandName === '.uno:SlideMasterPage') {
			var slideMasterPageItem = this._map['stateChangeHandler'].getItemValue('.uno:SlideMasterPage');
			if (slideMasterPageItem === 'true') {
				$('#document-container').removeClass('slide-normal-mode');
				$('#document-container').addClass('slide-master-mode');
				this._map._docLayer._preview._showMasterSlides();
			}
			if (!slideMasterPageItem  || slideMasterPageItem  == 'false' || slideMasterPageItem  == 'undefined') {
				$('#document-container').removeClass('slide-master-mode');
				$('#document-container').addClass('slide-normal-mode');
				this._map._docLayer._preview._hideMasterSlides();
			}
		}
	},

	getItems: function() {
		return this._items;
	},

	getItemValue: function(unoCmd) {
		if (unoCmd && unoCmd.substring(0, 5) !== '.uno:') {
			unoCmd = '.uno:' + unoCmd;
		}

		return this._items[unoCmd];
	},

	setItemValue: function(unoCmd, value) {
		if (unoCmd && unoCmd.substring(0, 5) !== '.uno:') {
			unoCmd = '.uno:' + unoCmd;
		}

		this._items[unoCmd] = value;
	}
});

L.Map.addInitHook('addHandler', 'stateChangeHandler', L.Map.StateChangeHandler);
