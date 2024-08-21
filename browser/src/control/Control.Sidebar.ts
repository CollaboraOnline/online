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
 * JSDialog.Sidebar
 */

/* global app */
interface SidebarOptions {
	animSpeed: number;
}
class Sidebar {
	options: SidebarOptions;

	map: any;

	container: HTMLDivElement;
	builder: any;
	targetDeckCommand: string;

	constructor(
		map: any,
		options: SidebarOptions = {
			animSpeed: 1000,
		} /* Default speed: to be used on load */,
	) {
		this.options = options;
		this.onAdd(map);
	}

	onAdd(map: ReturnType<typeof L.map>) {
		this.map = map;

		app.events.on('resize', this.onResize.bind(this));

		this.builder = new L.control.jsDialogBuilder({
			mobileWizard: this,
			map: map,
			cssClass: 'jsdialog sidebar',
		});
		this.container = L.DomUtil.create(
			'div',
			'sidebar-container',
			$('#sidebar-panel').get(0),
		);

		this.map.on('sidebar', this.onSidebar, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
	}

	onRemove() {
		this.map.off('sidebar');
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	}

	isVisible(): boolean {
		return $('#sidebar-dock-wrapper').is(':visible');
	}

	closeSidebar() {
		$('#sidebar-dock-wrapper').hide();
		this.map._onResize();

		if (!this.map.editorHasFocus()) {
			this.map.fire('editorgotfocus');
			this.map.focus();
		}

		this.map.uiManager.setDocTypePref('ShowSidebar', false);
	}

	onJSUpdate(e: FireEvent) {
		var data = e.data;

		if (data.jsontype !== 'sidebar') return;

		if (!this.container) return;

		if (!this.builder) return;

		// reduce unwanted warnings in console
		if (data.control.id === 'addonimage') {
			window.app.console.log('Ignored update for control: ' + data.control.id);
			return;
		}

		this.builder.updateWidget(this.container, data.control);
	}

	onJSAction(e: FireEvent) {
		var data = e.data;

		if (data.jsontype !== 'sidebar') return;

		if (!this.builder) return;

		if (!this.container) return;

		var innerData = data.data;
		if (!innerData) return;

		var controlId = innerData.control_id;

		// Panels share the same name for main containers, do not execute actions for them
		// if panel has to be shown or hidden, full update will appear
		if (
			controlId === 'contents' ||
			controlId === 'Panel' ||
			controlId === 'titlebar' ||
			controlId === 'addonimage'
		) {
			window.app.console.log(
				'Ignored action: ' +
					innerData.action_type +
					' for control: ' +
					controlId,
			);
			return;
		}

		this.builder.executeAction(this.container, innerData);
	}

	onResize() {
		var wrapper = document.getElementById('sidebar-dock-wrapper');
		wrapper.style.maxHeight =
			document.getElementById('document-container').getBoundingClientRect()
				.height + 'px';
	}

	unsetSelectedSidebar() {
		this.map.uiManager.setDocTypePref('PropertyDeck', false);
		this.map.uiManager.setDocTypePref('SdSlideTransitionDeck', false);
		this.map.uiManager.setDocTypePref('SdCustomAnimationDeck', false);
		this.map.uiManager.setDocTypePref('SdMasterPagesDeck', false);
		this.map.uiManager.setDocTypePref('NavigatorDeck', false);
		this.map.uiManager.setDocTypePref('A11yCheckDeck', false);
	}

	commandForDeck(deckId: string): string {
		if (deckId === 'PropertyDeck') return '.uno:SidebarDeck.PropertyDeck';
		else if (deckId === 'SdSlideTransitionDeck')
			return '.uno:SlideChangeWindow';
		else if (deckId === 'SdCustomAnimationDeck') return '.uno:CustomAnimation';
		else if (deckId === 'SdMasterPagesDeck') return '.uno:MasterSlidesPanel';
		else if (deckId === 'NavigatorDeck') return '.uno:Navigator';
		else if (deckId === 'A11yCheckDeck')
			return '.uno:SidebarDeck.A11yCheckDeck';
		return '';
	}

	setupTargetDeck(unoCommand: string) {
		this.targetDeckCommand = unoCommand;
	}

	getTargetDeck(): string {
		return this.targetDeckCommand;
	}

	changeDeck(unoCommand: string | null) {
		if (unoCommand !== null) app.socket.sendMessage('uno ' + unoCommand);
		this.setupTargetDeck(unoCommand);
	}

	onSidebar(data: FireEvent) {
		var sidebarData = data.data;
		this.builder.setWindowId(sidebarData.id);
		$(this.container).empty();

		if (
			sidebarData.action === 'close' ||
			window.app.file.disableSidebar ||
			this.map.isReadOnlyMode()
		) {
			this.closeSidebar();
		} else if (sidebarData.children) {
			for (var i = sidebarData.children.length - 1; i >= 0; i--) {
				if (
					sidebarData.children[i].type !== 'deck' ||
					sidebarData.children[i].visible === false
				)
					sidebarData.children.splice(i, 1);
			}

			if (sidebarData.children.length) {
				this.onResize();

				if (
					sidebarData.children &&
					sidebarData.children[0] &&
					sidebarData.children[0].id
				) {
					this.unsetSelectedSidebar();
					var currentDeck = sidebarData.children[0].id;
					this.map.uiManager.setDocTypePref(currentDeck, true);
					if (this.targetDeckCommand) {
						var stateHandler = this.map['stateChangeHandler'];
						var isCurrent = stateHandler
							? stateHandler.getItemValue(this.targetDeckCommand)
							: false;
						// just to be sure chack with other method
						if (isCurrent === 'false' || !isCurrent)
							isCurrent =
								this.targetDeckCommand === this.commandForDeck(currentDeck);
						if (this.targetDeckCommand && (isCurrent === 'false' || !isCurrent))
							this.changeDeck(this.targetDeckCommand);
					} else {
						this.changeDeck(this.targetDeckCommand);
					}
				}

				this.builder.build(this.container, [sidebarData]);
				if (!this.isVisible())
					$('#sidebar-dock-wrapper').show(this.options.animSpeed);

				this.map.uiManager.setDocTypePref('ShowSidebar', true);
			} else {
				this.closeSidebar();
			}
		}
	}
}

JSDialog.Sidebar = function (map: any, options: SidebarOptions) {
	return new Sidebar(map, options);
};
