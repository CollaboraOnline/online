// -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Command-line program to manipulate the Windows clipboard. See the help() function for usage
// information.

// To build, in a Visual Studio 2022 x64 native tools command prompt:
// cl.exe -std:c++23preview -MD clipboard.cpp user32.lib

#include <fcntl.h>
#include <io.h>

#include <cerrno>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <vector>
#include <ranges>
#include <set>
#include <string>
#include <string_view>

#include <wchar.h>

#include <Windows.h>

using std::operator""sv;

struct formatAndData
{
    UINT format;
    HGLOBAL handle;
    std::vector<char> data;
};

static std::wstring get_clipboard_format_name(UINT format)
{
    switch (format)
    {
#define CASE(x)                                                                                    \
    case CF_##x:                                                                                   \
        return std::wstring(L"CF_" #x)
        CASE(BITMAP);
        CASE(DIB);
        CASE(DIBV5);
        CASE(DIF);
        CASE(DSPBITMAP);
        CASE(DSPENHMETAFILE);
        CASE(DSPMETAFILEPICT);
        CASE(DSPTEXT);
        CASE(ENHMETAFILE);
        CASE(HDROP);
        CASE(LOCALE);
        CASE(METAFILEPICT);
        CASE(OEMTEXT);
        CASE(OWNERDISPLAY);
        CASE(PALETTE);
        CASE(PENDATA);
        CASE(RIFF);
        CASE(SYLK);
        CASE(TEXT);
        CASE(TIFF);
        CASE(UNICODETEXT);
        CASE(WAVE);
#undef CASE

        default:
            if (format >= CF_GDIOBJFIRST && format <= CF_GDIOBJLAST)
                return L"GDI object format " + std::to_wstring(format - CF_GDIOBJFIRST);
            if (format >= CF_PRIVATEFIRST && format <= CF_PRIVATELAST)
                return L"private format " + std::to_wstring(format - CF_PRIVATEFIRST);
            const int NNAME{ 1000 };
            wchar_t name[NNAME];
            int nwc = GetClipboardFormatNameW(format, name, NNAME);
            if (nwc)
            {
                name[nwc] = 0;
                return name;
            }
            return L"";
    }
}

static void help()
{
    std::cout << R"(Usage:
clipboard help                  -- show this text
clipboard list                  -- list formats on the clipboard
clipboard dump fmt              -- output data for a format to stdout
clipboard show fmt              -- show data for a format as hex dump
clipboard drop fmt1,fmt2,...    -- drop a set of formats from the clipboard
clipboard keep fmt1,fmt2,...    -- keep only a set of formats on the clipboard
)";
}

static void list()
{
    UINT format{ 0 };

    while ((format = EnumClipboardFormats(format)))
    {
        std::cout << format;
        auto name = get_clipboard_format_name(format);
        if (name.size())
        {
            std::wcout << ": " << name;
        }
        std::cout << std::endl;
    }
}

static UINT parse_format(const std::string& s)
{
    errno = 0;
    char* end = nullptr;
    auto format = std::strtoul(s.c_str(), &end, 10);
    if (errno == ERANGE || format == 0)
    {
        while ((format = EnumClipboardFormats(format)))
        {
            auto name = get_clipboard_format_name(format);
            if (name.size() && std::wstring(s.begin(), s.end()) == name)
                return format;
        }

        return 0;
    }
    else if (format > UINT32_MAX)
    {
        return 0;
    }
    else
        return (UINT)format;
}

static std::set<UINT> parse_format_list(const std::string& s)
{
    constexpr auto delim{ ","sv };
    std::set<UINT> result;

    for (const auto word : std::views::split(s, delim))
    {
        auto sv = std::string_view(word);
        auto format = parse_format(std::string(sv));
        if (format != 0)
            result.insert(format);
    }

    return result;
}

static void dump(int argc, char** argv)
{
    UINT format = parse_format(argv[0]);

    if (format == 0 || !IsClipboardFormatAvailable(format))
        return;

    HANDLE h = GetClipboardData(format);
    if (!h)
        return;

    char* p = (char*)GlobalLock(h);
    if (!p)
        return;

    const SIZE_T size = GlobalSize(h);

    const int oldMode = _setmode(1, _O_BINARY);
    _write(1, p, (int)size);
    _setmode(1, oldMode);

    GlobalUnlock(h);
}

