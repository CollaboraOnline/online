# Collabora Online clang plugin

## Building

For configure: use the `--enable-coplugin` option.

To build, first build the clang plugin using:

```
make -C clang
```

and only then build the actual code.

## Testing

To run the automated tests:

```
make -C clang check
```

## Resources

- <https://clang.llvm.org/docs/LibASTMatchersReference.html> "AST Matcher Reference"
- <https://firefox-source-docs.mozilla.org/code-quality/static-analysis/writing-new/index.html>
  "Writing New Firefox-Specific Static Analysis Checks" suggests to use AST matchers instead of
  `RecursiveASTVisitor`, so using that approach here
