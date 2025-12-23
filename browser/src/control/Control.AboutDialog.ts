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

/*
 * AboutDialog - implements Help - About dialog with version and warnings
 */

declare var JSDialog: any;
declare var brandProductName: any;
declare var brandProductURL: any;
declare var sanitizeUrl: any;

class AboutDialog {
	map: any;

	constructor(map: any) {
		this.map = map;
	}

	private aboutDialogClickHandler(e: any) {
		if (e.detail === 3) {
			this.map._debug.toggle();
		}
	}

	private static adjustIDs(content: HTMLElement) {
		const servedBy = content.querySelector(':scope #served-by');
		if (servedBy) servedBy.id += '-cloned';

		const wopiHostId = content.querySelector(':scope #wopi-host-id');
		if (wopiHostId) wopiHostId.id += '-cloned';
	}

	private static hideElementsHiddenByDefault(content: HTMLElement) {
		const servedBy = content.querySelector(
			':scope #served-by-cloned',
		) as HTMLElement;
		if (servedBy) servedBy.style.display = 'none';

		const wopiHostId = content.querySelector(
			':scope #wopi-host-id-cloned',
		) as HTMLElement;
		if (wopiHostId) wopiHostId.style.display = 'none';
	}

	private copyFromHiddenTemplate(content: HTMLElement, selector: string): void {
		const hiddenTemplate = document.querySelector('#about-dialog-template #about-dialog-info');
		if (!hiddenTemplate) return;

		const source = hiddenTemplate.querySelector(selector);
		const destination = content.querySelector(selector);

		if (source && destination) {
				destination.innerHTML = source.innerHTML;
		}
	}

	public static populateAboutContent(content: HTMLElement, map: any) {
		const windowAny = window as any;

		const hiddenInfo = document.querySelector('#about-dialog-template #about-dialog-info');
		if (hiddenInfo) {
			const fieldsToCopy = [
				'#coolwsd-version',
				'#lokit-version',
				'#lokit-extra',
				'#served-by',
				'#js-dialog',
			];

			fieldsToCopy.forEach(selector => {
				const source = hiddenInfo.querySelector(selector);
				const target = content.querySelector(selector);
				if (source && target) {
						target.innerHTML = source.innerHTML;
				}
			});
		}

		/*
			Now we copied the about dialog content which was already in the document, hidden.
			This copied content also includes the IDs. So we have now duplicate IDs for elements, which is contrary to HTML rules.
			Let's modify the IDs of such elements and add "-cloned" at the end.
		*/
		this.adjustIDs(content);
		this.hideElementsHiddenByDefault(content); // Now we can safely hide the elements that we want hidden by default.

		if (content.querySelector('#js-dialog')) {
			(content.querySelector('#js-dialog') as HTMLAnchorElement).onclick =
				function () {
					app.socket.sendMessage('uno .uno:WidgetTestDialog');
					app.map.uiManager.closeModal('modal-dialog-about-dialog-box', false);
				};
		}

		// fill product-name and product-string
		let productName;
		if (windowAny.ThisIsAMobileApp) {
			productName = windowAny.MobileAppName;
		} else {
			productName =
				typeof brandProductName === 'string' && brandProductName.length > 0
					? brandProductName
					: 'Collabora Online Development Edition (unbranded)';
		}
		var productURL =
			typeof brandProductURL === 'string' && brandProductURL.length > 0
				? brandProductURL
				: 'https://collaboraonline.github.io/';

		const productNameElement = content.querySelector(
			'#product-name',
		) as HTMLElement;
		productNameElement.innerText = productName;
		content.classList.add(
			'product-' +
				productName
					.split(/[ ()]+/)
					.join('-')
					.toLowerCase(),
		);

		var productString = _('This version of {productname} is powered by');
		var productNameWithURL;
		if (!windowAny.ThisIsAMobileApp)
			productNameWithURL =
				'<a href="' +
				sanitizeUrl(productURL) +
				'" target="_blank">' +
				productName +
				'</a>';
		else productNameWithURL = productName;

		const productStringElement = content.querySelector(
			'#product-string',
		) as HTMLElement;
		if (productStringElement)
			productStringElement.innerText = productString.replace(
				'{productname}',
				productNameWithURL,
			);

		const links = content.querySelectorAll<HTMLAnchorElement>(
			'#coolwsd-version a, #lokit-version a, #lokit-extra a',
		);

		for (let i = 0; i < links.length; i++) {
			const link = links[i];
			link.addEventListener('click', (event: MouseEvent) => {
				event.preventDefault();
				window.open(link.href, '_blank');
			});
		}

		const licenseInformationElement = content.querySelector(
			'#license-information',
		) as HTMLElement;
		if (licenseInformationElement) {
			const a = document.createElement('a');
			a.href = 'javascript:void(0)';
			a.textContent = _UNO('.uno:ShowLicense');
			a.addEventListener('click', () => window.postMobileMessage('LICENSE'));
			licenseInformationElement.appendChild(a);
		}

		const slowProxyElement = content.querySelector(
			'#slow-proxy',
		) as HTMLElement;
		if (windowAny.socketProxy) slowProxyElement.innerText = _('"Slow Proxy"');

		if (windowAny.indirectSocket) {
			const routeTokenElement = content.querySelector(
				'#routeToken',
			) as HTMLElement;
			routeTokenElement.innerText = 'RouteToken: ' + windowAny.routeToken;
			if (windowAny.geolocationSetup) {
				const timezoneElement = content.querySelector(
					'#timeZone',
				) as HTMLElement;
				timezoneElement.innerText =
					_('Time zone:') + ' ' + app.socket.WSDServer.TimeZone;
			}
		}
	}

