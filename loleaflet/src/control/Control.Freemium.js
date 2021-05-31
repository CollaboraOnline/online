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

			var that = this;
			// not using window.interface because even in notebookbar,
			// we have hamburger menu which is like classic mode (accommodates properties like track changes)
			// better to check where element exists in the DOM in this case
			if ($(DOMParentElement).parents('.notebookbar').length) {
				$(DOMParentElement).click(function(event) {
					event.stopPropagation();
					that.openSubscriptionPopup();
				});
			} else {
				var overlay = L.DomUtil.create('div', 'freemium-overlay', DOMParentElement);
				var lock = L.DomUtil.create('img', 'freemium-overlay-lock', overlay);
				lock.src = 'images/lc_freeemiumlock.svg';

				$(overlay).click(function(event) {
					event.stopPropagation();
					that.openSubscriptionPopup();
				});
			}
		}
	},

	openSubscriptionPopup: function() {
		var that = this;
		vex.dialog.confirm({
			unsafeMessage: [
				'<div class="container">',
				'<div class="item illustration"></div>',
				'<div class="item">',
				'<h1>' + this.Freemium.freemiumPurchaseTitle + '</h1>',
				'<p>' + this.Freemium.freemiumPurchaseDiscription + '<p>',
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
			contentClassName: 'vex-content vex-freemium',
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
