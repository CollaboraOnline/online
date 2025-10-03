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

	highlightTerm: string;
	focusQuickFind: boolean;

	constructor(map: any) {
		super(map, SidebarType.Navigator);
	}

	onAdd(map: ReturnType<typeof window.L.map>) {
		super.onAdd(map);
		this.map.on('navigator', this.onNavigator, this);
		this.map.on('doclayerinit', this.onDocLayerInit, this);
		this.map.on('focussearch', this.focusSearch, this);
		this.navigationPanel = document.getElementById(`navigation-sidebar`);
		this.floatingNavIcon = document.getElementById(`navigator-floating-icon`);
		this.presentationControlsWrapper = this.navigationPanel.querySelector(
			'#presentation-controls-wrapper',
		);
		this.navigatorDockWrapper = this.navigationPanel.querySelector(
			'#navigator-dock-wrapper',
		);
		this.quickFindWrapper = this.navigationPanel.querySelector(
			'#quickfind-dock-wrapper',
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
		const navContainer = window.L.DomUtil.create(
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
		var navHeader = window.L.DomUtil.create(
			'div',
			'navigation-header',
			navContainer,
		);

		var navTitle = window.L.DomUtil.create(
			'span',
			'navigation-title',
			navHeader,
		);
		navTitle.textContent = _('Navigation');

		// Create wrapper for search
		const navSearchWrapper = window.L.DomUtil.create(
			'div',
			'navigation-search-wrapper',
		);

		// Create a wrapper div
		const closeNavWrapper = window.L.DomUtil.create(
			'div',
			'close-navigation-wrapper',
			navHeader,
		);

		// Create the close button inside the div
		this.closeNavButton = window.L.DomUtil.create(
			'span',
			'close-navigation-button',
			closeNavWrapper,
		);
		const closeNavigationText = _('Close Navigation');
		this.closeNavButton.setAttribute('aria-label', closeNavigationText);
		this.closeNavButton.setAttribute('data-cooltip', closeNavigationText);
		window.L.control.attachTooltipEventListener(this.closeNavButton, this.map);
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

			var navOptions = window.L.DomUtil.create(
				'div',
				'navigation-tabs',
				navContainer,
			);
			navOptions.id = 'navigation-options';

			if (this.map.isPresentationOrDrawing()) {
				// Create Slide Sorter tab
				var slideSorterTab = window.L.DomUtil.create(
					'div',
					'tab selected',
					navOptions,
				);
				slideSorterTab.id = 'tab-slide-sorter';
				slideSorterTab.textContent = _('Slides');
				navigationTabs.push(slideSorterTab);
			}

			// Create Navigator tab
			var navigatorTab = window.L.DomUtil.create('div', 'tab', navOptions);
			navigatorTab.id = 'tab-navigator';
			navigatorTab.textContent = _('Outline');
			navigationTabs.push(navigatorTab);

			if (this.map.isText()) {
				// Create Quick Find tab
				var quickFindTab = window.L.DomUtil.create('div', 'tab', navOptions);
				quickFindTab.id = 'tab-quick-find';
				quickFindTab.textContent = _('Results');
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

		if (this.navigationPanel) {
			// Insert navigation container as the first child & navHeader as next-child of navigator-panel
			this.navigationPanel.prepend(navContainer);
			if (this.map.isText()) {
				this.navigationPanel.prepend(navSearchWrapper);
				this.createSearchBar(navSearchWrapper);
			}
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
		window.L.control.attachTooltipEventListener(this.floatingNavIcon, this.map);

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
		this.container.innerHTML = '';

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

			this.builder.build(this.container, [navigatorData], false);
			// There is case where user can directly click navigator from notebookbar view option
			// in that case we first show the navigation panel and then switch to tab view
			this.showNavigationPanel();
			// TODO: remove jQuery animation
			$('#navigator-dock-wrapper').show(200);
			app.showNavigator = true;
			if (
				app.map.isPresentationOrDrawing() &&
				!this.isNavigationPanelVisible()
			) {
				this.switchNavigationTab('tab-slide-sorter');
			} else {
				this.switchNavigationTab('tab-navigator');
			}
			if (this.focusQuickFind) {
				this.switchNavigationTab('tab-quick-find');
				this.focusSearch();
				this.focusQuickFind = false;
			}
		} else {
			this.closeSidebar();
		}
	}

	onJSUpdate(e: FireEvent) {
		if (this.highlightTerm && this.highlightTerm.trim().length > 0) {
			e.data.control.highlightTerm = this.highlightTerm;
		}
		return super.onJSUpdate(e);
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
		// In Calc we don't have tabs so far
		const tab = this.navigationPanel.querySelector('#' + tabId);
		tab?.classList.add('selected');

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
			if (!app.showQuickFind) app.map.sendUnoCommand('.uno:QuickFind'); // todo add showQuickFind to other areas of app
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
			// this will update the indentation marks for elements like ruler
			app.map.fire('fixruleroffset');
		});
	}

	isNavigationPanelVisible(): boolean {
		return this.navigationPanel.classList.contains('visible');
	}

	closeNavigation() {
		app.layoutingService.appendLayoutingTask(() => {
			this.navigationPanel.classList.remove('visible');
			this.floatingNavIcon.classList.add('visible');
			this.handleFloatingButtonVisibilityOnZoomChange(); // on close panel we should check if we can display nav icon or not based on zoom level
		});
	}

	preFocusQuickFind() {
		this.focusQuickFind = true;
	}

	focusSearch() {
		const searchInput = document.getElementById(
			'navigator-search-input',
		) as HTMLInputElement;
		if (!searchInput) return;

		app.layoutingService.appendLayoutingTask(() => {
			searchInput.focus();
		});
	}

	createSearchBar(wrapper: HTMLElement) {
		var data = {
			id: '',
			type: 'container',
			children: [
				{
					id: 'navigator-search',
					type: 'edit',
					placeholder: _('Search...'),
					text: '',
				} as EditWidgetJSON,
				{
					id: '',
					type: 'toolbox',
					text: '',
					children: [
						{
							id: 'navigator-search-button',
							type: 'pushbutton',
							text: '',
							image: 'lc_recsearch.svg',
						},
					],
				},
			],
		} as WidgetJSON;

		this.builder.build(wrapper, [data], false);
	}

	override callback(
		objectType: string,
		eventType: string,
		object: any,
		data: any,
		builder: JSBuilder,
	): void {
		let searchTerm = '';
		// Update results tab
		if (object.id === 'navigator-search-button') {
			searchTerm = (
				document.getElementById('navigator-search-input') as HTMLInputElement
			).value;
			super.callback('edit', 'activate', { id: 'Find' }, searchTerm, builder);
		} else if (object.id === 'navigator-search') {
			searchTerm = data;
			super.callback(
				objectType,
				eventType,
				{ id: 'Find' },
				searchTerm,
				builder,
			);
		}
		// Update outline highlighting
		// Note: only update on 'activate' or button pressed events to be consistent with results tab
		if (
			(object.id == 'navigator-search' && eventType == 'activate') ||
			object.id == 'navigator-search-button'
		) {
			var treeContainer = document.getElementById('contenttree') as any;
			if (treeContainer) treeContainer.highlightEntries(searchTerm);
			this.highlightTerm = searchTerm;
			return;
		}
		super.callback(objectType, eventType, object, data, builder);
	}
}

JSDialog.NavigatorPanel = function (map: any) {
	return new NavigatorPanel(map);
};
