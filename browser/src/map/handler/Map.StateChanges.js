/* -*- js-indent-level: 8 -*- */
/*
 * window.L.Map.StateChanges stores the state changes commands coming from core
 * LOK_CALLBACK_STATE_CHANGED callback
 */
/* global $ app cool */
/*eslint no-extend-native:0*/
window.L.Map.mergeOptions({
	stateChangeHandler: true
});

window.L.Map.StateChangeHandler = window.L.Handler.extend({

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
			state = e.state; // fallback if we don't find JSON

			var firstIndex = state.indexOf('{');
			var lastIndex = state.lastIndexOf('}');

			if (firstIndex !== -1 && lastIndex !== -1) {
				const substring = state.substring(firstIndex, lastIndex + 1);
				try {
					state = JSON.parse(substring);
				} catch (e) {
					console.error('Failed to parse state JSON: "' + substring + '" : ' + e);
				}
			}
		}
		const commandName = this.ensureUnoCommandPrefix(e.commandName);

		this._items[commandName] = state;
		if (e.commandName === '.uno:CurrentTrackedChangeId') {
			var redlineId = 'change-' + state;
			const annotations = app.sectionContainer.getSectionWithName(app.CSections.CommentList.name);
			if (annotations) annotations.selectById(redlineId);
			else console.error('_onStateChanged: section "CommentList" missing');
		}

		if (e.commandName === '.uno:SlideMasterPage') {
			this._map._docLayer._selectedMode = (state === true || state === 'true') ? 1 : 0;
		}

		if (e.commandName === '.uno:FormatPaintbrush') {
			if (state === 'true')
				$('#document-canvas').addClass('bucket-cursor');
			else
				$('#document-canvas').removeClass('bucket-cursor');
		}

		if (e.commandName === '.uno:StartWithPresentation' && (state === true || state === 'true')) {
			let startPresentationParam = window.coolParams.get('startPresentation');
			if (startPresentationParam === '' || startPresentationParam === 'true' || startPresentationParam === '1') {
				app.dispatcher.dispatch('presentation');
			}
		}

		if (commandName == '.uno:PageLinks') {
			let links = [];
			if (state && state.links) {
				for (const link of state.links) {
					const end1 = link.rectangle.indexOf('x');
					const end2 = link.rectangle.indexOf('@');
					const end3 = link.rectangle.indexOf(',');
					const new_link = {
						rectangle: new cool.SimpleRectangle(
							parseFloat(link.rectangle.substring(end2 + 2, end3)),
							parseFloat(link.rectangle.substring(end3 + 1)),
							parseFloat(link.rectangle.substring(0, end1)),
							parseFloat(link.rectangle.substring(end1 + 1, end2))
						),
						uri: link.uri
					};
					links.push(new_link);
				}
			}
			this._items[commandName] = links;
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

window.L.Map.addInitHook('addHandler', 'stateChangeHandler', window.L.Map.StateChangeHandler);
