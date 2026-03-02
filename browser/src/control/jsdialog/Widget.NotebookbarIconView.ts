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

declare var JSDialog: any;

function _createButtonForNotebookbarIconview(
	parentContainer: Element,
	id: string,
	buttonClass: string,
	icon: string,
	ariaLabel: string,
	builder: JSBuilder,
	onClickCallback: any,
	accessibility?: NotebookbarAccessibilityDescriptor,
	opensPopup?: boolean,
) {
	const container = window.L.DomUtil.create(
		'div',
		builder.options.cssClass +
			' unotoolbutton ui-content unospan no-label ui-iconview-button',
		parentContainer,
	);
	container.id = id;

	// create the button
	const button = window.L.DomUtil.create(
		'button',
		'ui-content unobutton ' + buttonClass,
		container,
	);
	button.id = id + '-button';
	if (accessibility?.combination) button.accessKey = accessibility?.combination;

	if (opensPopup) button.setAttribute('aria-haspopup', 'dialog');

	const a11yData: WidgetJSON = {
		id: id,
		type: 'iconview-button',
		aria: {
			label: ariaLabel,
		},
	};
	JSDialog.SetupA11yLabelForNonLabelableElement(button, a11yData, builder);

	// add the icon
	const buttonImage = window.L.DomUtil.create(
		'img',
		'ui-iconview-button-icon',
		button,
	);
	buttonImage.alt = '';
	app.LOUtil.setImage(buttonImage, icon, builder.map);

	// set the onclick callback
	button.onclick = onClickCallback;
}

function _getDropdownContent(data: IconViewListJSON) {
	const dropdownContent: Array<any> = [];
	for (const child of data.children) {
		dropdownContent.push({ type: 'json', content: child });
	}
	if (data.children.length === 1 && data.children[0].id === 'stylesview') {
		dropdownContent.push(
			{
				type: 'json',
				content: {
					type: 'separator',
					id: 'iconview-button-separator',
					orientation: 'horizontal',
				},
			},
			{
				type: 'json',
				content: {
					id: 'format-style-list-dialog',
					type: 'customtoolitem',
					text: _('Open Styles Sidebar'),
					command: 'showstylelistdeck',
					icon: 'lc_stylepreviewmore.svg',
				},
			},
		);
	}

	return dropdownContent;
}

JSDialog.notebookbarIconView = function (
	parentContainer: Element,
	data: IconViewJSON,
	builder: JSBuilder,
) {
	const iconviewlistdata = {
		id: data.id + '-iconview-list',
		type: 'iconviewlist',
		children: [data],
	};
	return JSDialog.notebookbarIconViewList(
		parentContainer,
		iconviewlistdata,
		builder,
	);
};

