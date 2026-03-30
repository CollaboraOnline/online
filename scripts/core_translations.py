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

"""
Manage core translation strings that differ between upstream LibreOffice
and the downstream Collabora branch.

Problem
-------
The Collabora branch of LibreOffice Core (e.g. distro/collabora/co-25.04)
carries new features on top of the corresponding upstream LibreOffice
branch (e.g. libreoffice-25-2).  These new features introduce new
translatable strings that do not exist in upstream.  Because TDF Weblate
only translates the upstream branch, those Collabora-only strings have no
translations — they would appear untranslated in Collabora Online.

This script extracts exactly those new strings (the "diff") and manages
their translation lifecycle through Collabora's own Weblate instance.

Workflow overview
-----------------
1. Both branches are built with `make translations`, producing .pot files
   under workdir/pot/.  (Or you supply pre-extracted pot directories.)
2. `update` compares downstream (Collabora) vs upstream (LibreOffice) pots.
   Entries that exist only in the Collabora branch (new strings from new
   features) are collected into browser/po/templates/core.pot in the
   online repo.
3. For every existing browser/po/core-<lang>.po it merges the new pot in,
   preserving translations already done in Weblate.  Untranslated entries
   are pre-filled from a *higher* upstream branch's translations (via
   --prefill-repo), because the base upstream branch does not contain
   these strings at all — they are new to the Collabora branch.  A higher
   branch like libreoffice-26-2 may already have translations if the
   features were upstreamed by then.
4. Translators work on these PO files via Collabora's Weblate.
5. `retrofit` takes the finished translations and writes them back into
   the core repo's translations/source/<lang>/*.po files so they can be
   committed there.

Language codes
--------------
Online repo uses underscores (zh_CN, pt_BR), core repo uses dashes
(zh-CN, pt-BR).  The script converts automatically.

Files touched
-------------
  online repo:
    browser/po/templates/core.pot   — generated POT (diff strings)
    browser/po/core-<lang>.po       — per-language PO files
  core repo:
    translations/source/<lang>/*.po — updated by retrofit

Subcommands
-----------
update      Generate core.pot and create/update core-<lang>.po files.
retrofit    Push translations from core-<lang>.po back into core repo.

Examples
--------
  # Most common: update using pre-extracted pot directories, prefilling
  # translations from a higher upstream branch (libreoffice-26-2)
  python3 scripts/core_translations.py update \\
      --downstream-pot-dir /path/to/co-25.04/workdir/pot \\
      --upstream-pot-dir /path/to/libreoffice-25-2/workdir/pot \\
      --prefill-repo ~/lo-26-2

  # If --prefill-repo is omitted it defaults to --core-repo (~/co-25.04)
  python3 scripts/core_translations.py update \\
      --downstream-pot-dir /path/to/co-25.04/workdir/pot \\
      --upstream-pot-dir /path/to/libreoffice-25-2/workdir/pot

  # Update only a single language's PO file
  python3 scripts/core_translations.py update \\
      --downstream-pot-dir /path/to/co-pots \\
      --upstream-pot-dir /path/to/lo-pots --lang de

  # Also create PO files for languages not yet in online repo
  python3 scripts/core_translations.py update \\
      --downstream-pot-dir /path/to/co-pots \\
      --upstream-pot-dir /path/to/lo-pots --create-new

  # Full automation with git worktrees (slow, requires build environment)
  python3 scripts/core_translations.py update \\
      --downstream-branch distro/collabora/co-25.04 \\
      --upstream-branch libreoffice-25-2

  # Retrofit all translations back to core repo
  python3 scripts/core_translations.py retrofit

  # Retrofit a single language (useful for testing)
  python3 scripts/core_translations.py retrofit --lang fr

  # Verbose output + custom repo paths
  python3 scripts/core_translations.py -v retrofit \\
      --core-repo /path/to/core --online-repo /path/to/online
"""

import argparse
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import polib

log = logging.getLogger("core_translations")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def lang_online_to_core(lang):
    """Convert online-style language code (underscore) to core-style (dash)."""
    return lang.replace("_", "-")


def lang_core_to_online(lang):
    """Convert core-style language code (dash) to online-style (underscore)."""
    return lang.replace("-", "_")


