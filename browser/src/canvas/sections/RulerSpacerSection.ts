/* -*- js-indent-level: 8; fill-column: 100 -*- */
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
 * RulerSpacerSection - Reserves vertical space for the horizontal ruler
 * in the canvas section layout.
 *
 * This section acts as a layout spacer so that the TilesSection (and any
 * sections anchored to it, such as CompareChangesLabelSection) are
 * positioned below the ruler when it is visible.
 *
 * NOTE: The ruler itself is currently rendered as a Leaflet control
 * (see HRuler.ts / VRuler.ts) using legacy DOM placement via
 * map._controlCorners. In the future, ruler rendering should be moved
 * into this section, eliminating the Leaflet control dependency entirely.
 */

namespace cool {
	export class RulerSpacerSection extends CanvasSectionObject {
		anchor: string[] = ['top', 'left'];
		expand: string[] = ['right'];
		processingOrder: number = app.CSections.RulerSpacer.processingOrder;
		drawingOrder: number = app.CSections.RulerSpacer.drawingOrder;
		zIndex: number = app.CSections.RulerSpacer.zIndex;
		interactable: boolean = false;

		constructor() {
			super(app.CSections.RulerSpacer.name);
			this.size = [0, 0];
		}

		onInitialize(): void {
			const map = (<any>window).L.Map.THIS;
			map.on('rulerchanged', this.onRulerChanged, this);
			this.updateSize();
		}

		onRemove(): void {
			const map = (<any>window).L.Map.THIS;
			map.off('rulerchanged', this.onRulerChanged, this);
		}

		private onRulerChanged(): void {
			this.updateSize();
			if (this.containerObject) this.containerObject.reNewAllSections();
		}

		private updateSize(): void {
			const rulerEl = document.querySelector(
				'.cool-ruler:not(.vruler)',
			) as HTMLElement;
			const visible = rulerEl && rulerEl.style.display !== 'none';

			if (visible) {
				const height = Math.round(
					rulerEl.getBoundingClientRect().height * app.dpiScale,
				);
				this.size = [0, height];
			} else {
				this.size = [0, 0];
			}
		}
	}
} // namespace cool
