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
 * JSDialog.NavigatorPanel
 */

/* global app */
class NavigatorPanel extends SidebarBase {
	navigationPanel: HTMLElement;
	floatingNavIcon: HTMLElement;
	presentationControlsWrapper: HTMLElement;
	navigatorDockWrapper: HTMLElement;
	closeNavButton: HTMLElement;

	constructor(map: any, options: SidebarOptions) {
		super(map, options, SidebarType.Navigator);
	}

	onAdd(map: ReturnType<typeof L.map>) {
		super.onAdd(map);
		this.map.on('navigator', this.onNavigator, this);
		this.map.on('doclayerinit', this.onDocLayerInit, this);
		this.navigationPanel = document.getElementById(`navigation-sidebar`);
		this.floatingNavIcon = document.getElementById(`navigator-floating-icon`);
		this.presentationControlsWrapper = this.navigationPanel.querySelector(
			'#presentation-controls-wrapper',
		);
		this.navigatorDockWrapper = this.navigationPanel.querySelector(
			'#navigator-dock-wrapper',
		);
		this.map.on(
			'zoomend',
			this.handleFloatingButtonVisibilityOnZoomChange,
			this,
		);
	}

	onRemove() {
		super.onRemove();
		this.map.off('navigator');
		this.map.off('zoomend');
		this.map.off('doclayerinit');
	}

	onDocLayerInit() {
		// for presentation show slide sorter navigation panel by default
		if (
			app.map.getDocType() === 'presentation' &&
			!app.map.isReadOnlyMode() &&
			!window.mode.isMobile()
		) {
			// Navigator panel should be visible and by default we should open slide sorter in case of impress/draw
			this.showNavigationPanel();
		}
	}

	initializeNavigator(docType: string) {
		// Create navigation container
		const navContainer = L.DomUtil.create(
			'div',
			'navigation-options-container',
		);
		navContainer.id = 'navigation-options-wrapper';

		// For calc we do not need to add floating icon
		if (docType !== 'spreadsheet') {
			// Create floating navigation button
			this.createFloatingNavigatorBtn();

			// Insert floatingNavIcon right after navigatorPanel
			this.navigationPanel.insertAdjacentElement(
				'afterend',
				this.floatingNavIcon,
			);
		}

		// Create header section
		var navHeader = L.DomUtil.create('div', 'navigation-header', navContainer);

		var navTitle = L.DomUtil.create('span', 'navigation-title', navHeader);
		navTitle.textContent = _('Navigation');

		// Create a wrapper div
		const closeNavWrapper = L.DomUtil.create(
			'div',
			'close-navigation-wrapper',
			navHeader,
		);

		// Create the close button inside the div
		this.closeNavButton = L.DomUtil.create(
			'span',
			'close-navigation-button',
			closeNavWrapper,
		);
		const closeNavigationText = _('Close Navigation');
		this.closeNavButton.setAttribute('aria-label', closeNavigationText);
		this.closeNavButton.setAttribute('data-cooltip', closeNavigationText);
		L.control.attachTooltipEventListener(this.closeNavButton, this.map);
		this.closeNavButton.setAttribute('tabindex', '0');

		this.closeNavButton.addEventListener(
			'click',
			function () {
				this.closeNavigation();
				if (app.map.uiManager.getBooleanDocTypePref('ShowNavigator')) {
					app.map.sendUnoCommand('.uno:Navigator');
				}
			}.bind(this),
		);

		if (this.map.isPresentationOrDrawing()) {
			var navOptions = L.DomUtil.create('div', 'navigation-tabs', navContainer);
			navOptions.id = 'navigation-options';

			// Create Slide Sorter tab
			var slideSorterTab = L.DomUtil.create('div', 'tab selected', navOptions);
			slideSorterTab.id = 'tab-slide-sorter';
			slideSorterTab.textContent = _('Slides');

			// Create Navigator tab
			var navigatorTab = L.DomUtil.create('div', 'tab', navOptions);
			navigatorTab.id = 'tab-navigator';
			navigatorTab.textContent = _('Outline');

			// Tab Click Event Listener
			[slideSorterTab, navigatorTab].forEach((tab) => {
				tab.addEventListener(
					'click',
					function () {
						this.switchNavigationTab(tab.id);
					}.bind(this),
				);
			});
		}

		if (this.navigationPanel) {
			// Insert navigation container as the first child & navHeader as next-child of navigator-panel
			this.navigationPanel.prepend(navContainer);
			this.navigationPanel.prepend(navHeader);
		}
	}

