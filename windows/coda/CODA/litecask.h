// Litecask - High performance, persistent embedded Key-Value storage engine.
// Single header file
//
// The MIT License (MIT)
//
// Copyright(c) 2023, Damien Feneyrou <dfeneyrou@gmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files(the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions :
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

#pragma once

// ==========================================================================================
// Quick doc
// ==========================================================================================

// A simple example inserting and retrieving a value is shown below:
/*
// example.cpp . Place the file litecask.h is in the same folder
// Build with: 'c++ --std=c++17 example.cpp -o example' (Linux) or 'cl.exe /std:c++17 /EHsc example.cpp' (Windows)

#include "litecask.h"

int main(int argc, char** argv)
{
    litecask::Datastore store;
    store.open("/tmp/my_temp_db");

    // Store an entry
    std::vector<uint8_t> value{1,2,3,4,5,6,7,8};
    store.put("my key identifier", value);

    // Retrieve the entry
    std::vector<uint8_t> retrievedValue;
    store.get("my key identifier", retrievedValue);
    assert(retrievedValue==value);

    store.close();
}
 */

// ==========================================================================================
// Version
// ==========================================================================================

#define LITECASK_VERSION_MAJOR 1
#define LITECASK_VERSION_MINOR 0
#define LITECASK_VERSION_PATCH 0
#define LITECASK_VERSION       (LITECASK_VERSION_MAJOR * 100 * 100 + LITECASK_VERSION_MINOR * 100 + LITECASK_VERSION_PATCH)

// ==========================================================================================
// Includes
// ==========================================================================================

#if defined(_MSC_VER)
// Windows
#define NOMINMAX
#include <intrin.h>
#include <windows.h>
#pragma intrinsic(_umul128)  // For Wyhash

#else

// Linux
#include <fcntl.h>     // OS open
#include <sys/mman.h>  // mmap
#include <unistd.h>    // process ID

#endif

// Standard
#include <inttypes.h>

#include <array>
#include <atomic>
#include <cassert>
#include <chrono>
#include <climits>
#include <condition_variable>
#include <cstdarg>  // va_args for logging
#include <cstring>
#include <filesystem>
#include <functional>  // for std::function
#include <mutex>
#include <thread>

// String and vector primitive can be overriden by custom implementation with same interface
#ifndef lcString
#include <string>
#define lcString std::string
#endif
#ifndef lcVector
#include <vector>
#define lcVector std::vector
#endif

// Select the standard shared_mutex or the more performant custom one (default). Follow the definition for more information.
//#define LITECASK_STANDARD_SHARED_MUTEX
#ifdef LITECASK_STANDARD_SHARED_MUTEX
#include <shared_mutex>
#endif

// Macros for likely and unlikely branching
#if defined(__GNUC__) || defined(__INTEL_COMPILER) || defined(__clang__)
#define LITECASK_LIKELY(x)   __builtin_expect(!!(x), 1)
#define LITECASK_UNLIKELY(x) __builtin_expect(!!(x), 0)
#else
#define LITECASK_LIKELY(x)   (x)
#define LITECASK_UNLIKELY(x) (x)
#endif

// Macro to check the printf-like API and detect formatting mismatch at compile time
#if defined(__GNUC__)
#define LITECASK_PRINTF_CHECK(formatStringIndex_, firstArgIndex_) \
    __attribute__((__format__(__printf__, formatStringIndex_, firstArgIndex_)))
#define LITECASK_PRINTF_FORMAT_STRING
#elif _MSC_VER
#define LITECASK_PRINTF_CHECK(formatStringIndex_, firstArgIndex_)
#define LITECASK_PRINTF_FORMAT_STRING _Printf_format_string_
#else
#define LITECASK_PRINTF_CHECK(formatStringIndex_, firstArgIndex_)
#define LITECASK_PRINTF_FORMAT_STRING
#endif

// Macro to disable thread sanitizing on a function
//   This is required on the code using optimistic locking, which is basically detecting at runtime the
//   data race and retrying until no more collision occurs.
#if defined(__clang__) || defined(__GNUC__)
#define LITECASK_ATTRIBUTE_NO_SANITIZE_THREAD __attribute__((no_sanitize_thread))
#else
#define LITECASK_ATTRIBUTE_NO_SANITIZE_THREAD
#endif

namespace litecask
{

namespace fs = std::filesystem;

// ==========================================================================================
// Definitions
// ==========================================================================================

enum class Status {
    Ok                          = 0,
    StoreNotOpen                = 1,
    StoreAlreadyOpen            = 2,
    BadDiskAccess               = 3,
    CannotOpenStore             = 4,
    StoreAlreadyInUse           = 5,
    BadKeySize                  = 6,
    InconsistentKeyIndex        = 7,
    UnorderedKeyIndex           = 8,
    BadValueSize                = 9,
    EntryNotFound               = 10,
    EntryCorrupted              = 11,
    BadParameterValue           = 12,
    InconsistentParameterValues = 13,
    OutOfMemory                 = 14,
};

struct DatastoreCounters {
    // API calls
    std::atomic<uint64_t> openCallQty           = 0;
    std::atomic<uint64_t> openCallFailedQty     = 0;
    std::atomic<uint64_t> closeCallQty          = 0;
    std::atomic<uint64_t> closeCallFailedQty    = 0;
    std::atomic<uint64_t> putCallQty            = 0;
    std::atomic<uint64_t> putCallFailedQty      = 0;
    std::atomic<uint64_t> removeCallQty         = 0;
    std::atomic<uint64_t> removeCallNotFoundQty = 0;
    std::atomic<uint64_t> removeCallFailedQty   = 0;
    std::atomic<uint64_t> getCallQty            = 0;
    std::atomic<uint64_t> getCallNotFoundQty    = 0;
    std::atomic<uint64_t> getCallCorruptedQty   = 0;
    std::atomic<uint64_t> getCallFailedQty      = 0;
    std::atomic<uint64_t> getWriteBufferHitQty  = 0;
    std::atomic<uint64_t> getCacheHitQty        = 0;
    std::atomic<uint64_t> queryCallQty          = 0;
    std::atomic<uint64_t> queryCallFailedQty    = 0;
    // Data files
    std::atomic<uint64_t> dataFileCreationQty     = 0;
    std::atomic<uint64_t> dataFileMaxQty          = 0;
    std::atomic<uint64_t> activeDataFileSwitchQty = 0;
    // Index
    std::atomic<uint64_t> indexArrayCleaningQty    = 0;
    std::atomic<uint64_t> indexArrayCleanedEntries = 0;
    // Maintenance (merge / compaction)
    std::atomic<uint64_t> mergeCycleQty          = 0;
    std::atomic<uint64_t> mergeCycleWithMergeQty = 0;
    std::atomic<uint64_t> mergeGainedDataFileQty = 0;
    std::atomic<uint64_t> mergeGainedBytes       = 0;
    std::atomic<uint64_t> hintFileCreatedQty     = 0;
};

struct ValueCacheCounters {
    std::atomic<uint64_t> insertCallQty          = 0;
    std::atomic<uint64_t> getCallQty             = 0;
    std::atomic<uint64_t> removeCallQty          = 0;
    std::atomic<uint32_t> currentInCacheValueQty = 0;
    std::atomic<uint64_t> hitQty                 = 0;
    std::atomic<uint64_t> missQty                = 0;
    std::atomic<uint64_t> evictedQty             = 0;
};

struct DataFileStats {
    uint64_t fileQty     = 0;
    uint64_t entries     = 0;
    uint64_t entryBytes  = 0;
    uint64_t tombBytes   = 0;
    uint64_t tombEntries = 0;
    uint64_t deadBytes   = 0;
    uint64_t deadEntries = 0;
};

struct Config {
    // General store parameters
    // ========================

    //   'dataFileMaxBytes' defines the maximum byte size of a data file before switching to a new one.
    //   It implicitely limits the maximum size of the database as there can be at most 65535 data files.
    //   Bigger data files make the total size bigger (up to 65535*4GB = 281 TiB)
    //   Smaller data files make the merge time shorter
    uint32_t dataFileMaxBytes = 100'000'000;
    //   'mergeCyclePeriodMs' defines the merge period for the database, in milliseconds.
    //   This merge cycle first checks if the 'merge' process is needed. If positive, the eligible data files
    //   are selected and compacted into defragmented and smaller files which eventually replace the old ones.
    uint32_t mergeCyclePeriodMs = 60'000;
    //   'upkeepCyclePeriodMs' defines the upkeep period for the internal structures, in milliseconds.
    //   It copes mainly with the cache eviction and the KeyDir resizing. This latter does not wait the end of
    //   the cycle and start working immediately
    uint32_t upkeepCyclePeriodMs = 1000;
    //   'writeBufferFlushPeriodMs' defines the maximum time for the write buffer to be flushed on disk.
    //   This limits the amount of data that can be lost in case of sudden interruption of the program, while
    //   avoiding costly disk access at each write operation.
    //   Note that the effective period is the maximum between upkeepCyclePeriodMs and writeBufferFlushPeriodMs.
    //   Note also that the "put" API offers to force-flush directly on disk (with a performance cost).
    uint32_t writeBufferFlushPeriodMs = 5000;
    //   'upkeepKeyDirBatchSize' defines the quantity of KeyDir entries to update in a row.
    //   This includes both KeyDir resizing and data file compaction mechanisms.
    //   A higher quantity of entries will make the transition finish earlier, at the price of higher spikes of
    //   latency on entry write or update. A too low value could paradoxically induce a forced resizing of the
    //   remaining part of the KeyDir if the next resize arrives before the end of the previous one.
    uint32_t upkeepKeyDirBatchSize = 100'000;
    //   'upkeepValueCacheBatchSize' defines the quantity of cached value entries to update in a row in the LRU.
    //   A higher quantity of entries will make the background task finish earlier, at the price of higher spikes of
    //   latency on entry write or update. A too low value could paradoxically induce a forced task to clean and
    //   evict cached values at inserting time.
    uint32_t upkeepValueCacheBatchSize = 10000;
    //   'valueCacheTargetMemoryLoadPercentage' configures the target load for the cache, so that the remaining free space
    //   ensures a performant insertion in the cache. The eviction required to meet this target load is deferred in a
    //   background task. Too low a value wastes cache memory. Too high a value prevent the insertion a new entry because
    //   of lack of free space.
    uint32_t valueCacheTargetMemoryLoadPercentage = 90;

    // Merge Triggers
    // ==============
    // They determine the conditions under which merging will be invoked. They fall into two basic categories:

    //   'mergeTriggerDataFileFragmentationPercentage' describes the percentage of dead keys to total keys in a file
    //   that triggers merging.
    //   Increasing this value will cause merging to occur less often.
    uint32_t mergeTriggerDataFileFragmentationPercentage = 50;
    //   'mergeTriggerDataFileDeadByteThreshold' describes how much data stored for dead keys in a single file will trigger merging.
    //   Increasing the value causes merging to occur less often, whereas decreasing the value causes merging to happen more often.
    uint32_t mergeTriggerDataFileDeadByteThreshold = 50'000'000;

    // Merge data file selection
    // =========================
    // These parameters determine which files will be selected for inclusion in a merge operation.

    //   'mergeSelectDataFileFragmentationPercentage' describes which percentage of dead keys to total  keys in a file causes
    //   it to be included in the merge.
    //   Note: this value shall be equal or less than the corresponding trigger threshold.
    uint32_t mergeSelectDataFileFragmentationPercentage = 30;
    //   'mergeSelectDataFileDeadByteThreshold' describes which ratio the minimum amount of data occupied by dead keys
    //   in a file to cause it to be included in the merge.
    //   Note: this value shall be equal or less than the corresponding trigger threshold.
    uint32_t mergeSelectDataFileDeadByteThreshold = 10'000'000;
    //   'mergeSelectDataFileSmallSizeTheshold' describes the minimum size below which a file is included in the merge.
    //   The purpose is to reduce the quantity of small data files to keep open file quantity low.
    uint32_t mergeSelectDataFileSmallSizeTheshold = 10'000'000;
};

enum class LogLevel { Debug = 0, Info = 1, Warn = 2, Error = 3, Fatal = 4, None = 5 };

// Defines the part of the key [start index; size[ that is used as an index/tag
// Example: Consider the key "UJohn Doe/CUS/TTax document/0001" with indexes [ (0, 9), (10, 3), (14, 13) ]
//          This allows querying for any User "UJohn Doe", or Country "CUS", or Type "TTax document" entries.
//          In this pure text key example (binary would be more efficient but a less good as example), the first byte
//          ('U', 'C' or 'T') prevents mixing "columns", and the separating "/" is purely for human readability.
struct KeyIndex {
    uint8_t startIdx;
    uint8_t size;
};

// This structure defines a 'query result' by providing a memory span, when using an arena allocator query API.
struct QueryResult {
    uint8_t* ptr;
    uint16_t size;
};

// ==========================================================================================
// Arena allocator
// ==========================================================================================

// Thread safety shall be enforced externally
class ArenaAllocator
{
   public:
    // 'minAllocChunkBytes' is the performed allocation size if the requested amount is smaller than this value.
    // For efficiency reasons, it should to be several orders of magnitude larger than the typical allocation size
    ArenaAllocator(size_t minAllocChunkBytes = 1024 * 1024) : _minAllocChunkBytes(minAllocChunkBytes) {}

    ~ArenaAllocator()
    {
        for (auto& m : _memChunks) { delete[] m.basePtr; }
    }

    uint8_t* allocate(size_t bytes)
    {
        // Ensure 8-bytes alignment
        bytes = (bytes + 7) & (~((size_t)0x7));

        // Ensure enough space
        while (_currentIdx < _memChunks.size() && !_memChunks[_currentIdx].isEnoughSpace(bytes)) { ++_currentIdx; }
        if (_currentIdx >= _memChunks.size()) {
            size_t allocatedSize = std::max(_minAllocChunkBytes, bytes);
            _memChunks.push_back({new uint8_t[allocatedSize], 0, allocatedSize});
        }

        MemChunk& m   = _memChunks[_currentIdx];
        uint8_t*  ptr = m.basePtr + m.usedSize;
        m.usedSize += bytes;
        _allocatedBytes += bytes;

        return ptr;
    }

    size_t getAllocatedBytes() const { return _allocatedBytes; }

    void reset()
    {
        if (!_memChunks.empty()) {
            for (size_t i = 0; i <= _currentIdx; ++i) { _memChunks[i].usedSize = 0; }
        }
        _allocatedBytes = 0;
        _currentIdx     = 0;
    }

   private:
    struct MemChunk {
        uint8_t* basePtr       = nullptr;
        size_t   usedSize      = 0;
        size_t   allocatedSize = 0;
        bool     isEnoughSpace(size_t bytes) const { return usedSize + bytes < allocatedSize; }
    };
    size_t             _allocatedBytes = 0;
    size_t             _currentIdx     = 0;
    lcVector<MemChunk> _memChunks;
    const size_t       _minAllocChunkBytes = 0;
};

namespace  // Local functions namespace
{

// ==========================================================================================
// Internal file helper functions
// ==========================================================================================

// OS common

enum class OsOpenMode { READ, APPEND };

struct DirEntry {
    lcString name;
    bool     isDir;
};

inline bool
osGetDirContent(const fs::path& path, lcVector<DirEntry>& entries)
{
    entries.clear();
    std::error_code ec;
    for (auto const& dirEntryIt : fs::directory_iterator(path, ec)) {
        if (dirEntryIt.is_regular_file() || dirEntryIt.is_directory()) {
            entries.push_back(DirEntry{(--(dirEntryIt.path()).end())->string(), dirEntryIt.is_directory()});
        }
    }
    return (!ec);
}

inline int64_t
osGetFileSize(const fs::path& path)
{
    std::error_code ec;
    int64_t         fileSize = (int64_t)fs::file_size(path, ec);
    return ec ? (int64_t)-1 : fileSize;
}

inline bool
osRenameFile(const fs::path& from, const fs::path& to)
{
    std::error_code ec;
    fs::rename(from, to, ec);
    return (!ec);
}

inline bool
osRemoveFile(const fs::path& path)
{
    std::error_code ec;
    return fs::remove(path, ec);
}

#if defined(_MSC_VER)
// Windows
using lcOsFileHandle                   = HANDLE;
const lcOsFileHandle InvalidFileHandle = INVALID_HANDLE_VALUE;

// UTF-8 -> UTF-16 conversion for interacting with Windows API
std::wstring
utf8ToUtf16(const lcString& s)
{
    constexpr uint32_t offsetPerTrailingByte[3] = {0x0, 0x3080, 0xE2080};
    std::wstring       outUtf16;
    outUtf16.reserve(s.size());
    const char* cursor   = &s[0];
    const char* endInput = cursor + s.size();
    int         trailingBytes;

    while (cursor < endInput) {
        if (((*cursor) & 0x80) == 0x00)
            trailingBytes = 0;
        else if (((*cursor) & 0xE0) == 0xC0)
            trailingBytes = 1;
        else if (((*cursor) & 0xF0) == 0xE0)
            trailingBytes = 2;
        else {
            break;
        }                                                   // Failure, only 16 bits is supported, not 32 bits codepoints
        if (cursor + trailingBytes >= endInput) { break; }  // Failure due to corrupted input

        uint32_t output = 0;
        switch (trailingBytes) {
            case 2:
                output += *cursor++;
                output <<= 6;  // fall through
            case 1:
                output += *cursor++;
                output <<= 6;  // fall through
            case 0:
                output += *cursor++;
        }
        outUtf16.push_back((char16_t)(output - offsetPerTrailingByte[trailingBytes]));
    }

    return outUtf16;
}

// UTF-16 -> UTF-8 conversion for interacting with Windows API
lcString
utf16ToUtf8(const std::wstring& s)
{
    constexpr uint8_t firstBytes[4] = {0x00, 0x00, 0xC0, 0xE0};
    lcString          outUtf8;
    outUtf8.reserve(s.size());

    for (wchar_t codepoint : s) {
        if ((codepoint >= 0xD800 && codepoint <= 0xDBFF)) break;  // Failure, corrupted input
        int outSize = (codepoint < 0x80) ? 1 : ((codepoint < 0x800) ? 2 : 3);

        size_t curSize = outUtf8.size();
        outUtf8.resize(curSize + outSize);
        switch (outSize) {
            case 3:
                outUtf8[curSize + 2] = (uint8_t)((codepoint | 0x80) & 0xBF);
                codepoint >>= 6;  // fall through
            case 2:
                outUtf8[curSize + 1] = (uint8_t)((codepoint | 0x80) & 0xBF);
                codepoint >>= 6;  // fall through
            case 1:
                outUtf8[curSize + 0] = (uint8_t)(codepoint | firstBytes[outSize]);
        }
    }
    return outUtf8;
}

// For "standard" file usage, with userland cache
inline FILE*
osFopen(const fs::path& path, const lcString& mode)
{
    return _wfopen(utf8ToUtf16(path.string()).c_str(), utf8ToUtf16(mode).c_str());
}

// For the data files live access which requires specific characteristics:  no cache, random read location, always end of file write
inline lcOsFileHandle
osOsOpen(const fs::path& path, OsOpenMode mode)
{
    if (mode == OsOpenMode::READ) {
        return CreateFileW((LPCWSTR)utf8ToUtf16(path.string()).c_str(), GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING,
                           FILE_ATTRIBUTE_NORMAL | FILE_FLAG_RANDOM_ACCESS, NULL);
    } else if (mode == OsOpenMode::APPEND) {
        return CreateFileW((LPCWSTR)utf8ToUtf16(path.string()).c_str(), FILE_APPEND_DATA | GENERIC_READ, FILE_SHARE_READ, NULL,
                           CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_RANDOM_ACCESS, NULL);
    }
    return InvalidFileHandle;
}

inline bool
osOsRead(lcOsFileHandle handle, void* buffer, size_t bufferSize, uint32_t fileOffset)
{
    DWORD      readBytes;
    OVERLAPPED overlap = {0};
    overlap.Offset     = fileOffset;  // Using "overlap" to have a local read offset. Call should be synchronous.
    bool status        = ReadFile(handle, buffer, (DWORD)bufferSize, &readBytes, &overlap);
    if (!status && GetLastError() == ERROR_IO_PENDING) { status = GetOverlappedResult(handle, &overlap, &readBytes, TRUE); }
    return status;
}

inline bool
osOsWrite(lcOsFileHandle handle, const void* buffer, size_t bufferSize)
{
    DWORD      writtenBytes;
    OVERLAPPED overlap = {0};
    overlap.Offset     = 0xFFFFFFFF;  // Using "overlap" to have a local write offset at the end. Call should be synchronous.
    overlap.OffsetHigh = 0xFFFFFFFF;
    bool status        = WriteFile(handle, buffer, (DWORD)bufferSize, &writtenBytes, &overlap);
    if (!status && GetLastError() == ERROR_IO_PENDING) { status = GetOverlappedResult(handle, &overlap, &writtenBytes, TRUE); }
    return status;
}

inline void
osOsClose(lcOsFileHandle handle)
{
    CloseHandle(handle);
}

inline bool
osIsValidHandle(lcOsFileHandle handle)
{
    return (handle != InvalidFileHandle);
}

#else
// Linux
using lcOsFileHandle                       = int;
constexpr lcOsFileHandle InvalidFileHandle = -1;

// For "standard" file usage, with userland cache
inline FILE*
osFopen(const fs::path& path, const lcString& mode)
{
    return fopen(path.c_str(), mode.c_str());
}

// For the data files live access which requires specific characteristics:  no cache, random read location, always end of file write
inline lcOsFileHandle
osOsOpen(const lcString& path, OsOpenMode mode)
{
    if (mode == OsOpenMode::READ) {
        return ::open(path.c_str(), O_RDONLY);
    } else if (mode == OsOpenMode::APPEND) {
        return ::open(path.c_str(), O_RDWR | O_APPEND | O_TRUNC | O_CREAT, S_IRUSR | S_IWUSR);
    }
    return InvalidFileHandle;
}

inline bool
osOsRead(lcOsFileHandle handle, void* buffer, size_t bufferSize, uint32_t fileOffset)
{
    return (pread(handle, buffer, bufferSize, fileOffset) == (ssize_t)bufferSize);
}

inline bool
osOsWrite(lcOsFileHandle handle, const void* buffer, size_t bufferSize)
{
    return (write(handle, buffer, bufferSize) == (ssize_t)bufferSize);
}

inline void
osOsClose(lcOsFileHandle handle)
{
    ::close(handle);
}

inline bool
osIsValidHandle(lcOsFileHandle handle)
{
    return (handle > InvalidFileHandle);
}

#endif

// ==========================================================================================
// Lock file (to ensure that at most 1 process accesses the same database)
// ==========================================================================================

inline Status
lockDatabase(const fs::path& dbDirectory)
{
    fs::path lockFilename = dbDirectory / "litecask.lockfile";

    int64_t ourPid = getpid();
    char    pidString[32];

    constexpr int MaxTryQty       = 3;
    int           remainingTryQty = MaxTryQty;
    while (remainingTryQty > 0) {
        if (remainingTryQty != MaxTryQty) { std::this_thread::sleep_for(std::chrono::milliseconds(100)); }
        remainingTryQty--;

        // Check the current lock file, if exists
        if (fs::exists(lockFilename)) {
            // Read the content
            FILE* fh = osFopen(lockFilename, "rb");
            if (!fh) { continue; }
            size_t length = fread(pidString, 1, sizeof(pidString) - 1, fh);
            fclose(fh);
            if (length <= 0 || length >= sizeof(pidString)) { continue; }  // Lock content may not be written yet
            pidString[length] = 0;
            int64_t readPid   = strtoll(pidString, nullptr, 10);
            if (readPid == 0) { continue; }  // Weird case, the written content seems not a hex number, as it should...

            // Check against the current processes in the system
#if defined(_MSC_VER)
            // Windows: The 'OpenProcess' API allows to check if the process with ID 'readPid' is still alive.
            // Note: it shall not exit with code "STILL_ACTIVE" (239) for this to work
            bool   isProcessStillRunning = true;
            HANDLE hPrevProc             = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, (DWORD)readPid);
            if (hPrevProc == NULL) {
                isProcessStillRunning = false;
            } else {
                DWORD cr;
                if (GetExitCodeProcess(hPrevProc, &cr) == 0 || cr != STILL_ACTIVE) { isProcessStillRunning = false; }
                CloseHandle(hPrevProc);
            }
            if (isProcessStillRunning) { return Status::StoreAlreadyInUse; }  // Database is locked by an existing process
#else
            // Linux: Check in the virtual filesystem of the kernel if a process with ID 'ReadPid' is listed
            lcVector<DirEntry> entries;
            if (!osGetDirContent("/proc/", entries)) { return Status::BadDiskAccess; }
            for (const auto& e : entries) {
                if (!e.isDir) continue;  // We search only directory with the PID as name
                if (!strcmp(e.name.c_str(), pidString)) { return Status::StoreAlreadyInUse; }  // Database is locked by an existing process
            }
#endif

            // Not a valid lock: we remove it
            if (!osRemoveFile(lockFilename)) { return Status::BadDiskAccess; }
        }

        FILE* fh = osFopen(lockFilename, "wbx");  // 'x' ensures that the file is created by this call
        if (!fh) { continue; }
        snprintf(pidString, sizeof(pidString), "%" PRId64, ourPid);
        if (fwrite(pidString, 1, strlen(pidString), fh) != (size_t)strlen(pidString)) {
            fclose(fh);
            return Status::BadDiskAccess;
        }
        fclose(fh);
        return Status::Ok;

    }  // End of retries

    return Status::BadDiskAccess;
}

inline Status
unlockDatabase(const fs::path& dbDirectory)
{
    fs::path lockFilename = dbDirectory / "litecask.lockfile";
    if (!fs::exists(lockFilename)) { return Status::Ok; }  // Weird, but it is supposed that the lock is no more valid

    // Sanity: check that it is indeed our lock (the content shall be our PID)
    // Read the content
    int64_t ourPid = getpid();
    char    pidString[32];

    FILE* fh = osFopen(lockFilename, "rb");
    if (!fh) { return Status::Ok; }  // Weird case. Anyway, it is then assumed that the lock is no more valid
    size_t length = fread(pidString, 1, sizeof(pidString) - 1, fh);
    fclose(fh);

    if (length <= 0 || length >= sizeof(pidString)) {
        return Status::Ok;
    }  // Weird case. Anyway, it is then assumed that the lock is no more valid
    pidString[length] = 0;
    int64_t readPid   = strtoll(pidString, nullptr, 10);
    if (readPid != ourPid) { return Status::Ok; }  // Weird case. Anyway, it is then assumed that the lock is no more valid

    // Our lock: we remove it
    if (!osRemoveFile(lockFilename)) { return Status::BadDiskAccess; }
    return Status::Ok;
}

}  // namespace

// ==========================================================================================
// Internal
// ==========================================================================================

