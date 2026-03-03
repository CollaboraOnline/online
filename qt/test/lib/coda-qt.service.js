/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { spawn } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import http from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

function pipeOutput(proc, label) {
	proc.stdout.on('data', (d) =>
		console.log(`[${label}]: ${d.toString().trim()}`),
	);
	proc.stderr.on('data', (d) => {
		const msg = d.toString().trim();
		if (msg) console.log(`[${label}]: ${msg}`);
	});
	proc.on('exit', (c, s) =>
		console.log(`${label} exited (code=${c}, signal=${s})`),
	);
}

async function waitForHttp(url, label, maxAttempts = 30) {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const ok = await new Promise((resolve, reject) => {
				const req = http.get(url, (res) => resolve(res.statusCode === 200));
				req.on('error', reject);
				req.setTimeout(1000, () => req.destroy(new Error('timeout')));
			});
			if (ok) {
				console.log(`${label} is ready`);
				return;
			}
		} catch (e) {
			// Not ready yet
		}
		await sleep(1000);
	}
	throw new Error(
		`${label} not available at ${url} after ${maxAttempts} attempts`,
	);
}

function killProcess(proc, name) {
	if (proc && proc.pid && !proc.killed) {
		console.log(`Sending SIGTERM to ${name}`);
		proc.kill('SIGTERM');
		const timer = setTimeout(() => {
			if (proc.exitCode === null) {
				console.log(`Forcing SIGKILL on ${name}`);
				proc.kill('SIGKILL');
			}
		}, 2000);
		proc.once('exit', () => clearTimeout(timer));
	}
}

export class CodaQtServiceLauncher {
	#codaQtProcess = null;
	#atSpiServerProcess = null;
	#webEngineDriverProcess = null;
	#testHomeDir = null;
	#options;

	constructor(options) {
		this.#options = options;
	}

	async onPrepare() {
		const {
			atSpiDriverPath,
			atSpiPort,
			webEngineDriver,
			webEngineDriverPort,
			codaQtBinary,
			remoteDebuggingPort,
		} = this.#options;

		console.log('Starting AT-SPI Flask server...');
		this.#atSpiServerProcess = spawn(
			'flask',
			['run', '--port', atSpiPort.toString(), '--no-reload'],
			{
				env: { ...process.env, FLASK_APP: atSpiDriverPath },
				stdio: ['ignore', 'pipe', 'pipe'],
			},
		);
		pipeOutput(this.#atSpiServerProcess, 'at-spi');

		console.log('Starting WebEngineDriver...');
		this.#webEngineDriverProcess = spawn(
			webEngineDriver,
			[`--port=${webEngineDriverPort}`, '--url-base=/'],
			{ stdio: ['ignore', 'pipe', 'pipe'] },
		);
		pipeOutput(this.#webEngineDriverProcess, 'webenginedriver');

		await Promise.all([
			waitForHttp(
				`http://localhost:${atSpiPort}/status`,
				'AT-SPI server',
			),
			waitForHttp(
				`http://localhost:${webEngineDriverPort}/status`,
				'WebEngineDriver',
			),
		]);

		this.#testHomeDir = mkdtempSync(join(tmpdir(), 'coda-qt-test-'));
		mkdirSync(join(this.#testHomeDir, 'Documents'));

		console.log('Starting coda-qt...');
		this.#codaQtProcess = spawn(codaQtBinary, [], {
			env: {
				...process.env,
				HOME: this.#testHomeDir,
				QTWEBENGINE_REMOTE_DEBUGGING: remoteDebuggingPort.toString(),
				QT_ACCESSIBILITY: '1',
				QT_LINUX_ACCESSIBILITY_ALWAYS_ON: '1',
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		pipeOutput(this.#codaQtProcess, 'coda-qt');

		await waitForHttp(
			`http://localhost:${remoteDebuggingPort}/json/version`,
			'Remote debugging',
		);

		console.log('All services ready, tests will now run');
	}

	async onComplete() {
		killProcess(this.#codaQtProcess, 'coda-qt');
		killProcess(this.#atSpiServerProcess, 'at-spi');
		killProcess(this.#webEngineDriverProcess, 'webenginedriver');

		if (this.#testHomeDir) {
			try {
				rmSync(this.#testHomeDir, { recursive: true, force: true });
				console.log(`Removed test home dir: ${this.#testHomeDir}`);
			} catch (e) {
				console.warn(
					`Failed to clean up test home dir ${this.#testHomeDir}: ${e.message}`,
				);
			}
		}
	}
}