JSDialog.notebookbarIconViewList = function (
	parentContainer: Element,
	data: IconViewListJSON,
	builder: JSBuilder,
) {
	const commonContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-window',
		parentContainer,
	);
	commonContainer.id = data.id;

	// Render all children inline so core's updateWidget can find and
	// populate them with entries.  Only the first child is visible;
	// the rest are hidden until the dropdown is opened.
	for (let i = 0; i < data.children.length; i++) {
		JSDialog.iconView(commonContainer, data.children[i], builder);
	}

	let currentIconView = commonContainer.querySelector('.ui-iconview') as any;

	// Hide non-first iconviews — they exist only so core can update them.
	const hideNonFirstIconViews = () => {
		const allViews = commonContainer.querySelectorAll(':scope > .ui-iconview');
		for (let i = 1; i < allViews.length; i++) {
			(allViews[i] as HTMLElement).style.display = 'none';
		}
	};
	hideNonFirstIconViews();

	const buttonsContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-buttons-container',
		parentContainer,
	);
	buttonsContainer.id = data.id + '-buttons-container';

	const scrollUpCallback = () => {
		currentIconView.scrollBy({
			top: -currentIconView.offsetHeight,
			behavior: 'smooth',
		});
	};

	const scrollDownCallback = () => {
		currentIconView.scrollBy({
			top: currentIconView.offsetHeight,
			behavior: 'smooth',
		});
	};

	const iconViewListCallback = (
		objectType: string,
		eventType: string,
		object: any,
		entry_data: string,
	) => {
		builder.callback(objectType, eventType, object, entry_data, builder);
		/*
			the dropdown can have controls to trigger dialogs
			or sidebars. when that happens, we want the dropdown
			to move out of our way.
		*/
		if (objectType !== 'iconview') JSDialog.CloseAllDropdowns();
	};

	const expanderCallback = () => {
		// Use current data from live iconview elements: core may have called
		// updateWidget on them since the list was first built, populating entries.
		const liveChildren = data.children.map((child: IconViewJSON) => {
			const liveIconView = commonContainer.querySelector(
				":scope > [id='" + child.id + "']",
			) as any;
			return liveIconView?.data ?? child;
		});
		const currentData: IconViewListJSON = { ...data, children: liveChildren };
		JSDialog.OpenDropdown(
			data.children[0].id,
			commonContainer,
			_getDropdownContent(currentData),
			iconViewListCallback,
		);
		bIsExpanded = true;
	};

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.children[0].id + '-scroll-up',
		'ui-iconview-scroll-up-button',
		'lc_searchprev.svg',
		_('Scroll up'),
		builder,
		scrollUpCallback,
	);

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.children[0].id + '-scroll-down',
		'ui-iconview-scroll-down-button',
		'lc_searchnext.svg',
		_('Scroll down'),
		builder,
		scrollDownCallback,
	);

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.children[0].id + '-expand',
		'ui-iconview-expander-button',
		'lc_iconviewexpander.svg',
		_('More options'),
		builder,
		expanderCallback,
		{ focusBack: true, combination: 'SD', de: null },
		true /* opensPopup */,
	);

	commonContainer._onDropDown = function (opened: boolean) {
		if (opened) {
			// Two nested layouting tasks: the first waits for the dropdown
			// DOM to be inserted, the second waits for iconView inside it
			// to finish populating entries.
			app.layoutingService.appendLayoutingTask(() => {
				app.layoutingService.appendLayoutingTask(() => {
					const expander = JSDialog.GetDropdown(data.children[0].id);
					if (!expander) {
						app.console.error(
							'iconview._onDropDown: expander missing: "' +
								data.children[0].id +
								'"',
						);
						return;
					}
					const overlay = expander.parentNode;
					overlay.style.position = 'fixed';
					overlay.style.zIndex = '20000';
					commonContainer.appendChild(overlay);
					for (let i = 0; i < data.children.length; i++) {
						const child = data.children[i];
						const dropdownIconView = expander.querySelector(
							"[id='" + child.id + "']",
						) as HTMLElement;
						if (!dropdownIconView) continue;

						// Insert heading label above each iconview
						if (child.label) {
							const label = window.L.DomUtil.create(
								'span',
								builder.options.cssClass + ' ui-iconview-list-heading',
							);
							label.textContent = child.label;
							dropdownIconView.parentNode?.insertBefore(
								label,
								dropdownIconView,
							);
						}

						// Get the inline (notebookbar) iconview — its
						// updateRendersImpl closure holds the notebookbar
						// builder's rendersCache, which has the cached images.
						const liveIconView = commonContainer.querySelector(
							":scope > [id='" + child.id + "']",
						) as any;

						// Fill cached images from the notebookbar builder's
						// cache, and request renders from core for uncached
						// entries.
						const cache = builder.rendersCache?.[child.id];
						const ddData = (dropdownIconView as any).data;
						const dpr = Math.floor(100 * window.devicePixelRatio);
						if (ddData?.entries) {
							for (let pos = 0; pos < ddData.entries.length; pos++) {
								if (cache?.images?.[pos] && liveIconView) {
									liveIconView.updateRendersImpl(
										pos,
										child.id,
										dropdownIconView,
									);
								} else if (ddData.entries[pos]?.ondemand) {
									builder.callback(
										'iconview',
										'render_entry',
										{ id: child.id },
										pos + ';' + dpr + ';' + dpr,
										builder,
									);
								}
							}
						}

						// Override the inline iconview's updateRenders so
						// rendered_entry responses from core also update the
						// dropdown copy while it is open.
						if (liveIconView) {
							const origUpdateRenders = liveIconView.updateRenders;
							liveIconView.updateRenders = (pos: number) => {
								origUpdateRenders?.call(liveIconView, pos);
								if (dropdownIconView.isConnected)
									liveIconView.updateRendersImpl(
										pos,
										child.id,
										dropdownIconView,
									);
							};
						}

						// CSS repeat(auto-fit, …) for grid-template-rows
						// needs an explicit container height; without one it
						// collapses to a single row.  Reset it so the grid
						// creates implicit rows sized by content instead.
						dropdownIconView.style.gridTemplateRows = 'none';
					}
				});
			});
		}
	};

	const updateAllIndexes = () => {
		// Example: if gridTemplateColumns = "96px 96px 96px"
		// Step 1: Split the string by spaces:           ["96px", "96px", "96px"]
		// Step 2: Remove any empty entries (if any):    ["96px", "96px", "96px"]
		// Step 3: The length of this array is the number of columns in the grid.
		const gridTemplateColumns =
			getComputedStyle(currentIconView).gridTemplateColumns;
		const columns = gridTemplateColumns.split(' ').filter(Boolean).length;

		if (columns > 0) {
			const entries = currentIconView.querySelectorAll('.ui-iconview-entry');
			entries.forEach((entry: Element, flatIndex: number) => {
				const row = Math.floor(flatIndex / columns);
				const column = flatIndex % columns;
				entry.setAttribute('index', row + ':' + column);
			});
		}
	};

	/*
		close dropdown when the window is resized. this
		is to prevent dropdown from hanging in the corner
		when the overflowgroups collapse displacing the
		underlying iconview.
	*/
	let bIsExpanded = false;

	// update indexes on resize
	const resizeObserver = new ResizeObserver(() => {
		updateAllIndexes();
		if (bIsExpanded) JSDialog.CloseDropdown(data.id);
	});

	/*
	 * NOTE: `resizeObserver` observes the iconview, not the dropdown.
	 * and since the iconview grid is always max height (with overflow),
	 * height changes do not trigger the observer as only the container's
	 * height changes and it looks as if the iconview's dimentions
	 * changd.
	 */
	resizeObserver.observe(commonContainer);

	// Do not animate on creation - eg. when opening sidebar with icon view it might move the app
	const firstSelected = $(currentIconView).children('.selected').get(0);
	if (firstSelected) {
		const offsetTop = firstSelected.offsetTop;
		currentIconView.scrollTop = offsetTop;
	}

	// Override iconview callbacks so they use the first child's ID
	// (which core recognises) instead of the iconviewlist container's ID.
	// Also track scroll position so we can restore it after widget rebuilds.
	const firstChild = data.children[0];
	let savedScrollTop = 0;

	const applyOverrides = () => {
		commonContainer.updateRenders = currentIconView.updateRenders = (
			pos: number,
		) => {
			currentIconView.updateRendersImpl(pos, firstChild.id, currentIconView);

			// also update the dropdown (if any)
			const dropdownContainer = JSDialog.GetDropdown(firstChild.id);
			if (dropdownContainer)
				currentIconView.updateRendersImpl(
					pos,
					firstChild.id,
					dropdownContainer,
				);
		};

		currentIconView.updateSelection = (position: number) => {
			currentIconView.updateSelectionImpl(position, firstChild);
		};

		currentIconView.requestRenders = (
			entry: IconViewEntry,
			placeholder: Element,
			entryContainer: Element,
		) => {
			currentIconView.requestRendersImpl(
				firstChild.id,
				entry,
				placeholder,
				entryContainer,
			);
		};

		currentIconView.builderCallback = (
			objectType: string,
			eventType: string,
			entry: any,
			builderArg: JSBuilder,
		) => {
			builder.callback(objectType, eventType, firstChild, entry, builderArg);
		};

		commonContainer.onSelect = currentIconView.onSelect;

		// Track scroll position so we can restore it after widget rebuilds.
		currentIconView.addEventListener('scroll', () => {
			savedScrollTop = currentIconView.scrollTop;
		});
	};

	applyOverrides();

	// When _updateWidgetImpl rebuilds an inner iconview, it calls this
	// hook on the parent (commonContainer) so we can fix up the DOM.
	//
	// Because the notebookbar builder maps 'iconview' to
	// notebookbarIconView (which wraps in a ui-iconview-window +
	// buttons), _updateWidgetImpl produces a nested wrapper instead
	// of a plain iconview.  Flatten such wrappers, re-apply overrides,
	// and re-hide non-first iconviews.
	(commonContainer as any)._onChildWidgetUpdated = () => {
		// Flatten nested wrappers produced by _updateWidgetImpl
		// rebuilding a child iconview via notebookbarIconView.
		const nestedWrappers = commonContainer.querySelectorAll(
			':scope > .ui-iconview-window',
		);
		for (const wrapper of Array.from(nestedWrappers) as HTMLElement[]) {
			const innerView = wrapper.querySelector(':scope > .ui-iconview');
			if (innerView) {
				commonContainer.insertBefore(innerView, wrapper);
				wrapper.remove();
			}
		}

		// Re-apply first-child overrides if the visible iconview was replaced.
		const newIconView = commonContainer.querySelector(
			':scope > .ui-iconview',
		) as any;
		if (newIconView && newIconView !== currentIconView) {
			const restoreScroll = savedScrollTop;
			currentIconView = newIconView;
			applyOverrides();

			// The new iconview's entries are populated in a layouting task
			// (queued by JSDialog.iconView) which also scrolls to the
			// selected entry.  Queue our own task to run afterwards and
			// restore the user's scroll position instead.
			app.layoutingService.appendLayoutingTask(() => {
				currentIconView.scrollTop = restoreScroll;
			});
		}

		// Re-hide non-first iconviews (they may have been replaced
		// by _updateWidgetImpl and lost their display:none).
		hideNonFirstIconViews();
	};

	return false;
};