	public show() {
		const windowAny = window as any;

    // Create the About dialog structure
		const aboutDialogId = 'about-dialog';
    const content: HTMLElement = AboutDialog.createAboutDialogContent(true);
    content.style.display = 'block';

		this.copyFromHiddenTemplate(content, '#coolwsd-version');
		this.copyFromHiddenTemplate(content, '#lokit-version');
		this.copyFromHiddenTemplate(content, '#lokit-extra');
		this.copyFromHiddenTemplate(content, '#served-by');
		this.copyFromHiddenTemplate(content, '#slow-proxy');
		this.copyFromHiddenTemplate(content, '#js-dialog');

		/*
			Now we copied the about dialog content which was already in the document, hidden.
			This copied content also includes the IDs. So we have now duplicate IDs for elements, which is contrary to HTML rules.
			Let's modify the IDs of such elements and add "-cloned" at the end.
		*/
		AboutDialog.adjustIDs(content);
		AboutDialog.hideElementsHiddenByDefault(content); // Now we can safely hide the elements that we want hidden by default.

		if (content.querySelector('#js-dialog')) {
			(content.querySelector('#js-dialog') as HTMLAnchorElement).onclick =
				function () {
					app.socket.sendMessage('uno .uno:WidgetTestDialog');
					app.map.uiManager.closeModal('modal-dialog-about-dialog-box', false);
				};
		}

		// fill product-name and product-string
		let productName;
		if (windowAny.ThisIsAMobileApp) {
			productName = windowAny.MobileAppName;
		} else {
			productName =
				typeof brandProductName === 'string' && brandProductName.length > 0
					? brandProductName
					: 'Collabora Online Development Edition (unbranded)';
		}
		var productURL =
			typeof brandProductURL === 'string' && brandProductURL.length > 0
				? brandProductURL
				: 'https://collaboraonline.github.io/';

		const productNameElement = content.querySelector(
			'#product-name',
		) as HTMLElement;
		productNameElement.innerText = productName;
		content.classList.add(
			'product-' +
				productName
					.split(/[ ()]+/)
					.join('-')
					.toLowerCase(),
		);

		var productString = _('This version of {productname} is powered by');
		var productNameWithURL;
		if (!windowAny.ThisIsAMobileApp)
			productNameWithURL =
				'<a href="' +
				sanitizeUrl(productURL) +
				'" target="_blank">' +
				productName +
				'</a>';
		else productNameWithURL = productName;

		const productStringElement = content.querySelector(
			'#product-string',
		) as HTMLElement;
		if (productStringElement)
			productStringElement.innerText = productString.replace(
				'{productname}',
				productNameWithURL,
			);

		const links = content.querySelectorAll<HTMLAnchorElement>(
			'#coolwsd-version a, #lokit-version a, #lokit-extra a',
		);

		for (let i = 0; i < links.length; i++) {
			const link = links[i];
			link.addEventListener('click', (event: MouseEvent) => {
				event.preventDefault();
				window.open(link.href, '_blank');
			});
		}

		const licenseInformationElement = content.querySelector(
			'#license-information',
		) as HTMLElement;
		if (licenseInformationElement) {
			const a = document.createElement('a');
			a.href = 'javascript:void(0)';
			a.textContent = _UNO('.uno:ShowLicense');
			a.addEventListener('click', () => window.postMobileMessage('LICENSE'));
			licenseInformationElement.appendChild(a);
		}

		const slowProxyElement = content.querySelector(
			'#slow-proxy',
		) as HTMLElement;
		if (windowAny.socketProxy) slowProxyElement.innerText = _('"Slow Proxy"');

		if (windowAny.indirectSocket) {
			const routeTokenElement = content.querySelector(
				'#routeToken',
			) as HTMLElement;
			routeTokenElement.innerText = 'RouteToken: ' + windowAny.routeToken;
			if (windowAny.geolocationSetup) {
				const timezoneElement = content.querySelector(
					'#timeZone',
				) as HTMLElement;
				timezoneElement.innerText =
					_('Time zone:') + ' ' + app.socket.WSDServer.TimeZone;
			}
		}

		AboutDialog.populateAboutContent(content, this.map);

		this.map.uiManager.showYesNoButton(
			aboutDialogId + '-box',
			productName,
			'',
			_('OK'),
			null,
			null,
			null,
			true,
		);

		this.showImpl(aboutDialogId, content);
	}

