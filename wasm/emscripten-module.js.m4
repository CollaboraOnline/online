m4_changequote(@[,]@)m4_dnl
/* exported createEmscriptenModule */
function createEmscriptenModule(docURL, encodedWOPI, isWopi) {
	return {
		arguments: [docURL, encodedWOPI, isWopi ? 'true' : 'false'],
		uno_scripts: [m4_ifelse(ENABLE_WASM_ZETAJS, @[true]@, @['zeta.js'm4_ifelse(ENABLE_WASM_EMBINDTEST, @[true]@, @[, 'smoketest.js']@)m4_ifelse(ENABLE_WASM_ZETAJS_EXAMPLE, @[true]@, @[, 'emscripten-zetajs-example.js']@)]@)],
	};
}
