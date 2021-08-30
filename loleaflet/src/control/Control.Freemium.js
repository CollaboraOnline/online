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
		freemiumPurchaseDescription: '',
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
		this.Freemium.freemiumPurchaseDescription = _(freemiumInfo['FreemiumPurchaseDescription']);
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

			var that = this;

			if (window.mode.isMobile()) {
				var overlay = L.DomUtil.create('div', 'freemium-overlay', DOMParentElement);
				var lock = L.DomUtil.create('img', 'freemium-overlay-lock', overlay);
				lock.src = 'images/lc_freeemiumlock.svg';
			}

			$(DOMParentElement).click(function(event) {
				event.stopPropagation();
				that.openSubscriptionPopup();
			});
		}
	},

	openSubscriptionPopup: function() {
		var freemiumOnMobile = '';

		if (window.mode.isMobile()) {
			freemiumOnMobile = 'mobile';
		}
		var that = this;
		vex.dialog.confirm({
			unsafeMessage: [
				'<div class="container">',
				'<div class="item illustration"></div>',
				'<div class="item">',
				'<h1>' + this.Freemium.freemiumPurchaseTitle + '</h1>',
				'<p>' + this.Freemium.freemiumPurchaseDescription + '<p>',
				'<ul>',
				'<li>' + this.Freemium.writerHighlights + '</li>',
				'<li>' + this.Freemium.calcHighlights + '</li>',
				'<li>' + this.Freemium.impressHighlights + '</li>',
				'<li>' + this.Freemium.drawHighlights + '</li>',
				'</ul>',
				'</div>',
				'<div>'
			].join(''),
			showCloseButton: false,
			contentClassName: 'vex-content vex-freemium ' + freemiumOnMobile,
			callback: function (value) {
				if (value)
					window.open(that.Freemium.freemiumPurchaseLink, '_blank');
			},
			buttons: [
				$.extend({}, vex.dialog.buttons.YES, { text: _('Unlock') }),
				$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
			]
		});
	},

	isFreemiumDeniedItem: function(item) {

		var command = '';
		if (item.command) // in notebookbar uno commands are stored as command
			command = item.command;
		else if (item.uno) { // in classic mode uno commands are stored as uno in menus
			if (typeof item.uno === 'string')
				command = item.uno;
			else if (this.Freemium.freemiumDenyList.indexOf(item.uno.textCommand) >= 0
			|| this.Freemium.freemiumDenyList.indexOf(item.uno.objectCommand) >= 0) // some unos have multiple commands
				return true;
		}
		else if (item.id)
			command = item.id;
		else if (item.unosheet)
			command = item.unosheet;

		if (this.Freemium.freemiumDenyList.indexOf(command) >= 0)
			return true;

		return false;
	},

	isFreemiumUser: function() {
		return this.Freemium.isFreemiumUser;
	},

});