def detect_online_repo():
    """Return the online repo root assuming this script lives in scripts/."""
    return Path(__file__).resolve().parent.parent


def po_dir(online_repo):
    return online_repo / "browser" / "po"


def pot_path(online_repo):
    return po_dir(online_repo) / "templates" / "core.pot"


def core_po_path(online_repo, lang):
    """Return path for core-<lang>.po (using online-style underscore codes)."""
    return po_dir(online_repo) / f"core-{lang}.po"


# ---------------------------------------------------------------------------
# POT comparison (from compare_pots1.py)
# ---------------------------------------------------------------------------

def collect_pot_entries(directory):
    """Collect all entries as {(relpath, msgctxt, msgid): POEntry}."""
    data = {}
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d != "helpcontent2"]
        for f in files:
            if not f.endswith(".pot"):
                continue
            relpath = os.path.relpath(os.path.join(root, f), directory)
            pot = polib.pofile(os.path.join(root, f))
            for entry in pot:
                key = (relpath, entry.msgctxt or "", entry.msgid)
                data[key] = entry
    return data


def merge_or_add(target, entry):
    """Merge occurrences/comments when (msgctxt, msgid) already exists."""
    key = (entry.msgctxt or "", entry.msgid)
    if key not in target:
        target[key] = polib.POEntry(
            msgid=entry.msgid,
            msgctxt=entry.msgctxt,
            msgstr="",
            occurrences=list(entry.occurrences),
            comment=entry.comment,
            tcomment=entry.tcomment,
            flags=list(entry.flags),
        )
    else:
        existing = target[key]
        seen = set(existing.occurrences)
        for occ in entry.occurrences:
            if occ not in seen:
                existing.occurrences.append(occ)
                seen.add(occ)
        if entry.comment and entry.comment not in (existing.comment or ""):
            existing.comment = (
                (existing.comment or "") + "\n" + entry.comment
            ).strip()
        if entry.tcomment and entry.tcomment not in (existing.tcomment or ""):
            existing.tcomment = (
                (existing.tcomment or "") + "\n" + entry.tcomment
            ).strip()


def build_diff_pot(downstream_dir, upstream_dir):
    """Return a POFile containing entries that differ between branches."""
    log.info("Loading upstream entries from %s ...", upstream_dir)
    upstream = collect_pot_entries(upstream_dir)

    log.info("Loading downstream entries from %s ...", downstream_dir)
    downstream = collect_pot_entries(downstream_dir)

    merged = {}
    for key, entry in downstream.items():
        relpath, msgctxt, msgid = key
        same_ctx = [
            v for (f, c, _), v in upstream.items()
            if f == relpath and c == msgctxt
        ]
        if not same_ctx or not any(v.msgid == msgid for v in same_ctx):
            merge_or_add(merged, entry)

    diff_pot = polib.POFile()
    diff_pot.metadata = {
        "Project-Id-Version": "core-co-25.04",
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Transfer-Encoding": "8bit",
    }
    for entry in merged.values():
        diff_pot.append(entry)

    log.info("Diff POT contains %d entries.", len(diff_pot))
    return diff_pot


# ---------------------------------------------------------------------------
# Collecting translations from core (from prefill_translations.py)
# ---------------------------------------------------------------------------

def collect_translations(lang_dir):
    """Collect all translations from .po files under *lang_dir*.

    Returns (by_key, by_msgid) where:
      by_key   — {(msgctxt, msgid): msgstr}  exact context match
      by_msgid — {msgid: msgstr}  context-free fallback, only set when
                 every translation for that msgid agrees (same msgstr);
                 omitted when translations conflict across contexts.
    """
    by_key = {}
    # msgid -> set of distinct msgstr values seen
    msgid_strs = {}
    for root, dirs, files in os.walk(lang_dir):
        dirs[:] = [d for d in dirs if d != "helpcontent2"]
        for f in files:
            if not f.endswith(".po"):
                continue
            po_path = Path(root) / f
            try:
                po = polib.pofile(str(po_path))
            except Exception as exc:
                log.warning("Failed to parse %s: %s", po_path, exc)
                continue
            for entry in po:
                if entry.msgstr and not entry.obsolete:
                    key = (entry.msgctxt or "", entry.msgid)
                    by_key[key] = entry.msgstr
                    msgid_strs.setdefault(entry.msgid, set()).add(
                        entry.msgstr,
                    )

    # Build context-free fallback: only when all contexts agree
    by_msgid = {}
    for msgid, strs in msgid_strs.items():
        if len(strs) == 1:
            by_msgid[msgid] = next(iter(strs))

    return by_key, by_msgid


