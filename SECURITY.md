# Security Policy

## Supported Versions

Currently the following Collabora Online versions are supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 26.04.x   | :white_check_mark: |
| 25.04.x   | :white_check_mark: |
| 24.04.x   | :white_check_mark: |
| 23.05.x  or older | :x:        |


## Reporting a Vulnerability

1. Share the details of the vulnerability privately with our security team by emailing *officesecurity@lists.freedesktop.org*.
2. We acknowledge your report and then verify the vulnerability.
3. Our policy is to disclose the vulnerability to the public within 30 days of the release of the fix, as an advisory with a CVE ID at https://github.com/CollaboraOnline/online/security/advisories.
4. We credit reporters in the advisory, but reporters may remain anonymous if they wish.

## What we do not treat as a vulnerability

We fix these as ordinary bugs, without a CVE:

- Denial of service on its own, including crashes, hangs and resource exhaustion. If it leads to something more, such as code execution or data disclosure, we assess that instead.
- Missing hardening with no demonstrated exploit.
