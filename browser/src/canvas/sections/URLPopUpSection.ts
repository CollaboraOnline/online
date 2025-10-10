// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class URLPopUpSection extends HTMLObjectSection {
    static sectionName = 'URL PopUp';
	containerId = 'hyperlink-pop-up-preview';
	linkId = 'hyperlink-pop-up';
	static cssClass = 'hyperlink-pop-up-container';
	copyButtonId = 'hyperlink-pop-up-copy';
	editButtonId = 'hyperlink-pop-up-edit';
	removeButtonId = 'hyperlink-pop-up-remove';
	arrowDiv: HTMLDivElement;

	static arrowHalfWidth = 10;
	static horizontalPadding = 6;
	static popupVerticalMargin = 20;

	constructor(url: string, documentPosition: cool.SimplePoint, linkPosition?: cool.SimplePoint, linkIsClientSide = false) {
        super(URLPopUpSection.sectionName, null, null, documentPosition, URLPopUpSection.cssClass);

		const objectDiv = this.getHTMLObject();
		objectDiv.remove();
		document.getElementById('document-container').appendChild(objectDiv);

		this.sectionProperties.url = url;
		this.sectionProperties.linkIsClientSide = linkIsClientSide;

		this.createUIElements(url);
		this.setUpCallbacks(linkPosition);

		document.getElementById('hyperlink-pop-up').title = url;

		if (app.map['wopi'].EnableRemoteLinkPicker)
			app.map.fire('postMessage', { msgId: 'Action_GetLinkPreview', args: { url: url } });

		this.sectionProperties.documentPosition = documentPosition.clone();
		this.getHTMLObject().style.pointerEvents = '';
    }

	getPopUpWidth(): number {
		return this.getHTMLObject().getBoundingClientRect().width;
	}

	getPopUpHeight(): number {
		return this.getHTMLObject().getBoundingClientRect().height;
	}

	getPopUpBoundingRectangle() {
		return this.getHTMLObject().getBoundingClientRect();
	}

	createUIElements(url: string) {
		const parent = this.getHTMLObject();
		window.L.DomUtil.createWithId('div', this.containerId, parent);

        const link = window.L.DomUtil.createWithId('a', this.linkId, parent);
		link.innerText = url;
		const copyLinkText = _('Copy link location');
		const copyBtn = window.L.DomUtil.createWithId('div', this.copyButtonId, parent);
		window.L.DomUtil.addClass(copyBtn, 'hyperlink-popup-btn');
		copyBtn.setAttribute('title', copyLinkText);
		copyBtn.setAttribute('role', 'button');
		copyBtn.setAttribute('aria-label', copyLinkText);

        const imgCopyBtn = window.L.DomUtil.create('img', 'hyperlink-pop-up-copyimg', copyBtn);
		app.LOUtil.setImage(imgCopyBtn, 'lc_copyhyperlinklocation.svg', app.map);
		imgCopyBtn.setAttribute('width', 18);
		imgCopyBtn.setAttribute('height', 18);
		imgCopyBtn.setAttribute('alt', copyLinkText);
		imgCopyBtn.style.padding = '4px';

		const editLinkText = _('Edit link');
		const editBtn = window.L.DomUtil.createWithId('div', this.editButtonId, parent);
		window.L.DomUtil.addClass(editBtn, 'hyperlink-popup-btn');
		editBtn.setAttribute('title', editLinkText);
		editBtn.setAttribute('role', 'button');
		editBtn.setAttribute('aria-label', copyLinkText);


		const imgEditBtn = window.L.DomUtil.create('img', 'hyperlink-pop-up-editimg', editBtn);
		app.LOUtil.setImage(imgEditBtn, 'lc_edithyperlink.svg', app.map);
		imgEditBtn.setAttribute('width', 18);
		imgEditBtn.setAttribute('height', 18);
		imgEditBtn.setAttribute('alt', editLinkText);
		imgEditBtn.style.padding = '4px';

		const removeLinkText = _('Remove link');
		const removeBtn = window.L.DomUtil.createWithId('div', this.removeButtonId, parent);
		window.L.DomUtil.addClass(removeBtn, 'hyperlink-popup-btn');
		removeBtn.setAttribute('title', removeLinkText);
		removeBtn.setAttribute('role', 'button');
		removeBtn.setAttribute('aria-label', removeLinkText);

		const imgRemoveBtn = window.L.DomUtil.create('img', 'hyperlink-pop-up-removeimg', removeBtn);
		app.LOUtil.setImage(imgRemoveBtn, 'lc_removehyperlink.svg', app.map);
		imgRemoveBtn.setAttribute('width', 18);
		imgRemoveBtn.setAttribute('height', 18);
		imgRemoveBtn.setAttribute('alt', removeLinkText);
		imgRemoveBtn.style.padding = '4px';

		this.arrowDiv = document.createElement('div');
		this.arrowDiv.className = 'arrow-div';
		parent.appendChild(this.arrowDiv);
	}

	setUpCallbacks(linkPosition?: cool.SimplePoint) {
		document.getElementById(this.linkId).onclick = () => {
			if (!this.sectionProperties.url.startsWith('#'))
				app.map.fire('warn', {url: this.sectionProperties.url, map: app.map, cmd: 'openlink'});
			else
				app.map.sendUnoCommand('.uno:JumpToMark?Bookmark:string=' + encodeURIComponent(this.sectionProperties.url.substring(1)));
		};

		var params: any;
		if (linkPosition) {
			params = {
				PositionX: {
					type: 'long',
					value: linkPosition.x
				},
				PositionY: {
					type: 'long',
					value: linkPosition.y
				}
			};
		}

		document.getElementById(this.copyButtonId).onclick = () => {
			if (this.sectionProperties.linkIsClientSide) {
				app.map._clip.setTextSelectionText(this.sectionProperties.url);
				app.map._clip._execCopyCutPaste('copy');
			}
			// If _navigatorClipboardWrite is available, use it.
			else if (window.L.Browser.clipboardApiAvailable || window.ThisIsTheiOSApp)
				app.map._clip.filterExecCopyPaste('.uno:CopyHyperlinkLocation', params);
			else // Or use previous method.
				app.map.sendUnoCommand('.uno:CopyHyperlinkLocation', params);
		};

		document.getElementById(this.editButtonId).onclick = () => {
			if (!this.sectionProperties.linkIsClientSide) // For now link in client side works only on readonly mode
				app.map.sendUnoCommand('.uno:EditHyperlink', params);
		};

		document.getElementById(this.removeButtonId).onclick = () => {
			if (!this.sectionProperties.linkIsClientSide) // For now link in client side works only on readonly mode
				app.map.sendUnoCommand('.uno:RemoveHyperlink', params);
			URLPopUpSection.closeURLPopUp();
		};
	}

	reLocateArrow(arrowAtTop: boolean) {
		if (arrowAtTop) this.arrowDiv.classList.add('reverse');
		else this.arrowDiv.classList.remove('reverse');

		/*
			Normally, the documentPosition sent from the core side nicely positions the arrow.
			We will check if we reposition the popup.
			If the arrow position falls outside of the popup, we will put it on the edge.
		*/
		const clientRect = this.getPopUpBoundingRectangle();
		let arrowCSSLeft = this.sectionProperties.documentPosition.pX - app.activeDocument.activeView.viewedRectangle.pX1 + this.containerObject.getDocumentAnchor()[0] - URLPopUpSection.arrowHalfWidth;
		arrowCSSLeft /= app.dpiScale;
		arrowCSSLeft += document.getElementById('canvas-container').getBoundingClientRect().left; // Add this in case there is something on its left.
		arrowCSSLeft -= clientRect.left;
		this.arrowDiv.style.left = (arrowCSSLeft > URLPopUpSection.horizontalPadding ? arrowCSSLeft : URLPopUpSection.horizontalPadding) + 'px';
	}

	public static resetPosition(section: URLPopUpSection) {
		if (!section) section = app.sectionContainer.getSectionWithName(URLPopUpSection.sectionName) as URLPopUpSection;
		if (!section) return;

		let originalLeft = section.sectionProperties.documentPosition.pX - section.getPopUpWidth() * 0.5 * app.dpiScale;
		let originalTop = section.sectionProperties.documentPosition.pY - (section.getPopUpHeight() + URLPopUpSection.popupVerticalMargin) * app.dpiScale;

		const checkLeft = originalLeft - app.activeDocument.activeView.viewedRectangle.pX1;
		const checkTop = originalTop - app.activeDocument.activeView.viewedRectangle.pY1;

		let arrowAtTop = false;
		if (checkTop < 0) {
			originalTop = section.sectionProperties.documentPosition.pY + (URLPopUpSection.popupVerticalMargin * 2 * app.dpiScale);
			arrowAtTop = true;
		}

		if (checkLeft < 0) originalLeft = app.activeDocument.activeView.viewedRectangle.pX1;

		section.setPosition(originalLeft, originalTop);
		section.adjustHTMLObjectPosition();
		section.reLocateArrow(arrowAtTop);
		section.containerObject.requestReDraw();
	}

	public static showURLPopUP(url: string, documentPosition: cool.SimplePoint, linkPosition?: cool.SimplePoint, linkIsClientSide?: boolean) {
		if (URLPopUpSection.isOpen())
			URLPopUpSection.closeURLPopUp();

		const section = new URLPopUpSection(url, documentPosition, linkPosition, linkIsClientSide);
		app.sectionContainer.addSection(section);
		this.resetPosition(section);
    }

    public static closeURLPopUp() {
		if (URLPopUpSection.isOpen())
			app.sectionContainer.removeSection(URLPopUpSection.sectionName);
	}

    public static isOpen() {
		return app.sectionContainer.doesSectionExist(URLPopUpSection.sectionName);
    }
}