def clone_entry(entry, msgstr=""):
    """Deep-copy a POEntry, optionally overriding msgstr."""
    return polib.POEntry(
        msgid=entry.msgid,
        msgctxt=entry.msgctxt,
        msgstr=msgstr,
        msgid_plural=entry.msgid_plural,
        msgstr_plural=(
            entry.msgstr_plural.copy() if entry.msgstr_plural else {}
        ),
        occurrences=list(entry.occurrences),
        comment=entry.comment,
        tcomment=entry.tcomment,
        flags=list(entry.flags),
        previous_msgctxt=entry.previous_msgctxt,
        previous_msgid=entry.previous_msgid,
        previous_msgid_plural=entry.previous_msgid_plural,
    )


# ---------------------------------------------------------------------------
# Git-worktree extraction (alternative to pre-extracted pot dirs)
# ---------------------------------------------------------------------------

def extract_pots_via_worktree(core_repo, branch):
    """Create a temporary worktree, run ``make translations``, return pot dir.

    The caller is responsible for cleaning up via *cleanup_worktree*.
    """
    tmp = tempfile.mkdtemp(prefix="core_pot_")
    wt_path = os.path.join(tmp, "worktree")
    log.info("Creating worktree for %s at %s ...", branch, wt_path)
    subprocess.check_call(
        ["git", "worktree", "add", wt_path, branch],
        cwd=str(core_repo),
    )
    log.info("Running make translations in worktree ...")
    subprocess.check_call(["make", "translations"], cwd=wt_path)
    pot_dir = os.path.join(wt_path, "workdir", "pot")
    if not os.path.isdir(pot_dir):
        raise RuntimeError(f"Expected pot directory not found: {pot_dir}")
    return pot_dir, wt_path, tmp


def cleanup_worktree(core_repo, wt_path, tmp):
    log.info("Removing worktree %s ...", wt_path)
    subprocess.call(
        ["git", "worktree", "remove", "--force", wt_path],
        cwd=str(core_repo),
    )
    shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# update subcommand
# ---------------------------------------------------------------------------

def resolve_pot_dirs(args):
    """Return (downstream_pot_dir, upstream_pot_dir) from args, extracting
    via worktrees if necessary.  Also returns a list of cleanup callbacks."""
    cleanups = []

    if args.downstream_pot_dir and args.upstream_pot_dir:
        return args.downstream_pot_dir, args.upstream_pot_dir, cleanups

    if args.downstream_branch and args.upstream_branch:
        core_repo = Path(args.core_repo).expanduser()
        ds_pot, ds_wt, ds_tmp = extract_pots_via_worktree(
            core_repo, args.downstream_branch,
        )
        cleanups.append(lambda: cleanup_worktree(core_repo, ds_wt, ds_tmp))

        us_pot, us_wt, us_tmp = extract_pots_via_worktree(
            core_repo, args.upstream_branch,
        )
        cleanups.append(lambda: cleanup_worktree(core_repo, us_wt, us_tmp))
        return ds_pot, us_pot, cleanups

    log.error(
        "Provide either --downstream-pot-dir/--upstream-pot-dir "
        "or --downstream-branch/--upstream-branch."
    )
    sys.exit(1)


def _lookup_translation(key, msgid, core_translations, core_translations_fallback):
    """Look up a translation by exact (msgctxt, msgid) first, then fall
    back to a context-free msgid match (only used when all contexts for
    that msgid agree on the same translation)."""
    msgstr = core_translations.get(key, "")
    if not msgstr:
        msgstr = core_translations_fallback.get(msgid, "")
    return msgstr


