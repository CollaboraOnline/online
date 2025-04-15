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
 * This file contains service which will coordinate intensive DOM modifications
 * which may impact browser rendering performance.
 */

type LayoutingTask = () => void;

class LayoutingService {
	private _layoutTasks: Array<LayoutingTask> = [];
	private _layoutTaskFlush: ReturnType<typeof setTimeout> | null = null;

	private _flushLayoutingQueue() {
		if (this._layoutTasks.length) {
			window.requestAnimationFrame(() => {
				const start = performance.now();
				let task = this._layoutTasks.shift();
				let duration = 0;
				while (task) {
					try {
						task.call(this);
					} catch (ex) {
						console.error('LayoutingTask exception: ' + ex);
					}

					duration = performance.now() - start;
					if (duration > 10) {
						this.scheduleLayouting();
						break;
					}
					task = this._layoutTasks.shift();
				}
			});
		}

		this._layoutTaskFlush = null;
	}

	public appendLayoutingTask(task: LayoutingTask) {
		this._layoutTasks.push(task);
	}

	public scheduleLayouting() {
		if (this._layoutTaskFlush) return;

		// get something around 60 fps
		this._layoutTaskFlush = setTimeout(
			this._flushLayoutingQueue.bind(this),
			10,
		);
	}
}