static void show(int argc, char** argv)
{
    UINT format = parse_format(argv[0]);

    if (format == 0 || !IsClipboardFormatAvailable(format))
        return;

    HANDLE h = GetClipboardData(format);
    if (!h)
        return;

    char* p = (char*)GlobalLock(h);
    if (!p)
        return;

    const SIZE_T size = GlobalSize(h);
    for (SIZE_T i = 0; i < size; i++)
    {
        if (i > 0 && i % 16 == 0)
            std::cout << std::endl;
        std::cout << " ";
        if (*p >= ' ' && *p < 0x7f)
            std::cout << *p << ' ';
        else
            std::cout << std::hex << std::setw(2) << std::setfill('0') << (int)*((unsigned char*)p);
        p++;
    }
    std::cout << std::endl;
    GlobalUnlock(h);
}

static bool format_has_handle(UINT format)
{
    switch (format)
    {
        case CF_BITMAP:
        case CF_ENHMETAFILE:
        case CF_HDROP:
        case CF_LOCALE:
        case CF_METAFILEPICT:
        case CF_PALETTE:
            return true;
    }
    return false;
}

static std::vector<formatAndData> get_current_clipboard_contents(const std::set<UINT>& toKeep,
                                                                 const std::set<UINT>& toDrop)
{
    UINT format{ 0 };
    std::vector<formatAndData> result;

    while ((format = EnumClipboardFormats(format)))
    {
        if (toKeep.size() && toKeep.count(format) == 0)
            continue;

        if (toDrop.size() && toDrop.count(format) == 1)
            continue;

        result.push_back({
            format,
        });
        if (format_has_handle(format))
        {
            result.back().handle = GetClipboardData(format);
        }
        else
        {
            HANDLE handle = GetClipboardData(format);
            SIZE_T size = GlobalSize(handle);
            char* data = (char*)GlobalLock(handle);
            result.back().data.assign(data, data + size);
            GlobalUnlock(handle);
        }
    }

    return result;
}

static void drop(int argc, char** argv)
{
    const auto toDrop = parse_format_list(argv[0]);

    const auto oldData = get_current_clipboard_contents({}, toDrop);

    EmptyClipboard();

    for (const auto i : oldData)
    {
        if (format_has_handle(i.format))
        {
            SetClipboardData(i.format, i.handle);
        }
        else
        {
            HANDLE handle = GlobalAlloc(GMEM_MOVEABLE, i.data.size());
            char* p = (char*)GlobalLock(handle);
            memcpy(p, i.data.data(), i.data.size());
            GlobalUnlock(handle);
            SetClipboardData(i.format, handle);
        }
    }
}

static void keep(int argc, char** argv)
{
    const auto toKeep = parse_format_list(argv[0]);

    const auto oldData = get_current_clipboard_contents(toKeep, {});

    EmptyClipboard();

    for (const auto i : oldData)
    {
        if (format_has_handle(i.format))
        {
            SetClipboardData(i.format, i.handle);
        }
        else
        {
            HANDLE handle = GlobalAlloc(GMEM_MOVEABLE, i.data.size());
            char* p = (char*)GlobalLock(handle);
            memcpy(p, i.data.data(), i.data.size());
            GlobalUnlock(handle);
            SetClipboardData(i.format, handle);
        }
    }
}

int main(int argc, char** argv)
{
    if (!OpenClipboard(NULL))
    {
        std::cerr << "Could not open clipboard" << std::endl;
        return 1;
    }

    if (argc == 1)
    {
        list();
    }
    else
    {
        const std::string verb{ argv[1] };

        if (verb == "help" || verb == "--help" || verb == "/?" || verb == "-?" || verb == "-h")
            help();
        else if (verb == "list")
            list();
        else if (verb == "dump")
            dump(argc - 2, argv + 2);
        else if (verb == "show")
            show(argc - 2, argv + 2);
        else if (verb == "drop")
            drop(argc - 2, argv + 2);
        else if (verb == "keep")
            keep(argc - 2, argv + 2);
    }

    CloseClipboard();
    return 0;
}