namespace detail
{

// Storage location, as a compressed pointer (32 bits)
typedef uint32_t KeyLoc;
typedef uint32_t ValueLoc;

// Constants
constexpr const char DataFileSuffix[]     = ".litecask_data";
constexpr const char HintFileSuffix[]     = ".litecask_hint";
constexpr const char TmpFileSuffix[]      = ".tmp";
constexpr const char LogFileSuffix[]      = ".log";
constexpr const char ToRemoveFileSuffix[] = ".litecask_to_remove";
constexpr uint32_t   DiskWorkBufferSize   = 10'000'000;
constexpr uint32_t   MinDataFileMaxBytes  = 1024;
constexpr uint64_t   CpuCacheLine         = 2 * 64;  // Destructive interferences is 2 cache lines
constexpr uint32_t   DeletedEntry         = 0xFFFFFFFF;
constexpr ValueLoc   NotStored            = 0xFFFFFFFF;  // Sentinel for "not stored"
constexpr size_t     MaxValueSize         = 0xFFFF0000;

// KeyDir table associativity. 1 is classical (1-associative), 8 is max for the cache line (8-associative so 8*8=64 bytes)
// Power of two is expected to keep the cache line alignment, so valid values are 1, 2, 4 and 8
constexpr uint32_t KeyDirAssocQty = 8;

// Arbitrary constant value. On a range of first 256 bytes of a key, 64 indexes should be enough for everyone
constexpr uint32_t MaxKeyIndexQty = 64;

// Default write buffer byte size
// In practice, its value does not matter much as long as it can amortize the calls to kernel in a reasonable factor
constexpr uint32_t DefaultWriteBufferBytes = 100'000;

// Big allocation of virtual memory. Physical memory will be 'committed' by the OS depending on the real need.
// Such automatically extended memory chunk provides a common base address and enables 32-bit pointer compression on 64-bit arch.
// A 32-bit compressed pointer is simply the delta between the memory pointer and the common base pointer, shifted by 3 bits as
// a 8 bytes alignement is enforced. As such, the total addressable memory range is 35 bits = 32 GB.
constexpr uint64_t KeyStorageAllocBytes = (uint64_t)16384 * 1024 * 1024;  // Yes, huge allocation but mostly virtual memory

constexpr uint32_t ValueFlagQueueTypeMask = 0x3;   // 2 bits for queue types
constexpr uint32_t ValueFlagActive        = 0x4;   // Bit set when the cache value is accessed. Used by deferred bumping LRU mechanism
constexpr uint32_t ValueMutexQty          = 1024;  // "Bucketized" cache lock

// On-file hint entry: 16 bytes + index size + key size
// Structure of an entry in a hint file
struct HintFileEntry {
    uint32_t fileOffset;
    uint32_t expTimeSec;
    uint32_t valueSize;
    uint16_t keySize;
    uint8_t  keyIndexSize;  // In bytes
    uint8_t  reserved;
    // uint8_t data[0]   The key then the indexes are stored here
};

// On-file entry: 16 bytes + index size + key size + value size
// Structure of an entry in a data file
struct DataFileEntry {
    uint32_t checksum;  // LITECASK_HASH_FUNC low 32 bits
    uint32_t expTimeSec;
    uint32_t valueSize;
    uint16_t keySize;
    uint8_t  keyIndexSize;  // In bytes
    uint8_t  reserved;
    // uint8_t data[0]   The key, the indexes, then the value are stored here
};

// In-memory KeyDir entry: it is composed of 2 parts
// 1) First part is inside the hashtable and points on the key location and its metadata (8 bytes)
struct MapEntry {
    uint32_t hash;
    KeyLoc   loc;
};

// 2) Second part is the metadata pointed by the first part, of 22 bytes + key size
struct KeyChunk {
    uint32_t expTimeSec;
    uint32_t valueSize;  // max key+value size is 4GB
    ValueLoc cacheLocation;
    uint32_t fileOffset;  // max data file size is 4 GB
    uint16_t fileId;
    uint16_t keySize;
    uint8_t  keyIndexSize;
    uint8_t  changeCounter;  // incremented at each update, to prevents ABA problems
    // uint8_t  data[0]   The key then the indexes are stored here
};

// Value cache metadata
struct ValueChunk {
    uint64_t ownerId;  // Typically the 64 bit hash of the key
    uint32_t expTimeSec;
    uint32_t size;
    uint16_t flags;
    uint16_t unused;
    ValueLoc prev;
    ValueLoc next;
};

// This structure is used when loading hint or data file
struct LoadedKeyChunk {
    KeyChunk metadata;
    uint32_t keyHash;
    uint8_t* key;
    uint8_t* keyIndexes;
};

// In-memory KeyDirPatch entry: 16 bytes
// Update to apply to a KeyDir entry when merging
struct KeyDirPatch {
    uint32_t keyHash;        // Identifier. Unique if combined with the old fileId and fileOffset
    uint32_t oldFileOffset;  // Patch shall not be applied if this value differs
    uint32_t fileOffset;     // max data file size is 4 GB
    uint16_t oldFileId;      // Patch shall not be applied if this value differs
    uint16_t newFileId;
};

struct MergeFileInfo {
    uint16_t              fileId;
    lcVector<KeyDirPatch> patches;
};

// In-memory DataFile: information and statistics for a data file
struct DataFile {
    lcString              filename;
    lcOsFileHandle        handle      = InvalidFileHandle;
    std::atomic<uint32_t> bytes       = 0;
    std::atomic<uint32_t> entries     = 0;
    std::atomic<uint32_t> tombBytes   = 0;
    std::atomic<uint32_t> tombEntries = 0;
    std::atomic<uint32_t> deadBytes   = 0;
    std::atomic<uint32_t> deadEntries = 0;

    void dump(int index, bool isActive = false) const
    {
        if (index < 0) {
            if (!osIsValidHandle(handle)) return;
            printf("  %s%s:\n", filename.c_str(), isActive ? " (ACTIVE)" : "");
        } else {
            printf("  %3d) %s%s:\n", index, filename.c_str(), isActive ? " (ACTIVE)" : "");
        }
        if (!osIsValidHandle(handle)) {
            printf("    Not in use\n");
        } else {
            printf("    Bytes       : %8u\n", bytes.load());
            printf("    Entries     : %8u\n", entries.load());
            printf("    Tomb bytes  : %8u\n", tombBytes.load());
            printf("    Tomb entries: %8u\n", tombEntries.load());
            printf("    Dead bytes  : %8u\n", deadBytes.load());
            printf("    Dead entries: %8u\n", deadEntries.load());
        }
    }
};

// ==========================================================================================
// Wyhash https://github.com/wangyi-fudan/wyhash/tree/master (18a25157b modified)
// This is free and unencumbered software released into the public domain under The Unlicense
// (http://unlicense.org/)
// ==========================================================================================

static inline void
_wymum(uint64_t* A, uint64_t* B)
{
#if defined(_MSC_VER)
    *A = _umul128(*A, *B, B);
#else
    __uint128_t r = *A;
    r *= *B;
    *A = (uint64_t)r;
    *B = (uint64_t)(r >> 64);
#endif
}

static inline uint64_t
_wymix(uint64_t A, uint64_t B)
{
    _wymum(&A, &B);
    return A ^ B;
}
static inline uint64_t
_wyr8(const uint8_t* p)
{
    uint64_t v;  // NOLINT(cppcoreguidelines-init-variables)
    memcpy(&v, p, 8);
    return v;
}
static inline uint64_t
_wyr4(const uint8_t* p)
{
    uint32_t v;  // NOLINT(cppcoreguidelines-init-variables)
    memcpy(&v, p, 4);
    return v;
}
static inline uint64_t
_wyr3(const uint8_t* p, size_t k)
{
    return (((uint64_t)p[0]) << 16) | (((uint64_t)p[k >> 1]) << 8) | p[k - 1];
}

static inline uint64_t
wyhash(const void* key, size_t len)
{
    constexpr uint64_t secret0 = 0x2d358dccaa6c78a5ull;
    constexpr uint64_t secret1 = 0x8bb84b93962eacc9ull;
    constexpr uint64_t secret2 = 0x4b33a62ed433d4a3ull;
    constexpr uint64_t secret3 = 0x4d5a2da51de1aa47ull;
    const uint8_t*     p       = (const uint8_t*)key;
    uint64_t           seed    = 0xca813bf4c7abf0a9ull;  // seed ^= _wymix(seed ^ secret0, secret1);  with fixed seed = 0
    uint64_t           a = 0, b = 0;

    if (LITECASK_LIKELY(len <= 16)) {
        if (LITECASK_LIKELY(len >= 4)) {
            a = (_wyr4(p) << 32) | _wyr4(p + ((len >> 3) << 2));
            b = (_wyr4(p + len - 4) << 32) | _wyr4(p + len - 4 - ((len >> 3) << 2));
        } else if (LITECASK_LIKELY(len > 0)) {
            a = _wyr3(p, len);
            b = 0;
        } else {
            a = b = 0;
        }
    } else {
        size_t i = len;
        if (LITECASK_UNLIKELY(i >= 48)) {
            uint64_t see1 = seed, see2 = seed;
            do {
                seed = _wymix(_wyr8(p) ^ secret1, _wyr8(p + 8) ^ seed);
                see1 = _wymix(_wyr8(p + 16) ^ secret2, _wyr8(p + 24) ^ see1);
                see2 = _wymix(_wyr8(p + 32) ^ secret3, _wyr8(p + 40) ^ see2);
                p += 48;
                i -= 48;
            } while (LITECASK_LIKELY(i >= 48));
            seed ^= see1 ^ see2;
        }
        while (LITECASK_UNLIKELY(i > 16)) {
            seed = _wymix(_wyr8(p) ^ secret1, _wyr8(p + 8) ^ seed);
            i -= 16;
            p += 16;
        }
        a = _wyr8(p + i - 16);
        b = _wyr8(p + i - 8);
    }
    a ^= secret1;
    b ^= seed;
    _wymum(&a, &b);
    return _wymix(a ^ secret0 ^ len, b ^ secret1);
}

#define LITECASK_HASH_FUNC(key, keySize) wyhash(key, keySize)

// ==========================================================================================
// Readers-writer lock
// ==========================================================================================

#ifdef LITECASK_STANDARD_SHARED_MUTEX

// The standard shared mutex is a risk-less implementation but its performance does not scale well with increasing thread quantity (on Linux
// at least) probably due to its generic implementation not focussed enough on false sharing across cores and avoiding going to kernel.
// Measurements show that 100% reading scales poorly and that ~5% write collapses the overall performance.
// This RWLock is an encapsulation of the standard library and its presence just serves validation and comparison purposes.
class RWLock
{
   public:
    RWLock() {}
    ~RWLock() {}

    void lockRead() { _mx.lock_shared(); }
    void unlockRead() { _mx.unlock_shared(); }
    void lockWrite() { _mx.lock(); }
    void unlockWrite() { _mx.unlock(); }

   private:
    std::shared_mutex _mx;
};
#else

// This custom implementation of shared mutex avoids costly false sharing by having a dedicated cache line per thread to mark its lock
// request ( more memory is used compared to the standard shared mutex). The cost of the per-reader check is moved on the exclusive lock
// side, which is fully in agreement with our system where writing operations are serialized and more expensive. Also, lock requests spin
// before going to the kernel, improving the reactivity in most cases.
class RWLock
{
    // Soft limit on the thread quantity before switching to exclusive lock as a fallback
    static constexpr uint64_t MaxThreads = 32;

   public:
    RWLock() : excLockReq(false), stateArraySptr(std::make_shared<StateArray>()), stateArray(*stateArraySptr)
    {
        static std::atomic<uint32_t> uniqueIdGenerator = 1;  // Global for all RWLock objects
        uniqueLockId                                   = uniqueIdGenerator++;
        (void)reserved;  // For nitty compilers
    }

    ~RWLock()
    {
        for (auto& lock : stateArray) { lock.state = Invalid; }
    }

    void lockWrite()
    {
        // Mostly Spin until the writer flag is acquired
        uint64_t counter  = 0;
        bool     oldValue = false;
        while (!excLockReq.compare_exchange_weak(oldValue, true, std::memory_order_seq_cst)) {
            oldValue = false;
            if (((++counter) & 0x0FFFFF) == 0) { std::this_thread::yield(); }  // Back to OS scheduler if too long spinning
        }

        // Wait for readers to stop using the shared lock
        for (auto& i : stateArray) {
            while (i.state.load(std::memory_order_seq_cst) >= Busy) {}
        }
    }

    void unlockWrite()
    {
        excLockReq.store(false, std::memory_order_release);  // Simply release the writer flag
    }

    void lockRead()
    {
        // Get the index of this thread in this lock
        int threadIndex = accessIndex();

        // Check if the thread has no index yet and there are some potential free index
        if (threadIndex < 0 && stateArraySptr.use_count() <= (int)stateArray.size()) {
            for (int idx = 0; idx < (int)stateArray.size(); ++idx) {
                int oldValue = Uninit;
                if (stateArray[idx].state == Uninit && stateArray[idx].state.compare_exchange_strong(oldValue, Free)) {
                    accessIndex(idx);
                    threadIndex = idx;
                    break;
                }
            }
        }

        if (threadIndex >= 0) {
            // Notify the reader's access
            stateArray[threadIndex].state.store(Busy, std::memory_order_seq_cst);

            // If a writer has the exclusive lock, then rollback and wait that it finishes
            while (excLockReq.load(std::memory_order_seq_cst)) {
                // Rollback the reader's access
                stateArray[threadIndex].state.store(Free, std::memory_order_seq_cst);
                // Wait that the writer releases the lock
                uint64_t counter = 0;
                while (excLockReq.load(std::memory_order_seq_cst)) {
                    if (((++counter) & 0x0FFFFF) == 0) { std::this_thread::yield(); }  // Back to OS scheduler if too long spinning
                }
                // Notify again the reader's access. If no writer has the lock, it will prevent them to take it.
                stateArray[threadIndex].state.store(Busy, std::memory_order_seq_cst);
            }
        } else {
            // Case more threads than array size: fallback to exclusive lock but without waiting for other readers
            uint64_t counter  = 0;
            bool     oldValue = false;
            while (!excLockReq.compare_exchange_weak(oldValue, true, std::memory_order_seq_cst)) {
                oldValue = false;
                if (((++counter) & 0x0FFFFF) == 0) { std::this_thread::yield(); }  // Back to OS scheduler if too long spinning
            }
        }
    }

    void unlockRead()
    {
        int threadIndex = accessIndex();
        if (threadIndex >= 0) {
            stateArray[threadIndex].state.store(Free, std::memory_order_release);
        } else {
            excLockReq.store(false, std::memory_order_release);  // Case more thread than array size: fallback to exclusive lock
        }
    }

   private:
    // Constants
    static constexpr int Invalid = -1;
    static constexpr int Uninit  = 0;
    static constexpr int Free    = 1;
    static constexpr int Busy    = 2;

    // Definitions
    struct State {
        alignas(CpuCacheLine) std::atomic<int> state{Uninit};
    };
    using StateArray     = std::array<State, MaxThreads>;
    using StateArraySptr = std::shared_ptr<StateArray>;

    // Thread local structure bridging between the current thread and all lock instances
    struct LockContext {
        LockContext(int index, const StateArraySptr& ptr) : threadIndex(index), stateArraySptr(ptr) {}
        LockContext(LockContext&& src) noexcept : threadIndex(src.threadIndex), stateArraySptr(std::move(src.stateArraySptr)) {}
        LockContext& operator=(LockContext&& src) noexcept
        {
            if (this == &src) return *this;
            threadIndex    = src.threadIndex;
            stateArraySptr = std::move(src.stateArraySptr);
            return *this;
        }
        ~LockContext()
        {
            if (stateArraySptr.use_count() > 0) { (*stateArraySptr)[threadIndex].state--; }
        }

        int            threadIndex;
        StateArraySptr stateArraySptr;
    };

    int accessIndex(int registrationIndex = -1)
    {
        // These per-thread lookups are shared by all RWlock instances
        thread_local static std::vector<LockContext> perLockContext;
        thread_local static std::vector<uint32_t>    perLockId;  // Cache-friendly to find the associated context

        // Getter case: return the value from the lookup
        if (LITECASK_LIKELY(registrationIndex < 0)) {
            for (size_t i = 0; i < perLockId.size(); ++i) {
                if (perLockId[i] == uniqueLockId) { return perLockContext[i].threadIndex; }
            }
            return -1;
        }

        // Setter case: create a new context in this thread local lookup
        perLockContext.emplace_back(registrationIndex, stateArraySptr);
        perLockId.push_back(uniqueLockId);

        // Take the opportunity to clean all deleted lock in this thread (accessible only from this thread...)
        for (size_t i = 0; i < perLockId.size();) {
            if (perLockContext[i].stateArraySptr->at(perLockContext[i].threadIndex).state < Uninit) {
                perLockContext[i] = std::move(perLockContext.back());
                perLockContext.pop_back();
                perLockId[i] = perLockId.back();
                perLockId.pop_back();
            } else {
                ++i;
            }
        }
        return registrationIndex;
    }

    // Fields
    std::atomic<bool>    excLockReq;
    const StateArraySptr stateArraySptr;          // Shared with thread local contexts
    uint8_t              reserved[CpuCacheLine];  // Prevent false sharing between threads
    StateArray&          stateArray;              // Intra-object local access, protected by the internal shared ptr
    uint32_t             uniqueLockId;
};

#endif

// ==========================================================================================
// TLSF allocator
// ==========================================================================================

// This allocator possesses interesting properties for our usage: fast, code is small, response time is bounded, internal fragmentation
// is bounded and external fragmentation is low in practice (good coalescing).
// See http://www.gii.upv.es/tlsf/ for details. The code is inspired from https://github.com/jserv/tlsf-bsd .
// It is not optimized for threading (as tcmalloc or jemalloc) and less efficient than ptmalloc (derived from dlmalloc described here
// https://gee.cs.oswego.edu/dl/html/malloc.html. As TLSF, it is a "heap" allocator) which has specific handling of small and big sizes.
// This implementation does not rely on "userland managed pages" but on virtual memory, which simplifies the code.
// Such single-heap allocator enables the use of "compressed pointers" (32 bits instead of 64 bits), hence reducing overhead.

constexpr uint32_t TlsfAlignShift = 3;  // 3 LSB cleared = 8 bytes alignment
constexpr uint32_t TlsfSlShift    = 4;  // 4 bits for the second layer, so 16 sub lists
constexpr uint32_t TlsfFlShift    = TlsfSlShift + TlsfAlignShift;
constexpr uint64_t TlsfSmallSize  = (1 << TlsfFlShift);  // Sizes less than 128 bytes go into the first layer
constexpr uint32_t TlsfSlQty      = (1 << TlsfSlShift);
constexpr uint32_t TlsfFlQty      = 32;  // Allows a theoritical max allocation of 1 << (32 + 3(align) + 4(sl) - (margin) 2)

constexpr uint64_t TlsfBlockOverhead = sizeof(uint64_t);  // Size of 'dataSizeAndFlags' placed just before payloads
constexpr uint64_t TlsfFlagFree      = 0x1;
constexpr uint64_t TlsfFlagPrevFree  = 0x2;

struct tlsfBlock {
    // The structure of a free block is:
    //   [offset -  8]  pointer to previous block in memory. Valid only if the previous block is free
    //   [offset +  0]  [bit 31 <- bit 2] block size    [bit 1] flag prev block is free   [bit 0] flag block is free
    //   [offset +  8]  Next free block in free list
    //   [offset + 16]  Previous free block in free list
    //
    // The structure of a used block is:
    //   [offset -  8]  pointer to previous block in memory. Valid only if the previous block is free
    //   [offset +  0]  [bit 31 <- bit 2] block size    [bit 1] flag prev block is free   [bit 0] flag block is free
    //   [offset +  8]  payload (seen by user)

    tlsfBlock* prevBlockIfFree;   // Valid only if previous block is free. That is why we need the 'PrevBlockIsFree' flag
    uint64_t   dataSizeAndFlags;  // Real block info = overhead
    tlsfBlock* nextFreeBlock;     // Valid only if block is free. Else it is the start of the payload
    tlsfBlock* prevFreeBlock;     // Valid only if block is free. Else it is part the payload

    char* header() { return (char*)this + offsetof(tlsfBlock, dataSizeAndFlags); }

    char* payload() { return header() + sizeof(dataSizeAndFlags); }

    static tlsfBlock* fromPayload(void* mem) { return (tlsfBlock*)((char*)mem - offsetof(tlsfBlock, nextFreeBlock)); }

    tlsfBlock* getNext() { return (tlsfBlock*)(header() + getPayloadSize()); }

    void setPayloadSize(uint64_t size) { dataSizeAndFlags = size | (dataSizeAndFlags & (TlsfFlagFree | TlsfFlagPrevFree)); }

    uint64_t getPayloadSize() const { return (dataSizeAndFlags & ~(TlsfFlagFree | TlsfFlagPrevFree)); }

    bool isFree() const { return (dataSizeAndFlags & TlsfFlagFree); }

    bool isPrevFree() const { return (dataSizeAndFlags & TlsfFlagPrevFree); }

    void setFree(bool state)
    {
        assert(isFree() != state && "block free bit unchanged");
        dataSizeAndFlags      = state ? (dataSizeAndFlags | TlsfFlagFree) : (dataSizeAndFlags & ~TlsfFlagFree);
        tlsfBlock* next       = getNext();
        next->prevBlockIfFree = this;
        next->setPrevFree(state);
    }

    void setPrevFree(bool state)
    {
        dataSizeAndFlags = state ? (dataSizeAndFlags | TlsfFlagPrevFree) : (dataSizeAndFlags & ~TlsfFlagPrevFree);
    }
};

class TlsfAllocator
{
   public:
    TlsfAllocator(uint64_t maxAllocatableBytes)
    {
        if (maxAllocatableBytes) {
#if defined(_MSC_VER)
            // On Windows, virtual allocation is better done in two phases: first reserve the total, then commit by chunks
            SYSTEM_INFO sSysInfo;
            GetSystemInfo(&sSysInfo);
            _allocGranularity         = sSysInfo.dwAllocationGranularity;  // Preferred to page size, which is very small for our usage
            _arenaMaxAllocatableBytes = ((maxAllocatableBytes + _allocGranularity - 1) / _allocGranularity) * _allocGranularity;
            _arenaBasePtr             = (uint8_t*)VirtualAlloc(NULL, _arenaMaxAllocatableBytes, MEM_RESERVE, PAGE_NOACCESS);
            assert(_arenaBasePtr);
#else
            _arenaMaxAllocatableBytes = maxAllocatableBytes;
            _arenaBasePtr             = (uint8_t*)mmap(nullptr, _arenaMaxAllocatableBytes, PROT_READ | PROT_WRITE,
                                                       MAP_PRIVATE | MAP_ANONYMOUS | MAP_NORESERVE, -1, 0);
            assert(_arenaBasePtr != MAP_FAILED);  // NOLINT
#endif
            assert((((uintptr_t)_arenaBasePtr) % (1 << TlsfAlignShift)) == 0);
        }
    }

    ~TlsfAllocator()
    {
        if (_arenaMaxAllocatableBytes) {
#if defined(_MSC_VER)
            [[maybe_unused]] bool status = VirtualFree(_arenaBasePtr, 0, MEM_RELEASE);
            assert(status);
#else
            [[maybe_unused]] int status = munmap(_arenaBasePtr, _arenaMaxAllocatableBytes);
            assert(status == 0);
#endif
        }
    }

    void reset()
    {
        // Reset the allocator. This invalidates all previous allocations
        _arenaAllocatedBytes = 0;
        _flBitmap            = 0;
        memset(_slBitmaps, 0, sizeof(_slBitmaps));
        memset(_freeBlocks, 0, sizeof(_freeBlocks));
        _statAllocatedBytes = 0;
    }

    void* malloc(uint64_t size)
    {
        uint64_t adjustedSize = getAdjustedSize(size);
        if (LITECASK_UNLIKELY(adjustedSize == 0)) return nullptr;

        // Compute the initial layer indexes
        uint32_t firstLayerIdx = 0, secondLayerIdx = 0;
        findSizeFittingList(adjustedSize, &firstLayerIdx, &secondLayerIdx);

        tlsfBlock* block = nullptr;
        for (int pass = 0; !block && pass < 2; ++pass) {
            // Second chance is after growing the arena
            if (LITECASK_UNLIKELY(pass == 1 && !extendArena(adjustedSize))) { return nullptr; }

            // Is the second layer of the targeted first layer populated for this size?
            uint32_t slBitmap = _slBitmaps[firstLayerIdx] & ~((1U << secondLayerIdx) - 1);  // Clear the too small sizes
            if (!slBitmap) {
                // Need to look up larger first level lists
                uint32_t flBitmap = _flBitmap & (~((1U << (firstLayerIdx + 1)) - 1));
                if (LITECASK_UNLIKELY(!flBitmap)) { continue; }  // No such free blocks available, go to next pass

                // Update the first layer to this larger one
                firstLayerIdx = countTrailingZeros(flBitmap);  // Take the lowest bit available, as the bitmap has been masked accordingly
                slBitmap      = _slBitmaps[firstLayerIdx];     // Update the second layer bitmap, any of these list would fit
                assert(slBitmap && "second level bitmap is null in spite of the first level bitmap");
            }

            secondLayerIdx = countTrailingZeros(slBitmap);  // Take the lowest bit available, as the bitmap has been masked accordingly
            assert(secondLayerIdx < TlsfSlQty && "wrong second level");
            block = _freeBlocks[firstLayerIdx][secondLayerIdx];
        }
        assert(block);
        assert(block && block->getPayloadSize() >= size && "insufficient block size");

        detachFreeBlockFromFreeList(block, firstLayerIdx, secondLayerIdx);

        // Split this free block to isolate the (left) part that will be used
        if (block->getPayloadSize() >= sizeof(tlsfBlock) + size) {
            // Split a block into two, the second of which is free
            tlsfBlock* rightBlock        = (tlsfBlock*)(block->header() + size);
            uint64_t   rightBlockSize    = block->getPayloadSize() - (size + TlsfBlockOverhead);
            rightBlock->dataSizeAndFlags = rightBlockSize | 0;  // Initialize without flags
            rightBlock->setFree(true);

            // Deduce the removed size from the block
            block->setPayloadSize(size);

            // Link the two blocks as "consecutive"
            block->getNext()->prevBlockIfFree = block;
            rightBlock->setPrevFree(true);  // 'block' is not yet in use

            // Insert the remaining free part of the block in the free list
            insertBlockInFreeList(rightBlock);
        }

        // Mark the block as used
        block->setFree(false);
        _statAllocatedBytes += TlsfBlockOverhead + block->getPayloadSize();
        return block->payload();
    }