	createFloatingNavigatorBtn() {
		// Get or create the main wrapper div
		this.floatingNavIcon.className =
			'notebookbar unoNavigator unospan-view-navigator unotoolbutton visible';
		this.floatingNavIcon.setAttribute('tabindex', '-1');
		this.floatingNavIcon.setAttribute('data-cooltip', _('Navigator'));
		L.control.attachTooltipEventListener(this.floatingNavIcon, this.map);

		// Create the button wrapper (square container)
		const buttonWrapper = document.createElement('div');
		buttonWrapper.className = 'navigator-btn-wrapper'; // Class for styling
		buttonWrapper.setAttribute('aria-label', _('Navigator'));

		// Create the button
		const button = document.createElement('button');
		button.className = 'ui-content unobutton';
		button.id = 'floating-navigator';
		button.accessKey = 'ZN';
		button.setAttribute('aria-pressed', 'false');

		// Create the image inside the button
		const img = document.createElement('img');
		app.LOUtil.setImage(img, 'lc_navigator.svg', this.map);

		// Append elements
		button.appendChild(img);
		buttonWrapper.appendChild(button);
		this.floatingNavIcon.appendChild(buttonWrapper);

		// Click event
		this.floatingNavIcon.addEventListener(
			'click',
			function () {
				this.showNavigationPanel();
				if (app.map.isPresentationOrDrawing()) {
					this.switchNavigationTab('tab-slide-sorter');
				} else {
					app.map.sendUnoCommand('.uno:Navigator');
				}
			}.bind(this),
		);
	}

	onNavigator(data: FireEvent) {
		var navigatorData = data.data;
		this.builder.setWindowId(navigatorData.id);
		$(this.container).empty();

		if (
			navigatorData.action === 'close' ||
			window.app.file.disableSidebar ||
			this.map.isReadOnlyMode()
		) {
			this.closeSidebar();
		} else if (navigatorData.children) {
			if (navigatorData.children.length) {
				this.onResize();
			}

			this.markNavigatorTreeView(navigatorData);

			this.builder.build(this.container, [navigatorData]);
			// There is case where user can directly click navigator from notebookbar view option
			// in that case we first show the navigation panel and then switch to tab view
			this.showNavigationPanel();
			$('#navigator-dock-wrapper').show(200);
			app.map.uiManager.setDocTypePref('ShowNavigator', true);
			// this will update the indentation marks for elements like ruler
			app.map.fire('fixruleroffset');
			if (app.map.isPresentationOrDrawing()) {
				this.switchNavigationTab('tab-navigator');
			}
		} else {
			this.closeSidebar();
		}
	}

	closeSidebar() {
		this.closeNavigation();
		this.map.uiManager.setDocTypePref('ShowNavigator', false);
		super.closeSidebar();
	}

	// Function to handle tab click
	switchNavigationTab(tabId: string) {
		// Remove 'selected' class from all tabs
		this.navigationPanel
			.querySelectorAll('.navigation-tabs .tab')
			.forEach((t) => t.classList.remove('selected'));

		// Add 'selected' class to the clicked tab
		this.navigationPanel.querySelector('#' + tabId).classList.add('selected');

		// Toggle visibility based on tabId
		if (tabId === 'tab-slide-sorter') {
			this.presentationControlsWrapper.style.display = 'block';
			this.navigatorDockWrapper.style.display = 'none';
		} else {
			if (!this.map.uiManager.getBooleanDocTypePref('ShowNavigator'))
				app.map.sendUnoCommand('.uno:Navigator');
			this.presentationControlsWrapper.style.display = 'none';
			this.navigatorDockWrapper.style.display = 'block';
		}
	}

	handleFloatingButtonVisibilityOnZoomChange() {
		// Handle special case for impress as the view there is landscape so better to hide Floating Nav ICON on lower zoom compare to other app
		if (
			this.map.getZoom() >= 14 ||
			(this.map.getZoom() >= 13 && this.map.getDocType() === 'presentation')
		) {
			this.floatingNavIcon.classList.remove('visible');
		} else if (!this.navigationPanel.classList.contains('visible')) {
			this.floatingNavIcon.classList.add('visible');
		}
	}

	showNavigationPanel() {
		this.navigationPanel.classList.add('visible');
		this.floatingNavIcon.classList.remove('visible');
	}

	closeNavigation() {
		this.navigationPanel.classList.remove('visible');
		this.floatingNavIcon.classList.add('visible');
		this.handleFloatingButtonVisibilityOnZoomChange(); // on close panel we should check if we can display nav icon or not based on zoom level
	}
}

JSDialog.NavigatorPanel = function (map: any, options: SidebarOptions) {
	return new NavigatorPanel(map, options);
};
