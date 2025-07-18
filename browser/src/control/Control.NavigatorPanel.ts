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
	quickFindWrapper: HTMLElement;
	closeNavButton: HTMLElement;

	constructor(map: any) {
		super(map, SidebarType.Navigator);
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
		this.quickFindWrapper = this.navigationPanel.querySelector(
			'#quick-find-wrapper',
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
		const allowedDocTypes = ['presentation', 'drawing'];
		// for presentation show slide sorter navigation panel by default
		if (
			allowedDocTypes.includes(app.map.getDocType()) &&
			!window.mode.isMobile()
		) {
			// Navigator panel should be visible and by default we should open slide sorter in case of impress/draw
			this.showNavigationPanel();
		}
	}

	initializeNavigator(docType: string) {
		app.layoutingService.appendLayoutingTask(() => {
			this.initializeImpl(docType);
		});
	}

	initializeImpl(docType: string) {
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
				if (app.showNavigator) {
					app.map.sendUnoCommand('.uno:Navigator');
				}
				app.map.focus();
			}.bind(this),
		);

		// build tabs if we are in an environment that supports them
		// e.g. in writer we have navigator and quickfind tabs
		// in impress/draw we have navigator and slide sorter tabs
		if (this.map.isPresentationOrDrawing() || this.map.isText()) {
			var navigationTabs = [];

			var navOptions = L.DomUtil.create('div', 'navigation-tabs', navContainer);
			navOptions.id = 'navigation-options';

			if (this.map.isPresentationOrDrawing()) {
				// Create Slide Sorter tab
				var slideSorterTab = L.DomUtil.create(
					'div',
					'tab selected',
					navOptions,
				);
				slideSorterTab.id = 'tab-slide-sorter';
				slideSorterTab.textContent = _('Slides');
				navigationTabs.push(slideSorterTab);
			}

			// Create Navigator tab
			var navigatorTab = L.DomUtil.create('div', 'tab', navOptions);
			navigatorTab.id = 'tab-navigator';
			navigatorTab.textContent = _('Outline');
			navigationTabs.push(navigatorTab);

			if (this.map.isText()) {
				// Create Quick Find tab
				var quickFindTab = L.DomUtil.create('div', 'tab', navOptions);
				quickFindTab.id = 'tab-quick-find';
				quickFindTab.textContent = _('Quick Find');
				navigationTabs.push(quickFindTab);
			}

			// Tab Click Event Listener
			navigationTabs.forEach((tab) => {
				tab.addEventListener(
					'click',
					function () {
						this.switchNavigationTab(tab.id);
					}.bind(this),
				);
			});
		}

		if (this.map.isText()) {
			// build quickfind panel container
			// Fill container probably from CanvasTileLayer or
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
		const navigatorText = _('Navigator');
		this.floatingNavIcon.setAttribute('data-cooltip', navigatorText);
		L.control.attachTooltipEventListener(this.floatingNavIcon, this.map);

		// Create the button wrapper (square container)
		const buttonWrapper = document.createElement('div');
		buttonWrapper.className = 'navigator-btn-wrapper'; // Class for styling
		buttonWrapper.setAttribute('aria-label', navigatorText);

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
				// TODO: handle properly keyboard navigation in navigator: ESC to exit, close button
				app.map.focus();
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
			// TODO: remove jQuery animation
			$('#navigator-dock-wrapper').show(200);
			app.showNavigator = true;
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
		app.showNavigator = false;
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
			// todo: must be a better way to handle this
			this.presentationControlsWrapper.style.display = 'block';
			this.navigatorDockWrapper.style.display = 'none';
			this.quickFindWrapper.style.display = 'none';
		} else if (tabId === 'tab-navigator') {
			if (!app.showNavigator) app.map.sendUnoCommand('.uno:Navigator');
			this.presentationControlsWrapper.style.display = 'none';
			this.navigatorDockWrapper.style.display = 'block';
			this.quickFindWrapper.style.display = 'none';
		} else if (tabId === 'tab-quick-find') {
			if (!app.showQuickFind)
				app.map.sendUnoCommand('.uno:SidebarDeck.FindDeck'); // todo add showQuickFind to other areas of app
			this.presentationControlsWrapper.style.display = 'none';
			this.navigatorDockWrapper.style.display = 'none';
			this.quickFindWrapper.style.display = 'block';
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
		app.layoutingService.appendLayoutingTask(() => {
			this.navigationPanel.classList.add('visible');
			this.floatingNavIcon.classList.remove('visible');
		});
	}

	closeNavigation() {
		app.layoutingService.appendLayoutingTask(() => {
			this.navigationPanel.classList.remove('visible');
			this.floatingNavIcon.classList.add('visible');
			this.handleFloatingButtonVisibilityOnZoomChange(); // on close panel we should check if we can display nav icon or not based on zoom level
		});
	}
}

JSDialog.NavigatorPanel = function (map: any) {
	return new NavigatorPanel(map);
};