    void free(void* mem)
    {
        if (LITECASK_UNLIKELY(!mem)) { return; }

        // Back to the block structure
        tlsfBlock* block = tlsfBlock::fromPayload(mem);

        assert(!block->isFree() && "block already marked as free");
        block->setFree(true);
        assert(_statAllocatedBytes >= TlsfBlockOverhead + block->getPayloadSize());
        _statAllocatedBytes -= TlsfBlockOverhead + block->getPayloadSize();

        // Merge this free block with previous one if it is free
        block = mergeBlockWithPreviousIfFree(block);

        // Merge this free block with next one if it is free
        tlsfBlock* next = block->getNext();
        assert(next && "next block can't be null");
        if (next->isFree()) {
            // Remove the next block from the free list
            uint32_t firstLayerIdx = 0, secondLayerIdx = 0;
            findSizeFittingList(next->getPayloadSize(), &firstLayerIdx, &secondLayerIdx);
            detachFreeBlockFromFreeList(next, firstLayerIdx, secondLayerIdx);

            // Absorb the next block inside the current one
            block->dataSizeAndFlags += next->getPayloadSize() + TlsfBlockOverhead;  // Flags untouched
            block->getNext()->prevBlockIfFree = block;
        }

        // Back in one of the free lists
        insertBlockInFreeList(block);
    }

    uint32_t compress(uint8_t* ptr) const { return (uint32_t)((uint64_t)(ptr - _arenaBasePtr) >> 3); }

    uint8_t* uncompress(uint32_t compressedPtr) const { return _arenaBasePtr + (((uint64_t)compressedPtr) << 3); }

    uint64_t getRealAllocatedSize(void* mem) { return tlsfBlock::fromPayload(mem)->getPayloadSize(); }

    // Returns the in-used quantity (free + overhead), not the mmap-ed one
    uint64_t getAllocatedBytes() const { return _statAllocatedBytes; }

    uint64_t getMaxAllocatableBytes() const { return _arenaMaxAllocatableBytes; }

    struct CheckContext {
        uint32_t firstLayerIdx;
        uint32_t secondLayerIdx;
        uint32_t firstLayerMask;
        uint32_t secondLayerMask;
    };

    static CheckContext getSizeCheckContext(uint64_t size)
    {
        CheckContext cc{};
        uint64_t     adjustedSize = getAdjustedSize(size);
        findSizeFittingList(adjustedSize, &cc.firstLayerIdx, &cc.secondLayerIdx);
        cc.firstLayerMask  = ~((1U << (cc.firstLayerIdx + 1)) - 1);  // Any bit set in this FL mask is ok
        cc.secondLayerMask = ~((1U << cc.secondLayerIdx) - 1);       // Any bit set in this SL mask from FL firstLayerIdx is ok
        return cc;
    }

    bool isAllocatable(const CheckContext& cc) const
    {
        return (_slBitmaps[cc.firstLayerIdx] & cc.secondLayerMask) || (_flBitmap & cc.firstLayerMask);
    }

#ifndef LITECASK_BUILD_FOR_TEST  // Allows looking inside the allocator internal, for testing purposes
   private:
#endif
    // Fix the provided size (minimum size + alignment) and return the corresponding size in the free list
    static uint64_t getAdjustedSize(uint64_t& size)
    {
        // Adjust the allocated size (ceil-aligned with a minimum value)
        constexpr uint64_t TlsfMaxSize = ((uint64_t)1) << (TlsfFlQty + TlsfFlShift - 2);  // 64 GB should be enough for everyone
        // Min size is 24 bytes in this implementation. It could be halved with compressed pointers and reduced max allocatable size.
        // However, no benefit would be provided in the context of Litecask, as minimum key and value chunks are above this size.
        constexpr uint64_t MinAllocatedSize = sizeof(tlsfBlock) - sizeof(tlsfBlock*);
        constexpr uint64_t AlignmentMask    = (1 << TlsfAlignShift) - 1;  // 0x7 when decrypted, 8 bytes alignment
        size                                = std::max((size + AlignmentMask) & (~AlignmentMask), MinAllocatedSize);
        if (LITECASK_UNLIKELY(size > TlsfMaxSize)) { return 0; }

        // Find the list of free blocks with big enough size
        uint64_t adjustedSize = size;
        if (size >= TlsfSmallSize) {
            uint32_t firstLayerBitIdx = (uint32_t)(63 - countLeadingZeros(size));
            uint64_t layersBitMask    = (((uint64_t)1) << (firstLayerBitIdx - TlsfSlShift)) - 1;
            // Keep only bits from first and second layers, with a ceiling
            adjustedSize = (size + layersBitMask) & ~layersBitMask;
        }
        return adjustedSize;
    }

    static void findSizeFittingList(uint64_t size, uint32_t* firstLayerIdx, uint32_t* secondLayerIdx)
    {
        // Due to the 8-bytes alignment constraint multiplied by the 16 second layers, the initial first layers
        // are not fully populated.
        // We choose to populate only the layer 0 for "small" block size (128=2^7) then the natural first layers
        if (size < TlsfSmallSize) {
            *firstLayerIdx  = 0;
            *secondLayerIdx = (uint32_t)(size / (TlsfSmallSize / TlsfSlQty));  // Step is 128/16 = 8 bytes
        } else {
            uint32_t firstLayerBitIdx = (uint32_t)(63 - countLeadingZeros(size));
            *firstLayerIdx            = 1 + firstLayerBitIdx - TlsfFlShift;
            // Shift to keep the second layer bits starting at bit0, and clear the top bit (set to 1, first layer)
            *secondLayerIdx = (uint32_t)(size >> (firstLayerBitIdx - TlsfSlShift)) & (TlsfSlQty - 1);
        }
        assert(*firstLayerIdx < TlsfFlQty && "wrong first level");
        assert(*secondLayerIdx < TlsfSlQty && "wrong second level");
    }

    void detachFreeBlockFromFreeList(tlsfBlock* block, uint32_t firstLayerIdx, uint32_t secondLayerIdx)
    {
        // Detach the block from list neighbors
        tlsfBlock* prev = block->prevFreeBlock;
        tlsfBlock* next = block->nextFreeBlock;
        if (next) { next->prevFreeBlock = prev; }
        if (prev) { prev->nextFreeBlock = next; }

        // Update list head if needed
        if (_freeBlocks[firstLayerIdx][secondLayerIdx] == block) {
            _freeBlocks[firstLayerIdx][secondLayerIdx] = next;
            if (!next) {                                                              // Update bitmaps if the list is empty
                _slBitmaps[firstLayerIdx] &= ~(1U << secondLayerIdx);                 // Second layer bitmap
                if (!_slBitmaps[firstLayerIdx]) _flBitmap &= ~(1U << firstLayerIdx);  // First layer bitmap if second layer is empty
            }
        }
    }

    void insertBlockInFreeList(tlsfBlock* block)
    {
        // Find the fitting list
        uint32_t firstLayerIdx = 0, secondLayerIdx = 0;
        findSizeFittingList(block->getPayloadSize(), &firstLayerIdx, &secondLayerIdx);

        // Insert in the list
        tlsfBlock* current   = _freeBlocks[firstLayerIdx][secondLayerIdx];
        block->nextFreeBlock = current;
        block->prevFreeBlock = nullptr;
        if (current) current->prevFreeBlock = block;
        _freeBlocks[firstLayerIdx][secondLayerIdx] = block;

        // Mark the bitmaps
        _flBitmap |= 1U << firstLayerIdx;
        _slBitmaps[firstLayerIdx] |= 1U << secondLayerIdx;
    }

    tlsfBlock* mergeBlockWithPreviousIfFree(tlsfBlock* block)
    {
        if (!block->isPrevFree()) { return block; }

        // Remove the previous block from the free list
        tlsfBlock* prev = block->prevBlockIfFree;
        assert(prev && "prev block can't be null");
        assert(prev->isFree() && "prev block is not free though marked as such");
        uint32_t firstLayerIdx = 0, secondLayerIdx = 0;
        findSizeFittingList(prev->getPayloadSize(), &firstLayerIdx, &secondLayerIdx);
        detachFreeBlockFromFreeList(prev, firstLayerIdx, secondLayerIdx);

        // Absorb the block inside the previous one
        prev->dataSizeAndFlags += block->getPayloadSize() + TlsfBlockOverhead;  // Flags untouched
        prev->getNext()->prevBlockIfFree = prev;
        return prev;
    }

    bool extendArena(uint64_t size)
    {
        // Note: first allocation is shifted by the field prevBlockIfFree
        uint64_t firstAllocOverhead = (_arenaAllocatedBytes == 0) ? TlsfBlockOverhead : 0;

        // Compute the size to match the allocation granularity
        // Mandatory on Windows, but generalized because we do not need fine grained allocation and can avoid its individual cost
        assert((size & 0x7) == 0);
        uint64_t requiredNewAllocatedSize = _arenaAllocatedBytes + size + TlsfBlockOverhead + firstAllocOverhead;
        uint64_t granularNewAllocatedSize = ((requiredNewAllocatedSize + _allocGranularity - 1) / _allocGranularity) * _allocGranularity;
        uint64_t granularSize             = granularNewAllocatedSize - _arenaAllocatedBytes - TlsfBlockOverhead - firstAllocOverhead;
        if (granularNewAllocatedSize > _arenaMaxAllocatableBytes) { return false; }

#if defined(_MSC_VER)
        // Windows: Memory shall be committed before use
        [[maybe_unused]] void* committedPtr =
            VirtualAlloc(_arenaBasePtr + _arenaAllocatedBytes, granularNewAllocatedSize - _arenaAllocatedBytes, MEM_COMMIT, PAGE_READWRITE);
        assert(committedPtr);
#endif
        tlsfBlock* addedBlock = (tlsfBlock*)((char*)_arenaBasePtr + _arenaAllocatedBytes - 2 * TlsfBlockOverhead + firstAllocOverhead);

        // 1st alloc requires the creation of the sentinel (null size & not free). Previous is not free either because below the base
        // pointer
        if (_arenaAllocatedBytes == 0) {
            addedBlock->dataSizeAndFlags = /* Null size */ 0 | /* Not free and previous not free either because first block ever */ 0;
        }

        // Transform the sentinel into a valid free block with the newly added size
        assert(addedBlock->getPayloadSize() == 0 && !addedBlock->isFree() && "the old sentinel is corrupted");
        addedBlock->dataSizeAndFlags |= granularSize | /* Free to recent allocation, previous block flag is untouched */ TlsfFlagFree;
        addedBlock = mergeBlockWithPreviousIfFree(addedBlock);
        insertBlockInFreeList(addedBlock);

        // Add a new sentinel (dummy last block of null size)
        tlsfBlock* sentinel       = addedBlock->getNext();
        sentinel->prevBlockIfFree = addedBlock;
        sentinel->dataSizeAndFlags =
            /* Null size */ 0 | /* Not free (sentinel) and previous block free due to recent allocation */ TlsfFlagPrevFree;
        assert(sentinel->getPayloadSize() == 0 && !sentinel->isFree() && "the new sentinel is corrupted");

        // Commit the allocation
        _arenaAllocatedBytes = granularNewAllocatedSize;
        return true;
    }

#if defined(_MSC_VER)
    static uint32_t countTrailingZeros(uint32_t v) { return _tzcnt_u32(v); }
    static uint32_t countLeadingZeros(uint64_t v) { return (uint32_t)_lzcnt_u64(v); }
#else
    static uint32_t countTrailingZeros(uint32_t v) { return __builtin_ctz(v); }
    static uint32_t countLeadingZeros(uint64_t v) { return __builtin_clzll(v); }
#endif

    // Bitmaps of the first and second layers
    uint32_t _flBitmap             = 0;
    uint32_t _slBitmaps[TlsfFlQty] = {};

    // Free lists for each (first, second) layer
    tlsfBlock* _freeBlocks[TlsfFlQty][TlsfSlQty] = {};
    uint64_t   _statAllocatedBytes               = 0;

    // Internal arena allocator
    uint8_t* _arenaBasePtr             = nullptr;
    uint64_t _arenaAllocatedBytes      = 0;
    uint64_t _arenaMaxAllocatableBytes = 0;
    uint64_t _allocGranularity         = 65536;  // Only really required on Windows, but generalized
};

// ==========================================================================================
// Value cache
// ==========================================================================================

inline uint32_t
getValueLockIndex(ValueLoc loc)
{
    uint32_t x = ((uint32_t)loc) ^ 2463534242;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return x & (ValueMutexQty - 1);  // Kind of xorshift output
}

inline void
lockValueLocation(ValueLoc loc, std::array<std::mutex, ValueMutexQty>& valueMutexes)
{
    valueMutexes[getValueLockIndex(loc)].lock();
}

inline void
unlockValueLocation(ValueLoc loc, std::array<std::mutex, ValueMutexQty>& valueMutexes)
{
    valueMutexes[getValueLockIndex(loc)].unlock();
}

class ValueCache
{
    // Definitions
    enum class LruType { None = 0, Hot = 1, Warm = 2, Cold = 3, Qty = 4 };

    static constexpr int SmallBatchSize = 10;

   public:
    ValueCache(uint64_t valueMaxAllocBytes) : _tlsfAlloc(valueMaxAllocBytes) {}

    ~ValueCache() {}

    bool setTargetMemoryLoad(double load)
    {
        if (load < 0. || load > 1.0) { return false; }
        _targetMemoryLoad = load;
        return true;
    }

    // To call when all references to this memory is no more used
    void reset() { _tlsfAlloc.reset(); }

    bool isEnabled() const { return (getMaxAllocatableBytes() > 0); }

    uint64_t getAllocatedBytes() const { return _tlsfAlloc.getAllocatedBytes(); }

    uint64_t getMaxAllocatableBytes() const { return _tlsfAlloc.getMaxAllocatableBytes(); }

    ValueLoc insertValue(const void* data, uint32_t size, uint64_t ownerId, uint32_t expTimeSec)
    {
        ++_stats.insertCallQty;
        ValueLoc loc        = NotStored;
        uint32_t targetSize = size + sizeof(ValueChunk);

        _mxMalloc.lock();
        uint8_t* ptr = (uint8_t*)_tlsfAlloc.malloc(targetSize);
        _mxMalloc.unlock();

        // If allocation failed, some forced evictions are needed
        if (!ptr) {
            TlsfAllocator::CheckContext cc = _tlsfAlloc.getSizeCheckContext(targetSize);  // For optimized check of "allocatability"

            int  remainingTries = SmallBatchSize;
            bool isAllocatable  = false;

            do {
                _mxLrus.lock();
                if (_queues[(uint32_t)LruType::Cold].tail == NotStored) {
                    updateLruHotAndWarm(SmallBatchSize);
                    if (_queues[(uint32_t)LruType::Cold].tail == NotStored) {
                        _mxLrus.unlock();
                        break;
                    }
                }

                ValueLoc locEvict = _queues[(uint32_t)LruType::Cold].tail;

                if (locEvict != NotStored) {
                    lockValueLocation(locEvict, _valueMutexes);
                    ValueChunk* c = getValueChunk(locEvict);
                    // If entry is active, move it to warm
                    if (c->flags & ValueFlagActive) {
                        lruRemove(c);
                        lruInsertFront(LruType::Warm, locEvict, c);
                    }
                    // Else we found our eviction
                    else {
                        lruRemove(c);
                        c->ownerId = 0;
                        _mxMalloc.lock();
                        _tlsfAlloc.free(c);
                        _mxMalloc.unlock();
                        ++_stats.evictedQty;
                        --_stats.currentInCacheValueQty;
                        isAllocatable = _tlsfAlloc.isAllocatable(cc);  // Cheap check
                    }
                    unlockValueLocation(locEvict, _valueMutexes);
                }
                _mxLrus.unlock();

            } while (remainingTries-- && !isAllocatable);

            if (isAllocatable) {
                _mxMalloc.lock();
                ptr = (uint8_t*)_tlsfAlloc.malloc(targetSize);
                _mxMalloc.unlock();
            }
        }

        if (!ptr) { return NotStored; }

        // Install meta data before the data
        ValueChunk* c = (ValueChunk*)ptr;
        c->ownerId    = ownerId;
        c->expTimeSec = expTimeSec;
        c->size       = size;
        c->flags      = 0;
        memcpy(((uint8_t*)c) + sizeof(ValueChunk), data, size);

        ++_stats.currentInCacheValueQty;

        // Insert this new entry inside the Hot queue
        loc = _tlsfAlloc.compress(ptr);
        _mxLrus.lock();
        lruInsertFront(LruType::Hot, loc, c);
        _mxLrus.unlock();

        return loc;
    }

    bool removeValue(ValueLoc loc, uint64_t ownerId)
    {
        ++_stats.removeCallQty;
        if (loc == NotStored) { return false; }

        _mxLrus.lock();
        lockValueLocation(loc, _valueMutexes);
        ValueChunk* c = getValueChunk(loc);

        // Check the ownerId and some sanity fields
        // By calling this function, the reference to `loc` is already removed in the above layers
        if (c->ownerId != ownerId || c->size == NotStored) {
            unlockValueLocation(loc, _valueMutexes);
            _mxLrus.unlock();
            return false;
        }

        // Invalidate
        lruRemove(c);
        c->ownerId = 0;

        unlockValueLocation(loc, _valueMutexes);
        _mxLrus.unlock();

        // Free
        _mxMalloc.lock();
        _tlsfAlloc.free(c);
        _mxMalloc.unlock();
        --_stats.currentInCacheValueQty;

        return true;
    }

    bool getValue(ValueLoc loc, uint64_t checKOwnerId, uint32_t checkValueSize, lcVector<uint8_t>& data)
    {
        ++_stats.getCallQty;
        if (loc == NotStored) { return false; }

        lockValueLocation(loc, _valueMutexes);
        ValueChunk* c = getValueChunk(loc);

        // Check the ownerId and size, as this 'loc' could have been meanwhile evicted
        if (c->ownerId != checKOwnerId || c->size != checkValueSize) {
            unlockValueLocation(loc, _valueMutexes);
            ++_stats.missQty;
            return false;
        }

        // Update the LRU
        c->flags |= ValueFlagActive;
        ++_stats.hitQty;

        // Copy data to the output
        data.resize(c->size);
        memcpy(data.data(), ((uint8_t*)c) + sizeof(ValueChunk), c->size);

        unlockValueLocation(loc, _valueMutexes);
        return true;
    }

    // Upkeeping background task
    void backgroundUpdateLru(uint32_t batchSize)
    {
        // Loop until no more work to do or batch exhausted
        while (batchSize > 0) {
            _mxLrus.lock();
            uint32_t consumed = updateLruHotAndWarm(batchSize);
            _mxLrus.unlock();
            batchSize = (consumed == 0 || consumed > batchSize) ? 0 : batchSize - consumed;
        }
    }

    // Upkeeping background task
    void backgroundPreventiveEviction(uint32_t batchSize)
    {
        if (!isEnabled()) { return; }

        uint64_t targetAllocatedBytes = (uint64_t)(_targetMemoryLoad * (double)_tlsfAlloc.getMaxAllocatableBytes());

        // Loop until no more work to do or batch exhausted
        while ((batchSize--) > 0 && _tlsfAlloc.getAllocatedBytes() > targetAllocatedBytes) {
            _mxLrus.lock();
            if (_queues[(uint32_t)LruType::Cold].tail == NotStored) {
                updateLruHotAndWarm(SmallBatchSize);
                if (_queues[(uint32_t)LruType::Cold].tail == NotStored) {
                    _mxLrus.unlock();
                    break;
                }
            }

            ValueLoc loc = _queues[(uint32_t)LruType::Cold].tail;

            if (loc != NotStored) {
                lockValueLocation(loc, _valueMutexes);
                ValueChunk* c = getValueChunk(loc);
                // If entry is active, move it to warm
                if (c->flags & ValueFlagActive) {
                    lruRemove(c);
                    lruInsertFront(LruType::Warm, loc, c);
                }
                // Else we found our eviction
                else {
                    lruRemove(c);
                    c->ownerId = 0;
                    _mxMalloc.lock();
                    _tlsfAlloc.free(c);
                    _mxMalloc.unlock();
                    ++_stats.evictedQty;
                    --_stats.currentInCacheValueQty;
                }
                unlockValueLocation(loc, _valueMutexes);
            }
            _mxLrus.unlock();

        }  // End of batch processing
    }

    const ValueCacheCounters& getCounters() const { return _stats; }

    void dump() const
    {
        printf("Cache:\n");
        printf("  insert call: %" PRId64 "\n", _stats.insertCallQty.load());
        printf("  get    call: %" PRId64 "\n", _stats.getCallQty.load());
        printf("  remove call: %" PRId64 "\n", _stats.removeCallQty.load());
        printf("  hit     qty: %" PRId64 "\n", _stats.hitQty.load());
        printf("  miss    qty: %" PRId64 "\n", _stats.missQty.load());
        printf("  evicted qty: %" PRId64 "\n", _stats.evictedQty.load());
        printf("  hit   ratio: %.3f\n", (double)_stats.hitQty / (double)std::max((uint64_t)1, _stats.hitQty + _stats.missQty));
    }

   private:
    ValueChunk* getValueChunk(KeyLoc loc) const { return (ValueChunk*)_tlsfAlloc.uncompress(loc); }

    // Lock shall be taken beforehand
    void lruRemove(ValueChunk* c)
    {
        assert((c->flags & ValueFlagQueueTypeMask) != (uint32_t)LruType::None);
        LruQueue& queue = _queues[c->flags & ValueFlagQueueTypeMask];
        c->flags        = (uint32_t)LruType::None;  // No more present in any LRU

        if (c->prev != NotStored) {
            getValueChunk(c->prev)->next = c->next;
        } else {
            queue.head = c->next;
        }
        if (c->next != NotStored) {
            getValueChunk(c->next)->prev = c->prev;
        } else {
            queue.tail = c->prev;
        }
        assert(queue.bytes >= c->size);
        queue.bytes -= c->size;
    }

    // Lock shall be taken beforehand
    void lruInsertFront(LruType lruType, ValueLoc loc, ValueChunk* c)
    {
        assert(lruType != LruType::None);
        assert((c->flags & ValueFlagQueueTypeMask) == (uint32_t)LruType::None);
        LruQueue& queue = _queues[(uint32_t)lruType];

        c->flags = (uint16_t)lruType;  // Active flag is cleared when bumped
        c->prev  = NotStored;
        if (queue.head != NotStored) {
            getValueChunk(queue.head)->prev = loc;
            c->next                         = queue.head;
        } else {
            queue.tail = loc;
            c->next    = NotStored;
        }
        queue.head = loc;
        queue.bytes += c->size;
    }

    uint32_t updateLruHotAndWarm(uint32_t batchSize)
    {
        int64_t allBytes = (int64_t)_queues[(uint32_t)LruType::Hot].bytes + (int64_t)_queues[(uint32_t)LruType::Warm].bytes +
                           (int64_t)_queues[(uint32_t)LruType::Cold].bytes;
        ValueLoc loc      = NotStored;
        uint32_t consumed = 0;

        // Move from Hot to Warm or Cold
        int64_t moveQty   = batchSize;
        int64_t moveBytes = std::max((int64_t)0, (int64_t)_queues[(uint32_t)LruType::Hot].bytes - (allBytes * 20 / 100));
        while (moveQty-- && moveBytes > 0 && (loc = _queues[(uint32_t)LruType::Hot].tail) != NotStored) {
            lockValueLocation(loc, _valueMutexes);
            ValueChunk* c        = getValueChunk(loc);
            bool        isActive = (c->flags & ValueFlagActive);
            lruRemove(c);
            // Move it to the Warm or Cold LRU, depending on its active state
            lruInsertFront(isActive ? LruType::Warm : LruType::Cold, loc, c);
            moveBytes -= c->size;
            ++consumed;
            unlockValueLocation(loc, _valueMutexes);
        }

        // Move from Warm to Warm (bumped) or Cold
        moveQty   = batchSize;
        moveBytes = std::max((int64_t)0, (int64_t)_queues[(uint32_t)LruType::Warm].bytes - (allBytes * 40 / 100));
        while (moveQty-- && moveBytes > 0 && (loc = _queues[(uint32_t)LruType::Warm].tail) != NotStored) {
            lockValueLocation(loc, _valueMutexes);
            ValueChunk* c        = getValueChunk(loc);
            bool        isActive = (c->flags & ValueFlagActive);
            lruRemove(c);
            // Move it to the Warm or Cold LRU, depending on its access state
            lruInsertFront(isActive ? LruType::Warm : LruType::Cold, loc, c);
            moveBytes -= c->size;
            ++consumed;
            unlockValueLocation(loc, _valueMutexes);
        }

        // Note: Move from Cold to Warm is performed independently. It depends on the cache filled ratio.

        return consumed;
    }

    struct LruQueue {
        ValueLoc head  = NotStored;
        ValueLoc tail  = NotStored;
        uint32_t bytes = 0;
    };
    std::mutex _mxLrus;
    std::mutex _mxMalloc;
    LruQueue   _queues[(uint32_t)LruType::Qty];
    double     _targetMemoryLoad = 0.90;

    TlsfAllocator                         _tlsfAlloc;
    ValueCacheCounters                    _stats;
    std::array<std::mutex, ValueMutexQty> _valueMutexes;
};

// ==========================================================================================
// Index Hashmap
// ==========================================================================================

struct IndexChunk {
    uint32_t keyPartSize;  // Length in bytes of the tag (=part of the key)
    uint32_t entries;      // Quantity of used entries
    // uint8_t keyPart[0] the part of the key is stored here (padded to 4 bytes), followed by the list of hash32 of related entries
    uint32_t* getHashArrayStart() const
    {
        constexpr uint32_t AlignMask = (uint32_t)(sizeof(uint32_t) - 1);
        return (uint32_t*)((uint8_t*)this + sizeof(IndexChunk) + ((keyPartSize + AlignMask) & (~AlignMask)));
    }
};

class IndexMap
{
   public:
    IndexMap(uint64_t indexMaxAllocBytes, uint32_t initMapSize) : _tlsfAlloc(indexMaxAllocBytes)
    {
        // Sanity: Check that the initial size is a power of 2
        uint32_t checkSize = initMapSize;
        while ((checkSize & 1) == 0) checkSize >>= 1;
        assert(checkSize == 1);

        // Allocate the initial map and key storage
        resize(initMapSize);
    }

    ~IndexMap()
    {
        delete[] _table0.allocPtr;
        delete[] _table1.allocPtr;
    }

    void clear()
    {
        for (uint32_t i = 0; i < _table0.maxSize; ++i) { _table0.nodes[i].hash = Empty; }
        _table0.size = 0;
        for (uint32_t i = 0; i < _table1.maxSize; ++i) { _table1.nodes[i].hash = Empty; }
        _table1.size = 0;
    }

    uint32_t size() const { return _table0.size + _table1.size; }

    uint32_t capacity() const { return std::max(_table0.maxSize, _table1.maxSize); }

    bool empty() const { return (size() == 0); }

