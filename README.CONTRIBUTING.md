## Online Contributor Representation & Certificate of Origin v1.0

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the appropriate
    version of the Mozilla Public License v2, or (for artwork)
    the Creative Commons Zero (CC0) license; or

(b) The contribution is based upon previous work that, to the best of
    my knowledge, is covered under an appropriate open source license
    and I have the right under that license to submit that work with
    modifications, whether created in whole or in part by me, under
    the aforementioned licenes, in the appropriate version; or

(c) The contribution was provided directly to me by some other person
    who certified (a) or (b) and I have not modified it.

(d) I understand and agree that this project and the contribution are
    public and that a record of the contribution (including all
    metadata and personal information I submit with it, including my
    sign-off) is maintained indefinitely and may be redistributed
    consistent with this project or the open source license(s)
    involved.

(e) I am granting this work to this project under the terms of both
    the Mozilla Public License v2 and the GNU Lesser General Public
    License version 3 as published by the Free Software Foundation:

When submitting a patch, to make this certification add a line that
states:
```
Signed-off-by: Random J Developer <random@developer.example.org>
```
using your real name and the email address (sorry, no pseudonyms
or anonymous contributions.)

## Other information to put into your commit message

When reviewing a patch, we look for the following information in the commit message:

- Title: a single line, short and to the point summary of what the patch does.

  - The reason is to be able to do `git log --pretty=oneline` and have a usable result.

- Intro: observation of the current state

  - Rationale: the problem to be solved is obvious to you, but not to the reviewer. It's good to
    have a list of steps to reproduce the problem.

- Problem description: pros and cons of the current state

  - Rationale: when some feature doesn't work the way expected, frequently there is some other
    use-case that motivated the current behavior. It's easier to not break the old use-case with
    your change if you're aware of the old use-case.

  - If there was an old use-case and you found it by research, please document it, so the person
    reading the commit message finds it easily.

- Solution: give orders to the codebase

  - A short description of how you introduce new behavior while not breaking old behavior is useful,
    because it may not be too obvious just by looking at what you changed.

An alternative is to have much of this information in a (public) issue, refer to that issue and have
a short commit message. That works better e.g. when using images to demonstrate the problem.

## Coding style

There is not really any serious rationale why the code ended up being
written in the style it is... but unless you plan to change some style
detail completely and consistently all over, please keep to the style
of the existing code when editing.

The style is roughly as follows, in rough order of importance:

- Source code files should have unix line terminators (LF)

### C++

- As in LibreOffice, no hard TABs in source files. Only spaces.
  Indentation step is four columns.

- As in LibreOffice, the braces `{` and `}` of the block of `if`, `switch`,
  and `while` statements go on separate lines.

- Following Poco conventions, non-static member variables are prefixed
  with an underscore. Static members have a CamelCase name.

- Do use C++20. When writing new code, prefer C++ Standard Library
  over Poco classes and functions.

- Always prefer the C++ wrapped version of a C library
  API. I.e. include `<cstring>` instead of `<string.h>`, use `std::memcpy()`
  instead of `memcpy()`, etc.

- Use std:: prefix for all std API, i.e. don't ever do `using
  std;`. But it's OK to use `using Poco::Foo;` all over. Maybe that is
  not a good idea? But please no `using` in headers.

- Member functions use `camelCaseWithInitialLowerCase` instead of
  `CamelCaseWithInitialUpperCase`.

- No kind of Hungarian prefixes.

- `return` - is not a function; but a statement - it doesn't need extra ()

- Use `auto` in the following cases only:

  - iterators

  - range-based for loops

  - the type is spelled out in the same line already (e.g. initializing from a
    cast or a function that has a single type parameter)

  In other cases it makes the code more readable to still spell out the type
  explicitly.

### JavaScript

- Indent code with TABs.

- For new code, use TypeScript.

## Security credential related changes

- Instead of the usual one, two reviews are needed.

- Instead of just choosing the 'approve' option on GitHub, please add your
  explicit sign-off to the commit message when you review.
