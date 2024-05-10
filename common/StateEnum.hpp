/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <iosfwd>
#include <type_traits>
#include <string>

/// Enum macro specifically for state-machines.
/// Has several limitations, some intentional. For example,
/// the states must have automatic, sequential, values.
/// But also has some advantages, for example it can be used inside classes.
/// Some ideas from https://stackoverflow.com/questions/28828957/enum-to-string-in-modern-c11-c14-c17-and-future-c20
/// and from https://github.com/pfultz2/Cloak/wiki/C-Preprocessor-tricks,-tips,-and-idioms

#define STRINGIFY1(_, e) #e,
#define STRINGIFY2(NAME, e) #NAME "::" #e,
#define CONCAT(X, Y) X##Y
#define CALL(X, ...) X(__VA_ARGS__)

#define APPLY1(MACRO, NAME, e) MACRO(NAME, e)
#define APPLY2(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY1(MACRO, NAME, __VA_ARGS__)
#define APPLY3(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY2(MACRO, NAME, __VA_ARGS__)
#define APPLY4(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY3(MACRO, NAME, __VA_ARGS__)
#define APPLY5(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY4(MACRO, NAME, __VA_ARGS__)
#define APPLY6(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY5(MACRO, NAME, __VA_ARGS__)
#define APPLY7(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY6(MACRO, NAME, __VA_ARGS__)
#define APPLY8(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY7(MACRO, NAME, __VA_ARGS__)
#define APPLY9(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY8(MACRO, NAME, __VA_ARGS__)
#define APPLY10(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY9(MACRO, NAME, __VA_ARGS__)
#define APPLY11(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY10(MACRO, NAME, __VA_ARGS__)
#define APPLY12(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY11(MACRO, NAME, __VA_ARGS__)
#define APPLY13(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY12(MACRO, NAME, __VA_ARGS__)
#define APPLY14(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY13(MACRO, NAME, __VA_ARGS__)
#define APPLY15(MACRO, NAME, e, ...) MACRO(NAME, e) APPLY14(MACRO, NAME, __VA_ARGS__)

// Credit to Anton Bachin for this trick.
#define GET_COUNT(_1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, c, ...) c
#define COUNT_ARGS(...) GET_COUNT(__VA_ARGS__, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1)

#define APPLY(MACRO, NAME, ...)                                                                    \
    CALL(CONCAT, APPLY, COUNT_ARGS(__VA_ARGS__))(MACRO, NAME, __VA_ARGS__)
#define FOR_EACH(MACRO, NAME, ...) APPLY(MACRO, NAME, __VA_ARGS__)

/// Define a state-machine with various independent states.
/// NAME is the name of the state enum followed by the state names.
#define STATE_ENUM(NAME, ...)                                                                      \
    enum class NAME : char;                                                                        \
    /* Returns the state name only, without the namespace. */                                      \
    static inline const char* nameShort(NAME e)                                                    \
    {                                                                                              \
        static const char* const NAME##_names[] = { FOR_EACH(STRINGIFY1, NAME, __VA_ARGS__) };     \
        assert(static_cast<unsigned>(e) < N_ELEMENTS(NAME##_names) &&                              \
               "Enum value is out of range.");                                                     \
        return NAME##_names[static_cast<int>(e)];                                                  \
    }                                                                                              \
    /* Returns the state name only, without the namespace, as a std::string. */                    \
    static inline std::string toStringShort(NAME e)                                                \
    {                                                                                              \
        return nameShort(e);                                                                       \
    }                                                                                              \
    /* Returns the state name with the namespace. */                                               \
    static inline const char* name(NAME e)                                                         \
    {                                                                                              \
        static const char* const NAME##_names[] = { FOR_EACH(STRINGIFY2, NAME, __VA_ARGS__) };     \
        assert(static_cast<unsigned>(e) < N_ELEMENTS(NAME##_names) &&                              \
               "Enum value is out of range.");                                                     \
        return NAME##_names[static_cast<int>(e)];                                                  \
    }                                                                                              \
    /* Returns the state name, with the namespace, as a std::string. */                            \
    static inline std::string toString(NAME e)                                                     \
    {                                                                                              \
        return name(e);                                                                            \
    }                                                                                              \
    static const size_t NAME##Max = COUNT_ARGS(__VA_ARGS__);                                       \
    enum class NAME : char                                                                         \
    {                                                                                              \
        __VA_ARGS__                                                                                \
    }

/// Support seamless serialization of STATE_ENUM to ostream.
template <typename T, typename std::enable_if<
                          std::is_same<decltype(name(T())), const char*>::value>::type* = nullptr>
inline std::ostream& operator<<(std::ostream& os, const T state)
{
    os << name(state);
    return os;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