    static constexpr uint64_t Empty      = 0;
    static constexpr uint64_t FirstValid = 1;

    // An external writer RW-lock shall ensure 1 writer at a time
    Status insertIndex(const void* keyPart, uint32_t keyPartSize, uint32_t entryKeyHash)
    {
        uint32_t keyHash = (uint32_t)LITECASK_HASH_FUNC(keyPart, keyPartSize);
        if (keyHash < FirstValid) keyHash += FirstValid;
        if (entryKeyHash < FirstValid) entryKeyHash += FirstValid;

        Table*   currentTable = _currentTable.load();
        uint32_t mask         = (currentTable->maxSize - 1) & (~(KeyDirAssocQty - 1));
        int      idx          = keyHash & mask;
        uint32_t probeIncr    = 1;
        uint32_t cellId       = 0;

        while (true) {
            cellId = 0;
            while (cellId < KeyDirAssocQty && currentTable->nodes[idx + cellId].hash >= FirstValid) {
                if (currentTable->nodes[idx + cellId].hash == keyHash) {
                    IndexChunk* indexChunk = (IndexChunk*)_tlsfAlloc.uncompress(currentTable->nodes[idx + cellId].loc);
                    if (indexChunk->keyPartSize == keyPartSize &&
                        !memcmp(((uint8_t*)indexChunk) + sizeof(IndexChunk), keyPart, keyPartSize)) {
                        // Match found, entry update case
                        _optimisticsCounters[keyHash & OptCounterMask]++;

                        const uint32_t arrayStartOffset    = (uint32_t)((uint8_t*)indexChunk->getHashArrayStart() - (uint8_t*)indexChunk);
                        const uint32_t accessibleEntrySize = (uint32_t)(_tlsfAlloc.getRealAllocatedSize(indexChunk) - arrayStartOffset);
                        if ((indexChunk->entries + 1) * sizeof(uint32_t) > accessibleEntrySize) {
                            // New allocation required because the current one is too small
                            const uint32_t newMaxEntries = 2 * indexChunk->entries;
                            uint32_t       targetSize    = arrayStartOffset + newMaxEntries * (uint32_t)sizeof(uint32_t);
                            uint8_t*       ptr           = (uint8_t*)_tlsfAlloc.malloc(targetSize);
                            if (ptr == nullptr) { return Status::OutOfMemory; }
                            memcpy(ptr, indexChunk, arrayStartOffset + indexChunk->entries * sizeof(uint32_t));
                            currentTable->nodes[idx + cellId].loc = _tlsfAlloc.compress(ptr);
                            _tlsfAlloc.free(indexChunk);
                            indexChunk = (IndexChunk*)ptr;
                        }

                        // Store the new entry
                        assert((indexChunk->entries + 1) * sizeof(uint32_t) <=
                               (uint32_t)(_tlsfAlloc.getRealAllocatedSize(indexChunk) - arrayStartOffset));
                        indexChunk->getHashArrayStart()[indexChunk->entries++] = entryKeyHash;

                        _optimisticsCounters[keyHash & OptCounterMask]++;
                        return Status::Ok;
                    }
                }
                ++cellId;
            }

            if (cellId < KeyDirAssocQty) { break; }  // Empty space spotted on this cache line, so key has not been found
            idx = (idx + (probeIncr * KeyDirAssocQty)) & mask;
            ++probeIncr;  // Between linear and quadratic probing
        }

        const uint32_t     newMaxEntries = 2;  // Starts with 2 elements max
        constexpr uint32_t AlignMask     = (uint32_t)(sizeof(uint32_t) - 1);
        uint32_t           targetSize = sizeof(IndexChunk) + ((keyPartSize + AlignMask) & (~AlignMask)) + newMaxEntries * sizeof(uint32_t);
        uint8_t*           ptr        = (uint8_t*)_tlsfAlloc.malloc(targetSize);
        if (ptr == nullptr) { return Status::OutOfMemory; }
        IndexChunk* indexChunk = (IndexChunk*)ptr;
        *indexChunk            = {keyPartSize, 0};
        memcpy(ptr + sizeof(IndexChunk), keyPart, keyPartSize);
        indexChunk->getHashArrayStart()[indexChunk->entries++] = entryKeyHash;
        currentTable->nodes[idx + cellId]                      = {keyHash, _tlsfAlloc.compress(ptr)};

        currentTable->size += 1;
        if ((uint64_t)128 * (_table0.size + _table1.size) > _maxLoadFactor128th * currentTable->maxSize) {
            resize(2 * currentTable->maxSize);
        }
        return Status::Ok;
    }

    // An external reader RW-lock shall ensure that there is no edit at the same time
    uint32_t getEntryHashes(const void* keyPart, uint16_t keyPartSize, lcVector<uint32_t>* entryHashes = nullptr)
    {
        uint32_t keyHash = (uint32_t)LITECASK_HASH_FUNC(keyPart, keyPartSize);
        if (keyHash < FirstValid) keyHash += FirstValid;

        Table*   currentTable = _currentTable.load();
        uint32_t mask         = (currentTable->maxSize - 1) & (~(KeyDirAssocQty - 1));
        int      idx          = keyHash & mask;
        uint32_t probeIncr    = 1;

        while (true) {
            uint32_t cellId = 0;
            for (; cellId < KeyDirAssocQty && currentTable->nodes[idx + cellId].hash >= FirstValid; ++cellId) {
                if (currentTable->nodes[idx + cellId].hash == keyHash) {
                    IndexChunk* indexChunk = (IndexChunk*)_tlsfAlloc.uncompress(currentTable->nodes[idx + cellId].loc);
                    if (indexChunk->keyPartSize == keyPartSize &&
                        !memcmp(((uint8_t*)indexChunk) + sizeof(IndexChunk), keyPart, keyPartSize)) {
                        if (entryHashes) {
                            entryHashes->resize(indexChunk->entries);
                            memcpy(entryHashes->data(), indexChunk->getHashArrayStart(), indexChunk->entries * sizeof(uint32_t));
                        }
                        return indexChunk->entries;
                    }
                }
            }

            if (cellId < KeyDirAssocQty) { break; }  // Empty space spotted on this cache line, so key has not been found
            idx = (idx + (probeIncr * KeyDirAssocQty)) & mask;
            ++probeIncr;  // Between linear and quadratic probing
        }

        // Not found
        return 0;
    }

    // An external writer RW-lock shall ensure 1 writer at a time and keep the lock as long as the returned array is used
    bool getEntryHashesForUpdate(const void* keyPart, uint32_t keyPartSize, uint32_t** entryHashes, uint32_t** entries)
    {
        uint32_t keyHash = (uint32_t)LITECASK_HASH_FUNC(keyPart, keyPartSize);
        if (keyHash < FirstValid) keyHash += FirstValid;

        Table*   currentTable = _currentTable.load();
        uint32_t mask         = (currentTable->maxSize - 1) & (~(KeyDirAssocQty - 1));
        int      idx          = keyHash & mask;
        uint32_t probeIncr    = 1;

        while (true) {
            uint32_t cellId = 0;
            for (; cellId < KeyDirAssocQty && currentTable->nodes[idx + cellId].hash >= FirstValid; ++cellId) {
                if (currentTable->nodes[idx + cellId].hash == keyHash) {
                    IndexChunk* indexChunk = (IndexChunk*)_tlsfAlloc.uncompress(currentTable->nodes[idx + cellId].loc);
                    if (indexChunk->keyPartSize == keyPartSize &&
                        !memcmp(((uint8_t*)indexChunk) + sizeof(IndexChunk), keyPart, keyPartSize)) {
                        *entryHashes = indexChunk->getHashArrayStart();
                        *entries     = &(indexChunk->entries);
                        return true;
                    }
                }
            }

            if (cellId < KeyDirAssocQty) { break; }  // Empty space spotted on this cache line, so key has not been found
            idx = (idx + (probeIncr * KeyDirAssocQty)) & mask;
            ++probeIncr;  // Between linear and quadratic probing
        }

        // Not found, which is not supposed to happen unless the index is removed in-between
        return false;
    }

    // Above this load factor, the KeyDir will get resized
    bool setMaxLoadFactor(double f)
    {
        if (f <= 0. || f > 1.) return false;
        _maxLoadFactor128th = (uint64_t)(128. * f);
        return true;
    }

    double getLoadFactor() const
    {
        return (double)(_table0.size + _table1.size) / (double)std::max(std::max(_table0.maxSize, _table1.maxSize), 1U);
    }

    uint64_t getEstimatedUsedMemoryBytes() const
    {
        return sizeof(MapEntry) * (_table0.maxSize + _table1.maxSize) + _tlsfAlloc.getAllocatedBytes();
    }

    void resize(uint32_t newMaxSize)
    {
        // Allocate the new table
        Table* newTable = (_currentTable.load() == &_table0) ? &_table1 : &_table0;
        delete[] newTable->allocPtr;
        newTable->allocPtr = new uint8_t[newMaxSize * sizeof(MapEntry) + detail::CpuCacheLine];       // For cache-line aligned base pointer
        newTable->nodes = (MapEntry*)((((uintptr_t)newTable->allocPtr) + detail::CpuCacheLine - 1) &  // NOLINT(performance-no-int-to-ptr)
                                      (~(detail::CpuCacheLine - 1)));
        memset(newTable->nodes, 0, sizeof(MapEntry) * newMaxSize);
        newTable->maxSize = newMaxSize;
        newTable->size    = 0;

        Table*   oldTable = (newTable == &_table0) ? &_table1 : &_table0;
        uint32_t newMask  = (newTable->maxSize - 1) & (~(KeyDirAssocQty - 1));

        // Transfer the data
        for (uint32_t oldIdx = 0; oldIdx < oldTable->maxSize; ++oldIdx) {
            if (oldTable->nodes[oldIdx].hash < FirstValid) continue;

            uint32_t newIdx    = oldTable->nodes[oldIdx].hash & newMask;
            uint32_t probeIncr = 1;
            uint32_t cellId    = 0;

            while (true) {
                cellId = 0;
                while (cellId < KeyDirAssocQty && newTable->nodes[newIdx + cellId].hash >= FirstValid) ++cellId;
                if (cellId < KeyDirAssocQty) { break; }  // Empty space spotted on this cache line
                newIdx = (newIdx + (probeIncr * KeyDirAssocQty)) & newMask;
                ++probeIncr;
            }

            assert(cellId < KeyDirAssocQty && newTable->nodes[newIdx + cellId].hash < FirstValid);
            newTable->nodes[newIdx + cellId] = oldTable->nodes[oldIdx];
            newTable->size += 1;
            oldTable->size -= 1;  // So that the sum of the sizes is accurate
        }

        oldTable->size = 0;  // Cleared table

        // Swap
        _currentTable.store(newTable);
    }

   private:
    // Definitions
    struct Table {
        MapEntry* nodes    = nullptr;  // Cache line aligned
        uint32_t  size     = 0;
        uint32_t  maxSize  = 0;
        uint8_t*  allocPtr = nullptr;  // May not be aligned on a cache line///
    };

    // Constants
    static constexpr int OptCounterQty   = 8192;
    static constexpr int OptCounterMask  = OptCounterQty - 1;
    static constexpr int CurrentTableNbr = (1 << 0);

    // Fields
    Table               _table0;
    Table               _table1;
    std::atomic<Table*> _currentTable       = &_table1;
    uint64_t            _maxLoadFactor128th = (uint64_t)(0.90 * 128);  // 90% load factor with 8-associativity is ok
    TlsfAllocator       _tlsfAlloc;
    std::array<std::atomic<uint32_t>, OptCounterQty> _optimisticsCounters = {0};
};

// ==========================================================================================
// KeyDir Hashmap
// ==========================================================================================

struct OldKeyChunk {
    bool     isValid       = false;
    uint32_t valueSize     = 0;
    ValueLoc cacheLocation = NotStored;
    uint16_t fileId        = 0;
    uint16_t keyIndexQty   = 0;  // Index qty, and not bytes
    KeyIndex keyIndexes[MaxKeyIndexQty];
};

class KeyDirMap
{
   public:
    KeyDirMap(uint64_t keyMaxAllocBytes, uint32_t initMapSize, const std::function<void(uint32_t, bool, bool)>& notifyResizing)
        : _notifyResizing(notifyResizing), _tlsfAlloc(keyMaxAllocBytes)
    {
        assert(notifyResizing);

        // Sanity: Check that the initial size is a power of 2
        uint32_t checkSize = initMapSize;
        while ((checkSize & 1) == 0) checkSize >>= 1;
        assert(checkSize == 1);

        // Allocate the initial map and key storage
        resize(initMapSize);
    }

    ~KeyDirMap()
    {
        delete[] _table0.allocPtr;
        delete[] _table1.allocPtr;
    }

    void reset()
    {
        for (uint32_t i = 0; i < _table0.maxSize; ++i) { _table0.nodes[i].hash = Empty; }
        _table0.size = 0;
        for (uint32_t i = 0; i < _table1.maxSize; ++i) { _table1.nodes[i].hash = Empty; }
        _table1.size = 0;
    }

    uint32_t size() const { return _table0.size + _table1.size; }

    uint32_t capacity() const { return std::max(_table0.maxSize, _table1.maxSize); }

    bool empty() const { return (size() == 0); }

    static constexpr uint64_t Empty      = 0;
    static constexpr uint64_t FirstValid = 1;

#define LITECASK_FIND_KEY_LOOP(parameterActionCode)                                                                     \
    mask      = (currentTable->maxSize - 1) & (~(KeyDirAssocQty - 1));                                                  \
    idx       = keyHash & mask;                                                                                         \
    probeIncr = 1;                                                                                                      \
                                                                                                                        \
    while (true) {                                                                                                      \
        uint32_t cellId = 0;                                                                                            \
        for (; cellId < KeyDirAssocQty && currentTable->nodes[idx + cellId].hash >= FirstValid; ++cellId) {             \
            if (currentTable->nodes[idx + cellId].hash == keyHash) {                                                    \
                KeyChunk* keyChunk = getKey(currentTable->nodes[idx + cellId].loc);                                     \
                if (keyChunk->keySize == keySize && !memcmp(((uint8_t*)keyChunk) + sizeof(KeyChunk), key, keySize)) {   \
                    if (keyChunk->expTimeSec > 0 && keyChunk->expTimeSec <= _nowTimeSec) { break; }                     \
                    parameterActionCode;                                                                                \
                }                                                                                                       \
            }                                                                                                           \
        }                                                                                                               \
        if (cellId < KeyDirAssocQty) { break; } /* Empty space spotted on this cache line, so key has not been found */ \
        idx = (idx + (probeIncr * KeyDirAssocQty)) & mask;                                                              \
        ++probeIncr; /* Between linear and quadratic probing */                                                         \
    }

#define LITECASK_FIND_KEY_AND_DO_ACTION(parameterActionCode)                                     \
    uint32_t mask;                                                                               \
    int      idx;                                                                                \
    uint32_t probeIncr;                                                                          \
    if (keyHash < FirstValid) keyHash += FirstValid;                                             \
    Table* currentTable = ((_signalBitmap.load() & CurrentTableNbr) == 0) ? &_table0 : &_table1; \
    LITECASK_FIND_KEY_LOOP(parameterActionCode);                                                 \
    if (_signalBitmap.load() & UnderResizing) { /* Try the other table */                        \
        currentTable = (currentTable == &_table0) ? &_table1 : &_table0;                         \
        LITECASK_FIND_KEY_LOOP(parameterActionCode);                                             \
    }

#define LITECASK_FIND_HASH_LOOP(parameterActionCode)                                                                    \
    mask      = (currentTable->maxSize - 1) & (~(KeyDirAssocQty - 1));                                                  \
    idx       = keyHash & mask;                                                                                         \
    probeIncr = 1;                                                                                                      \
                                                                                                                        \
    while (true) {                                                                                                      \
        uint32_t cellId = 0;                                                                                            \
        for (; cellId < KeyDirAssocQty && currentTable->nodes[idx + cellId].hash >= FirstValid; ++cellId) {             \
            if (currentTable->nodes[idx + cellId].hash == keyHash) {                                                    \
                KeyChunk* keyChunk = getKey(currentTable->nodes[idx + cellId].loc);                                     \
                parameterActionCode;                                                                                    \
            }                                                                                                           \
        }                                                                                                               \
        if (cellId < KeyDirAssocQty) { break; } /* Empty space spotted on this cache line, so key has not been found */ \
        idx = (idx + (probeIncr * KeyDirAssocQty)) & mask;                                                              \
        ++probeIncr; /* Between linear and quadratic probing */                                                         \
    }

#define LITECASK_FIND_HASH_AND_DO_ACTION(parameterActionCode)                                    \
    uint32_t mask;                                                                               \
    int      idx;                                                                                \
    uint32_t probeIncr;                                                                          \
    if (keyHash < FirstValid) keyHash += FirstValid;                                             \
    Table* currentTable = ((_signalBitmap.load() & CurrentTableNbr) == 0) ? &_table0 : &_table1; \
    LITECASK_FIND_HASH_LOOP(parameterActionCode);                                                \
    if (_signalBitmap.load() & UnderResizing) { /* Try the other table */                        \
        currentTable = (currentTable == &_table0) ? &_table1 : &_table0;                         \
        LITECASK_FIND_HASH_LOOP(parameterActionCode);                                            \
    }

    void updateMergedValueLocation(uint32_t keyHash, uint16_t oldFileId, uint32_t oldFileOffset, uint16_t newFileId, uint32_t newFileOffset)
    {
        LITECASK_FIND_HASH_AND_DO_ACTION({
            if (keyChunk->fileId == oldFileId && keyChunk->fileOffset == oldFileOffset) {
                keyChunk->fileId     = newFileId;
                keyChunk->fileOffset = newFileOffset;
                return;
            }
            // Continue looking for another entry with the same hash in the keydir
        });
    }

    void updateCachedValueLocation(uint32_t keyHash, const void* key, uint16_t keySize, uint32_t checkValueSize, uint8_t checkChangeCounter,
                                   ValueLoc newCacheLocation)
    {
        LITECASK_FIND_KEY_AND_DO_ACTION({
            if (keyChunk->valueSize == checkValueSize && keyChunk->changeCounter == checkChangeCounter) {
                keyChunk->cacheLocation = newCacheLocation;
            }
            return;
        });
    }

    LITECASK_ATTRIBUTE_NO_SANITIZE_THREAD
    bool getKeyAndIndexes(uint32_t keyHash, lcVector<uint8_t>& key, lcVector<KeyIndex>& keyIndexes)
    {
        LITECASK_FIND_HASH_AND_DO_ACTION({
            bool     wasNotTheRightHash = false;
            uint32_t lockCounterBefore;
            do {
                lockCounterBefore     = _optimisticsCounters[keyHash & OptCounterMask];  // Optimistic locking
                uint32_t valueSize    = keyChunk->valueSize;
                uint16_t keySize      = keyChunk->keySize;
                uint8_t  keyIndexSize = keyChunk->keyIndexSize;

                // Ensure non corrupted sizes
                if ((lockCounterBefore & 0x1) == 0 && (_optimisticsCounters[keyHash & OptCounterMask]) == lockCounterBefore) {
                    if (valueSize == DeletedEntry || (keyChunk->expTimeSec > 0 && keyChunk->expTimeSec <= _nowTimeSec)) {
                        wasNotTheRightHash = true;  // The entry with matching hash is invalid. We continue looking for another entry.
                        continue;
                    }
                    key.resize(keySize);
                    memcpy(key.data(), ((uint8_t*)keyChunk) + sizeof(KeyChunk), keySize);
                    keyIndexes.resize(keyIndexSize);
                    if (keyIndexSize) { memcpy(keyIndexes.data(), ((uint8_t*)keyChunk) + sizeof(KeyChunk) + keySize, keyIndexSize); }
                }
            } while ((lockCounterBefore & 0x1) ||
                     (_optimisticsCounters[keyHash & OptCounterMask]) != lockCounterBefore);  // Odd means under write
            if (wasNotTheRightHash) { continue; }  // Continue looking for another entry in the keydir
            return true;
        });
        return false;
    }

    LITECASK_ATTRIBUTE_NO_SANITIZE_THREAD
    bool cleanIndex(uint32_t keyHash, const void* keyPart, uint16_t keyPartSize)
    {
        LITECASK_FIND_HASH_AND_DO_ACTION({
            if (keyChunk->valueSize != DeletedEntry && (keyChunk->expTimeSec == 0 || keyChunk->expTimeSec > _nowTimeSec)) {
                continue;  // The entry is valid, so no cleaning needed. We continue looking for an entry to clean.
            }

            // If entry is not deleted and the key part is found, then it shall be kept (also in the index)
            // Else, it shall be removed (if needed) and index updated.
            uint8_t* key     = (uint8_t*)keyChunk + sizeof(KeyChunk);
            uint8_t* kiArray = key + keyChunk->keySize;
            for (int kIdx = 0; kIdx < (int)keyChunk->keyIndexSize; kIdx += sizeof(KeyIndex)) {
                KeyIndex& ki = *(KeyIndex*)(kiArray + kIdx);
                if (ki.size != keyPartSize || memcmp(&key[ki.startIdx], keyPart, keyPartSize)) { continue; }
                // Key part is present
                // Case obsolete entry: the key part is removed (keeping the order)
                if (kIdx + sizeof(KeyIndex) < (int)keyChunk->keyIndexSize) {
                    memmove(&ki, (&ki) + sizeof(KeyIndex), ((int)keyChunk->keyIndexSize - (kIdx + sizeof(KeyIndex))));
                }
                assert(keyChunk->keyIndexSize >= (uint8_t)sizeof(KeyIndex));
                keyChunk->keyIndexSize -= (uint8_t)sizeof(KeyIndex);
                return true;  // Key part found and removed from the entry. The index definitely needs cleaning
            }

            continue;  // Key part is not found in this entry. We continue looking for an entry to clean
        });
        return true;  // No hash matching entry with such key part found. The index definitely needs cleaning
    }

    LITECASK_ATTRIBUTE_NO_SANITIZE_THREAD
    bool find(uint32_t keyHash, const void* key, uint16_t keySize, KeyChunk& entry)
    {
        LITECASK_FIND_KEY_AND_DO_ACTION({
            if (_isInstrumentationEnable) {
                if (probeIncr > _instrumentedProbeMax) { _instrumentedProbeMax = probeIncr; }
                _instrumentedProbeSum += probeIncr;
                ++_instrumentedFindCount;
            }
            uint32_t lockCounterBefore;
            do {
                lockCounterBefore = _optimisticsCounters[keyHash & OptCounterMask];  // Optimistic locking
                entry             = *keyChunk;
            } while ((lockCounterBefore & 0x1) ||
                     (_optimisticsCounters[keyHash & OptCounterMask]) != lockCounterBefore);  // Odd means under write
            return true;
        });
        return false;
    }

    bool invalidateExpiredTtl(uint32_t keyDirIndex, uint32_t& keyHash, uint32_t& keySize, uint32_t& oldValueSize, uint16_t& oldFileId,
                              ValueLoc& oldCacheLoc)
    {
        // Checks only in current table. An external lock shall ensure 1 writer at a time
        Table* currentTable = ((_signalBitmap.load() & CurrentTableNbr) == 0) ? &_table0 : &_table1;

        // Ensure that the entry is expired (whatever the entry), as indicated by the previous probing
        MapEntry& kde = currentTable->nodes[keyDirIndex];
        if (kde.hash < FirstValid) { return false; }
        KeyChunk* keyChunk = getKey(kde.loc);
        if (keyChunk->valueSize == DeletedEntry) { return false; }

        _optimisticsCounters[keyHash & OptCounterMask]++;

        // Copy some old values
        keyHash      = kde.hash;
        keySize      = keyChunk->keySize;
        oldValueSize = keyChunk->valueSize;
        oldFileId    = keyChunk->fileId;
        oldCacheLoc  = keyChunk->cacheLocation;

        // Invalidate the meta data chunk
        keyChunk->expTimeSec    = 0;
        keyChunk->valueSize     = DeletedEntry;
        keyChunk->cacheLocation = NotStored;

        _optimisticsCounters[keyHash & OptCounterMask]++;
        return true;
    }

    // Returns true when the entry is successfully stored. May fail if OOM
    LITECASK_ATTRIBUTE_NO_SANITIZE_THREAD
    Status insertEntry(uint32_t keyHash, const void* key, const void* keyIndexes, const KeyChunk& entry, OldKeyChunk& oldEntry)
    {
        if (keyHash < FirstValid) keyHash += FirstValid;
        oldEntry.isValid = false;

        // Insert only in current table. An external lock shall ensure 1 writer at a time
        Table*   currentTable = ((_signalBitmap.load() & CurrentTableNbr) == 0) ? &_table0 : &_table1;
        uint32_t mask         = (currentTable->maxSize - 1) & (~(KeyDirAssocQty - 1));
        int      idx          = keyHash & mask;
        uint32_t probeIncr    = 1;
        uint32_t cellId       = 0;

        while (true) {
            cellId = 0;
            while (cellId < KeyDirAssocQty && currentTable->nodes[idx + cellId].hash >= FirstValid) {
                if (currentTable->nodes[idx + cellId].hash == keyHash) {
                    KeyChunk* keyChunk = getKey(currentTable->nodes[idx + cellId].loc);
                    if (keyChunk->keySize == entry.keySize && !memcmp(((uint8_t*)keyChunk) + sizeof(KeyChunk), key, entry.keySize)) {
                        // Match found, entry update case
                        _optimisticsCounters[keyHash & OptCounterMask]++;

                        oldEntry.isValid       = true;
                        oldEntry.valueSize     = keyChunk->valueSize;
                        oldEntry.cacheLocation = keyChunk->cacheLocation;
                        oldEntry.fileId        = keyChunk->fileId;
                        oldEntry.keyIndexQty   = (uint16_t)((int)keyChunk->keyIndexSize / sizeof(KeyIndex));
                        if (oldEntry.keyIndexQty) {
                            memcpy(&oldEntry.keyIndexes, ((uint8_t*)keyChunk) + sizeof(KeyChunk) + keyChunk->keySize,
                                   keyChunk->keyIndexSize);
                        }
                        Status storageStatus = updateKey(key, keyIndexes, entry, currentTable->nodes[idx + cellId].loc);

                        _optimisticsCounters[keyHash & OptCounterMask]++;
                        return storageStatus;
                    }
                }
                ++cellId;
            }
            if (cellId < KeyDirAssocQty) { break; } /* Empty space spotted on this cache line, so key has not been found */
            idx = (idx + (probeIncr * KeyDirAssocQty)) & mask;
            ++probeIncr;  // Between linear and quadratic probing
        }

        KeyLoc keyLoc        = NotStored;
        Status storageStatus = insertKey(key, keyIndexes, entry, keyLoc);
        if (storageStatus != Status::Ok) { return storageStatus; }  // Failure to store the key due to OOM or too big key
        // No need for protection vs "get" as there is no key removal API (tombstone instead)
        assert(cellId < KeyDirAssocQty && currentTable->nodes[idx + cellId].hash < FirstValid);
        currentTable->nodes[idx + cellId] = {keyHash, keyLoc};

        currentTable->size += 1;
        if ((uint64_t)128 * (_table0.size + _table1.size) > _maxLoadFactor128th * currentTable->maxSize) {
            resize(2 * currentTable->maxSize);
        }
        return Status::Ok;
    }

