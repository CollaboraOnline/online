import eslintConfigPrettier from 'eslint-config-prettier';
import eslint from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import * as fs from 'fs';
import globals from 'globals';

const beforePrettier = fs.readFileSync('./.beforeprettier');
const beforePrettierTypescript = [];
const beforePrettierJavascript = [];

for (const file of beforePrettier.toString().split('\n')) {
  if (file === '') continue;

  if (!file.startsWith('/')) {
    throw new Error('A file in .beforeprettier did not start with a /, the eslint config cannot handle paths which are do not have a leading slash');
  }

  if (file.endsWith('.ts')) {
    beforePrettierTypescript.push(file.substring(1));
  } else {
    beforePrettierJavascript.push(file.substring(1));
  }
}

const stylisticRules = {
  semi: 2,
  'comma-style': 2,
  quotes: [2, 'single'],
  'space-before-blocks': 2,
  'keyword-spacing': 2,
};

const functionalRules = {
  'no-mixed-spaces-and-tabs': [2, 'smart-tabs'],
  'no-lonely-if': 2,
  'no-underscore-dangle': 0,
  'no-constant-condition': 0,
  strict: 0,
  'no-shadow': 0,
  'no-console': 0,
  'no-control-regex': 0,
  'no-useless-escape': 0,
  'no-redeclare': 0,
  /// Rules that are set to warn will fail in CI but not when building for development:
  'no-debugger': 1,
  'no-unreachable': 1,
  'no-unused-vars': 0, // needs to be 0, as some things are used by things bundled elsewhere in the project. We should remove this if we switch to import/export
};

const typescriptRules = {
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-inferrable-types': 'off',
  'no-var': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-namespace': 'off',
  'no-inner-declarations': 'off',
  'no-constant-condition': 'off',
  '@typescript-eslint/triple-slash-reference': 'off',
};

const defaultLanguageOptions = {
  ecmaVersion: 2017,
  globals: {
    ...globals.browser,
    ...globals.jquery,
    module: 'readonly',
    define: 'readonly',
    // TODO: maybe we should rethink the below globals to use imports instead?
    Bounds: 'writable',
    CEventsHandler: 'writable',
    CLineUtil: 'writable',
    CPath: 'writable',
    CPathGroup: 'writable',
    CPointSet: 'writable',
    CPolygon: 'writable',
    CPolyline: 'writable',
    CRectangle: 'writable',
    CanvasFillRule: 'writable',
    CanvasLineCap: 'writable',
    CanvasLineJoin: 'writable',
    CanvasOverlay: 'writable',
    CanvasSectionContainer: 'writable',
    CanvasSectionObject: 'writable',
    ChildNode: 'writable',
    ColumnGroup: 'writable',
    CommentLayoutStatus: 'writable',
    EventData: 'writable',
    GroupBase: 'writable',
    GroupEntry: 'writable',
    Header: 'writable',
    HeaderEntryData: 'writable',
    HeaderExtraProperties: 'writable',
    JSDialog: 'writable',
    L: 'writable',
    PathGroupType: 'writable',
    Point: 'writable',
    PointConvertable: 'writable',
    RowGroup: 'writable',
    SectionInitProperties: 'writable',
    SelectionRange: 'writable',
    Toolbar: 'writable',
    ToolbarItem: 'writable',
    UNOModifier: 'writable',
    _: 'writable',
    app: 'writable',
    cool: 'writable',
    CPolyUtil: 'writable',
    ClientRect: 'writable',
    EventListener: 'writable',
    _UNO: 'writable',
    Rectangle: 'writable',
    PointLike: 'writable',
    SheetGeomentry: 'writable',
    EventListenerOrEventListenerObject: 'writable',
    JSDialogCallback: 'writable',
    DimensionPosSize: 'writable',
    SplitPanesContext: 'writable',
    SheetGeometry: 'writable',
  },
};

const ignoredFiles = [
  "**/js/Autolinker.js",
  "**/js/select2.js",
  "**/js/sanitize-url.js",
  "**/js/l10n.js",
  "**/src/unocommands.js",
  "node_modules",
  "dist/src",
  "eslint.config.mjs",
];

export default typescriptEslint.config(
  {
    files: beforePrettierTypescript,
    languageOptions: {
      ...typescriptEslint.configs.base.languageOptions,
      ...defaultLanguageOptions,
    },
    plugins: typescriptEslint.configs.base.plugins,
    rules: {
      ...eslint.configs.recommended.rules,
      ...typescriptEslint.configs.eslintRecommended.rules,
      ...typescriptEslint.configs.recommended[2].rules,
      ...functionalRules,
      ...typescriptRules,
      ...stylisticRules,
    },
    ignores: ignoredFiles,
  },
  {
    files: beforePrettierJavascript,
    languageOptions: {
      ...defaultLanguageOptions,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...functionalRules,
      ...stylisticRules,
    },
    ignores: ignoredFiles,
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ...typescriptEslint.configs.base.languageOptions,
      ...defaultLanguageOptions,
    },
    plugins: typescriptEslint.configs.base.plugins,
    rules: {
      ...eslint.configs.recommended.rules,
      ...typescriptEslint.configs.eslintRecommended.rules,
      ...typescriptEslint.configs.recommended[2].rules,
      ...functionalRules,
      ...typescriptRules,
      ...eslintConfigPrettier.rules,
    },
    ignores: ignoredFiles,
  },
  {
    languageOptions: {
      ...defaultLanguageOptions,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...functionalRules,
      ...eslintConfigPrettier.rules,
    },
    ignores: ignoredFiles,
  },
);