	showImpl(aboutDialogId: string, content: HTMLElement) {
		var box = document.getElementById(aboutDialogId + '-box');

		// TODO: do it JSDialog native...
		if (!box) {
			setTimeout(() => {
				this.showImpl(aboutDialogId, content);
			}, 10);
			return;
		}

		var innerDiv = window.L.DomUtil.create('div', '', null);
		box.insertBefore(innerDiv, box.firstChild);
		innerDiv.appendChild(content);

		var form = document.getElementById('about-dialog-box');

		form.addEventListener('click', this.aboutDialogClickHandler.bind(this));
		form.addEventListener('keyup', this.aboutDialogKeyHandler.bind(this));
		form.querySelector('#coolwsd-version').querySelector('a').focus();
		const copyVersionText = _('Copy all version information in English');
		var copyVersion = window.L.DomUtil.create(
			'button',
			'ui-pushbutton jsdialog',
			null,
		);
		copyVersion.setAttribute('id', 'modal-dialog-about-dialog-box-copybutton');
		copyVersion.setAttribute('aria-label', copyVersionText);
		copyVersion.setAttribute('data-cooltip', copyVersionText);
		var img = window.L.DomUtil.create('img', null, null);
		app.LOUtil.setImage(img, 'lc_copy.svg', this.map);
		copyVersion.innerHTML =
			'<img src="' + sanitizeUrl(img.src) + '" width="18px" height="18px">';
		copyVersion.addEventListener(
			'click',
			this.copyVersionInfoToClipboard.bind(this),
		);
		window.L.control.attachTooltipEventListener(copyVersion, this.map);
		var aboutOk = document.getElementById(
			'modal-dialog-about-dialog-box-yesbutton',
		);
		if (aboutOk) {
			aboutOk.before(copyVersion);
		}
	}

	private aboutDialogKeyHandler(e: KeyboardEvent) {
		if (e.key === 'd') {
			this.map._debug.toggle();
		} else if (e.key === 'l') {
			// L toggles the Online logging level between the default (whatever
			// is set in coolwsd.xml or on the coolwsd command line) and the
			// most verbose a client is allowed to set (which also can be set in
			// coolwsd.xml or on the coolwsd command line).
			//
			// In a typical developer "make run" setup, the default is "trace"
			// so there is nothing more verbose. But presumably it is different
			// in production setups.

			app.socket.threadLocalLoggingLevelToggle =
				!app.socket.threadLocalLoggingLevelToggle;

			const newLogLevel = app.socket.threadLocalLoggingLevelToggle
				? 'verbose'
				: 'default';
			app.socket.sendMessage('loggingleveloverride ' + newLogLevel);

			const logLevelInformation = app.socket.threadLocalLoggingLevelToggle
				? 'most verbose (from coolwsd.xml)'
				: 'default (from coolwsd.xml)';
			console.debug('Log level: ' + logLevelInformation);
		}
	}