def update_existing_po(pot, existing_po_path, core_translations,
                       core_translations_fallback):
    """Merge new pot into an existing PO file, preserving Weblate
    translations and prefilling untranslated entries from core."""
    existing = polib.pofile(str(existing_po_path))

    # Index existing translations by (msgctxt, msgid)
    existing_index = {}
    for entry in existing:
        key = (entry.msgctxt or "", entry.msgid)
        existing_index[key] = entry

    new_po = polib.POFile()
    new_po.metadata = existing.metadata.copy()

    for pot_entry in pot:
        key = (pot_entry.msgctxt or "", pot_entry.msgid)
        if key in existing_index and existing_index[key].msgstr:
            # Preserve existing Weblate translation
            new_po.append(clone_entry(pot_entry, existing_index[key].msgstr))
        else:
            # New entry or still untranslated — try prefilling from core
            msgstr = _lookup_translation(
                key, pot_entry.msgid,
                core_translations, core_translations_fallback,
            )
            new_po.append(clone_entry(pot_entry, msgstr))

    return new_po


def create_new_po(pot, lang_core, core_translations,
                  core_translations_fallback):
    """Create a brand-new PO file for *lang_core*, prefilled from core."""
    new_po = polib.POFile()
    new_po.metadata = {
        "Project-Id-Version": f"core-{lang_core}",
        "Language": lang_core,
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Transfer-Encoding": "8bit",
    }
    for pot_entry in pot:
        key = (pot_entry.msgctxt or "", pot_entry.msgid)
        msgstr = _lookup_translation(
            key, pot_entry.msgid,
            core_translations, core_translations_fallback,
        )
        new_po.append(clone_entry(pot_entry, msgstr))
    return new_po


def cmd_update(args):
    online_repo = Path(args.online_repo).expanduser()
    core_repo = Path(args.core_repo).expanduser()
    prefill_repo = Path(args.prefill_repo).expanduser()
    prefill_source = prefill_repo / "translations" / "source"
    if not prefill_source.exists():
        log.error("Prefill translations dir not found: %s", prefill_source)
        sys.exit(1)

    downstream_dir, upstream_dir, cleanups = resolve_pot_dirs(args)
    try:
        # Step 1: build diff pot
        diff_pot = build_diff_pot(downstream_dir, upstream_dir)

        # Step 2: write core.pot
        out_pot = pot_path(online_repo)
        out_pot.parent.mkdir(parents=True, exist_ok=True)
        diff_pot.save(str(out_pot))
        log.info("Wrote %s (%d entries).", out_pot, len(diff_pot))

        # Step 3: update / create PO files
        browser_po = po_dir(online_repo)
        browser_po.mkdir(parents=True, exist_ok=True)

        if args.lang:
            # Single language mode
            lang_online = args.lang
            lang_core = lang_online_to_core(lang_online)
            langs = [(lang_online, lang_core)]
        else:
            # Collect existing languages from browser/po/core-*.po
            langs = []
            for p in sorted(browser_po.glob("core-*.po")):
                lo = p.stem[len("core-"):]  # online-style code
                lc = lang_online_to_core(lo)
                langs.append((lo, lc))

        for lang_online, lang_core in langs:
            po_file = core_po_path(online_repo, lang_online)
            lang_dir = prefill_source / lang_core
            core_trans, core_trans_fallback = (
                collect_translations(lang_dir)
                if lang_dir.exists()
                else ({}, {})
            )

            if po_file.exists():
                new_po = update_existing_po(
                    diff_pot, po_file, core_trans, core_trans_fallback,
                )
            else:
                new_po = create_new_po(
                    diff_pot, lang_core, core_trans, core_trans_fallback,
                )

            new_po.save(str(po_file))
            translated = sum(
                1 for e in new_po if e.msgstr and not e.obsolete
            )
            log.info(
                "Wrote %s (%d entries, %d translated).",
                po_file.name, len(new_po), translated,
            )

        # Step 4: optionally create PO files for new languages
        if args.create_new and prefill_source.exists():
            existing_online = {
                p.stem[len("core-"):]
                for p in browser_po.glob("core-*.po")
            }
            for lang_dir in sorted(prefill_source.iterdir()):
                if not lang_dir.is_dir():
                    continue
                lang_core = lang_dir.name
                lang_online = lang_core_to_online(lang_core)
                if lang_online in existing_online:
                    continue
                if args.lang and lang_online != args.lang:
                    continue

                core_trans, core_trans_fallback = collect_translations(
                    lang_dir,
                )
                if not core_trans:
                    continue

                new_po = create_new_po(
                    diff_pot, lang_core, core_trans, core_trans_fallback,
                )
                # Only create if there are some translated entries
                translated = sum(
                    1 for e in new_po if e.msgstr and not e.obsolete
                )
                if translated == 0:
                    continue

                out = core_po_path(online_repo, lang_online)
                new_po.save(str(out))
                log.info(
                    "Created %s (%d entries, %d translated).",
                    out.name, len(new_po), translated,
                )

    finally:
        for fn in cleanups:
            fn()


