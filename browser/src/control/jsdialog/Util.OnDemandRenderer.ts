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
 * Util.OnDemandRenderer - helper for rendering entries on demand (when visible)
 */

declare var JSDialog: any;

function onDemandRenderer(
	builder: JSBuilder,
	controlId: string,
	controlType: string,
	entryId: number,
	placeholder: Element,
	parentContainer: Element,
	entryText: string | undefined,
) {
	const cachedComboboxEntries = builder.rendersCache[controlId];
	let requestRender = true;

	if (cachedComboboxEntries && cachedComboboxEntries.images[entryId]) {
		L.DomUtil.remove(placeholder);
		placeholder = L.DomUtil.create('img', '', parentContainer);
		const placeholderImg = placeholder as HTMLImageElement;
		placeholderImg.src = cachedComboboxEntries.images[entryId];
		placeholderImg.alt = entryText;
		placeholderImg.title = entryText;
		requestRender = !cachedComboboxEntries.persistent;
	}

	if (requestRender) {
		// render on demand
		var onIntersection = (entries: any) => {
			entries.forEach((entry: any) => {
				if (entry.isIntersecting) {
					builder.callback(
						controlType,
						'render_entry',
						{ id: controlId },
						entryId +
							';' +
							Math.floor(100 * window.devicePixelRatio) +
							';' +
							Math.floor(100 * window.devicePixelRatio),
						builder,
					);
				}
			});
		};

		var observer = new IntersectionObserver(onIntersection, {
			root: null,
			threshold: 0.01, // percentage of visible area
		});

		observer.observe(placeholder);
	}
}

JSDialog.OnDemandRenderer = onDemandRenderer;