	private copyVersionInfoToClipboard() {
		let text = '';

		const addLine = (label: string, value?: string | null): void => {
			if (value && value.trim() !== '') {
				text += `${label}: ${value}\n`;
			}
		};

		addLine(
			'COOLWSD version',
			this.getVersionInfoFromClass?.('coolwsd-version'),
		);
		addLine('LOKit version', this.getVersionInfoFromClass?.('lokit-version'));
		addLine('Served by', document.getElementById('os-info')?.innerText);
		addLine('Server ID', document.getElementById('coolwsd-id')?.innerText);
		addLine('WOPI host', document.getElementById('wopi-host-id')?.innerText);

		text = text.replace(/\u00A0/g, ' ');

		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard
				.writeText(text)
				.then(
					function () {
						window.console.log('Text copied to clipboard');
						this.contentHasBeenCopiedShowSnackbar();
					}.bind(this),
				)
				.catch(function (error) {
					window.console.error('Error copying text to clipboard:', error);
				});
		} else {
			var textArea = document.createElement('textarea');
			textArea.style.position = 'absolute';
			textArea.style.opacity = '0';
			textArea.value = text;
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand('copy');
				window.console.log('Text copied to clipboard');
				this.contentHasBeenCopiedShowSnackbar();
			} catch (error) {
				window.console.error('Error copying text to clipboard:', error);
			} finally {
				document.body.removeChild(textArea);
			}
		}
	}

	private contentHasBeenCopiedShowSnackbar() {
		const timeout = 1000;
		this.map.uiManager.showSnackbar(
			'Version information has been copied',
			null,
			null,
			timeout,
		);
		const copybutton = document.querySelector(
			'#modal-dialog-about-dialog-box-copybutton > img',
		);
		app.LOUtil.setImage(copybutton, 'lc_clipboard-check.svg', this.map);
		setTimeout(() => {
			app.LOUtil.setImage(copybutton, 'lc_copy.svg', this.map);
		}, timeout);
	}

	private getVersionInfoFromClass(className: string) {
		const versionElement = document.getElementById(className);
		let versionInfo = versionElement.innerText;

		const gitHashIndex = versionInfo.indexOf('git hash');
		if (gitHashIndex > -1) {
			versionInfo =
				versionInfo.slice(0, gitHashIndex) +
				'(' +
				versionInfo.slice(gitHashIndex) +
				')';
		}

		return versionInfo;
	}

	private static createElementWithId(tag: string, id: string, attrs: Record<string, string> = {}): HTMLElement {
		const el = document.createElement(tag);
		el.id = id;
		Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
		return el;
	}

	private static createElementWithClass(tag: string, className: string, child?: HTMLElement): HTMLElement {
		const el = document.createElement(tag);
		el.className = className;
		if (child) el.appendChild(child);
		return el;
	}

	// Shared static method to create the About dialog structure
	public static createAboutDialogContent(includeHeader: boolean): HTMLElement {
		const windowAny = window as any;

		const aboutDialog = document.createElement('div');
		aboutDialog.id = 'about-dialog';
		aboutDialog.tabIndex = 0;

		let productName = typeof brandProductName === 'string' && brandProductName.length > 0
			? brandProductName
			: 'Collabora Online Development Edition (unbranded)';

		if (windowAny.ThisIsAMobileApp) {
			productName = windowAny.MobileAppName || productName;
		}

		const productClass = 'product-' + productName
			.split(/[ ()]+/)
			.join('-')
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, '') + '-';

		aboutDialog.className = productClass;

		if (includeHeader) {
			const header = document.createElement('div');
			header.id = 'about-dialog-header';

			const integratorLogo = document.createElement('fig');
			integratorLogo.id = 'integrator-logo';
			header.appendChild(integratorLogo);

			const title = document.createElement('h1');
			title.id = 'product-name';
			title.textContent = productName;
			header.appendChild(title);

			aboutDialog.appendChild(header);
			aboutDialog.appendChild(document.createElement('hr'));
		}
		
		const container = document.createElement('div');
		container.id = 'about-dialog-container';

		const logosDiv = document.createElement('div');
		logosDiv.id = 'about-dialog-logos';

		const productLogo = document.createElement('fig');
		productLogo.id = 'product-logo';
		const lokitLogo = document.createElement('fig');
		lokitLogo.id = 'lokit-logo';

		logosDiv.appendChild(productLogo);
		logosDiv.appendChild(lokitLogo);
		container.appendChild(logosDiv);

		const infoContainer = document.createElement('div');
		infoContainer.id = 'about-dialog-info-container';

		const infoDiv = document.createElement('div');
		infoDiv.id = 'about-dialog-info';

		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'coolwsd-version-label'));
		infoDiv.appendChild(AboutDialog.createElementWithClass('div', 'about-dialog-info-div',
			AboutDialog.createElementWithId('div', 'coolwsd-version', { dir: 'ltr' })));
		infoDiv.appendChild(AboutDialog.createElementWithClass('div', 'spacer'));

		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'lokit-version-label'));
		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'lokit-extra'));
		infoDiv.appendChild(AboutDialog.createElementWithClass('div', 'about-dialog-info-div',
			AboutDialog.createElementWithId('div', 'lokit-version', { dir: 'ltr' })));

		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'served-by'));
		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'slow-proxy'));
		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'js-dialog'));
		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'routeToken'));
		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'timeZone'));
		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'wopi-host-id'));
		infoDiv.appendChild(AboutDialog.createElementWithId('div', 'license-information'));

		const copyrightP = document.createElement('p');
		copyrightP.className = 'about-dialog-info-div';
		copyrightP.innerHTML = '<span dir="ltr">Copyright © 2025, banobe.</span>';
		infoDiv.appendChild(copyrightP);

		infoContainer.appendChild(infoDiv);
		container.appendChild(infoContainer);
		aboutDialog.appendChild(container);

		return aboutDialog;
	}
}

// Initiate the class
JSDialog.aboutDialog = (map: any) => {
	return new AboutDialog(map);
};