    void resize(uint32_t newMaxSize)
    {
        // Emergency case: if the next resize arrives and the previous is not finished, just force-finish it
        constexpr uint32_t EmergencyBatchSize = 1'000'000;
        if (isResizingOngoing()) {
            while (isResizingOngoing()) { backgroundResizeWork(EmergencyBatchSize, true); }
        }

        // Allocate the new table
        Table* newTable = ((_signalBitmap.load() & CurrentTableNbr) == 0) ? &_table1 : &_table0;
        delete[] newTable->allocPtr;
        newTable->allocPtr = new uint8_t[newMaxSize * sizeof(MapEntry) + detail::CpuCacheLine];       // For cache-line aligned base pointer
        newTable->nodes = (MapEntry*)((((uintptr_t)newTable->allocPtr) + detail::CpuCacheLine - 1) &  // NOLINT(performance-no-int-to-ptr)
                                      (~(detail::CpuCacheLine - 1)));
        memset(newTable->nodes, 0, sizeof(MapEntry) * newMaxSize);
        newTable->maxSize = newMaxSize;
        newTable->size    = 0;

        // Start the background resizing process
        _resizeNextIdx = 0;
        if (_table0.size != 0 || _table1.size != 0) {
            _signalBitmap.store(UnderResizing | (_signalBitmap.load() ^ CurrentTableNbr));
            _notifyResizing(newMaxSize, true, false);  // Notify the start of the resizing job
        } else {
            // Construction time (empty tables)
            _signalBitmap.store(_signalBitmap.load() ^ CurrentTableNbr);
        }
    }

    // Note: writer lock is expected to be taken
    void backgroundResizeWork(uint32_t batchSize, bool wasForced = false)
    {
        assert(batchSize > 0);
        if (!isResizingOngoing()) { return; }

        Table*   oldTable   = ((_signalBitmap.load() & CurrentTableNbr) == 0) ? &_table1 : &_table0;
        Table*   newTable   = (oldTable == &_table0) ? &_table1 : &_table0;
        uint32_t newMask    = (newTable->maxSize - 1) & (~(KeyDirAssocQty - 1));
        uint32_t lastOldIdx = std::min(_resizeNextIdx + batchSize, oldTable->maxSize);

        // Transfer a batch of data
        for (uint32_t oldIdx = _resizeNextIdx; oldIdx < lastOldIdx; ++oldIdx) {
            if (oldTable->nodes[oldIdx].hash < FirstValid) continue;

            uint32_t newIdx    = oldTable->nodes[oldIdx].hash & newMask;
            uint32_t probeIncr = 1;
            uint32_t cellId    = 0;

            while (true) {
                cellId = 0;
                while (cellId < KeyDirAssocQty && newTable->nodes[newIdx + cellId].hash >= FirstValid) ++cellId;
                if (cellId < KeyDirAssocQty) { break; }  // Empty space spotted on this cache line
                newIdx = (newIdx + (probeIncr * KeyDirAssocQty)) & newMask;
                ++probeIncr;
            }

            assert(cellId < KeyDirAssocQty && newTable->nodes[newIdx + cellId].hash < FirstValid);
            newTable->nodes[newIdx + cellId] = oldTable->nodes[oldIdx];
            newTable->size += 1;
            oldTable->size -= 1;  // So that the sum of the sizes is accurate
        }

        _resizeNextIdx = lastOldIdx;
        if (lastOldIdx == oldTable->maxSize) {
            oldTable->size = 0;                                    // Cleared table
            _notifyResizing(newTable->maxSize, false, wasForced);  // Notify the end of the resizing job
            _signalBitmap.store((~UnderResizing) & _signalBitmap.load());
        }
    }

    uint32_t backgroundExpiredKeyCleaning(uint32_t& batchSize)
    {
        assert(batchSize > 0);

        Table*   table   = ((_signalBitmap.load() & CurrentTableNbr) == 0) ? &_table0 : &_table1;
        uint32_t lastIdx = std::min(_ttlNextIdx + batchSize, table->maxSize);

        // Analyze a batch of data
        for (uint32_t idx = _ttlNextIdx; idx < lastIdx; ++idx, --batchSize) {
            // Skip entries which are empty, without TTL, or not expired TTL
            if (table->nodes[idx].hash < FirstValid) { continue; }
            KeyChunk* keyChunk = getKey(table->nodes[idx].loc);
            if (keyChunk->valueSize == DeletedEntry || keyChunk->expTimeSec == 0 || keyChunk->expTimeSec > _nowTimeSec) { continue; }

            // Return the entry to remove, after checking again (under lock) that the TTL is indeed expired
            // The data race condition is harmless, just a little waste of CPU if this probing is defeated later
            _ttlNextIdx = (idx + 1 >= table->maxSize) ? 0 : idx + 1;
            return idx;
        }

        _ttlNextIdx = (lastIdx >= table->maxSize) ? 0 : lastIdx;
        batchSize   = 0;
        return NotStored;
    }

    bool isResizingOngoing() const { return (_signalBitmap.load() & UnderResizing); }

    // Above this load factor, the KeyDir will get resized
    bool setMaxLoadFactor(double f)
    {
        if (f <= 0. || f > 1.) return false;
        _maxLoadFactor128th = (uint64_t)(128. * f);
        return true;
    }

    double getLoadFactor() const
    {
        return (double)(_table0.size + _table1.size) / (double)std::max(std::max(_table0.maxSize, _table1.maxSize), 1U);
    }

    uint64_t getEstimatedUsedMemoryBytes() const
    {
        return sizeof(MapEntry) * (_table0.maxSize + _table1.maxSize) + _tlsfAlloc.getAllocatedBytes();
    }

    // Only enabled in tests, to analyse the probing of the hash table when reading some entries
    void setInstrumentationEnable(bool isEnable) { _isInstrumentationEnable = isEnable; }

    // It returns the monotonic counters of probe count and find API call count, and the max probe count per call since the last
    // getProbeCount call
    void getProbeCount(uint64_t& probeMax, uint64_t& probeSum, uint64_t& findCount)
    {
        probeMax              = _instrumentedProbeMax;
        _instrumentedProbeMax = 0;
        probeSum              = _instrumentedProbeSum;
        findCount             = _instrumentedFindCount;
    }

    void setNow(uint32_t nowTimeSec) { _nowTimeSec = nowTimeSec; }

   private:
    KeyChunk* getKey(KeyLoc loc) const { return (KeyChunk*)_tlsfAlloc.uncompress(loc); }

    Status insertKey(const void* key, const void* keyIndexes, const KeyChunk& entry, KeyLoc& loc)
    {
        uint32_t targetSize = (uint32_t)(sizeof(KeyChunk) + entry.keySize + entry.keyIndexSize);
        uint8_t* ptr        = (uint8_t*)_tlsfAlloc.malloc(targetSize);
        if (ptr == nullptr) { return Status::OutOfMemory; }
        loc         = _tlsfAlloc.compress(ptr);
        KeyChunk* c = (KeyChunk*)ptr;
        *c          = entry;
        c->changeCounter += 1;
        memcpy(ptr + sizeof(KeyChunk), key, entry.keySize);
        if (entry.keyIndexSize) { memcpy(ptr + sizeof(KeyChunk) + entry.keySize, keyIndexes, entry.keyIndexSize); }
        return Status::Ok;
    }

    Status updateKey(const void* key, const void* keyIndexes, const KeyChunk& entry, KeyLoc& locToUpdate)
    {
        KeyChunk* keyChunk = getKey(locToUpdate);

        uint32_t accessibleKeyIndexSize = (uint32_t)(_tlsfAlloc.getRealAllocatedSize(keyChunk) - sizeof(KeyChunk) - entry.keySize);
        if (entry.keyIndexSize > accessibleKeyIndexSize) {
            // New allocation required because the current one is too small
            KeyLoc newKeyLoc     = NotStored;
            Status storageStatus = insertKey(key, keyIndexes, entry, newKeyLoc);
            if (storageStatus != Status::Ok) { return storageStatus; }  // Failure to store the key due to OOM
            KeyLoc oldKeyLoc = locToUpdate;
            locToUpdate      = newKeyLoc;

            // Invalidate and free the old chunk
            memset(keyChunk, 0, sizeof(KeyChunk));
            keyChunk->cacheLocation = NotStored;
            keyChunk->fileOffset    = NotStored;
            keyChunk->fileId        = 0xFFFF;
            _tlsfAlloc.free(_tlsfAlloc.uncompress(oldKeyLoc));
        } else if (entry.valueSize == DeletedEntry) {
            // For deletion, we keep the previous key index. Setting back the size is enough.
            // This is needed to avoid multiple entries in the index lookups if this entry is added back later
            // with some matching key indexes.
            uint8_t oldKeyIndexSize = keyChunk->keyIndexSize;
            *keyChunk               = entry;
            keyChunk->keyIndexSize  = oldKeyIndexSize;
            keyChunk->changeCounter += 1;
        } else {
            *keyChunk = entry;
            keyChunk->changeCounter += 1;
            if (entry.keyIndexSize) { memcpy(((uint8_t*)keyChunk) + sizeof(KeyChunk) + entry.keySize, keyIndexes, entry.keyIndexSize); }
        }
        return Status::Ok;
    }

    // Definitions
    struct Table {
        MapEntry* nodes    = nullptr;  // Cache line aligned
        uint32_t  size     = 0;
        uint32_t  maxSize  = 0;
        uint8_t*  allocPtr = nullptr;  // May not be aligned on a cache line
    };

    // Constants
    static constexpr int OptCounterQty   = 8192;
    static constexpr int OptCounterMask  = OptCounterQty - 1;
    static constexpr int CurrentTableNbr = (1 << 0);
    static constexpr int UnderResizing   = (1 << 1);

    // Fields
    alignas(CpuCacheLine) Table _table0;
    Table                 _table1;
    uint64_t              _maxLoadFactor128th = (uint64_t)(0.90 * 128);  // 90% load factor with 8-associativity is ok
    std::atomic<uint64_t> _signalBitmap       = 0;                       // Table 0 and not resizing
    uint32_t              _resizeNextIdx      = 0;
    uint32_t              _ttlNextIdx         = 0;
    uint32_t              _nowTimeSec         = 0;

    alignas(CpuCacheLine) std::array<std::atomic<uint32_t>, OptCounterQty> _optimisticsCounters = {0};
    std::function<void(uint32_t, bool, bool)> _notifyResizing;

    TlsfAllocator _tlsfAlloc;
    bool          _isInstrumentationEnable = false;
    uint64_t      _instrumentedProbeMax    = 0;
    uint64_t      _instrumentedProbeSum    = 0;
    uint64_t      _instrumentedFindCount   = 0;
};

}  // namespace detail

// ==========================================================================================
// Datastore
// ==========================================================================================

class Datastore  // NOLINT(clang-analyzer-optin.performance.Padding)  Padding is not optimal due to the alignas directives
{
   public:
    Datastore(size_t cacheBytes = 256 * 1024 * 1024)
    {
        _upkeepLastActiveFlushedTimeMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
        setLogHandler({});  // Install the default handler

        constexpr uint32_t initialMapSize = 16 * 1024;
        _writeBuffer.resize(detail::DefaultWriteBufferBytes);
        _keyDir = new detail::KeyDirMap(detail::KeyStorageAllocBytes, initialMapSize, [&](uint32_t newSize, bool isStart, bool wasForced) {
            notifyKeyDirResizing(newSize, isStart, wasForced);
        });
        _valueCache = new detail::ValueCache((uint64_t)cacheBytes);
        _indexMap   = new detail::IndexMap(detail::KeyStorageAllocBytes, initialMapSize);

        updateNow();
    }

    ~Datastore()
    {
        if (_isInitialized) { close(); }
        delete _keyDir;
        delete _valueCache;
        delete _indexMap;
    }

    // Observability
    // ==========================================================================================

    void dumpFd(bool withIndex = false)
    {
        using namespace litecask::detail;
        _mxDataFiles.lockRead();
        for (uint32_t fileId = 0; fileId < _dataFiles.size(); ++fileId) {
            DataFile* dfd = _dataFiles[fileId];
            dfd->dump(withIndex ? fileId : -1, fileId == _activeDataFileId);
        }
        _mxDataFiles.unlockRead();
    }

    DataFileStats getFileStats() const
    {
        using namespace litecask::detail;
        DataFileStats stats;
        _mxDataFiles.lockRead();

        for (uint32_t fileId = 0; fileId < _dataFiles.size(); ++fileId) {
            DataFile* dfd = _dataFiles[fileId];
            if (!osIsValidHandle(dfd->handle)) continue;

            stats.fileQty += 1;
            stats.entries += dfd->entries;
            stats.entryBytes += dfd->bytes;
            stats.tombBytes += dfd->tombBytes;
            stats.tombEntries += dfd->tombEntries;
            stats.deadBytes += dfd->deadBytes;
            stats.deadEntries += dfd->deadEntries;
        }

        _mxDataFiles.unlockRead();
        return stats;
    }

    Config getConfig() const { return _config; }

    const DatastoreCounters& getCounters() const { return _stats; }

    const ValueCacheCounters& getValueCacheCounters() const { return _valueCache->getCounters(); }

    uint64_t getValueCacheAllocatedBytes() const { return _valueCache->getAllocatedBytes(); }

    uint64_t getValueCacheMaxAllocatableBytes() const { return _valueCache->getMaxAllocatableBytes(); }

    // Returns an estimate of the memory usage
    uint64_t getEstimatedUsedMemoryBytes(bool withCache = false) const
    {
        uint64_t usedMem = 0;
        _mxDataFiles.lockRead();
        usedMem += sizeof(detail::DataFile) * _dataFiles.size();  // Data files storage (small)
        _mxDataFiles.unlockRead();
        usedMem += _keyDir->getEstimatedUsedMemoryBytes();    // KeyDirMap (big)
        usedMem += _indexMap->getEstimatedUsedMemoryBytes();  // Index Map (may be big, depends on index usage)
        usedMem += _writeBuffer.size() * sizeof(uint8_t);     // Write buffers (small)
        if (withCache) {
            usedMem += _valueCache->getAllocatedBytes();  // Value cache storage (depends on config)
        }
        return usedMem;
    }

    bool setLogLevel(LogLevel level)
    {
        if (level >= LogLevel::Debug && level <= LogLevel::None) {
            _logLevel = level;
            return true;
        }
        return false;
    }

    void setLogHandler(const std::function<void(LogLevel, const char*, bool)>& logHandler)
    {
        if (logHandler) {
            _logHandler = logHandler;
        } else {
            _logHandler = [&](LogLevel level, const char* message, bool closeDbNotification) {
                defaultLogHandler(level, message, closeDbNotification);
            };
        }
    }

    static const char* toString(Status status)
    {
        switch (status) {
            case Status::Ok:
                return "Ok";
            case Status::StoreNotOpen:
                return "datastore is not open";
            case Status::StoreAlreadyOpen:
                return "datastore is already open";
            case Status::BadDiskAccess:
                return "bad disk access";
            case Status::CannotOpenStore:
                return "cannot access the datastore directory path";
            case Status::StoreAlreadyInUse:
                return "datastore already open and locked by another process";
            case Status::BadKeySize:
                return "key size is out of bounds";
            case Status::InconsistentKeyIndex:
                return "key indexes are inconsistent";
            case Status::UnorderedKeyIndex:
                return "key indexes are not ordered";
            case Status::BadValueSize:
                return "value size is out of bounds";
            case Status::EntryNotFound:
                return "entry has not be found";
            case Status::EntryCorrupted:
                return "entry is corrupted";
            case Status::BadParameterValue:
                return "bad parameter value";
            case Status::InconsistentParameterValues:
                return "inconsistent parameter values";
            case Status::OutOfMemory:
                return "operation failed due to out of memory";
            default:
                return "UNKNOWN";
        }
    }

    // Configuration
    // ==========================================================================================

    // Defines the buffer size to write entries and batch the costly disk access.
    // This optimization is effective as each disk write system call has a fixed base cost.
    // Too big a size may create spikes of latency when flushing the buffer, too small a size reduces write throughput performance.
    // In practice small values are enough to amortize the system calls
    Status setWriteBufferBytes(uint32_t writeBufferBytes)
    {
        _mxWriteBuffer.lockWrite();
        flushWriteBufferUnlocked();
        _writeBuffer.resize(writeBufferBytes);
        _mxWriteBuffer.unlockWrite();
        return Status::Ok;
    }

    Status setConfig(const Config& config)
    {
        if (config.dataFileMaxBytes < detail::MinDataFileMaxBytes) {
            log(LogLevel::Warn, "setConfig: too small 'dataFileMaxBytes' parameter value. Shall be above %d", detail::MinDataFileMaxBytes);
            return Status::BadParameterValue;
        }
        if (config.mergeCyclePeriodMs == 0) {
            log(LogLevel::Warn, "setConfig: 'mergeCyclePeriodMs' shall be a positive integer.");
            return Status::BadParameterValue;
        }
        if (config.upkeepCyclePeriodMs == 0) {
            log(LogLevel::Warn, "setConfig: 'upkeepCyclePeriodMs' shall be a positive integer.");
            return Status::BadParameterValue;
        }
        if (config.upkeepKeyDirBatchSize == 0) {
            log(LogLevel::Warn, "setConfig: 'upkeepKeyDirBatchSize' shall be a positive integer.");
            return Status::BadParameterValue;
        }
        if (config.upkeepValueCacheBatchSize == 0) {
            log(LogLevel::Warn, "setConfig: 'upkeepValueCacheBatchSize' shall be a positive integer.");
            return Status::BadParameterValue;
        }
        if (config.valueCacheTargetMemoryLoadPercentage > 100) {
            log(LogLevel::Warn, "setConfig: 'valueCacheTargetMemoryLoadPercentage' shall be in the range [0; 100]");
            return Status::BadParameterValue;
        }
        if (config.mergeTriggerDataFileFragmentationPercentage < 1 || config.mergeTriggerDataFileFragmentationPercentage > 100) {
            log(LogLevel::Warn, "setConfig: 'mergeTriggerDataFileFragmentationPercentage' shall be in the range ]0; 100].");
            return Status::BadParameterValue;
        }
        if (config.mergeTriggerDataFileDeadByteThreshold > config.dataFileMaxBytes) {
            log(LogLevel::Warn,
                "setConfig: too big 'mergeTriggerDataFileDeadByteThreshold' parameter value. Shall be below dataFileMaxBytes=%d",
                config.dataFileMaxBytes);
            return Status::InconsistentParameterValues;
        }
        if (config.mergeSelectDataFileFragmentationPercentage < 1 || config.mergeSelectDataFileFragmentationPercentage > 100) {
            log(LogLevel::Warn, "setConfig: 'mergeSelectDataFileFragmentationPercentage' shall be in the range ]0; 100].");
            return Status::BadParameterValue;
        }
        if (config.mergeSelectDataFileFragmentationPercentage > config.mergeTriggerDataFileFragmentationPercentage) {
            log(LogLevel::Warn,
                "setConfig: too big 'mergeSelectDataFileFragmentationPercentage' parameter value. Shall be below "
                "mergeTriggerDataFileFragmentationPercentage=%d",
                config.mergeTriggerDataFileFragmentationPercentage);
            return Status::InconsistentParameterValues;
        }
        if (config.mergeSelectDataFileDeadByteThreshold > config.mergeTriggerDataFileDeadByteThreshold) {
            log(LogLevel::Warn,
                "setConfig: too big 'mergeSelectDataFileDeadByteThreshold' parameter value. Shall be below "
                "mergeTriggerDataFileDeadByteThreshold=%d",
                config.mergeTriggerDataFileDeadByteThreshold);
            return Status::InconsistentParameterValues;
        }
        if (config.mergeSelectDataFileSmallSizeTheshold < detail::MinDataFileMaxBytes) {
            log(LogLevel::Warn, "setConfig: too small 'mergeSelectDataFileSmallSizeTheshold' parameter value. Shall be above %d",
                detail::MinDataFileMaxBytes);
            return Status::BadParameterValue;
        }

        // Accepted config
        _mxConfig.lock();
        _config           = config;
        _dataFileMaxBytes = (uint64_t)config.dataFileMaxBytes;  // Harmless data race (integrity is ensured)
        _valueCache->setTargetMemoryLoad(0.01 * config.valueCacheTargetMemoryLoadPercentage);
        _mxConfig.unlock();
        return Status::Ok;
    }

    // Open and close
    // ==========================================================================================

    Status open(fs::path dbDirectoryPath, bool doCreateIfNotExist = true)
    {
        using namespace litecask::detail;
        if (_isInitialized) {
            ++_stats.openCallFailedQty;
            log(LogLevel::Error, "'open' failed: %s", toString(Status::StoreAlreadyOpen));
            return Status::StoreAlreadyOpen;
        }

        // Input directory massaging
        std::error_code ec;
        dbDirectoryPath /= "";
        if (!fs::exists(dbDirectoryPath) && doCreateIfNotExist) { fs::create_directories(dbDirectoryPath, ec); }
        if (!fs::exists(dbDirectoryPath) || !fs::is_directory(dbDirectoryPath, ec)) {
            ++_stats.openCallFailedQty;
            log(LogLevel::Error, "'open' failed: %s", toString(Status::CannotOpenStore));
            return Status::CannotOpenStore;
        }

        // Lock the database via a lock file
        Status s = lockDatabase(dbDirectoryPath);
        if (s != Status::Ok) {
            ++_stats.openCallFailedQty;
            log(LogLevel::Error, "'open' failed: unable to lock the datastore, %s.", toString(s));
            return s;
        }

        lcVector<lcString> baseDataFilenames;
        s = sanitizeAndCollectDataFiles(dbDirectoryPath, _maxDataFileIndex, baseDataFilenames);
        if (s != Status::Ok) {
            ++_stats.openCallFailedQty;
            log(LogLevel::Error, "'open' failed: unable to clean the datastore, %s.", toString(s));
            return s;
        }

        if (!doCreateIfNotExist && baseDataFilenames.empty()) {
            ++_stats.openCallFailedQty;
            log(LogLevel::Error, "'open' failed because there is no datastore at the provided path.");
            unlockDatabase(dbDirectoryPath);
            return Status::CannotOpenStore;
        }

        // Reset all fields
        _directory = dbDirectoryPath;
        _keyDir->reset();
        _valueCache->reset();
        for (detail::DataFile* dfd : _dataFiles) delete dfd;
        _dataFiles.clear();
        _freeDataFileIds.clear();
        _activeDataOffset        = 0;
        _activeFlushedDataOffset = 0;
        _activeDataFileId        = 0xFFFF;
        _mergeWork.store(false);
        _mergeExit.store(false);
        _upkeepWork.store(false);
        _upkeepExit.store(false);
        _someHintFilesAreMissing           = false;
        _upkeepLastActiveFlushedDataOffset = NotStored;
        _upkeepLastActiveDataFileId        = 0xFFFF;
        updateNow();

        lcVector<LoadedKeyChunk> keyDirEntries;
        keyDirEntries.reserve(16384);
        ArenaAllocator loadArena;

        // Loop on data files to load
        for (const auto& baseDataFilename : baseDataFilenames) {
            uint16_t fileId = getFreeDataFileIdUnlocked();
            loadArena.reset();

            // Check for hint file
            if (!loadHintFile(baseDataFilename + HintFileSuffix, fileId, loadArena, keyDirEntries)) {
                // Hint file failed or does not exist, let's load directly the data file
                _someHintFilesAreMissing = true;
                if (!loadDataFile(baseDataFilename + DataFileSuffix, fileId, loadArena, keyDirEntries)) {
                    ++_stats.openCallFailedQty;
                    log(LogLevel::Error, "'open' failed: unable to read the datastore.");
                    return Status::CannotOpenStore;
                }
            }

            // Create the data file descriptor
            DataFile* newFd = _dataFiles[fileId];
            newFd->filename = baseDataFilename + DataFileSuffix;
            newFd->handle   = osOsOpen(newFd->filename, OsOpenMode::READ);
            assert(osIsValidHandle(newFd->handle));
            KeyChunk    entryToErase;
            OldKeyChunk oldEntry;

            // Populate the key directory
            for (uint32_t entryIdx = 0; entryIdx < keyDirEntries.size(); ++entryIdx) {
                const LoadedKeyChunk& entry   = keyDirEntries[entryIdx];
                uint16_t              keySize = entry.metadata.keySize;

                if (entry.metadata.valueSize == DeletedEntry) {
                    // Deletion case
                    if (_keyDir->find(entry.keyHash, entry.key, entry.metadata.keySize, entryToErase)) {
                        // As there is an entry in the KeyDir, a tombstone is required instead
                        _dataFiles[entryToErase.fileId]->deadBytes +=
                            sizeof(DataFileEntry) +
                            ((entryToErase.valueSize == DeletedEntry) ? keySize : (keySize + entryToErase.valueSize));
                        _dataFiles[entryToErase.fileId]->deadEntries += 1;
                        _keyDir->insertEntry(entry.keyHash, entry.key, entry.keyIndexes, entry.metadata, oldEntry);
                    } else {
                        // No entry present in KeyDir, so no tombstone added there
                        newFd->deadBytes += sizeof(DataFileEntry) + keySize;
                        newFd->deadEntries += 1;
                    }
                    newFd->tombBytes += (uint32_t)sizeof(DataFileEntry) + keySize;
                    newFd->tombEntries += 1;
                    newFd->bytes += (uint32_t)sizeof(DataFileEntry) + keySize;
                    newFd->entries += 1;
                }

                else if (entry.metadata.expTimeSec == 0 || entry.metadata.expTimeSec > _nowTimeSec) {
                    // Value case
                    if (_keyDir->insertEntry(entry.keyHash, entry.key, entry.keyIndexes, entry.metadata, oldEntry) == Status::Ok &&
                        oldEntry.isValid) {
                        // Replace an entry: update file descriptors
                        _dataFiles[oldEntry.fileId]->deadBytes +=
                            sizeof(DataFileEntry) + ((oldEntry.valueSize == DeletedEntry) ? keySize : (keySize + oldEntry.valueSize));
                        _dataFiles[oldEntry.fileId]->deadEntries += 1;
                    }
                    newFd->bytes += (uint32_t)sizeof(DataFileEntry) + keySize + entry.metadata.valueSize;
                    newFd->entries += 1;
                }

                else {
                    // Expired TTL case
                    newFd->deadBytes += (uint32_t)sizeof(DataFileEntry) + keySize + entry.metadata.valueSize;
                    newFd->deadEntries += 1;
                    newFd->bytes += (uint32_t)sizeof(DataFileEntry) + keySize + entry.metadata.valueSize;
                    newFd->entries += 1;
                }
            }
        }

        // Finalize
        createNewActiveDataFileUnlocked();
        _mergeThread   = std::thread(&Datastore::mergeThreadEntry, this);
        _upkeepThread  = std::thread(&Datastore::upkeepThreadEntry, this);
        _isInitialized = true;
        ++_stats.openCallQty;
        log(LogLevel::Info, "Datastore successfully opened");
        return Status::Ok;
    }

