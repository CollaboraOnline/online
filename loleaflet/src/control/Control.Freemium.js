/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Freemium handler
 */

/* global $ vex _ */
L.Map.include({

	Freemium: {
		isFreemiumUser: false,
		freemiumDenyList: [],
		freemiumPurchaseTitle: '',
		freemiumPurchaseLink: '',
		freemiumPurchaseDiscription: '',
		writerHighlights: '',
		calcHighlights: '',
		impressHighlights: '',
		drawHighlights: '',
	},

	_setFreemiumProps: function(freemiumInfo) {
		this.Freemium.isFreemiumUser = !!freemiumInfo['IsFreemiumUser'];
		this.Freemium.freemiumDenyList = freemiumInfo['FreemiumDenyList'];
		this.Freemium.freemiumPurchaseTitle = _(freemiumInfo['FreemiumPurchaseTitle']);
		this.Freemium.freemiumPurchaseLink = _(freemiumInfo['FreemiumPurchaseLink']);
		this.Freemium.freemiumPurchaseDiscription = _(freemiumInfo['FreemiumPurchaseDiscription']);
		this.Freemium.writerHighlights = _(freemiumInfo['WriterHighlights']);
		this.Freemium.calcHighlights = _(freemiumInfo['CalcHighlights']);
		this.Freemium.impressHighlights = _(freemiumInfo['ImpressHighlights']);
		this.Freemium.drawHighlights = _(freemiumInfo['DrawHighlights']);
	},

	// We mark the element disabled for the freemium
	// and add overlay on the element
	disableFreemiumItem: function(item, DOMParentElement, buttonToDisable) {
		if (this.isFreemiumUser() && this.isFreemiumDeniedItem(item)) {
			$(DOMParentElement).data('freemiumDenied', true);
			$(DOMParentElement).addClass('freemium-disabled');
			$(buttonToDisable).off('click');

			var overlay = L.DomUtil.create('div', 'freemium-overlay', DOMParentElement);
			var lock = L.DomUtil.create('img', 'freemium-overlay-lock', overlay);
			lock.src = 'images/lc_freeemiumlock.svg';

			var that = this;
			$(overlay).click(function(event) {
				event.stopPropagation();
				that.openSubscriptionPopup();
			});
		}
	},

	openSubscriptionPopup: function() {
		var map = this;
		var freemiumLocation = 'freemium.html';
		if (window.socketProxy)
			freemiumLocation = window.host + window.serviceRoot + '/loleaflet/dist/' + freemiumLocation;
		$.get(freemiumLocation, function(data) {
			console.debug(data);
			map._doVexOpenFreemiumFile(data);
		});
	},

	_doVexOpenFreemiumFile: function(data) {
		var btnText = 'Unlock';
		console.debug(data);
		vex.dialog.open({
			unsafeMessage: data,
			showCloseButton: false,
			contentClassName: 'vex-content vex-freemium',
			buttons: [
				$.extend({}, vex.dialog.buttons.YES, { text: (btnText) }),
				vex.dialog.buttons.NO
			]
		});
	},

	isFreemiumDeniedItem: function(item) {
		if (this.Freemium.freemiumDenyList.includes(item.command) // in notebookbar uno commands are stored as command
		|| this.Freemium.freemiumDenyList.includes(item.uno) // in classic mode uno commands are stored as uno in menus
		|| this.Freemium.freemiumDenyList.includes(item.id))
			return true;
		return false;
	},

	isFreemiumUser: function() {
		return this.Freemium.isFreemiumUser;
	},

});
