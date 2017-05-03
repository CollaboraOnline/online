/*
 * L.Map.StateChanges stores the state changes commands coming from core
 * LOK_CALLBACK_STATE_CHANGED callback
 */

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
		this._items[e.commandName] = e.state;
	},

	getItems: function() {
		return this._items;
	},

	getItemValue: function(unoCmd) {
		if (unoCmd && unoCmd.substring(0, 5) !== '.uno:') {
			unoCmd = '.uno:' + unoCmd;
		}

		return this._items[unoCmd];
	}
});

L.Map.addInitHook('addHandler', 'stateChangeHandler', L.Map.StateChangeHandler);
