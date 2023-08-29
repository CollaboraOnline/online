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

// set of control data bytes for vperd
static uint8_t vpermd_lut[256][8];

// Build table we can lookup bitmasks in to generate gather data
void init_gather_lut()
{
    for (unsigned int pattern = 0; pattern < 256; ++pattern)
    {
        unsigned int i = 0, src = 0;
        for (uint32_t bitToCheck = 1; bitToCheck < 256; bitToCheck <<= 1)
        {
            if (!(pattern & bitToCheck)) // set bit is a duplicate -> ignore.
                vpermd_lut[pattern][i++] = src;
            src++;
        }
        while (i<8) // pad to copy first point
                vpermd_lut[pattern][i++] = 0;
    }

    // NB for size in bytes - we can use popcount in 1 cycle rather than a table.
}

#endif


int simd_initPixRowSimd(const uint32_t *from, uint32_t *scratch, unsigned int *scratchLen, uint64_t *rleMask)
{
#if !ENABLE_SIMD
    // no fun.
    (void)from; (void)scratch; (void)scratchLen; (void)rleMask;
    return 0;
#else // ENABLE_SIMD

    static int lut_initialized = 0;
    if (!lut_initialized)
    {
        init_gather_lut();
        lut_initialized = 1;
    }

    // do accelerated things here.
    (void)from; (void)scratch; (void)scratchLen; (void)rleMask;

    // Caolan's intrinsic magic

    // unsigned int bitmask = <magic from shift/XOR ing etc. only 8 bits big>
    // __m256i control_vector = _mm256_loadu_si256((__m256i*)vpermd_lut[bitmask]);
    // __m256i result_vector = _mm256_permutevar8x32_epi32(<source_pixels>, control_vector);
    // bitsSet = _mm_popcnt_u32(bitmask ^ 0xff);
    // memcpy (scratch, result_vector, bitsSet);
    // scratch += bitsSet etc.

    return 0; // 1 when we're done.
#endif
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
