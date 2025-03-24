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
 * JSDialog.SearchEdit - single line input field for searching inside document
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'searchedit',
 *     text: 'abc',
 *     placeholder: 'this is shown when empty',
 *     changedCallback: null
 * }
 */

declare var L: any;
declare var JSDialog: any;

class SearchEditWidget extends EditWidget {
	constructor(
		parentContainer: HTMLElement,
		data: EditWidgetJSON,
		builder: JSBuilder,
		callback: JSDialogCallback,
	) {
		super(parentContainer, data, builder, callback);
	}

	private onSearchInput() {
		this.updateSearchButtons();
		if (L.Map.THIS.getDocType() === 'text') {
			// perform the immediate search in Writer
			app.searchService.search(
				this.edit.input.value,
				false,
				'',
				0,
				true /* expand search */,
			);
		}
	}

	private onSearchKeyDown(e: KeyboardEvent) {
		var entry = this.edit.input;
		if (
			(e.keyCode === 71 && e.ctrlKey) ||
			e.keyCode === 114 ||
			e.keyCode === 13
		) {
			if (e.shiftKey) {
				app.searchService.search(entry.value, true);
			} else {
				app.searchService.search(entry.value);
			}
			e.preventDefault();
		} else if (e.ctrlKey && e.keyCode === 70) {
			entry.focus();
			entry.select();
			e.preventDefault();
		} else if (e.keyCode === 27) {
			L.Map.THIS.cancelSearch();
		}
	}

	private onSearchFocus() {
		L.Map.THIS.fire('searchstart');
		this.updateSearchButtons();
	}

	private onSearchBlur() {
		L.Map.THIS._onGotFocus();
	}

	private updateSearchButtons() {
		var toolbar = (window as any).mode.isMobile()
			? app.map.mobileSearchBar
			: app.map.statusBar;
		if (!toolbar) {
			console.debug('Cannot find search bar');
			return;
		}

		// conditionally disabling until, we find a solution for tdf#108577
		if (this.edit.input.value === '') {
			toolbar.enableItem('searchprev', false);
			toolbar.enableItem('searchnext', false);
			toolbar.showItem('cancelsearch', false);
		} else {
			toolbar.enableItem('searchprev', true);
			toolbar.enableItem('searchnext', true);
			toolbar.showItem('cancelsearch', true);
		}
	}

	protected setupEventListeners() {
		super.setupEventListeners();

		this.edit.input.addEventListener('input', this.onSearchInput.bind(this));
		this.edit.input.addEventListener(
			'keydown',
			this.onSearchKeyDown.bind(this),
		);
		this.edit.input.addEventListener('focus', this.onSearchFocus.bind(this));
		this.edit.input.addEventListener('blur', this.onSearchBlur.bind(this));
	}
}

JSDialog.searchEdit = function (
	parentContainer: HTMLElement,
	data: EditWidgetJSON,
	builder: JSBuilder,
	callback: JSDialogCallback,
) {
	const widget = new SearchEditWidget(parentContainer, data, builder, callback);
	return widget.build();
};
