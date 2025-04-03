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
 * JSDialog.Sidebar
 */

// /* global app */
class Sidebar extends SidebarBase {
	targetDeckCommand: string;

	constructor(
		map: any,
		options: SidebarOptions = {
			animSpeed: 1000,
		} /* Default speed: to be used on load */,
	) {
		super(map, options, SidebarType.Sidebar);
	}

	onAdd(map: ReturnType<typeof L.map>) {
		super.onAdd(map);
		this.map.on('sidebar', this.onSidebar, this);
	}

	onRemove() {
		super.onRemove();
		this.map.off('sidebar');
	}

	updateSidebarPrefs(currentDeck: string) {
		const decks = [
			'PropertyDeck',
			'SdSlideTransitionDeck',
			'SdCustomAnimationDeck',
			'SdMasterPagesDeck',
			'NavigatorDeck',
			'StyleListDeck',
			'A11yCheckDeck',
		];

		const deckPref: { [key: string]: string } = {};
		decks.forEach((deck: string) => {
			deckPref[deck] = currentDeck === deck ? 'true' : 'false';
		});
		this.map.uiManager.setDocTypeMultiplePrefs(deckPref);
	}

	commandForDeck(deckId: string): string {
		if (deckId === 'PropertyDeck') return '.uno:SidebarDeck.PropertyDeck';
		else if (deckId === 'SdSlideTransitionDeck')
			return '.uno:SlideChangeWindow';
		else if (deckId === 'SdCustomAnimationDeck') return '.uno:CustomAnimation';
		else if (deckId === 'SdMasterPagesDeck') return '.uno:MasterSlidesPanel';
		else if (deckId === 'NavigatorDeck') return '.uno:Navigator';
		else if (deckId === 'StyleListDeck')
			return '.uno:SidebarDeck.StyleListDeck';
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
		if (unoCommand !== null && unoCommand !== undefined)
			app.socket.sendMessage('uno ' + unoCommand);
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
				) {
					sidebarData.children.splice(i, 1);
					continue;
				}

				if (
					typeof sidebarData.children[i].id === 'string' &&
					sidebarData.children[i].id.startsWith('Navigator')
				) {
					this.markNavigatorTreeView(sidebarData);
				}
			}

			if (sidebarData.children.length) {
				this.onResize();

				if (
					sidebarData.children &&
					sidebarData.children[0] &&
					sidebarData.children[0].id
				) {
					var currentDeck = sidebarData.children[0].id;
					this.updateSidebarPrefs(currentDeck);
					if (this.targetDeckCommand) {
						var stateHandler = this.map['stateChangeHandler'];
						var isCurrent = stateHandler
							? stateHandler.getItemValue(this.targetDeckCommand)
							: false;
						// just to be sure check with other method
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
				if (!this.isVisible()) $('#sidebar-dock-wrapper').addClass('visible');

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
