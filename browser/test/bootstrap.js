const { spawn, fork } = require('child_process');
if (process.argv.length < 5 || process.argv[2] == '--help') {
	console.debug('bootstrap.js <ssl_true_or_false> <abs_top_builddir> <abs_srcdir>');
	process.exit(0);
}
const ssl_flag = process.argv[2];
const top_builddir = process.argv[3];
const srcdir = process.argv[4];
const typing_speed = process.argv[5];
const single_view = process.argv[6];
const typing_duration = process.argv[7];
const inspect = process.argv[8];
const recordStats = process.argv[9];

// verbose console output
const debug = false;

/* dont use the default port (9980)*/
const port = '9999';
let args = [
	`--o:sys_template_path=${top_builddir}/systemplate`,
	'--o:security.capabilities=false',
	`--o:child_root_path=${top_builddir}/jails`,
	'--o:storage.filesystem[@allow]=true',
	'--o:admin_console.username=admin --o:admin_console.password=admin',
	'--o:logging.file[@enable]=true --o:logging.level=' + (debug ? 'trace' : 'warning'),
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

const coolwsd = spawn(`${top_builddir}/coolwsd`, args);

if (debug)
{
	coolwsd.stdout.on('data', (data) => {
		console.log(`stdout: ${data}`);
	});
	coolwsd.stderr.on('data', (data) => {
		console.error(`stderr: ${data}`);
	});
}

coolwsd.on('exit', (code) => {
	console.log(`coolwsd process exited with code ${code}`);
});

console.log('\nTest running - connect to:\n\n\t' +
	    'https://localhost:9999/browser/1234/cool.html?file_path=file://' +
	    top_builddir + '/test/data/perf-test-edit.odt\n\n');

let childNodes = [];

let execArgs = [];
if (inspect === 'true')
	execArgs.push('--inspect');
childNodes.push(
	fork(`${srcdir}/test/load.js`, [ssl_flag, top_builddir, `${top_builddir}/test/data/perf-test-edit.odt`, `testEdit_1`, `${port}`, `${typing_speed}`, `${typing_duration}`, `${recordStats}`, `${single_view}`], {execArgv: execArgs})
);
if(single_view !== "true") {
	for (let i = 2; i <= 6; i++) {
		childNodes.push(
			fork(`${srcdir}/test/load.js`, [ssl_flag, top_builddir, `${top_builddir}/test/data/perf-test-edit.odt`, `testEdit_${i}`, `${port}`, `${typing_speed}`, `${typing_duration}`, 'false', 'false'])
		);
	}
}

function vacuumCleaner(kill, message, code) {
		console.log(message);
		childNodes.forEach(n => n.kill(kill));
		coolwsd.kill(kill);
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