    Status close()
    {
        using namespace litecask::detail;

        if (!_isInitialized) {
            ++_stats.closeCallFailedQty;
            log(LogLevel::Error, "'close' failed: %s", toString(Status::StoreNotOpen));
            return Status::StoreNotOpen;
        }
        log(LogLevel::Info, "Closing datastore");

        // Stop the maintenance threads
        {
            std::unique_lock<std::mutex> lk(_mergeMutex);
            _mergeExit.store(true);
            _mergeCv.notify_one();
        }
        {
            std::unique_lock<std::mutex> lk(_upkeepMutex);
            _upkeepExit.store(true);
            _upkeepCv.notify_one();
        }
        _mergeThread.join();
        _upkeepThread.join();
        _mergeExit.store(false);
        _upkeepExit.store(false);

        // Lock the database and make it uninitialized
        _mxActiveFile.lock();
        _mxDataFiles.lockWrite();
        _mxKeyDir.lock();
        _isInitialized = false;

        // Clean the data file
        _mxWriteBuffer.lockWrite();
        flushWriteBufferUnlocked();
        _mxWriteBuffer.unlockWrite();
        for (auto* dfd : _dataFiles) {
            if (osIsValidHandle(dfd->handle)) {
                osOsClose(dfd->handle);
                dfd->handle = InvalidFileHandle;
            }
            delete dfd;
        }
        _dataFiles.clear();
        _logHandler(LogLevel::Info, "closing", true);

        // Resetting all fields
        _activeDataOffset        = 0;
        _activeDataFileId        = 0;
        _activeFlushedDataOffset = 0;

        unlockDatabase(_directory);

        // Reset the state
        _directory.clear();

        _mxKeyDir.unlock();
        _mxDataFiles.unlockWrite();
        _mxActiveFile.unlock();
        ++_stats.closeCallQty;
        return Status::Ok;
    }

    // Access API: put, remove, get
    // ==========================================================================================

    Status put(const void* key, size_t keySize, const void* value, size_t valueSize, const lcVector<KeyIndex>& keyIndexes = {},
               uint32_t ttlSec = 0, bool forceDiskSync = false)
    {
        using namespace litecask::detail;

        if (keySize == 0 || keySize >= USHRT_MAX) {
            ++_stats.putCallFailedQty;
            return Status::BadKeySize;
        }
        if (keyIndexes.size() > MaxKeyIndexQty) {
            ++_stats.putCallFailedQty;
            return Status::InconsistentKeyIndex;
        }
        KeyIndex lastIdx{0, 0};
        for (const KeyIndex& ki : keyIndexes) {
            if (ki.size == 0 || ki.startIdx + ki.size > keySize) {
                ++_stats.putCallFailedQty;
                return Status::InconsistentKeyIndex;
            }
            if (ki.startIdx < lastIdx.startIdx || (ki.startIdx == lastIdx.startIdx && ki.size <= lastIdx.size)) {
                ++_stats.putCallFailedQty;
                return Status::UnorderedKeyIndex;
            }
            lastIdx = ki;
        }
        if (valueSize >= detail::MaxValueSize) {
            ++_stats.putCallFailedQty;
            return Status::BadValueSize;
        }

        uint64_t keyHash  = LITECASK_HASH_FUNC(key, keySize);
        uint32_t checksum = (uint32_t)(keyHash ^ LITECASK_HASH_FUNC(value, valueSize));

        _mxActiveFile.lock();
        if (!_isInitialized) {
            _mxActiveFile.unlock();
            ++_stats.putCallFailedQty;
            return Status::StoreNotOpen;
        }

        // Check that the limit of the data file size is not exceeded (taking into account the 64 overflow)
        // The only exception is if we are at the beginning of a new file, so that any entry size can fit the data file
        if (_activeDataOffset > 0 &&
            (uint64_t)_activeDataOffset + sizeof(DataFileEntry) + (uint64_t)keySize + (uint64_t)valueSize >= _dataFileMaxBytes) {
            createNewActiveDataFileUnlocked();  // Now the entry can be written whatever its size (new file)
        }

        _mxDataFiles.lockRead();
        lcOsFileHandle fh = _dataFiles[_activeDataFileId]->handle;
        assert(osIsValidHandle(fh));

        // Write entry in the memory write buffer
        _mxWriteBuffer.lockWrite();
        size_t keyIndexSize = keyIndexes.size() * sizeof(KeyIndex);
        if ((_activeDataOffset - _activeFlushedDataOffset) + (sizeof(DataFileEntry) + keySize + keyIndexSize + valueSize) >
            _writeBuffer.size()) {
            flushWriteBufferUnlocked();
        }

        uint32_t      expTimeSec = (ttlSec == 0) ? 0 : ttlSec + _nowTimeSec;
        DataFileEntry dfe{checksum, expTimeSec, (uint32_t)valueSize, (uint16_t)keySize, (uint8_t)keyIndexSize, 0};
        uint32_t      entryActiveDataOffset = _activeDataOffset;
        uint16_t      entryActiveDataFileId = _activeDataFileId;
        assert(_activeDataOffset >= _activeFlushedDataOffset);

        if ((_activeDataOffset - _activeFlushedDataOffset) + (sizeof(DataFileEntry) + keySize + keyIndexSize + valueSize) <=
            _writeBuffer.size()) {
            // Store in the write buffer
            uint32_t dataOffset = _activeDataOffset - _activeFlushedDataOffset;
            memcpy(&_writeBuffer[dataOffset], &dfe, sizeof(DataFileEntry));
            memcpy(&_writeBuffer[dataOffset + sizeof(DataFileEntry)], key, keySize);
            if (keyIndexSize > 0) {
                memcpy(&_writeBuffer[dataOffset + sizeof(DataFileEntry) + keySize], (uint8_t*)keyIndexes.data(), keyIndexSize);
            }
            if (valueSize > 0) { memcpy(&_writeBuffer[dataOffset + sizeof(DataFileEntry) + keySize + keyIndexSize], value, valueSize); }

            // Update the active offset
            _activeDataOffset += (uint32_t)(sizeof(DataFileEntry) + keySize + keyIndexSize + valueSize);
            if (forceDiskSync) { flushWriteBufferUnlocked(); }
        }

        else {
            // Too big entry: the write buffer has already been synced-flushed, so the entry is directly written in the file
            assert(_activeDataOffset == _activeFlushedDataOffset);
            if (!osOsWrite(fh, &dfe, sizeof(DataFileEntry)) || !osOsWrite(fh, key, keySize)) {
                fatalHandler("Put: Unable to write the header and key (size=%" PRId64 ") in the datafile", keySize);
            }
            if (keyIndexSize > 0 && !osOsWrite(fh, (uint8_t*)keyIndexes.data(), keyIndexSize)) {
                fatalHandler("Put: Unable to write the key indexes (size=%" PRId64 ") in the datafile", keyIndexSize);
            }
            if (valueSize > 0 && !osOsWrite(fh, value, valueSize)) {
                fatalHandler("Put: Unable to write the value (size=%" PRId64 ") in the datafile", valueSize);
            }

            // Update the offsets (flush also) after this unoptimized write
            _activeDataOffset += (uint32_t)(sizeof(DataFileEntry) + keySize + keyIndexSize + valueSize);
            _activeFlushedDataOffset = _activeDataOffset;
        }

        _mxWriteBuffer.unlockWrite();

        // Update active data file stats
        _dataFiles[entryActiveDataFileId]->bytes += (uint32_t)(sizeof(DataFileEntry) + keySize + keyIndexSize + valueSize);
        _dataFiles[entryActiveDataFileId]->entries += 1;

        _mxDataFiles.unlockRead();
        _mxActiveFile.unlock();

        // Push in cache
        ValueLoc cacheLoc = NotStored;
        if (_valueCache->isEnabled()) { cacheLoc = _valueCache->insertValue(value, (uint32_t)valueSize, keyHash, expTimeSec); }

        // Update the KeyDir
        OldKeyChunk oldEntry;
        _mxKeyDir.lock();
        Status storageStatus = _keyDir->insertEntry((uint32_t)keyHash, key, keyIndexes.data(),
                                                    {expTimeSec, (uint32_t)valueSize, cacheLoc, entryActiveDataOffset,
                                                     entryActiveDataFileId, (uint16_t)keySize, (uint8_t)keyIndexSize, (uint8_t)checksum},
                                                    oldEntry);
        _mxKeyDir.unlock();

        if (storageStatus != Status::Ok) {  // Can be too big a key (precise check done here) or out of memory
            if (storageStatus == Status::OutOfMemory) {
                // This error deserves a dedicated log message
                // In this case, the run-time behavior of the database is compromised.
                // The data files are however still correct and consistent, only the in-memory information is incomplete.
                log(LogLevel::Error,
                    "Unable to store the new key due to out of memory, the run-time integrity of the datastore is compromised (data files "
                    "are ok). You should stop and relaunch the application to recover it. If not enough, using tools to perform a full "
                    "merge on the data to make it more compact could help.");
            }
            return storageStatus;
        }

        // Update the index map
        int lastOldIdx = 0;
        for (const KeyIndex& ki : keyIndexes) {
            // Insert in the index map only if it is not present in the old list. Run time is O(N) as lists are sorted.
            bool doAdd = !oldEntry.isValid;
            if (!doAdd) {
                while (lastOldIdx < oldEntry.keyIndexQty &&
                       (oldEntry.keyIndexes[lastOldIdx].startIdx < ki.startIdx ||
                        (oldEntry.keyIndexes[lastOldIdx].startIdx == ki.startIdx && oldEntry.keyIndexes[lastOldIdx].size < ki.size))) {
                    ++lastOldIdx;
                }
                doAdd = (lastOldIdx >= oldEntry.keyIndexQty || oldEntry.keyIndexes[lastOldIdx].startIdx != ki.startIdx ||
                         oldEntry.keyIndexes[lastOldIdx].size != ki.size);
            }
            if (doAdd) {
                _mxIndexMap.lockWrite();
                _indexMap->insertIndex((uint8_t*)key + ki.startIdx, ki.size, (uint32_t)keyHash);
                _mxIndexMap.unlockWrite();
            }
        }

        // Update case?
        if (oldEntry.isValid) {
            // Remove the old entry from the cache
            if (oldEntry.cacheLocation != NotStored && _valueCache->isEnabled()) {
                _valueCache->removeValue(oldEntry.cacheLocation, keyHash);
            }

            // Update "old" file descriptor statistics for proper maintenance
            _mxDataFiles.lockRead();
            _dataFiles[oldEntry.fileId]->deadBytes += (uint32_t)(sizeof(DataFileEntry) + keySize + keyIndexSize +
                                                                 ((oldEntry.valueSize == DeletedEntry) ? 0 : oldEntry.valueSize));
            _dataFiles[oldEntry.fileId]->deadEntries += 1;
            _mxDataFiles.unlockRead();
        }

        ++_stats.putCallQty;
        return Status::Ok;
    }

    // Variant 1: key as vector
    Status put(const lcVector<uint8_t>& key, const void* value, size_t valueSize, const lcVector<KeyIndex>& keyIndexes = {},
               uint32_t ttlSec = 0, bool forceDiskSync = false)
    {
        return put(key.data(), key.size(), value, valueSize, keyIndexes, ttlSec, forceDiskSync);
    }

    // Variant 2: key as string
    Status put(const lcString& key, const void* value, size_t valueSize, const lcVector<KeyIndex>& keyIndexes = {}, uint32_t ttlSec = 0,
               bool forceDiskSync = false)
    {
        return put(key.data(), key.size(), value, valueSize, keyIndexes, ttlSec, forceDiskSync);
    }

    // Variant 3: key as vector and value as vector
    Status put(const lcVector<uint8_t>& key, const lcVector<uint8_t>& value, const lcVector<KeyIndex>& keyIndexes = {}, uint32_t ttlSec = 0,
               bool forceDiskSync = false)
    {
        return put(key.data(), key.size(), value.data(), value.size(), keyIndexes, ttlSec, forceDiskSync);
    }

    // Variant 4: key as string and value as vector
    Status put(const lcString& key, const lcVector<uint8_t>& value, const lcVector<KeyIndex>& keyIndexes = {}, uint32_t ttlSec = 0,
               bool forceDiskSync = false)
    {
        return put(key.data(), key.size(), value.data(), value.size(), keyIndexes, ttlSec, forceDiskSync);
    }

    Status remove(const void* key, size_t keySize, bool forceDiskSync = false)
    {
        using namespace litecask::detail;
        if (keySize == 0 || keySize >= USHRT_MAX) {
            ++_stats.removeCallFailedQty;
            return Status::BadKeySize;
        }

        uint64_t keyHash  = LITECASK_HASH_FUNC(key, keySize);
        uint32_t checksum = (uint32_t)keyHash;

        _mxActiveFile.lock();
        if (!_isInitialized) {
            _mxActiveFile.unlock();
            ++_stats.removeCallFailedQty;
            return Status::StoreNotOpen;
        }

        // Optional, but keeps the database cleaner in case of false removal
        KeyChunk entry;
        bool     isFound = _keyDir->find((uint32_t)keyHash, key, (uint16_t)keySize, entry);
        if (!isFound || entry.valueSize == DeletedEntry) {
            _mxActiveFile.unlock();
            ++_stats.removeCallNotFoundQty;
            return Status::EntryNotFound;
        }

        // Check that the limit of the data file size is not exceeded (taking into account the 64 overflow)
        // The only exception is if we are at the beginning of a new file, so that any entry size can fit the data file
        if (_activeDataOffset > 0 && (uint64_t)_activeDataOffset + sizeof(DataFileEntry) + (uint64_t)keySize >= _dataFileMaxBytes) {
            createNewActiveDataFileUnlocked();  // Now the "removal" entry can be written
        }

        _mxDataFiles.lockRead();
        lcOsFileHandle fh = _dataFiles[_activeDataFileId]->handle;
        assert(osIsValidHandle(fh));

        // Write entry in the memory write buffer
        _mxWriteBuffer.lockWrite();
        if ((_activeDataOffset - _activeFlushedDataOffset) + (sizeof(DataFileEntry) + keySize) > _writeBuffer.size()) {
            flushWriteBufferUnlocked();  // After that, the write must succeed by design (write buffer big enough for 1 entry)
        }

        // Note: tombstone's keyIndexes are not stored on disk, but we need to keep the previous indexes in memory for the
        //  following use case: remove an entry with indexes, then add it again with some identical indexes: we do not want doubles inside
        //  index arrays
        DataFileEntry dfe{checksum, 0, DeletedEntry, (uint16_t)keySize, 0, 0};
        uint32_t      entryActiveDataOffset = _activeDataOffset;
        uint16_t      entryActiveDataFileId = _activeDataFileId;
        assert(_activeDataOffset >= _activeFlushedDataOffset);

        if ((_activeDataOffset - _activeFlushedDataOffset) + (sizeof(DataFileEntry) + keySize) <= _writeBuffer.size()) {
            // Store in the write buffer
            uint32_t dataOffset = _activeDataOffset - _activeFlushedDataOffset;
            memcpy(&_writeBuffer[dataOffset], &dfe, sizeof(DataFileEntry));
            memcpy(&_writeBuffer[dataOffset + sizeof(DataFileEntry)], key, keySize);

            // Update the active offset
            _activeDataOffset += (uint32_t)(sizeof(DataFileEntry) + keySize);
            if (forceDiskSync) { flushWriteBufferUnlocked(); }
        }

        else {
            // Too big entry: the write buffer has already been synced-flushed, and we directly write in the file
            if (!osOsWrite(fh, &dfe, sizeof(DataFileEntry)) || !osOsWrite(fh, key, keySize)) {
                fatalHandler("Remove: Unable to write the header and key (size=%" PRId64 ") in the datafile", keySize);
            }

            // Update the offsets (flush also) after this unoptimized write
            _activeDataOffset += (uint32_t)(sizeof(DataFileEntry) + keySize);
            _activeFlushedDataOffset = _activeDataOffset;
        }

        _mxWriteBuffer.unlockWrite();

        _dataFiles[entryActiveDataFileId]->tombBytes += (uint32_t)(sizeof(DataFileEntry) + keySize);
        _dataFiles[entryActiveDataFileId]->tombEntries += 1;
        _dataFiles[entryActiveDataFileId]->bytes += (uint32_t)(sizeof(DataFileEntry) + keySize);
        _dataFiles[entryActiveDataFileId]->entries += 1;

        _mxDataFiles.unlockRead();
        _mxActiveFile.unlock();

        // Update the KeyDir with a tombstone
        _mxKeyDir.lock();
        OldKeyChunk oldEntry;
        Status      storageStatus = _keyDir->insertEntry(
                 (uint32_t)keyHash, key, nullptr,
                 {0, DeletedEntry, NotStored, entryActiveDataOffset, entryActiveDataFileId, (uint16_t)keySize, 0, 0}, oldEntry);
        _mxKeyDir.unlock();

        if (storageStatus != Status::Ok) {
            if (storageStatus == Status::OutOfMemory) {
                // This error deserves a dedicated log message
                // In this case, the run-time behavior of the database is compromised.
                // The data files are however still correct and consistent, only the in-memory information is incomplete.
                log(LogLevel::Error,
                    "Unable to store the new key due to out of memory, the run-time integrity of the datastore is compromised (data files "
                    "are  ok). You should stop and relaunch the application to recover it. If not enough, using tools to perform a full "
                    "merge on the data to make it more compact could help.");
            }
            return storageStatus;
        }

        // Remove the (potential) old value from the value cache
        if (oldEntry.isValid && oldEntry.cacheLocation != NotStored && _valueCache->isEnabled()) {
            _valueCache->removeValue(oldEntry.cacheLocation, keyHash);
        }

        if (oldEntry.isValid) {
            _mxDataFiles.lockRead();
            _dataFiles[oldEntry.fileId]->deadBytes += (uint32_t)(sizeof(DataFileEntry) + oldEntry.valueSize + keySize);
            _dataFiles[oldEntry.fileId]->deadEntries += 1;
            _mxDataFiles.unlockRead();
        }

        ++_stats.removeCallQty;
        return Status::Ok;
    }

    // Variant 1: key as vector
    Status remove(const lcVector<uint8_t>& key, bool forceDiskSync = false) { return remove(key.data(), key.size(), forceDiskSync); }

    // Variant 2: key as string
    Status remove(const lcString& key, bool forceDiskSync = false) { return remove(key.data(), key.size(), forceDiskSync); }

    Status get(const void* key, size_t keySize, lcVector<uint8_t>& value)
    {
        using namespace litecask::detail;

        if (keySize == 0 || keySize >= USHRT_MAX) {  // Key size is anyway limited by 16 bits minus some meta data overhead
            ++_stats.getCallFailedQty;
            return Status::BadKeySize;
        }

        // Look in the KeyDir
        uint64_t keyHash = LITECASK_HASH_FUNC(key, keySize);

        _mxDataFiles.lockRead();
        if (!_isInitialized) {
            _mxDataFiles.unlockRead();
            ++_stats.getCallFailedQty;
            return Status::StoreNotOpen;
        }

        KeyChunk entry{0, 0, 0, 0, 0, 0, 0, 0};
        bool     isFound = _keyDir->find((uint32_t)keyHash, key, (uint16_t)keySize, entry);

        if (!isFound || entry.valueSize == DeletedEntry) {
            _mxDataFiles.unlockRead();
            ++_stats.getCallNotFoundQty;
            return Status::EntryNotFound;
        }
        assert(entry.fileId < _dataFiles.size());

        // Check the write buffer
        if (entry.fileId == _activeDataFileId) {  // If it is different, it cannot be equal afterwards. And we avoid a lock on main path
            _mxWriteBuffer.lockRead();
            if (entry.fileId == _activeDataFileId && entry.fileOffset >= _activeFlushedDataOffset &&
                entry.fileOffset - _activeFlushedDataOffset < _writeBuffer.size()) {
                value.resize(entry.valueSize);
                memcpy(value.data(),
                       &_writeBuffer[entry.fileOffset - _activeFlushedDataOffset + sizeof(DataFileEntry) + keySize + entry.keyIndexSize],
                       entry.valueSize);
                _mxWriteBuffer.unlockRead();
                _mxDataFiles.unlockRead();
                ++_stats.getCallQty;
                ++_stats.getWriteBufferHitQty;
                return Status::Ok;
            }
            _mxWriteBuffer.unlockRead();
        }

        // Check the cache
        if (_valueCache->isEnabled()) {
            bool isInTheCache = _valueCache->getValue(entry.cacheLocation, keyHash, entry.valueSize, value);
            if (isInTheCache) {
                _mxDataFiles.unlockRead();
                ++_stats.getCallQty;
                ++_stats.getCacheHitQty;
                return Status::Ok;
            }
        }

        // Load the value
        value.resize(sizeof(DataFileEntry) + keySize + entry.keyIndexSize + entry.valueSize);

        DataFile*      dfd = _dataFiles[entry.fileId];
        lcOsFileHandle fh  = dfd->handle;
        assert(osIsValidHandle(fh));
        bool isReadOk =
            osOsRead(fh, value.data(), sizeof(DataFileEntry) + keySize + entry.keyIndexSize + entry.valueSize, entry.fileOffset);
        _mxDataFiles.unlockRead();

        size_t valueStartOffset = (uint32_t)sizeof(DataFileEntry) + keySize + entry.keyIndexSize;

        // Check the value consistency. Read errors are caught here too
        uint32_t checksum = (uint32_t)(keyHash ^ LITECASK_HASH_FUNC(&value[valueStartOffset], entry.valueSize));
        if (!isReadOk || checksum != ((DataFileEntry*)value.data())->checksum) {
            ++_stats.getCallCorruptedQty;
            return Status::EntryCorrupted;
        }

        // Remove the offset due to the metadata (cannot avoid memmove with a generic container as output...)
        memmove(value.data(), &value[valueStartOffset], entry.valueSize);
        value.resize(entry.valueSize);

        if (_valueCache->isEnabled()) {
            // Store the value in the cache
            ValueLoc cacheLoc = _valueCache->insertValue(value.data(), entry.valueSize, keyHash, entry.expTimeSec);

            // The change counter avoids the ABA problem between the entry insertion above and the cache update here
            // If valueSize or changeCounter do not match, the cache entry is wasted but it will be later evicted anyway
            _mxKeyDir.lock();
            _keyDir->updateCachedValueLocation((uint32_t)keyHash, key, (uint16_t)keySize, entry.valueSize, entry.changeCounter, cacheLoc);
            _mxKeyDir.unlock();
        }

        ++_stats.getCallQty;
        return Status::Ok;
    }

    // Get variant 1: key as vector
    Status get(const lcVector<uint8_t>& key, lcVector<uint8_t>& value) { return get(key.data(), key.size(), value); }

    // Get variant 2: key as string
    Status get(const lcString& key, lcVector<uint8_t>& value) { return get(key.data(), key.size(), value); }

    // Query variant 1: single key part as vector
    Status query(const lcVector<uint8_t>& keyPart, lcVector<lcVector<uint8_t>>& matchingKeys)
    {
        return privateQuery<lcVector<uint8_t>, lcVector<uint8_t>>({keyPart}, matchingKeys);
    }

    // Query variant 2: single key part as string
    Status query(const lcString& keyPart, lcVector<lcVector<uint8_t>>& matchingKeys)
    {
        return privateQuery<lcString, lcVector<uint8_t>>({keyPart}, matchingKeys);
    }

    // Query variant 3: multiple key part as vector of vector
    Status query(const lcVector<lcVector<uint8_t>>& keyParts, lcVector<lcVector<uint8_t>>& matchingKeys)
    {
        return privateQuery<lcVector<uint8_t>, lcVector<uint8_t>>(keyParts, matchingKeys);
    }

    // Query variant 4: key part as vector of string
    Status query(const lcVector<lcString>& keyParts, lcVector<lcVector<uint8_t>>& matchingKeys)
    {
        return privateQuery<lcString, lcVector<uint8_t>>(keyParts, matchingKeys);
    }

    // Query variant 5: single key part as vector, with arena allocator for output array of keys
    Status query(const lcVector<uint8_t>& keyPart, lcVector<QueryResult>& arenaMatchingKeys, ArenaAllocator& allocator)
    {
        return privateQuery<lcVector<uint8_t>, QueryResult>({keyPart}, arenaMatchingKeys, &allocator);
    }

    // Query variant 6: single key part as string, with arena allocator for output array of keys
    Status query(const lcString& keyPart, lcVector<QueryResult>& arenaMatchingKeys, ArenaAllocator& allocator)
    {
        return privateQuery<lcString, QueryResult>({keyPart}, arenaMatchingKeys, &allocator);
    }

    // Query variant 7: multiple key parts as vector, with arena allocator for output array of keys
    Status query(const lcVector<lcVector<uint8_t>>& keyParts, lcVector<QueryResult>& arenaMatchingKeys, ArenaAllocator& allocator)
    {
        return privateQuery<lcVector<uint8_t>, QueryResult>(keyParts, arenaMatchingKeys, &allocator);
    }

    // Query variant 8: multiple key parts as string, with arena allocator for output array of keys
    Status query(const lcVector<lcString>& keyParts, lcVector<QueryResult>& arenaMatchingKeys, ArenaAllocator& allocator)
    {
        return privateQuery<lcString, QueryResult>(keyParts, arenaMatchingKeys, &allocator);
    }

    void sync()
    {
        _mxWriteBuffer.lockWrite();
        flushWriteBufferUnlocked();
        _mxWriteBuffer.unlockWrite();
    }

    bool requestMerge()
    {
        std::unique_lock<std::mutex> lk(_mergeMutex);
        if (_isInitialized && _mergeWork.load() == false) {
            _mergeWork.store(true);
            _mergeCv.notify_one();
            return true;
        }
        return false;
    }

    bool isMergeOnGoing() const { return _mergeWork.load(); }

