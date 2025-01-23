#!/usr/bin/env python3
# -*- tab-width: 4; indent-tabs-mode: nil; py-indent-offset: 4 -*-
#
# Copyright the Collabora Online contributors.
#
# SPDX-License-Identifier: MPL-2.0
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

import sys
import os
import json
import subprocess
from datetime import datetime

# Fetch the library versions from coolforkit-ns output
def get_library_versions():
    try:
        result = subprocess.run(
            ["./coolforkit-ns", "--disable-cool-user-checking", "--libversions"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            check=True
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error running 'coolforkit-ns': {e.stderr}")
        return {}

# Map library versions to SBOM packages
def update_versions(lib_versions):
    version_mapping = {
        "coolwsd": lib_versions.get("Version"),
        "Poco": lib_versions.get("PocoVersion"),
        "OpenSSL": lib_versions.get("OpenSSLVersion"),
        "libzstd": lib_versions.get("ZstdVersion"),
        "libpng": lib_versions.get("LibPngVersion")
    }
    for package in sbom_data.get("packages", []):
        if package["name"] in version_mapping and version_mapping[package["name"]]:
            package["versionInfo"] = version_mapping[package["name"]]

# Update 'documentNamespace' based on coolwsd version
def update_document_namespace():
    for package in sbom_data.get("packages", []):
        if package["name"] == "coolwsd":
            version = package.get("versionInfo", "unknown-version")
            sbom_data["documentNamespace"] = f"http://spdx.org/spdxdocs/coolwsd-{version}"
            break

def update_date():
    sbom_data["creationInfo"]["created"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

file_path = os.path.dirname(os.path.dirname(__file__)) + "/cool-sbom-template.spdx.json"
with open(file_path, "r") as file:
    sbom_data = json.load(file)

lib_versions = get_library_versions()
update_versions(lib_versions)
update_document_namespace()
update_date()

output_file_path = sys.argv[1] + "/collabora-online-sbom.spdx.json"
with open(output_file_path, "w") as file:
    json.dump(sbom_data, file, indent=2)
