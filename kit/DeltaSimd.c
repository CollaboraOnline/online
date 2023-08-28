/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

// This is a C file - to avoid inclusion of C++ headers
// since compiling with different instruction set can generate
// versions of inlined code that get injected outside of this
// module by the linker.

#include <config.h>
#include "DeltaSimd.h"

#if ENABLE_SIMD
#  include <immintrin.h>
#endif

int simd_initPixRowSimd(const uint32_t *from, uint32_t *scratch, unsigned int *scratchLen, uint64_t *rleMask)
{
#if !ENABLE_SIMD
    // no fun.
    (void)from; (void)scratch; (void)scratchLen; (void)rleMask;
    return 0;
#else // ENABLE_SIMD
    // do accelerated things here.
    (void)from; (void)scratch; (void)scratchLen; (void)rleMask;
    return 0;

#endif
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