    // Use carefully...
    static void erasePermanentlyAllContent_UseWithCaution(fs::path dbDirectoryPath)
    {
        using namespace litecask::detail;
        dbDirectoryPath /= "";
        lcVector<DirEntry> entries;
        if (!osGetDirContent(dbDirectoryPath, entries)) return;

        for (const auto& e : entries) {
            if (e.isDir || e.name.empty()) continue;
            fs::path filename(e.name);

            if (filename.extension() == DataFileSuffix) {
                osRemoveFile(dbDirectoryPath / e.name);
                continue;
            }
            if (filename.extension() == HintFileSuffix) {
                osRemoveFile(dbDirectoryPath / e.name);
                continue;
            }
            if (filename.extension() == TmpFileSuffix) {
                osRemoveFile(dbDirectoryPath / e.name);
                continue;
            }
            if (filename.extension() == ToRemoveFileSuffix) {
                osRemoveFile(dbDirectoryPath / e.name);
                continue;
            }
            if (filename.extension() == LogFileSuffix) {
                osRemoveFile(dbDirectoryPath / e.name);
                continue;
            }
        }
    }

#ifndef LITECASK_BUILD_FOR_TEST  // Allows looking inside the datastore internal, for testing purposes
   private:
#endif

    // Internal data file management
    // ==========================================================================================

    // Returns the basename of the last active data file (not the new one but the just closed one)
    // The "active file" lock must be taken before the call
    lcString createNewActiveDataFileUnlocked()
    {
        using namespace litecask::detail;

        // Set the name of the previous active data file (used as an in-order basename for merged data files)
        char tmpFilename[256];
        snprintf(tmpFilename, 256, "%s%" PRId64 "", _directory.string().c_str(), _maxDataFileIndex);
        lcString lastActiveBaseDataFilename = tmpFilename;

        // The data file structure is modified
        _mxDataFiles.lockWrite();
        _mxWriteBuffer.lockWrite();

        if (_activeDataFileId < _dataFiles.size()) {
            // Close previous active file, which was writable
            flushWriteBufferUnlocked();
            DataFile* dfd = _dataFiles[_activeDataFileId];
            assert(osIsValidHandle(dfd->handle));
            osOsClose(dfd->handle);

            // Reopen it in read-only mode
            dfd->handle = osOsOpen(dfd->filename, OsOpenMode::READ);
            assert(osIsValidHandle(dfd->handle));
        }

        // Open a new data file in append + read mode
        _activeDataOffset        = 0;
        _activeFlushedDataOffset = 0;
        _activeDataFileId        = getFreeDataFileIdUnlocked();
        _mxWriteBuffer.unlockWrite();

        DataFile* newFd = _dataFiles[_activeDataFileId];
        snprintf(tmpFilename, 256, "%s%" PRId64 "%s", _directory.string().c_str(), ++_maxDataFileIndex, DataFileSuffix);
        newFd->filename = tmpFilename;
        newFd->handle   = osOsOpen(newFd->filename, OsOpenMode::APPEND);
        assert(osIsValidHandle(newFd->handle));

        _mxDataFiles.unlockWrite();

        log(LogLevel::Debug, "Creating new active data file %s", tmpFilename);
        ++_stats.activeDataFileSwitchQty;
        return lastActiveBaseDataFilename;
    }

    bool isItWorthMerging(int fragmentationPercentage, uint32_t deadByteThreshold)
    {
        using namespace litecask::detail;
        assert(fragmentationPercentage >= 1 && fragmentationPercentage <= 100);

        _mxDataFiles.lockRead();
        for (const DataFile* dfd : _dataFiles) {
            if (!osIsValidHandle(dfd->handle)) continue;  // Descriptor not in use

            if ((uint64_t)dfd->deadBytes * 100L > (uint64_t)dfd->bytes * (uint64_t)fragmentationPercentage) {
                _mxDataFiles.unlockRead();
                log(LogLevel::Debug, "Merge needed due to some data file having too high ratio of dead bytes");
                return true;
            }

            if (dfd->deadBytes > deadByteThreshold) {
                _mxDataFiles.unlockRead();
                log(LogLevel::Debug, "Merge needed due to some data file having more than %d dead bytes", deadByteThreshold);
                return true;
            }
        }
        _mxDataFiles.unlockRead();
        return false;
    }

    Status selectDataFilesToMerge(int fragmentationPercentage, uint32_t deadByteThreshold, uint32_t smallFileSizeTheshold,
                                  lcVector<detail::MergeFileInfo>& mergeInfos)
    {
        using namespace litecask::detail;
        assert(fragmentationPercentage >= 1 && fragmentationPercentage <= 100);
        assert(smallFileSizeTheshold >= MinDataFileMaxBytes);
        mergeInfos.clear();

        // Check each data file
        _mxDataFiles.lockRead();
        for (uint32_t fileId = 0; fileId < _dataFiles.size(); ++fileId) {
            const DataFile* dfd = _dataFiles[fileId];
            if (!osIsValidHandle(dfd->handle)) continue;  // Descriptor not in use
            bool doIncludeFileInMerge = false;

            if ((uint64_t)dfd->deadBytes * 100L > (uint64_t)dfd->bytes * (uint64_t)fragmentationPercentage) doIncludeFileInMerge = true;
            if (dfd->deadBytes > deadByteThreshold) doIncludeFileInMerge = true;
            if (dfd->bytes < smallFileSizeTheshold) doIncludeFileInMerge = true;

            if (doIncludeFileInMerge) { mergeInfos.push_back({(uint16_t)fileId, {}}); }
            log(LogLevel::Debug, "selectDataFilesToMerge: %s %s", dfd->filename.c_str(),
                doIncludeFileInMerge ? "will be merged" : "is skipped");
        }
        _mxDataFiles.unlockRead();
        return Status::Ok;
    }

    // 'Merging' is a data file "cleaning" process which:
    //  - remove obsolete entries whose value has been overridden or deleted in newer data files
    //  - compact the entries together in the new data files up to the allowed maximum size
    bool createMergedDataFiles(lcVector<detail::MergeFileInfo>& mergeInfos, const lcString& mergeBasename, const uint32_t dataFileMaxBytes)
    {
        using namespace litecask::detail;
        DataFileEntry     header;
        lcVector<uint8_t> buf(1024);
        uint16_t          mergeFileCount    = 0;
        uint32_t          readFileOffset    = 0;
        uint32_t          writeFileOffset   = 0;
        uint32_t          fileIncrement     = 0;
        uint16_t          currentDataFileId = 0xFFFF;
        DataFile*         currentDataFile   = nullptr;
        FILE*             fhw               = nullptr;
        FILE*             fhhw              = nullptr;

        // Loop on files to merge, the order does not matter
        for (MergeFileInfo& mergeInfo : mergeInfos) {
            // Get the data file descriptor
            _mxDataFiles.lockRead();
            const DataFile* dfd = _dataFiles[mergeInfo.fileId];
            assert(osIsValidHandle(dfd->handle) && "This data file should have been in use");
            _mxDataFiles.unlockRead();

            // We use fopen/fread/fwrite here because of standard usage and the provided buffering
            // By design, we never merge the active file
            FILE* fhr = osFopen(dfd->filename, "rb");
            assert(fhr);
            readFileOffset = 0;

            // Loop on entries
            while (fread(&header, sizeof(DataFileEntry), 1, fhr) == 1) {
                uint32_t valueSize    = header.valueSize;
                uint32_t keyIndexSize = header.keyIndexSize;
                uint32_t keySize      = header.keySize;
                if (keySize == 0) {
                    log(LogLevel::Error,
                        "Cannot read the data file %s for merging: a key has a null (=corrupted) size (value size is said to be %u) at "
                        "file offset %u",
                        dfd->filename.c_str(), valueSize, readFileOffset);
                    break;
                }

                if (keyIndexSize > MaxKeyIndexQty * sizeof(KeyIndex)) {
                    log(LogLevel::Error,
                        "Cannot read the data file %s for merging: a key has too big index (byte size=%d > %" PRId64 ") at file offset %u",
                        dfd->filename.c_str(), keyIndexSize, MaxKeyIndexQty * sizeof(KeyIndex), readFileOffset);
                    break;
                }

                if (valueSize != DeletedEntry) {
                    uint32_t allSize = keySize + keyIndexSize + valueSize;
                    if (buf.size() < allSize) buf.resize(allSize);
                    if (fread(buf.data(), 1, allSize, fhr) != allSize) {
                        log(LogLevel::Warn,
                            "Cannot read the data file %s for merging: unable to read all the bytes (%u) of the entry at file offset %u",
                            dfd->filename.c_str(), allSize, readFileOffset);
                        break;
                    }
                    fileIncrement = (uint32_t)sizeof(DataFileEntry) + allSize;
                }

                else {
                    // Tombstone case
                    uint32_t allSize = keySize + keyIndexSize;
                    if (buf.size() < allSize) buf.resize(allSize);
                    if (fread(buf.data(), 1, allSize, fhr) != allSize) {
                        log(LogLevel::Warn,
                            "Cannot read the data file %s for merging: unable to read all the bytes (%u) of the deleted entry at file "
                            "offset %u",
                            dfd->filename.c_str(), allSize, readFileOffset);
                        break;
                    }
                    keyIndexSize  = 0;
                    fileIncrement = sizeof(DataFileEntry) + allSize;
                }

                uint64_t keyHash = LITECASK_HASH_FUNC(buf.data(), keySize);
                KeyChunk entry;
                bool     isFound = _keyDir->find((uint32_t)keyHash, buf.data(), (uint16_t)keySize, entry);
                if (!isFound || entry.fileId != mergeInfo.fileId || entry.fileOffset != readFileOffset) {
                    readFileOffset += fileIncrement;
                    continue;  // This entry is not the latest or expired
                }
                readFileOffset += fileIncrement;

                // Change the write file if the size exceeds the threshold
                if (fhw == nullptr || (writeFileOffset > 0 && writeFileOffset + fileIncrement > dataFileMaxBytes)) {
                    // Move the complete compacted file as official data file
                    if (fhw != nullptr) {
                        // Close finished data and hint written files
                        fclose(fhw);
                        fclose(fhhw);

                        // If a crash occurs before the move then the .tmp is simply removed at next launch. If a crash
                        // occurs after this (atomic) renaming, then the data will be taken into account and the old
                        // duplicate entries will be cleaned by next merge
                        assert(currentDataFile);
                        log(LogLevel::Debug, "Finished compacted file %s. Removing the '%s' suffix.", currentDataFile->filename.c_str(),
                            TmpFileSuffix);
                        [[maybe_unused]] bool isOk = osRenameFile(currentDataFile->filename + TmpFileSuffix, currentDataFile->filename);
                        assert(isOk);
                        currentDataFile->handle = osOsOpen(currentDataFile->filename, OsOpenMode::READ);
                        assert(osIsValidHandle(currentDataFile->handle));
                        fs::path hintFilename = fs::path(currentDataFile->filename).replace_extension(HintFileSuffix);
                        isOk                  = osRenameFile(hintFilename.string() + TmpFileSuffix, hintFilename);
                        assert(isOk);
                    }

                    // Create the next compacted file to write in
                    char dataFilename[512];  // Note: the fractional number shall not be zero
                    snprintf(dataFilename, sizeof(dataFilename), "%s.%05d%s", mergeBasename.c_str(), ++mergeFileCount, DataFileSuffix);

                    // The data file structure is modified
                    _mxDataFiles.lockWrite();
                    currentDataFileId = getFreeDataFileIdUnlocked();
                    currentDataFile   = _dataFiles[currentDataFileId];
                    _mxDataFiles.unlockWrite();

                    currentDataFile->filename = dataFilename;
                    currentDataFile->handle =
                        InvalidFileHandle;  // Will be opened for read only when the temporary file is complete and renamed
                    fhw = osFopen(lcString(dataFilename) + TmpFileSuffix, "wb");
                    if (!fhw) {
                        fatalHandler("Unable to open temp data file for %s during merge file creation.", currentDataFile->filename.c_str());
                    }
                    writeFileOffset       = 0;
                    fs::path hintFilename = fs::path(currentDataFile->filename).replace_extension(HintFileSuffix);
                    fhhw                  = osFopen(hintFilename.string() + TmpFileSuffix, "wb");
                    if (!fhhw) {
                        fatalHandler("Unable to open temp hint file for %s during merge file creation.", currentDataFile->filename.c_str());
                    }
                }

                // Write the entry both in the data file and its hint file
                uint8_t*      keyAndIndexes = buf.data();
                DataFileEntry dfe{header.checksum, header.expTimeSec, valueSize, (uint16_t)keySize, (uint8_t)keyIndexSize, 0};
                bool          isMergeOk = (fwrite(&dfe, sizeof(DataFileEntry), 1, fhw) == 1);
                isMergeOk               = isMergeOk &&
                            (fwrite(keyAndIndexes, 1, fileIncrement - sizeof(DataFileEntry), fhw) == fileIncrement - sizeof(DataFileEntry));

                HintFileEntry hfe{writeFileOffset, header.expTimeSec, valueSize, (uint16_t)keySize, (uint8_t)keyIndexSize, 0};
                isMergeOk = isMergeOk && (fwrite(&hfe, sizeof(HintFileEntry), 1, fhhw) == 1);
                isMergeOk = isMergeOk && (fwrite(keyAndIndexes, 1, keySize + keyIndexSize, fhhw) == keySize + keyIndexSize);
                if (!isMergeOk) {
                    fatalHandler("Write error for for file %s during merge file creation.", currentDataFile->filename.c_str());
                }

                mergeInfo.patches.push_back({(uint32_t)keyHash, entry.fileOffset, writeFileOffset, mergeInfo.fileId, currentDataFileId});
                currentDataFile->bytes += fileIncrement;
                currentDataFile->entries += 1;
                if (valueSize == DeletedEntry) {
                    currentDataFile->tombBytes += fileIncrement;
                    currentDataFile->tombEntries += 1;
                }
                writeFileOffset += fileIncrement;
            }  // End of loop on entries

            _stats.mergeGainedBytes += readFileOffset - writeFileOffset;
            fclose(fhr);
        }  // End of loop on data files to merge

        // Close the last merged data file
        if (fhw != nullptr) {
            // Close finished data and hint written files
            fclose(fhw);
            fclose(fhhw);

            assert(currentDataFile);
            log(LogLevel::Debug, "Finished compacted file %s. Removing the '%s' suffix.", currentDataFile->filename.c_str(), TmpFileSuffix);
            if (!osRenameFile(currentDataFile->filename + TmpFileSuffix, currentDataFile->filename)) {
                fatalHandler("Unable to rename temp data file for %s during merge file creation.", currentDataFile->filename.c_str());
            }
            currentDataFile->handle = osOsOpen(currentDataFile->filename, OsOpenMode::READ);
            assert(osIsValidHandle(currentDataFile->handle));
            fs::path hintFilename = fs::path(currentDataFile->filename).replace_extension(HintFileSuffix);
            if (!osRenameFile(hintFilename.string() + TmpFileSuffix, hintFilename)) {
                fatalHandler("Unable to rename temp hint file for %s during merge file creation.", currentDataFile->filename.c_str());
            }
        }

        // No problem so far: create the tag files to remove old data files
        // If a crash occurs before/while creating the "to_remove" tag files, next merge will clean the old-and-now-duplicate entries
        _mxDataFiles.lockRead();
        for (MergeFileInfo& mergeInfo : mergeInfos) {
            const DataFile* dfd = _dataFiles[mergeInfo.fileId];
            log(LogLevel::Debug, "Creating tag file to request removal of old data file %s.", dfd->filename.c_str());
            FILE* tagFile = osFopen(fs::path(dfd->filename).replace_extension(ToRemoveFileSuffix), "wb");
            fclose(tagFile);  // No content, just the file existence. Not really a problem if the tag file creation failed
        }
        _mxDataFiles.unlockRead();

        // No problem so far.
        // Next step is to apply patch on KeyDir, close the old data files, open the new ones, and remove the tagged data files
        _stats.mergeGainedDataFileQty += mergeInfos.size() - mergeFileCount;
        return true;
    }

    bool replaceDataFiles(const lcVector<detail::MergeFileInfo>& mergeInfos)
    {
        using namespace litecask::detail;

        // Next step is to apply patch on KeyDir, close the old data files, open the new ones, and remove the tagged data files
        for (const MergeFileInfo& mergeInfo : mergeInfos) {
            // The data file structure is modified
            _mxDataFiles.lockWrite();
            DataFile* dfd = _dataFiles[mergeInfo.fileId];

            // Live-patch of the KeyDir
            _mxKeyDir.lock();
            for (const KeyDirPatch& kdPatch : mergeInfo.patches) {
                _keyDir->updateMergedValueLocation(kdPatch.keyHash, kdPatch.oldFileId, kdPatch.oldFileOffset, kdPatch.newFileId,
                                                   kdPatch.fileOffset);
            }
            _mxKeyDir.unlock();

            if (osIsValidHandle(dfd->handle)) {
                osOsClose(dfd->handle);
                dfd->handle = InvalidFileHandle;

                // Remove the files associated with this old data file. The order below matters in case of hard interruption.
                // First remove the old data file
                osRemoveFile(dfd->filename);
                // Then the hint file (if it exists)
                osRemoveFile(fs::path(dfd->filename).replace_extension(HintFileSuffix));
                // Then, the removal tag
                osRemoveFile(fs::path(dfd->filename).replace_extension(ToRemoveFileSuffix));

                // Free the fileId for reuse
                _freeDataFileIds.push_back(mergeInfo.fileId);
            }

            _mxDataFiles.unlockWrite();
        }

        return true;
    }

    // Templatized helper function for template<class KP, class K> privateQuery(...) below
    void addQueryResult(lcVector<lcVector<uint8_t>>& matchingKeys, const lcVector<uint8_t>& key, ArenaAllocator* /*allocator*/)
    {
        matchingKeys.push_back(key);
    }

    // Templatized helper function for template<class KP, class K> privateQuery(...) below
    void addQueryResult(lcVector<QueryResult>& matchingKeys, const lcVector<uint8_t>& key, ArenaAllocator* allocator)
    {
        uint8_t* ptr = allocator->allocate(key.size());
        assert(ptr);
        memcpy(ptr, key.data(), key.size());
        matchingKeys.push_back({ptr, (uint16_t)key.size()});
    }

    template<class KP, class K>
    Status privateQuery(const lcVector<KP>& keyParts, lcVector<K>& matchingKeys, ArenaAllocator* allocator = nullptr)
    {
        matchingKeys.clear();
        ++_stats.queryCallQty;

        // Check key parts validity
        for (const KP& kp : keyParts) {
            if (kp.size() >= USHRT_MAX) {
                ++_stats.queryCallFailedQty;
                return Status::BadKeySize;
            }
        }

        _mxIndexMap.lockRead();

        // Get the smallest entry list among the "key parts", to minimize the work
        int sourceKeyPartIdx = -1;
        if (keyParts.size() == 1) {
            sourceKeyPartIdx = 0;
        } else if (keyParts.size() > 1) {
            uint32_t bestValue = 0;
            for (int keyPartIdx = 0; keyPartIdx < (int)keyParts.size(); ++keyPartIdx) {
                const KP& kp      = keyParts[keyPartIdx];
                uint32_t  entries = _indexMap->getEntryHashes(kp.data(), (uint16_t)kp.size(), nullptr);
                if (sourceKeyPartIdx == -1 || entries < bestValue) {
                    sourceKeyPartIdx = keyPartIdx;
                    bestValue        = entries;
                    if (bestValue == 0) {  // Empty match, so empty output ("and" between key parts)
                        sourceKeyPartIdx = -1;
                        break;
                    }
                }
            }
        }

        // Empty answer
        if (sourceKeyPartIdx < 0) {
            _mxIndexMap.unlockRead();
            return Status::Ok;
        }

        // Snapshot the smaller list of keyHash
        lcVector<uint32_t> entryHashes;
        const KP&          sourceKeyPart = keyParts[sourceKeyPartIdx];
        _indexMap->getEntryHashes(sourceKeyPart.data(), (uint16_t)sourceKeyPart.size(), &entryHashes);
        _mxIndexMap.unlockRead();

        // Loop on the hashes
        //   - check if the entry exists and really contain the keyPart
        //   - if yes, check that other keyparts are also present
        //   - if all are present, store the key in the result list
        lcVector<uint8_t>  key;
        lcVector<KeyIndex> keyIndexes;
        uint32_t           hashNotPresentQty = 0;
        for (uint32_t entryHashIdx = 0; entryHashIdx < (uint32_t)entryHashes.size(); ++entryHashIdx) {
            uint32_t keyHash = entryHashes[entryHashIdx];

            if (!_keyDir->getKeyAndIndexes(keyHash, key, keyIndexes)) {
                // The entry hash array is reused to store the absent hash.
                // Collected data is used later if a "cleaning" is triggered
                entryHashes[hashNotPresentQty++] = keyHash;
                continue;
            }

            // Filter on other key parts (which implements the "and" behavior if multiple key parts are provided)
            bool allKeyPartsFound = true;
            for (int i = 0; i < (int)keyParts.size(); ++i) {
                // Swap sourceKeyPart and index 0. Indeed, we want to check that the "main" key part is present in the key
                int       keyPartIdx = (i == 0) ? sourceKeyPartIdx : ((i == sourceKeyPartIdx) ? 0 : i);
                const KP& kp         = keyParts[keyPartIdx];

                bool keyPartFound = false;
                for (const auto& ki : keyIndexes) {
                    if (ki.size == kp.size() && !memcmp(&key[ki.startIdx], kp.data(), ki.size)) {
                        keyPartFound = true;
                        break;
                    }
                }
                if (!keyPartFound) {
                    if (keyPartIdx == sourceKeyPartIdx) {
                        // Collected data is used later if a "cleaning" is triggered, as the key part is unexpecingly not in the entry
                        entryHashes[hashNotPresentQty++] = keyHash;
                    }

                    allKeyPartsFound = false;
                    break;
                }
            }

            // Store only if all key parts are present in this key
            if (allKeyPartsFound) { addQueryResult(matchingKeys, key, allocator); }
        }

        // A cleaning phase to remove the no-more-matching keys from the database is done at query time.
        // The mismatch is due to database entry key index modification or entry removal, as no index array update is performed
        // at that time for performance reasons.
        // The cleaning implies both an update of the index lookup array and an update of the key part list inside the entries.
        // It is trigged based on a minimum quantity and array ratio of entries to clean.
        // Note: in case of multiple "AND" index provided, only the one with smallest array will be processed
        constexpr uint32_t MinimumMismatchEntries      = 10;
        constexpr uint64_t MinimumMismatchArrayPercent = 10;
        if (hashNotPresentQty > MinimumMismatchEntries &&
            (uint64_t)hashNotPresentQty * 100 > MinimumMismatchArrayPercent * entryHashes.size()) {
            ++_stats.indexArrayCleaningQty;

            // Get the writable array of entry hashes
            uint32_t* storedEntryHashes  = nullptr;
            uint32_t* storedEntryHashQty = nullptr;
            _mxIndexMap.lockWrite();
            if (_indexMap->getEntryHashesForUpdate(sourceKeyPart.data(), (uint16_t)sourceKeyPart.size(), &storedEntryHashes,
                                                   &storedEntryHashQty)) {
                // Collected invalid hashes to clean are processed in order.
                // This ordering assumption is valid if no cleaning was done in-between. Otherwise, the array is already clean
                // and the current cleaning process will be ineffective and harmless.
                // In-between insertions in the array do not affect the cleaning as they are added at the end
                uint32_t storedEntryHashIndex  = 0;
                uint32_t invalidEntryHashIndex = 0;
                while (storedEntryHashIndex < *storedEntryHashQty && invalidEntryHashIndex < hashNotPresentQty) {
                    uint32_t keyHashToClean = entryHashes[invalidEntryHashIndex++];

                    // Find the hash in the invalid hash list
                    while (storedEntryHashIndex < *storedEntryHashQty && storedEntryHashes[storedEntryHashIndex] != keyHashToClean) {
                        ++storedEntryHashIndex;
                    }
                    if (storedEntryHashIndex >= *storedEntryHashQty) {
                        break;
                    }  // Means that the invalid hash was not found inside the array

                    // Clean the index in the entry
                    _mxKeyDir.lock();
                    if (_keyDir->cleanIndex(keyHashToClean, sourceKeyPart.data(), (uint16_t)sourceKeyPart.size())) {
                        // The index was removed or not found in this entry, so it shall also be removed from current hash array
                        storedEntryHashes[storedEntryHashIndex] = storedEntryHashes[--(*storedEntryHashQty)];
                        ++_stats.indexArrayCleanedEntries;
                    }
                    _mxKeyDir.unlock();

                }  // End of loop on current hashes

            } else {
                log(LogLevel::Warn,
                    "The key part to clean was not found in the index map in spite of the absence of removal of such item...");
            }

            _mxIndexMap.unlockWrite();
        }

        return Status::Ok;
    }

    void notifyKeyDirResizing(uint32_t newSize, bool isStart, bool wasForced)
    {
        if (isStart) {
            log(LogLevel::Debug, "KeyDir resizing to %u entries started", newSize);
            std::unique_lock<std::mutex> lk(_upkeepMutex);
            _upkeepWork.store(true);
            _upkeepCv.notify_one();
        } else {
            log(LogLevel::Debug, "KeyDir resizing to %u entries finished%s", newSize, wasForced ? " (forced)" : "");
        }
    }

    bool requestUpKeeping()
    {
        std::unique_lock<std::mutex> lk(_upkeepMutex);
        if (_isInitialized && _upkeepWork.load() == false) {
            _upkeepWork.store(true);
            _upkeepCv.notify_one();
            return true;
        }
        return false;
    }

    bool isUpkeepingOnGoing() const { return _upkeepWork.load(); }

