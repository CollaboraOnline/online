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

	private adjustIDs(content: HTMLElement) {
		const servedBy = content.querySelector(':scope #served-by');
		if (servedBy) servedBy.id += '-cloned';

		const wopiHostId = content.querySelector(':scope #wopi-host-id');
		if (wopiHostId) wopiHostId.id += '-cloned';
	}

	private hideElementsHiddenByDefault(content: HTMLElement) {
		const servedBy = content.querySelector(
			':scope #served-by-cloned',
		) as HTMLElement;
		if (servedBy) servedBy.style.display = 'none';

		const wopiHostId = content.querySelector(
			':scope #wopi-host-id-cloned',
		) as HTMLElement;
		if (wopiHostId) wopiHostId.style.display = 'none';
	}

	public show() {
		const windowAny = window as any;
		// Just as a test to exercise the Async Trace Event functionality, uncomment this
		// line and the asyncTraceEvent.finish() below.
		// var asyncTraceEvent = app.socket.createAsyncTraceEvent('cool-showLOAboutDialog');

		const aboutDialogId = 'about-dialog';
		// Move the div sitting in 'body' as content and make it visible
		const content: HTMLElement = document
			.getElementById(aboutDialogId)
			.cloneNode(true) as HTMLElement;
		content.style.display = 'block';

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
					'TimeZone: ' + app.socket.WSDServer.TimeZone;
			}
		}

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
		var box = document.getElementById(aboutDialogId + '-box');
		var innerDiv = L.DomUtil.create('div', '', null);
		box.insertBefore(innerDiv, box.firstChild);
		innerDiv.appendChild(content);

		var form = document.getElementById('about-dialog-box');

		form.addEventListener('click', this.aboutDialogClickHandler.bind(this));
		form.addEventListener('keyup', this.aboutDialogKeyHandler.bind(this));
		form.querySelector('#coolwsd-version').querySelector('a').focus();
		var copyversion = L.DomUtil.create(
			'button',
			'ui-pushbutton jsdialog',
			null,
		);
		copyversion.setAttribute('id', 'modal-dialog-about-dialog-box-copybutton');
		copyversion.setAttribute(
			'title',
			_('Copy all version information in English'),
		);
		var img = L.DomUtil.create('img', null, null);
		app.LOUtil.setImage(img, 'lc_copy.svg', this.map);
		copyversion.innerHTML =
			'<img src="' + sanitizeUrl(img.src) + '" width="18px" height="18px">';
		copyversion.addEventListener(
			'click',
			this.copyVersionInfoToClipboard.bind(this),
		);
		this.map.uiManager.enableTooltip(copyversion);
		var aboutok = document.getElementById(
			'modal-dialog-about-dialog-box-yesbutton',
		);
		if (aboutok) {
			aboutok.before(copyversion);
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

			let logLevelInformation;
			if (newLogLevel === 'default')
				logLevelInformation = 'default (from coolwsd.xml)';
			else if (newLogLevel === 'verbose')
				logLevelInformation = 'most verbose (from coolwsd.xml)';
			else if (newLogLevel === 'terse')
				logLevelInformation = 'least verbose (from coolwsd.xml)';
			else logLevelInformation = newLogLevel;

			console.debug('Log level: ' + logLevelInformation);
		}
	}

	private copyVersionInfoToClipboard() {
		let text =
			'COOLWSD version: ' +
			this.getVersionInfoFromClass('coolwsd-version') +
			'\n';
		text +=
			'LOKit version: ' + this.getVersionInfoFromClass('lokit-version') + '\n';
		text += 'Served by: ' + document.getElementById('os-info').innerText + '\n';
		text +=
			'Server ID: ' + document.getElementById('coolwsd-id').innerText + '\n';
		text +=
			'WOPI host: ' + document.getElementById('wopi-host-id').innerText + '\n';
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
}

// Initiate the class.
JSDialog.aboutDialog = (map: any) => {
	return new AboutDialog(map);
};
