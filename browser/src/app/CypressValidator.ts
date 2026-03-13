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
 * CypressValidator - useful for adding validation during tests in Cypress
 *                    which doesn't run in the regular sessions
 */

abstract class CypressValidator {
	public isValidatorActive(): boolean {
		return window.L.Browser.cypressTest;
	}
}