# ---------------------------------------------------------------------------
# retrofit subcommand
# ---------------------------------------------------------------------------

def collect_replacements(core_po_file):
    """Collect translated entries from a core-<lang>.po as
    {(msgctxt, msgid): msgstr}."""
    replacements = {}
    po = polib.pofile(str(core_po_file))
    for entry in po:
        if entry.msgstr and not entry.obsolete:
            key = (entry.msgctxt or "", entry.msgid)
            replacements[key] = entry.msgstr
    return replacements


def _remove_obsolete_duplicates(po_path):
    """Remove obsolete (#~) entries whose (msgctxt, msgid) duplicates an
    active entry.  msgmerge can re-activate previously obsolete strings,
    leaving the old obsolete copy behind — which then causes "duplicate
    message definition" errors on the next msgmerge run.

    Returns True if any entries were removed.
    """
    po = polib.pofile(str(po_path), wrapwidth=0)
    # po iteration includes obsolete entries; filter them out
    active_keys = {(e.msgctxt, e.msgid) for e in po
                   if not e.obsolete}
    to_remove = [e for e in po.obsolete_entries()
                 if (e.msgctxt, e.msgid) in active_keys]
    if not to_remove:
        return False
    for e in to_remove:
        po.obsolete_entries().remove(e)
    po.save()
    return True


