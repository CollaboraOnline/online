#!/usr/bin/env node
/* eslint-env node */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const TEMPLATE_SELECTION = [
	{ id: 'writer-modern-business-letter-sans-serif', type: 'writer', category: 'writer', relativePath: 'officorr/Modern_business_letter_sans_serif.ott', name: 'Modern Business Letter Sans Serif', featured: true },
	{ id: 'writer-modern-business-letter-serif', type: 'writer', category: 'writer', relativePath: 'officorr/Modern_business_letter_serif.ott', name: 'Modern Business Letter Serif', featured: true },
	{ id: 'writer-businesscard-with-logo', type: 'writer', category: 'writer', relativePath: 'offimisc/Businesscard-with-logo.ott', name: 'Businesscard With Logo', featured: true },
	{ id: 'writer-cv', type: 'writer', category: 'writer', relativePath: 'personal/CV.ott', name: 'CV', featured: true },
	{ id: 'writer-resume1page', type: 'writer', category: 'writer', relativePath: 'personal/Resume1page.ott', name: 'Resume One Page', featured: true },
	{ id: 'writer-styles-default', type: 'writer', category: 'writer', relativePath: 'styles/Default.ott', name: 'Default Style' },
	{ id: 'writer-styles-modern', type: 'writer', category: 'writer', relativePath: 'styles/Modern.ott', name: 'Modern Style' },
	{ id: 'writer-styles-simple', type: 'writer', category: 'writer', relativePath: 'styles/Simple.ott', name: 'Simple Style' },

	{ id: 'calc-default', type: 'calc', category: 'calc', relativePath: 'wizard/styles/default.ots', name: 'Default Spreadsheet' },

	{ id: 'impress-beehive', type: 'impress', category: 'impress', relativePath: 'presnt/Beehive.otp', name: 'Beehive' },
	{ id: 'impress-blue-curve', type: 'impress', category: 'impress', relativePath: 'presnt/Blue_Curve.otp', name: 'Blue Curve' },
	{ id: 'impress-blueprint-plans', type: 'impress', category: 'impress', relativePath: 'presnt/Blueprint_Plans.otp', name: 'Blueprint Plans' },
	{ id: 'impress-candy', type: 'impress', category: 'impress', relativePath: 'presnt/Candy.otp', name: 'Candy' },
	{ id: 'impress-dna', type: 'impress', category: 'impress', relativePath: 'presnt/DNA.otp', name: 'DNA' },
	{ id: 'impress-focus', type: 'impress', category: 'impress', relativePath: 'presnt/Focus.otp', name: 'Focus' },
	{ id: 'impress-forestbird', type: 'impress', category: 'impress', relativePath: 'presnt/Forestbird.otp', name: 'Forestbird' },
	{ id: 'impress-freshes', type: 'impress', category: 'impress', relativePath: 'presnt/Freshes.otp', name: 'Freshes' },
	{ id: 'impress-grey-elegant', type: 'impress', category: 'impress', relativePath: 'presnt/Grey_Elegant.otp', name: 'Grey Elegant' },
	{ id: 'impress-growing-liberty', type: 'impress', category: 'impress', relativePath: 'presnt/Growing_Liberty.otp', name: 'Growing Liberty' },
	{ id: 'impress-inspiration', type: 'impress', category: 'impress', relativePath: 'presnt/Inspiration.otp', name: 'Inspiration' },
	{ id: 'impress-lights', type: 'impress', category: 'impress', relativePath: 'presnt/Lights.otp', name: 'Lights' },
	{ id: 'impress-metropolis', type: 'impress', category: 'impress', relativePath: 'presnt/Metropolis.otp', name: 'Metropolis' },
	{ id: 'impress-midnightblue', type: 'impress', category: 'impress', relativePath: 'presnt/Midnightblue.otp', name: 'Midnightblue' },
	{ id: 'impress-nature-illustration', type: 'impress', category: 'impress', relativePath: 'presnt/Nature_Illustration.otp', name: 'Nature Illustration' },
	{ id: 'impress-pencil', type: 'impress', category: 'impress', relativePath: 'presnt/Pencil.otp', name: 'Pencil' },
	{ id: 'impress-piano', type: 'impress', category: 'impress', relativePath: 'presnt/Piano.otp', name: 'Piano' },
	{ id: 'impress-portfolio', type: 'impress', category: 'impress', relativePath: 'presnt/Portfolio.otp', name: 'Portfolio' },
	{ id: 'impress-progress', type: 'impress', category: 'impress', relativePath: 'presnt/Progress.otp', name: 'Progress' },
	{ id: 'impress-sunset', type: 'impress', category: 'impress', relativePath: 'presnt/Sunset.otp', name: 'Sunset' },
	{ id: 'impress-vintage', type: 'impress', category: 'impress', relativePath: 'presnt/Vintage.otp', name: 'Vintage' },
	{ id: 'impress-vivid', type: 'impress', category: 'impress', relativePath: 'presnt/Vivid.otp', name: 'Vivid' },
	{ id: 'impress-yellow-idea', type: 'impress', category: 'impress', relativePath: 'presnt/Yellow_Idea.otp', name: 'Yellow Idea' },
];

function parseArgs(argv) {
	const args = {};
	for (let i = 2; i < argv.length; ++i) {
		const arg = argv[i];
		if (!arg.startsWith('--'))
			continue;
		const [key, value] = arg.includes('=') ? arg.split(/=(.+)/) : [arg, argv[++i]];
		args[key.slice(2)] = value;
	}
	return args;
}

function ensureDir(dirPath) {
	fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(value) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

function extractThumbnail(templatePath) {
	try {
		const zip = new AdmZip(templatePath);
		const entry = zip.getEntry('Thumbnails/thumbnail.png');
		if (!entry)
			return null;
		return entry.getData();
	} catch (error) {
		console.warn(`Failed to read thumbnail from ${templatePath}: ${error.message}`);
		return null;
	}
}

function buildManifestEntries(templateRoot, previewsRoot) {
	const entries = [];
	for (const item of TEMPLATE_SELECTION) {
		const absoluteTemplatePath = path.join(templateRoot, item.relativePath);
		if (!fs.existsSync(absoluteTemplatePath)) {
			console.warn(`Template not found: ${absoluteTemplatePath}`);
			continue;
		}

		let previewRelative = null;
		const buffer = extractThumbnail(absoluteTemplatePath);
		if (buffer && buffer.length) {
			const previewRelativePath = path.join('previews', item.type, `${slugify(item.id)}.png`);
			const previewAbsolutePath = path.join(previewsRoot, item.type, `${slugify(item.id)}.png`);
			ensureDir(path.dirname(previewAbsolutePath));
			try {
				fs.writeFileSync(previewAbsolutePath, buffer);
				previewRelative = path.posix.join('templates', previewRelativePath.replace(/\\/g, '/'));
			} catch (error) {
				console.warn(`Failed to write preview for ${absoluteTemplatePath}: ${error.message}`);
			}
		}

		entries.push({
			id: item.id,
			name: item.name,
			type: item.type,
			category: item.category,
			path: absoluteTemplatePath,
			preview: previewRelative,
			featured: !!item.featured,
		});
	}
	return entries;
}

function writeManifest(outPath, templates, sourceRoot) {
	const manifest = {
		generatedAt: new Date().toISOString(),
		source: sourceRoot,
		templates,
	};

	ensureDir(path.dirname(outPath));
	fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');
}

(function main() {
	const args = parseArgs(process.argv);
	const loPath = args['lo-path'];
	const outPath = args['out'];

	if (!outPath) {
		console.error('generate-templates-manifest: missing --out argument');
		process.exit(1);
	}

	const templateRoot = loPath ? path.join(loPath, 'share', 'template', 'common') : null;
	if (!templateRoot || !fs.existsSync(templateRoot)) {
		writeManifest(outPath, [], templateRoot || '');
		return;
	}

	const manifestDir = path.dirname(outPath);
	const previewsRoot = path.join(manifestDir, 'previews');
	try {
		fs.rmSync(previewsRoot, { recursive: true, force: true });
	} catch (error) {
		console.warn(`Failed to clean previews directory: ${error.message}`);
	}

	const entries = buildManifestEntries(templateRoot, previewsRoot);
	writeManifest(outPath, entries, templateRoot);
})();
