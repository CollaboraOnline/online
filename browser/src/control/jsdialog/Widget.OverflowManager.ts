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
 * JSDialog.OverflowManager - parent for OverflowGroup, coordinates it's behavior
 */

declare var JSDialog: any;

class OverflowManager {
	parentContainer: HTMLElement;
	data: ContainerWidgetJSON;
	lastMaxWidth: number = -1;

	constructor(parentContainer: Element, data: ContainerWidgetJSON) {
		this.parentContainer = parentContainer as HTMLElement;
		this.data = data;

		window.addEventListener('resize', this.onResize.bind(this));
		app.map.on('refreshoverflows', this.onResize, this);
	}

	calculateMaxWidth(): number {
		const margin = 5;
		let nextElement = this.parentContainer.nextSibling as HTMLElement;
		// floating right element after spacer
		if (nextElement && nextElement.classList.contains('ui-spacer'))
			nextElement = nextElement.nextSibling as HTMLElement;

		let nextElementPosition = nextElement ? nextElement.offsetLeft : 0;
		if (nextElementPosition <= 0)
			// is a last visible sibling
			nextElementPosition = this.parentContainer.offsetWidth + margin + 1;
		if (nextElementPosition > window.innerWidth)
			nextElementPosition = window.innerWidth;

		const startPosition = this.parentContainer.offsetLeft;

		return nextElementPosition - startPosition - margin;
	}

	hasOverflow(maxWidth: number): boolean {
		const requiredWidth = this.parentContainer.scrollWidth;
		app.console.debug(
			'overflow manager: "' +
				this.data.id +
				'" max: ' +
				maxWidth +
				' req: ' +
				requiredWidth,
		);
		return maxWidth < requiredWidth;
	}

	onResize(event: any) {
		if (!this.parentContainer) return;

		app.layoutingService.appendLayoutingTask(() => {
			if (!event?.force && this.lastMaxWidth === window.innerWidth) return;

			this.lastMaxWidth = window.innerWidth;

			const groups =
				this.parentContainer.querySelectorAll('.ui-overflow-group');

			// first show all the groups
			groups.forEach((element: OverflowGroupContainer) => {
				if (typeof element.unfoldGroup === 'function') element.unfoldGroup();
			});

			const maxWidth = this.calculateMaxWidth();

			// then hide required
			for (let i = groups.length - 1; i >= 0; i--) {
				const element: OverflowGroupContainer = groups[i];
				if (maxWidth >= 0 && this.hasOverflow(maxWidth)) {
					if (typeof element.foldGroup === 'function') element.foldGroup();
				}
			}
		});
	}
}

JSDialog.OverflowManager = function (
	parentContainer: Element,
	data: ContainerWidgetJSON,
	builder: JSBuilder,
) {
	parentContainer.classList.add('ui-overflow-manager');
	// Just create manager which will attach itself to the container and resize event.
	// Builder will process children as in regular container.
	new OverflowManager(parentContainer, data);
	app.console.debug('Create OverflowManager for: "' + data.id + '"');
	return true;
} as JSWidgetHandler;
