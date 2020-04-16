/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.SigningBar
 */

/* global $ w2ui */
L.Control.SigningBar = L.Control.extend({

	onAdd: function (map) {
		this.map = map;
		this.create();

		map.on('doclayerinit', this.onDocLayerInit, this);
	},

	create: function() {
		var that = this;
		if (L.DomUtil.get('document-signing-bar') !== null) {
			var toolbar = $('#document-signing-bar');
			toolbar.w2toolbar({
				name: 'document-signing-bar',
				tooltip: 'bottom',
				items: this.map.setupSigningToolbarItems(),
				onClick: function (e) {
					that.onClick(e, e.target);
					window.hideTooltip(this, e.target);
				},
				onRefresh: function() {
				}
			});
			toolbar.bind('touchstart', function() {
				w2ui['document-signing-bar'].touchStarted = true;
			});
		}
	},

	onClick: function(e, id, item) {
		if ('document-signing-bar' in w2ui && w2ui['document-signing-bar'].get(id) !== null) {
			var toolbar = w2ui['document-signing-bar'];
			item = toolbar.get(id);
		}

		// In the iOS app we don't want clicking on the toolbar to pop up the keyboard.
		if (!window.ThisIsTheiOSApp && id !== 'zoomin' && id !== 'zoomout' && id !== 'mobile_wizard' && id !== 'insertion_mobile_wizard') {
			this.map.focus(this.map.canAcceptKeyboardInput()); // Maintain same keyboard state.
		}

		if (item.disabled) {
			return;
		}

		this.map.handleSigningClickEvent(id, item); // this handles a bunch of signing bar click events
	},

	onDocLayerInit: function() {
		if (L.DomUtil.get('document-signing-bar') !== null) {
			this.map.signingInitializeBar();
		}
	}
});

L.control.signingBar = function () {
	return new L.Control.SigningBar();
};
