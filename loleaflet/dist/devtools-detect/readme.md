# devtools-detect

> Detect if DevTools is open and its orientation

Useful for when you want something special to happen when DevTools is open. Like pausing canvas, adding style debug info, etc.


## [Demo](http://sindresorhus.com/devtools-detect)


## Install

```
$ npm install --save devtools-detect
```


## Usage

```html
<script src="node_modules/devtools-detect/index.js"></script>
<script>
	// check if it's open
	console.log('is DevTools open?', window.devtools.open);
	// check it's orientation, null if not open
	console.log('and DevTools orientation?', window.devtools.orientation);

	// get notified when it's opened/closed or orientation changes
	window.addEventListener('devtoolschange', function (e) {
		console.log('is DevTools open?', e.detail.open);
		console.log('and DevTools orientation?', e.detail.orientation);
	});
</script>
```


## Support

- Chrome DevTools
- Safari DevTools
- Firefox DevTools
- Firebug
- Firebug Lite


## Caveats

Doesn't work if DevTools is undocked and will show false positive if you toggle any kind of sidebar.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
