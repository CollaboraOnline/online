const { spawn, fork } = require('child_process');
if (process.argv.length < 5 || process.argv[2] == '--help') {
	console.debug('bootstrap.js <ssl_true_or_false> <abs_top_builddir> <abs_srcdir>');
	process.exit(0);
}
const ssl_flag = process.argv[2];
const top_builddir = process.argv[3];
const srcdir = process.argv[4];
/* dont use the default port (9980)*/
const port = '9999';
let args = [
	`--o:sys_template_path=${top_builddir}/systemplate`,
	'--o:security.capabilities=false',
	`--o:child_root_path=${top_builddir}/jails`,
	'--o:storage.filesystem[@allow]=true',
	'--o:admin_console.username=admin --o:admin_console.password=admin',
	'--o:logging.file[@enable]=true --o:logging.level=warning',
	'--o:trace_event[@enable]=true',
	`--port=${port}`
];

let ssl_args = [
	`--o:ssl.cert_file_path=${top_builddir}/etc/cert.pem`,
	`--o:ssl.key_file_path=${top_builddir}/etc/key.pem`,
	`--o:ssl.ca_file_path=${top_builddir}/etc/ca-chain.cert.pem`,
];

if (ssl_flag === 'true')
	args = [...args, ...ssl_args];

const loolwsd = spawn(`${top_builddir}/loolwsd`, args);
/*
loolwsd.stdout.on('data', (data) => {
	//console.log(`stdout: ${data}`);
});

loolwsd.stderr.on('data', (data) => {
	//console.error(`stderr: ${data}`);
});
*/
loolwsd.on('exit', (code) => {
	console.log(`loolwsd process exited with code ${code}`);
});

let childNodes = [];
for (let i = 1; i <= 6; i++) {
	childNodes.push(
		fork(`${srcdir}/test/load.js`, [ssl_flag, top_builddir, `${top_builddir}/test/data/perf-test-edit.odt`, `testEdit_${i}`, `${port}`])
	);
}

function vacuumCleaner(kill, message, code) {
		console.log(message);
		childNodes.forEach(n => n.kill(kill));
		loolwsd.kill(kill);
		console.log(`Process exited with code ${code}`);
}

function exitHandler(options, exitCode) {
	if (options.cleanup) {
		vacuumCleaner('SIGKILL', 'cleaning up...', exitCode)
	}
	if (options.exit) {
		vacuumCleaner('SIGINT', 'exiting...', exitCode)
	}
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup: true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit: true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