def msgmerge_po(po_path, pot_path):
    """Run msgmerge to update *po_path* with new entries from *pot_path*.

    After a successful merge, any obsolete entries that now duplicate
    active entries are removed (msgmerge can re-activate strings while
    leaving the old obsolete copy behind).

    Returns True if the file was changed, False if unchanged or on error
    (e.g. duplicate entries in the pot file).
    """
    old_content = po_path.read_bytes()
    result = subprocess.run(
        [
            "msgmerge", "--quiet", "--update", "--no-fuzzy-matching",
            "--no-wrap", "--backup=none", str(po_path), str(pot_path),
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        log.warning("msgmerge failed for %s: %s", pot_path.name,
                     result.stderr.strip().split("\n")[0])
        return False
    _remove_obsolete_duplicates(po_path)
    return po_path.read_bytes() != old_content


def merge_pots_into_lang(lang_core, core_source, pot_dir):
    """Run msgmerge for every PO file under *lang_core* that has a
    matching pot file.  Only files that actually change are written
    (msgmerge --update skips unchanged files, and we compare bytes to
    be sure).

    Returns the number of PO files updated by msgmerge.
    """
    lang_dir = core_source / lang_core
    merged_files = 0

    for root, dirs, files in os.walk(lang_dir):
        dirs[:] = [d for d in dirs if d != "helpcontent2"]
        for f in files:
            if not f.endswith(".po"):
                continue
            po_path = Path(root) / f
            # Derive the matching pot path:
            #   translations/source/<lang>/cui/messages.po
            #   -> workdir/pot/cui/messages.pot
            rel = po_path.relative_to(lang_dir)
            pot_file = pot_dir / rel.with_suffix(".pot")
            if not pot_file.exists():
                continue
            if msgmerge_po(po_path, pot_file):
                merged_files += 1

    return merged_files


def ensure_pot_dir(core_repo):
    """Return the pot directory under *core_repo*, running
    ``make translations`` first if it does not exist yet."""
    pot_dir = core_repo / "workdir" / "pot"
    if not pot_dir.exists():
        log.info(
            "workdir/pot not found — running make translations in %s ...",
            core_repo,
        )
        subprocess.check_call(["make", "translations"], cwd=str(core_repo))
        if not pot_dir.exists():
            log.error("make translations did not produce %s", pot_dir)
            sys.exit(1)
    return pot_dir


def retrofit_lang(core_po_file, lang_core, core_source, pot_dir):
    lang_dir = core_source / lang_core
    if not lang_dir.exists():
        log.warning(
            "Skipping %s: directory not found (%s).", lang_core, lang_dir,
        )
        return

    # Step 1: merge latest pot entries into PO files so new strings exist
    merged = merge_pots_into_lang(lang_core, core_source, pot_dir)
    log.info("msgmerge: %d file(s) updated for %s.", merged, lang_core)

    # Step 2: apply translations from core-<lang>.po
    log.info("Retrofitting %s ...", lang_core)
    replacements = collect_replacements(core_po_file)
    changed_files = 0
    changed_entries = 0

    for root, dirs, files in os.walk(lang_dir):
        dirs[:] = [d for d in dirs if d != "helpcontent2"]
        for f in files:
            if not f.endswith(".po"):
                continue
            po_path = Path(root) / f
            po = polib.pofile(str(po_path))
            updated = False

            for entry in po:
                key = (entry.msgctxt or "", entry.msgid)
                if key in replacements:
                    new_msgstr = replacements[key]
                    if entry.msgstr != new_msgstr:
                        entry.msgstr = new_msgstr
                        if "fuzzy" in entry.flags:
                            entry.flags.remove("fuzzy")
                        updated = True
                        changed_entries += 1

            if updated:
                po.wrapwidth = 0
                po.save(str(po_path))
                changed_files += 1

    log.info(
        "Updated %d entries in %d files for %s.",
        changed_entries, changed_files, lang_core,
    )

    # Step 2b (sl only): strip keyid comments from changed files.
    # Slovenian PO files don't use keyids; removing them avoids noise.
    if lang_core == "sl":
        _strip_keyids(lang_dir)

    # Step 3: strip noise hunks from changed files
    reverted, noise_hunks = filter_noise_from_files(lang_dir)
    if reverted or noise_hunks:
        log.info(
            "Noise filter: reverted %d file(s), stripped %d noise hunk(s) "
            "for %s.", reverted, noise_hunks, lang_core,
        )


def _strip_keyids(lang_dir):
    """Remove keyid comment lines from git-changed PO files under *lang_dir*.

    Keyids are 5-character identifier comments (e.g. ``#. KGSPW``) generated
    by the LibreOffice build system.  Some languages (notably Slovenian) don't
    carry them, so stripping them from files touched by msgmerge avoids diff
    noise.
    """
    toplevel = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True, text=True, cwd=str(lang_dir),
    )
    if toplevel.returncode != 0:
        return
    repo_root = toplevel.stdout.strip()

    result = subprocess.run(
        ["git", "diff", "--name-only", "--", str(lang_dir)],
        capture_output=True, text=True, cwd=repo_root,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return

    keyid_re = re.compile(r"^#\. .{5}$")
    stripped = 0
    for rel_path in result.stdout.strip().split("\n"):
        if not rel_path.endswith(".po"):
            continue
        abs_path = Path(repo_root) / rel_path
        lines = abs_path.read_text(encoding="utf-8").splitlines(True)
        new_lines = [ln for ln in lines if not keyid_re.match(ln.rstrip("\n"))]
        if len(new_lines) < len(lines):
            abs_path.write_text("".join(new_lines), encoding="utf-8")
            stripped += 1
    if stripped:
        log.debug("Stripped keyids from %d file(s).", stripped)


# ---------------------------------------------------------------------------
# Diff noise filtering (from translations/filter-po-changes.py)
# ---------------------------------------------------------------------------

# Keywords found in PO header msgstr blocks (to be ignored)
_HEADER_KEYWORDS = [
    "POT-Creation-Date", "PO-Revision-Date", "Last-Translator",
    "Language-Team", "MIME-Version", "Content-Type",
    "Content-Transfer-Encoding", "Plural-Forms", "X-Generator",
    "X-Accelerator-Marker", "X-POOTLE-MTIME", "Project-Id-Version",
    "Report-Msgid-Bugs-To", "Language:",
]


def _hunk_has_real_changes(hunk_lines):
    """True if the hunk contains a real translation or structural change
    (not just header metadata, comments, or empty msgstr).

    Besides msgstr changes, msgctxt and msgid changes are considered
    real because they alter the identity of translation entries (e.g.
    context renames from .ui fixes).
    """
    for line in hunk_lines:
        if line.startswith("@@"):
            continue
        # A changed msgctxt or msgid is a structural change
        if re.match(r"^[+-]msgctxt\s", line):
            return True
        if re.match(r"^[+-]msgid\s", line):
            return True
        if re.match(r"^[+-]msgstr", line):
            if re.match(r'^[+-]msgstr\s*""?\s*$', line):
                continue
            if any(kw in line for kw in _HEADER_KEYWORDS):
                continue
            return True
        if re.match(r'^[+-]"', line):
            if any(kw in line for kw in _HEADER_KEYWORDS):
                continue
            content = line[2:].strip().strip('"')
            if content and not content.startswith("#"):
                return True
    return False


def _hunk_is_comment_only(hunk_lines):
    """True if the hunk only touches comment or blank lines."""
    for line in hunk_lines:
        if line.startswith("@@"):
            continue
        if line.startswith(("+", "-")):
            content = line[1:]
            if content.startswith("#") or not content.strip():
                continue
            return False
    return True


def _parse_diff_into_hunks(diff_text):
    """Parse a diff into its header and individual hunks."""
    lines = diff_text.split("\n")
    header_lines = []
    hunks = []
    current = []

    in_header = True
    for line in lines:
        if line.startswith("@@"):
            in_header = False
            if current:
                hunks.append(current)
            current = [line]
        elif in_header:
            header_lines.append(line)
        else:
            current.append(line)
    if current:
        hunks.append(current)

    return header_lines, hunks


def _filter_hunks(header_lines, hunks):
    """Keep only hunks with real translation changes."""
    filtered = []
    for hunk in hunks:
        if _hunk_is_comment_only(hunk):
            continue
        if _hunk_has_real_changes(hunk):
            filtered.append(hunk)
    return filtered


def _reconstruct_diff(header_lines, hunks):
    """Reconstruct a diff from header and hunks."""
    if not hunks:
        return None
    lines = header_lines[:]
    for hunk in hunks:
        lines.extend(hunk)
    result = "\n".join(lines)
    if not result.endswith("\n"):
        result += "\n"
    return result


def filter_noise_from_files(lang_dir):
    """For each changed PO file under *lang_dir*, strip noise hunks
    (comment/header-only changes) from the working tree, keeping only
    hunks with real msgstr changes.

    For each file:
      - If no hunks are real: revert the file entirely.
      - If some hunks are noise: revert the file, then re-apply only
        the real hunks.
      - If all hunks are real: leave the file as-is.

    Returns (files_reverted, noise_hunks_removed).
    """
    toplevel = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True, text=True, cwd=str(lang_dir),
    )
    if toplevel.returncode != 0:
        return 0, 0
    repo_root = toplevel.stdout.strip()

    result = subprocess.run(
        ["git", "diff", "--name-only", "--", str(lang_dir)],
        capture_output=True, text=True,
        cwd=repo_root,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return 0, 0

    files_reverted = 0
    noise_hunks_removed = 0

    for rel_path in result.stdout.strip().split("\n"):
        if not rel_path.endswith(".po"):
            continue

        diff_result = subprocess.run(
            ["git", "diff", "--", rel_path],
            capture_output=True, text=True,
            cwd=repo_root,
        )
        if diff_result.returncode != 0 or not diff_result.stdout:
            continue

        header, hunks = _parse_diff_into_hunks(diff_result.stdout)
        filtered = _filter_hunks(header, hunks)
        noise_count = len(hunks) - len(filtered)

        if noise_count == 0:
            # All hunks are real — nothing to do
            continue

        # Revert the file to clean state first
        subprocess.run(
            ["git", "checkout", "--", rel_path],
            cwd=repo_root,
        )

        if not filtered:
            # Entire file was noise
            log.debug("Reverted (all noise): %s", rel_path)
            files_reverted += 1
            noise_hunks_removed += noise_count
            continue

        # Re-apply only the real hunks
        real_diff = _reconstruct_diff(header, filtered)
        apply_result = subprocess.run(
            ["git", "apply", "-"],
            input=real_diff, text=True,
            capture_output=True, cwd=repo_root,
        )
        if apply_result.returncode != 0:
            log.warning(
                "Failed to re-apply filtered diff for %s: %s",
                rel_path, apply_result.stderr.strip(),
            )
            # Re-apply the full original diff as fallback
            subprocess.run(
                ["git", "apply", "-"],
                input=diff_result.stdout, text=True,
                cwd=repo_root,
            )
        else:
            log.debug(
                "Stripped %d noise hunk(s) from %s",
                noise_count, rel_path,
            )
            noise_hunks_removed += noise_count

    return files_reverted, noise_hunks_removed


def cmd_retrofit(args):
    online_repo = Path(args.online_repo).expanduser()
    core_repo = Path(args.core_repo).expanduser()
    core_source = core_repo / "translations" / "source"

    if not core_source.exists():
        log.error("Core translations dir not found: %s", core_source)
        sys.exit(1)

    pot_dir = ensure_pot_dir(core_repo)

    browser_po = po_dir(online_repo)

    if args.lang:
        lang_online = args.lang
        lang_core = lang_online_to_core(lang_online)
        po_file = core_po_path(online_repo, lang_online)
        if not po_file.exists():
            log.error("PO file not found: %s", po_file)
            sys.exit(1)
        retrofit_lang(po_file, lang_core, core_source, pot_dir)
    else:
        po_files = sorted(browser_po.glob("core-*.po"))
        if not po_files:
            log.error("No core-*.po files found in %s.", browser_po)
            sys.exit(1)

        for po_file in po_files:
            lang_online = po_file.stem[len("core-"):]
            lang_core = lang_online_to_core(lang_online)
            retrofit_lang(po_file, lang_core, core_source, pot_dir)

    log.info("Retrofit complete.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Manage core translation strings for Collabora Online.",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true",
        help="Enable verbose logging.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # -- update --
    p_upd = sub.add_parser(
        "update",
        help="Generate core.pot and create/update core-<lang>.po files.",
    )
    pot_grp = p_upd.add_argument_group("POT source (pick one pair)")
    pot_grp.add_argument("--downstream-pot-dir", help="Pre-extracted downstream pot directory.")
    pot_grp.add_argument("--upstream-pot-dir", help="Pre-extracted upstream pot directory.")
    pot_grp.add_argument("--downstream-branch", help="Downstream branch for git worktree extraction.")
    pot_grp.add_argument("--upstream-branch", help="Upstream branch for git worktree extraction.")
    p_upd.add_argument(
        "--core-repo", default="~/co-25.04",
        help="Path to core repo (default: ~/co-25.04).",
    )
    p_upd.add_argument(
        "--prefill-repo",
        help=(
            "Path to a core repo checkout whose translations/source/<lang>/ "
            "is used to prefill untranslated entries.  Should be a higher "
            "upstream branch (e.g. libreoffice-26-2 checkout) where the "
            "new strings already have translations.  "
            "Defaults to --core-repo."
        ),
    )
    p_upd.add_argument(
        "--online-repo", default=None,
        help="Path to online repo (default: auto-detect from script location).",
    )
    p_upd.add_argument(
        "--create-new", action="store_true",
        help="Also create PO files for languages not yet in online repo.",
    )
    p_upd.add_argument(
        "--lang",
        help="Process only this language (online-style code, e.g. fr, zh_CN).",
    )
    p_upd.set_defaults(func=cmd_update)

    # -- retrofit --
    p_ret = sub.add_parser(
        "retrofit",
        help="Push translations from core-<lang>.po back to core repo.",
    )
    p_ret.add_argument(
        "--core-repo", default="~/co-25.04",
        help="Path to core repo (default: ~/co-25.04).",
    )
    p_ret.add_argument(
        "--online-repo", default=None,
        help="Path to online repo (default: auto-detect from script location).",
    )
    p_ret.add_argument(
        "--lang",
        help="Process only this language (online-style code, e.g. fr, zh_CN).",
    )
    p_ret.set_defaults(func=cmd_retrofit)

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    if args.online_repo is None:
        args.online_repo = str(detect_online_repo())

    if hasattr(args, "prefill_repo") and args.prefill_repo is None:
        args.prefill_repo = args.core_repo

    args.func(args)


if __name__ == "__main__":
    main()

# vim: set shiftwidth=4 softtabstop=4 expandtab:
