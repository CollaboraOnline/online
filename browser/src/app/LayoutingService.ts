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

	// get something around 25 fps as minimum (35ms + some overflow = ~40ms)
	private MAX_TASK_DURATION_MS = 35;
	private MIN_TIMER_DELAY_MS = 10;

	private _setupTimer() {
		this._layoutTaskFlush = setTimeout(
			this._flushLayoutingQueue.bind(this),
			this.MIN_TIMER_DELAY_MS,
		);
	}

	private _reachedTaskTimeout(start: number): boolean {
		const duration = performance.now() - start;
		if (duration > this.MAX_TASK_DURATION_MS) return true;
		return false;
	}

	private _flushLayoutingQueue() {
		if (this._layoutTasks.length) {
			window.requestAnimationFrame(() => {
				const start = performance.now();
				let task = this._layoutTasks.shift();
				while (task) {
					try {
						task.call(this);
					} catch (ex) {
						console.error('LayoutingTask exception: ' + ex);
					}

					if (this._reachedTaskTimeout(start)) {
						this._scheduleLayouting();
						return;
					}

					task = this._layoutTasks.shift();
				}
			});
		}

		this._layoutTaskFlush = null;
	}

	public appendLayoutingTask(task: LayoutingTask) {
		this._layoutTasks.push(task);
		this._scheduleLayouting();
	}

	private _scheduleLayouting() {
		if (this._layoutTaskFlush) return;
		this._setupTimer();
	}
}
