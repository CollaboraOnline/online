/* -*- js-indent-level: 8; fill-column: 100 -*- */
/* eslint-disable no-inner-declarations */
/* global importScripts */

if ('undefined' === typeof window) {
	importScripts('../../node_modules/fzstd/umd/index.js');
	importScripts('../layer/tile/CanvasTileUtils.js');
	addEventListener('message', onMessage);

	console.log('MessagePreProcessor initialised', self.fzstd);

	function onMessage(e) {
		switch (e.data.message) {
			case 'image.rawData':
				var delta = self.fzstd.decompress(e.data.rawData);
				if (e.data.isKeyframe) {
					self.unpremultiply(delta, delta.length);
				} else {
					for (var i = 0; i < delta.length; ++i) {
						switch (delta[i]) {
							case 99: // 'c': // copy row
								i += 4;
								break;
							case 100: // 'd': // new run
								var span = delta[i + 3] * 4;
								i += 4;
								self.unpremultiply(delta, span, i);
								i += span - 1;
								break;
							case 116: // 't': // terminate delta
								break;
							default:
								console.log(
									'[' + i + ']: ERROR: Unknown delta code ' + delta[i],
								);
								i = delta.length;
								break;
						}
					}
				}
				postMessage(
					{
						id: e.data.id,
						message: e.data.message,
						rawData: e.data.rawData,
						processedData: delta,
					},
					[e.data.rawData.buffer, delta.buffer],
				);
				break;

			default:
				console.error('Unrecognised preprocessor message', e);
		}
	}
}