    void upkeepThreadEntry()
    {
        using namespace litecask::detail;

        // Upkeep service loop
        while (!_upkeepExit.load()) {
            // Wait for a upkeep period or explicit request
            {
                std::unique_lock<std::mutex> lk(_upkeepMutex);
                _upkeepCv.wait_for(lk, std::chrono::milliseconds(_config.upkeepCyclePeriodMs),
                                   [this] { return _upkeepExit.load() || _upkeepWork.load(); });
                if (_upkeepExit.load()) continue;
                _upkeepWork.store(false);
            }

            // Update the current date
            updateNow();

            // Write buffer flushing
            uint64_t timeMs =
                std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
            if (timeMs - _upkeepLastActiveFlushedTimeMs > _config.writeBufferFlushPeriodMs) {
                _mxActiveFile.lock();
                _mxWriteBuffer.lockWrite();

                // Flush only if no flush was performed since last check, and if there is something to flush
                if (_activeFlushedDataOffset == _upkeepLastActiveFlushedDataOffset && _activeDataFileId == _upkeepLastActiveDataFileId &&
                    _activeDataOffset - _activeFlushedDataOffset > 0) {
                    flushWriteBufferUnlocked();
                }
                _upkeepLastActiveDataFileId        = _activeDataFileId;
                _upkeepLastActiveFlushedDataOffset = _activeFlushedDataOffset;
                _upkeepLastActiveFlushedTimeMs     = timeMs;
                _mxWriteBuffer.unlockWrite();
                _mxActiveFile.unlock();
            }

            // First priority: resize the key directory
            if (_keyDir->isResizingOngoing()) {
                log(LogLevel::Debug, "Resizing KeyDir in upkeep thread under work");
                while (_keyDir->isResizingOngoing()) {
                    // Transfer one batch of entries at a time
                    _mxKeyDir.lock();
                    _keyDir->backgroundResizeWork(_config.upkeepKeyDirBatchSize);
                    _mxKeyDir.unlock();
                    // Give air to writer threads
                    std::this_thread::yield();
                }
                log(LogLevel::Debug, "Resizing KeyDir in upkeep thread finished");
            }

            // Second priority: Value cache upkeeping
            _valueCache->backgroundUpdateLru(_config.upkeepValueCacheBatchSize);
            _valueCache->backgroundPreventiveEviction(_config.upkeepValueCacheBatchSize);  // Ensures a free margin

            uint32_t keyDirIndex  = 0;
            uint32_t keyHash      = 0;
            uint32_t keySize      = 0;
            uint32_t oldValueSize = 0;
            uint16_t oldFileId    = 0;
            ValueLoc oldCacheLoc  = NotStored;

            // Third priority: cleaning of entries with expired TTL
            uint32_t batchSize = _config.upkeepValueCacheBatchSize;
            while (batchSize > 0) {
                // Probe a KeyDir entry with expired TTL and remove the entry after checking it again under lock
                if ((keyDirIndex = _keyDir->backgroundExpiredKeyCleaning(batchSize)) == NotStored) { continue; }

                // Invalidate the entry iff valid and with an expired TTL. This time, under write lock.
                _mxKeyDir.lock();
                bool isReplacing = _keyDir->invalidateExpiredTtl(keyDirIndex, keyHash, keySize, oldValueSize, oldFileId, oldCacheLoc);
                _mxKeyDir.unlock();

                if (!isReplacing) { continue; }

                // Remove the (potential) old value from the value cache
                if (oldCacheLoc != NotStored && _valueCache->isEnabled()) { _valueCache->removeValue(oldCacheLoc, keyHash); }

                // Update the data file statistics
                _mxDataFiles.lockRead();
                _dataFiles[oldFileId]->deadBytes += (uint32_t)sizeof(DataFileEntry) + oldValueSize + keySize;
                _dataFiles[oldFileId]->deadEntries += 1;
                _mxDataFiles.unlockRead();
            }

        }  // End of service loop
    }

    void mergeThreadEntry()
    {
        using namespace litecask::detail;
        log(LogLevel::Debug, "Merge thread started");

        // Merge service loop
        while (!_mergeExit.load()) {
            {
                // Wait for a merge period or explicit request
                std::unique_lock<std::mutex> lk(_mergeMutex);
                _mergeCv.wait_for(lk, std::chrono::milliseconds(_config.mergeCyclePeriodMs),
                                  [this] { return _mergeExit.load() || _mergeWork.load(); });
                if (_mergeExit.load()) continue;
            }

            log(LogLevel::Debug, "Merge process started");

            // Snapshot the protected configuration
            _mxConfig.lock();
            Config c = _config;
            _mxConfig.unlock();
            ++_stats.mergeCycleQty;

            // Analyze the data files to select which ones to merge, if any
            lcVector<MergeFileInfo> mergeInfos;
            if (isItWorthMerging(c.mergeTriggerDataFileFragmentationPercentage, c.mergeTriggerDataFileDeadByteThreshold)) {
                selectDataFilesToMerge(c.mergeSelectDataFileFragmentationPercentage, c.mergeSelectDataFileDeadByteThreshold,
                                       c.mergeSelectDataFileSmallSizeTheshold, mergeInfos);
            }

            if (!mergeInfos.empty()) {
                // Mandatory switch of the active file for the following reasons:
                //  - it ensures that the previous active file can be merged, as it was potentially selected
                //  - it ensures that the naming of the new compacted data files is unique
                _mxActiveFile.lock();
                lcString mergeBasename = createNewActiveDataFileUnlocked();
                _mxActiveFile.unlock();

                // Create the new compacted data files from the selected files
                createMergedDataFiles(mergeInfos, mergeBasename, c.dataFileMaxBytes);

                // Add the new data files, remove the old ones, and update the memory KeyDir
                replaceDataFiles(mergeInfos);

                ++_stats.mergeCycleWithMergeQty;
            }

            if (_someHintFilesAreMissing) {
                // This flag is set once at database opening, so this section will be run once too
                _someHintFilesAreMissing = false;
                for (uint32_t fileId = 0; fileId < _dataFiles.size(); ++fileId) {
                    if (fileId == _activeDataFileId) continue;
                    const DataFile* dfd          = _dataFiles[fileId];
                    fs::path        hintFilename = fs::path(dfd->filename).replace_extension(HintFileSuffix);
                    if (osIsValidHandle(dfd->handle) && !fs::exists(hintFilename)) {
                        log(LogLevel::Debug, "Merge thread started");
                        createHintFile(dfd->filename, hintFilename);
                    }
                    ++_stats.hintFileCreatedQty;
                }
            }

            _mergeWork.store(false);  // Work finished
        }                             // End of service loop

        log(LogLevel::Debug, "Merge thread stopped");
    }

    // File cleaning before opening the data store. The cleaning instructions comes from the file extension.
    // Robustness comes from the atomic nature of some file operations (creation and renaming)
    Status sanitizeAndCollectDataFiles(const fs::path& dbDirectory, uint64_t& maxDataFileIndex, lcVector<lcString>& baseDataFilenames)
    {
        using namespace litecask::detail;
        fs::path dbDirectoryPath = dbDirectory / "";

        baseDataFilenames.clear();
        maxDataFileIndex = 1;
        lcVector<DirEntry> entries;
        if (!osGetDirContent(dbDirectoryPath, entries)) { return Status::CannotOpenStore; }

        struct OrderedDataFiles {
            lcString name;
            double   index;
        };
        lcVector<OrderedDataFiles> orderedDataFiles;

        for (const auto& e : entries) {
            if (e.isDir) continue;
            fs::path entryFilename = dbDirectoryPath / e.name;

            // Remove ".tmp" files which correspond to an unfinished merge due to a crash
            if (entryFilename.extension() == TmpFileSuffix) {
                log(LogLevel::Info, "Removing unfinished merge file %s", entryFilename.c_str());
                osRemoveFile(entryFilename);
            }

            // Remove ".to_remove" tag files and associated data files, which is a cleanup of redundant file not removed due to a crash
            else if (entryFilename.extension() == ToRemoveFileSuffix) {
                log(LogLevel::Info, "Removing old data file %s", entryFilename.replace_extension(DataFileSuffix).string().c_str());
                // First the data file (if exists)
                osRemoveFile(entryFilename.replace_extension(DataFileSuffix));
                // then the hint file (if exists)
                osRemoveFile(entryFilename.replace_extension(HintFileSuffix));
                // and last the removal instruction
                osRemoveFile(entryFilename.replace_extension(ToRemoveFileSuffix));
            }

            // Remove standalone hint files
            else if (entryFilename.extension() == HintFileSuffix &&
                     osGetFileSize(fs::path(entryFilename).replace_extension(DataFileSuffix)) <= 0) {
                osRemoveFile(entryFilename);
            }

            // Remove zero sized data files
            else if (entryFilename.extension() == DataFileSuffix && osGetFileSize(entryFilename) == 0) {
                log(LogLevel::Info, "Removing zero size data file %s", entryFilename.c_str());
                osRemoveFile(entryFilename);
            }

            // List the data files
            else if (entryFilename.extension() == DataFileSuffix) {
                // Get the data file number as "double" (decimals created by merge process), as their order matters
                double fileNumber = strtod(entryFilename.stem().string().c_str(), nullptr);
                if (fileNumber > 0.) {
                    // Store the data file basename in the list
                    orderedDataFiles.push_back({entryFilename.replace_extension("").string(), fileNumber});
                    // Get the highest file number
                    if ((uint64_t)fileNumber > maxDataFileIndex) { maxDataFileIndex = (uint64_t)fileNumber; }
                }
            }
        }

        // Fill the output list of ordered data files (oldest data files first)
        std::sort(orderedDataFiles.begin(), orderedDataFiles.end(),
                  [](const OrderedDataFiles& a, const OrderedDataFiles& b) { return a.index < b.index; });
        baseDataFilenames.reserve(orderedDataFiles.size());
        for (const auto& e : orderedDataFiles) baseDataFilenames.push_back(e.name);

        return Status::Ok;
    }

    bool createHintFile(const lcString& readDataFilename, const fs::path& writeHintFilename)
    {
        using namespace litecask::detail;
        log(LogLevel::Info, "Creating hint file for %s", readDataFilename.c_str());

        // We use fopen/fread/fwrite here because of standard usage and the provided buffering
        FILE* fhr = osFopen(readDataFilename, "rb");
        assert(fhr);
        FILE* fhw = osFopen(writeHintFilename.string() + TmpFileSuffix, "wb");
        assert(fhw);

        DataFileEntry     header;
        lcVector<uint8_t> buf(1024);
        bool              isOk          = true;
        uint32_t          fileOffset    = 0;
        uint32_t          fileIncrement = 0;

        while (fread(&header, sizeof(DataFileEntry), 1, fhr) == 1) {
            uint32_t keySize      = header.keySize;
            uint32_t keyIndexSize = header.keyIndexSize;
            uint32_t valueSize    = header.valueSize;

            if (keySize == 0) {
                log(LogLevel::Error, "Cannot create the hint file for %s: a key in the data file has a null (=corrupted) size",
                    readDataFilename.c_str());
                isOk = false;
                break;
            }

            if (keyIndexSize > MaxKeyIndexQty * sizeof(KeyIndex)) {
                log(LogLevel::Error, "Cannot create the hint file for %s: a key has too big index (byte size=%d > %" PRId64 ")",
                    readDataFilename.c_str(), keyIndexSize, MaxKeyIndexQty * sizeof(KeyIndex));
                break;
            }

            if (valueSize == DeletedEntry) {
                // Tombstone case (no key index stored)
                if (buf.size() < keySize) buf.resize(keySize);
                if (fread(buf.data(), 1, keySize, fhr) != keySize) {
                    log(LogLevel::Error,
                        "Cannot create the hint file for %s: unable to read all the bytes (%d) of the deleted key at file offset %u",
                        readDataFilename.c_str(), keySize, fileOffset);
                    isOk = false;
                    break;
                }
                keyIndexSize  = 0;
                fileIncrement = sizeof(DataFileEntry) + keySize;
            }

            else {
                uint32_t allSize = keySize + keyIndexSize + valueSize;
                if (buf.size() < allSize) buf.resize(allSize);
                if (fread(buf.data(), 1, allSize, fhr) != allSize) {
                    log(LogLevel::Error,
                        "Cannot create the hint file for %s: unable to read all the bytes (%d) of the key and value at file offset %u",
                        readDataFilename.c_str(), allSize, fileOffset);
                    isOk = false;
                    break;
                }
                fileIncrement = (uint32_t)sizeof(DataFileEntry) + allSize;
            }

            HintFileEntry hfe{fileOffset, header.expTimeSec, valueSize, (uint16_t)keySize, (uint8_t)keyIndexSize, 0};
            if (fwrite(&hfe, sizeof(HintFileEntry), 1, fhw) != 1 ||
                fwrite(buf.data(), 1, keySize + keyIndexSize, fhw) != keySize + keyIndexSize) {
                log(LogLevel::Error, "Cannot create the hint file for %s: unable to write the hint entry (size=%" PRId64 ")",
                    readDataFilename.c_str(), sizeof(HintFileEntry) + keySize + keyIndexSize);
                isOk = false;
                break;
            }

            fileOffset += fileIncrement;
        }

        fclose(fhw);
        fclose(fhr);

        if (isOk) {
            [[maybe_unused]] bool isRenamingOk = osRenameFile(writeHintFilename.string() + TmpFileSuffix, writeHintFilename);
            assert(isRenamingOk);
        }
        return isOk;
    }

    bool loadHintFile(const lcString& hintFilename, uint16_t fileId, ArenaAllocator& loadArena,
                      lcVector<detail::LoadedKeyChunk>& keyEntries)
    {
        using namespace litecask::detail;
        log(LogLevel::Debug, "Loading hint file %s", hintFilename.c_str());

        keyEntries.clear();
        loadArena.reset();

        // We use fopen/fread/fwrite here because of standard usage and the provided buffering
        int64_t fileSize = osGetFileSize(hintFilename);
        if (fileSize <= 0) { return false; }
        FILE* fh = osFopen(hintFilename, "rb");
        if (!fh) { return false; }

        // Loading fully the hint file in one call, as we need anyway the key and keyindexes
        uint8_t* buf = loadArena.allocate(fileSize);
        assert(buf && "The hint file is too big");
        size_t readSize = fread(buf, 1, fileSize, fh);
        fclose(fh);

        HintFileEntry header;
        bool          isOk       = true;
        size_t        readOffset = 0;

        while (isOk && readOffset + sizeof(HintFileEntry) < readSize) {
            // Copy due to uncontrolled alignment
            memcpy(&header, &buf[readOffset], sizeof(HintFileEntry));

            // Parse the header
            if (header.keySize == 0) {
                log(LogLevel::Error, "Cannot load the hint file %s: a key has a null (=corrupted) size", hintFilename.c_str());
                isOk = false;
                break;
            }

            if (header.keyIndexSize > MaxKeyIndexQty * sizeof(KeyIndex)) {
                log(LogLevel::Error, "Cannot read the hint file %s: an index has a too big value (byte size=%d > %" PRId64 ")",
                    hintFilename.c_str(), header.keyIndexSize, MaxKeyIndexQty * sizeof(KeyIndex));
                isOk = false;
                break;
            }

            if (header.keyIndexSize & 0x1) {
                log(LogLevel::Error, "Cannot read the hint file %s: an index has an odd size (byte size=%d)", hintFilename.c_str(),
                    header.keyIndexSize);
                break;
            }

            size_t entrySize = sizeof(HintFileEntry) + (int)header.keySize + (int)header.keyIndexSize;
            if (readOffset + entrySize > readSize) {
                log(LogLevel::Warn, "The hint file %s is corrupted", hintFilename.c_str());
                break;  // End of file reached (and corrupted last entry)
            }
            uint8_t* key        = &buf[readOffset + sizeof(HintFileEntry)];
            uint64_t keyHash    = LITECASK_HASH_FUNC(key, header.keySize);
            uint8_t* keyIndexes = key + header.keySize;

            // Note: the key and keyIndexes pointers are persistent in the memory arena (until it is reset)
            // The changeCounter initialized with the readOffset is to provide some spreading for the initial value
            keyEntries.push_back({{header.expTimeSec, header.valueSize, NotStored, header.fileOffset, fileId, header.keySize,
                                   header.keyIndexSize, (uint8_t)readOffset},
                                  (uint32_t)keyHash,
                                  key,
                                  keyIndexes});
            readOffset += entrySize;
        }

        return isOk;
    }

    bool loadDataFile(const lcString& dataFilename, uint16_t fileId, ArenaAllocator& loadArena,
                      lcVector<detail::LoadedKeyChunk>& keyEntries)
    {
        using namespace litecask::detail;
        log(LogLevel::Debug, "Loading data file %s", dataFilename.c_str());

        keyEntries.clear();

        // We use fopen/fread/fwrite here because of the provided buffering and sequential reading
        FILE* fh = osFopen(dataFilename, "rb");
        if (!fh) return false;

        DataFileEntry     header;
        lcVector<uint8_t> buf;
        bool              isOk          = true;
        uint32_t          fileOffset    = 0;
        uint64_t          valueHash     = 0;
        uint32_t          fileIncrement = 0;

        while (isOk && fread(&header, sizeof(DataFileEntry), 1, fh) == 1) {
            uint32_t keySize      = header.keySize;
            uint32_t keyIndexSize = header.keyIndexSize;
            uint32_t valueSize    = header.valueSize;

            if (keySize == 0) {
                log(LogLevel::Error,
                    "Cannot load the data file %s: a key has a null (=corrupted) size (value size is said to be %u) at file offset %u",
                    dataFilename.c_str(), valueSize, fileOffset);
                isOk = false;
                break;
            }

            if (keyIndexSize > MaxKeyIndexQty * sizeof(KeyIndex)) {
                log(LogLevel::Error, "Cannot load the data file %s: an index has a too big value (byte size=%d > %" PRId64 ")",
                    dataFilename.c_str(), keyIndexSize, MaxKeyIndexQty * sizeof(KeyIndex));
                break;
            }

            if (keyIndexSize & 0x1) {
                log(LogLevel::Error, "Cannot load the data file %s: an index has an odd size (byte size=%d)", dataFilename.c_str(),
                    keyIndexSize);
                break;
            }

            if (valueSize != DeletedEntry) {
                if (buf.size() < keySize + keyIndexSize + valueSize) buf.resize(keySize + keyIndexSize + valueSize);
                if (fread(buf.data(), 1, keySize + keyIndexSize + valueSize, fh) != keySize + keyIndexSize + valueSize) {
                    log(LogLevel::Warn,
                        "Cannot load the data file %s: unable to read all the bytes (%u) of the entry at file offset %u. May be last entry "
                        "not fully written...",
                        dataFilename.c_str(), keySize + keyIndexSize + valueSize, fileOffset);
                    break;
                }
                valueHash     = LITECASK_HASH_FUNC(&buf[keySize], valueSize);
                fileIncrement = (uint32_t)sizeof(DataFileEntry) + keySize + keyIndexSize + valueSize;
            }

            else {
                if (buf.size() < keySize) buf.resize(keySize);
                if (fread(buf.data(), 1, keySize, fh) != keySize) {
                    log(LogLevel::Warn,
                        "Cannot load the data file %s: unable to read all the bytes (%u) of the deleted  entry at file offset %u. May be "
                        "last entry not fully written...",
                        dataFilename.c_str(), keySize, fileOffset);
                    break;
                }
                valueHash     = 0;
                keyIndexSize  = 0;  // No key index shall be stored for tombstones
                fileIncrement = sizeof(DataFileEntry) + keySize;
            }

            // Copy the key and index in the memory arena
            uint8_t* persistentPtr = loadArena.allocate(keySize + keyIndexSize);
            memcpy(persistentPtr, buf.data(), keySize + keyIndexSize);
            uint8_t* key        = persistentPtr;
            uint64_t keyHash    = LITECASK_HASH_FUNC(key, keySize);
            uint8_t* keyIndexes = key + keySize;
            uint32_t checksum   = (uint32_t)(keyHash ^ valueHash);
            if (header.checksum != checksum) {
                log(LogLevel::Warn, "Cannot load the data file %s: the entry is corrupted (bad checksum) at file offset %u",
                    dataFilename.c_str(), fileOffset);
                isOk = false;
                break;
            }
            // The changeCounter initialized with the checksum is to provide some spreading for the initial value
            keyEntries.push_back(
                {{header.expTimeSec, valueSize, NotStored, fileOffset, fileId, (uint16_t)keySize, (uint8_t)keyIndexSize, (uint8_t)checksum},
                 (uint32_t)keyHash,
                 key,
                 keyIndexes});

            fileOffset += fileIncrement;
        }

        fclose(fh);
        return isOk;
    }

    void flushWriteBufferUnlocked()
    {
        assert(_activeDataOffset >= _activeFlushedDataOffset);
        if (_activeDataOffset - _activeFlushedDataOffset > 0) {
            lcOsFileHandle fh = _dataFiles[_activeDataFileId]->handle;
            assert(osIsValidHandle(fh));
            if (!osOsWrite(fh, _writeBuffer.data(), _activeDataOffset - _activeFlushedDataOffset)) {
                fatalHandler("flushWriteBufferUnlocked: Unable to flush the write buffer (size=%d)",
                             _activeDataOffset - _activeFlushedDataOffset);
            }
            _activeFlushedDataOffset = _activeDataOffset;
        }
    }

    // The "data file" *write* lock must be taken before the call
    uint16_t getFreeDataFileIdUnlocked()
    {
        uint16_t fileId = 0xFFFF;
        if (!_freeDataFileIds.empty()) {
            fileId = _freeDataFileIds.back();
            _freeDataFileIds.pop_back();
        } else {
            fileId = (uint16_t)_dataFiles.size();
            _dataFiles.push_back(new detail::DataFile());
            ++_stats.dataFileMaxQty;
        }
        ++_stats.dataFileCreationQty;
        return fileId;
    }

    // The default handler is displaying on console with a relative date
    void defaultLogHandler(LogLevel level, const char* message, bool closeDbNotification) const
    {
        constexpr const char* levelStr[5] = {"[debug]", "[info ]", "[warn ]", "[error]", "[FATAL]"};
        static FILE*          fileHandle  = nullptr;

        // Log file management
        if (closeDbNotification) {
            if (fileHandle) {
                fclose(fileHandle);
                fileHandle = nullptr;
            }
            return;
        }
        if (!fileHandle) {
            if (!_directory.empty()) {
                // Manage big log files (at open time only)
                if (osGetFileSize(_directory / "litecask.log") > _maxLogFileBytes) {
                    // Return status is ignored on purpose, as files may not exist
                    osRenameFile(_directory / "litecask4.log", _directory / "litecask5.log");
                    osRenameFile(_directory / "litecask3.log", _directory / "litecask4.log");
                    osRenameFile(_directory / "litecask2.log", _directory / "litecask3.log");
                    osRenameFile(_directory / "litecask1.log", _directory / "litecask2.log");
                    osRenameFile(_directory / "litecask.log", _directory / "litecask1.log");
                }
                // Create / append the current log file
                fileHandle = osFopen(_directory / "litecask.log", "a");
            }
            if (!fileHandle) { return; }
        }

        auto        now     = std::chrono::system_clock::now();
        std::time_t nowDate = std::chrono::system_clock::to_time_t(now);
        std::string dateStr(32, '\0');
        std::strftime(dateStr.data(), dateStr.size(), "%Y-%m-%d %H:%M:%S", std::localtime(&nowDate));
        uint64_t dateMs = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

        if (fprintf(fileHandle, "[%s.%03d] %s %s\n", dateStr.c_str(), (int)(dateMs % 1000), levelStr[(int)level], message) < 0) {
            // Write issue: closing the file pointer
            fclose(fileHandle);
            fileHandle = nullptr;
        }
    }

    void LITECASK_PRINTF_CHECK(3, 4) log(LogLevel level, LITECASK_PRINTF_FORMAT_STRING const char* format, ...)
    {
        // Filter the log based on the level
        if (level < _logLevel) { return; }

        // Format the message
        char    message[512];
        va_list args;
        va_start(args, format);
        vsnprintf(message, sizeof(message), format, args);
        va_end(args);

        // Thread-safe forwarding to the handler
        std::lock_guard<std::mutex> lk(_logMx);
        _logHandler(level, message, false);
    }

    void LITECASK_PRINTF_CHECK(2, 3) fatalHandler(LITECASK_PRINTF_FORMAT_STRING const char* format, ...)
    {
        // Format the message
        char    message[512];
        va_list args;
        va_start(args, format);
        vsnprintf(message, sizeof(message), format, args);
        va_end(args);

        // Thread-safe forwarding to the handler
        {
            std::lock_guard<std::mutex> lk(_logMx);
            _logHandler(LogLevel::Fatal, message, true);
        }

        // Exit in error
        exit(1);
    }

    // To use only in the context of testing (with "private:" disabled)
    void setTestTimeFunction(const std::function<uint32_t()>& testTimeFunc) { _getTestTime = testTimeFunc; }

    void setTestLogMaxFileBytes(int64_t maxLogFileBytes) { _maxLogFileBytes = maxLogFileBytes; }

    void updateNow()
    {
        if (LITECASK_UNLIKELY(_getTestTime)) {
            // This optional time function is provided in the context of testing only
            _nowTimeSec = _getTestTime();
        } else {
            _nowTimeSec =
                (uint32_t)std::chrono::duration_cast<std::chrono::seconds>(std::chrono::system_clock::now().time_since_epoch()).count();
        }
        _keyDir->setNow(_nowTimeSec);
    }

    bool                        _isInitialized = false;
    uint32_t                    _nowTimeSec    = 0;  // Unix timestamp in second
    lcVector<detail::DataFile*> _dataFiles;
    lcVector<uint16_t>          _freeDataFileIds;
    detail::KeyDirMap*          _keyDir     = nullptr;
    detail::ValueCache*         _valueCache = nullptr;
    detail::IndexMap*           _indexMap   = nullptr;
    lcVector<uint8_t>           _writeBuffer;
    uint64_t                    _maxDataFileIndex        = 1;
    uint32_t                    _activeDataOffset        = 0;
    uint32_t                    _activeFlushedDataOffset = 0;  // Last "write buffer" write on disk
    uint16_t                    _activeDataFileId        = 0xFFFF;
    uint64_t                    _dataFileMaxBytes        = 100'000'000;  // Copied from the config for efficiency in multithread environment
    int64_t                     _maxLogFileBytes         = 10'000'000;

    alignas(detail::CpuCacheLine) mutable detail::RWLock _mxDataFiles;    // lockRead: using _dataFiles, lockWrite: data files changes
    alignas(detail::CpuCacheLine) mutable detail::RWLock _mxWriteBuffer;  // lock for using the current write buffer
    alignas(detail::CpuCacheLine) mutable detail::RWLock _mxIndexMap;     // lock for using the index lookup
    alignas(detail::CpuCacheLine) mutable std::mutex _mxActiveFile;       // lock for using active file (write entry)
    alignas(detail::CpuCacheLine) mutable std::mutex _mxKeyDir;           // lock for writing the hashmap
    alignas(detail::CpuCacheLine) mutable std::mutex _mxConfig;           // lock for reading or writing the config

    // Control of merge operations thread. May be long operations
    std::thread             _mergeThread;
    std::mutex              _mergeMutex;
    std::condition_variable _mergeCv;
    std::atomic<bool>       _mergeWork               = false;
    std::atomic<bool>       _mergeExit               = false;
    bool                    _someHintFilesAreMissing = false;

    // Control of upkeep operations thread (KeyDir resizing, cache queues, ...). Fine granularity
    std::thread             _upkeepThread;
    std::mutex              _upkeepMutex;
    std::condition_variable _upkeepCv;
    std::atomic<bool>       _upkeepWork                        = false;
    std::atomic<bool>       _upkeepExit                        = false;
    uint64_t                _upkeepLastActiveFlushedTimeMs     = 0;
    uint32_t                _upkeepLastActiveFlushedDataOffset = detail::NotStored;
    uint16_t                _upkeepLastActiveDataFileId        = 0xFFFF;

    // Logging
    std::mutex _logMx;
    LogLevel   _logLevel = LogLevel::Info;

    std::function<void(LogLevel, const char*, bool)> _logHandler;
    std::function<uint32_t()>                        _getTestTime;

    Config            _config;
    fs::path          _directory;
    DatastoreCounters _stats;
};

}  // namespace litecask
