/* -*- js-indent-level: 8 -*- */

class URLPopUpSection extends HTMLObjectSection {
    static sectionName = 'URL PopUp';
	containerId = 'hyperlink-pop-up-preview';
	linkId = 'hyperlink-pop-up';
	static cssClass = 'hyperlink-pop-up-container';
	copyButtonId = 'hyperlink-pop-up-copy';
	editButtonId = 'hyperlink-pop-up-edit';
	removeButtonId = 'hyperlink-pop-up-remove';

	constructor(url: string, documentPosition: cool.SimplePoint, linkPosition?: cool.SimplePoint) {
        super(URLPopUpSection.sectionName, null, null, documentPosition, URLPopUpSection.cssClass);

		const objectDiv = this.getHTMLObject();
		objectDiv.remove();
		document.getElementById('document-container').appendChild(objectDiv);

		this.sectionProperties.url = url;

		this.createUIElements(url);
		this.setUpCallbacks(linkPosition);

		document.getElementById('hyperlink-pop-up').title = url;

		if (app.map['wopi'].EnableRemoteLinkPicker)
			app.map.fire('postMessage', { msgId: 'Action_GetLinkPreview', args: { url: url } });

		this.sectionProperties.documentPosition = documentPosition.clone();
    }

	getPopUpWidth(): number {
		return this.getHTMLObject().getBoundingClientRect().width;
	}

	getPopUpHeight(): number {
		return this.getHTMLObject().getBoundingClientRect().height;
	}

	createUIElements(url: string) {
		const parent = this.getHTMLObject();
		L.DomUtil.createWithId('div', this.containerId, parent);

        const link = L.DomUtil.createWithId('a', this.linkId, parent);
		link.innerText = url;

		const copyBtn = L.DomUtil.createWithId('div', this.copyButtonId, parent);
		L.DomUtil.addClass(copyBtn, 'hyperlink-popup-btn');
		copyBtn.setAttribute('title', _('Copy link location'));

        const imgCopyBtn = L.DomUtil.create('img', 'hyperlink-pop-up-copyimg', copyBtn);
		L.LOUtil.setImage(imgCopyBtn, 'lc_copyhyperlinklocation.svg', app.map);
		imgCopyBtn.setAttribute('width', 18);
		imgCopyBtn.setAttribute('height', 18);
		imgCopyBtn.style.padding = '4px';

		const editBtn = L.DomUtil.createWithId('div', this.editButtonId, parent);
		L.DomUtil.addClass(editBtn, 'hyperlink-popup-btn');
		editBtn.setAttribute('title', _('Edit link'));

		const imgEditBtn = L.DomUtil.create('img', 'hyperlink-pop-up-editimg', editBtn);
		L.LOUtil.setImage(imgEditBtn, 'lc_edithyperlink.svg', app.map);
		imgEditBtn.setAttribute('width', 18);
		imgEditBtn.setAttribute('height', 18);
		imgEditBtn.style.padding = '4px';

		const removeBtn = L.DomUtil.createWithId('div', this.removeButtonId, parent);
		L.DomUtil.addClass(removeBtn, 'hyperlink-popup-btn');
		removeBtn.setAttribute('title', _('Remove link'));

		const imgRemoveBtn = L.DomUtil.create('img', 'hyperlink-pop-up-removeimg', removeBtn);
		L.LOUtil.setImage(imgRemoveBtn, 'lc_removehyperlink.svg', app.map);
		imgRemoveBtn.setAttribute('width', 18);
		imgRemoveBtn.setAttribute('height', 18);
		imgRemoveBtn.style.padding = '4px';

		const arrowDiv = document.createElement('div');
		arrowDiv.className = 'arrow-div';
		parent.appendChild(arrowDiv);
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
			app.map.sendUnoCommand('.uno:CopyHyperlinkLocation', params);
		};

		document.getElementById(this.editButtonId).onclick = () => {
			app.map.sendUnoCommand('.uno:EditHyperlink', params);
		};

		document.getElementById(this.removeButtonId).onclick = () => {
			app.map.sendUnoCommand('.uno:RemoveHyperlink', params);
		};
	}

	public static resetPosition(section: URLPopUpSection) {
		if (!section)
			section = app.sectionContainer.getSectionWithName(URLPopUpSection.sectionName);

		const left = section.sectionProperties.documentPosition.pX - section.getPopUpWidth() * 0.5 * app.dpiScale;
		const top = section.sectionProperties.documentPosition.pY - (section.getPopUpHeight() + 20) * app.dpiScale;

		if (section) {
			section.setPosition((left >= 0 ? left : 10), (top >= 0 ? top : 10));
			section.containerObject.requestReDraw();
		}
	}

	public static showURLPopUP(url: string, documentPosition: cool.SimplePoint, linkPosition?: cool.SimplePoint) {
		if (URLPopUpSection.isOpen())
			URLPopUpSection.closeURLPopUp();

		const section = new URLPopUpSection(url, documentPosition, linkPosition);
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

app.definitions.urlPopUpSection = URLPopUpSection;
