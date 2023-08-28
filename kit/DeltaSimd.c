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
#include <assert.h>
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

static uint64_t diffMask(__m256i prev, __m256i curr)
{
    __m256i res = _mm256_cmpeq_epi32(prev, curr);
    __m256 m256 = _mm256_castsi256_ps(res); // ?
    return _mm256_movemask_ps(m256);
}

#endif

// accelerated compression of a 256 pixel run
int simd_initPixRowSimd(const uint32_t *from, uint32_t *scratch, unsigned int *scratchLen, uint64_t *rleMaskBlock)
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

    // Caolan's intrinsic magic
    unsigned int x = 0;
    const uint32_t* block = from;
    for (unsigned int nMask = 0; nMask < 4; ++nMask)
    {
        uint64_t rleMask = 0;
        int remaining = 256 - x;
        assert(remaining % 8 == 0);
        int blocks = remaining/8;
        if (blocks > 8)
            blocks = 8;
        for (int i = 0; i < blocks; ++i)
        {
            switch (x)
            {
            case 0:
            {
                __m256i prev = _mm256_setr_epi32(0 /*transparent*/, block[0], block[1], block[2],
                                                 block[3], block[4], block[5], block[6]);
                __m256i curr = _mm256_loadu_si256((const __m256i_u*)(block));
                rleMask |= diffMask(prev, curr) << (i * 8);
                break;
            }
            default:
            {
                __m256i prev = _mm256_loadu_si256((const __m256i_u*)(block - 1));
                __m256i curr = _mm256_loadu_si256((const __m256i_u*)(block));
                rleMask |= diffMask(prev, curr) << (i * 8);
                break;
            }
            }
            block += 8;
            x += 8;
        }
        rleMaskBlock[nMask] = rleMask;
    }

    (void)scratch; (void)scratchLen;

    // unsigned int bitmask = <magic from shift/XOR ing etc. only 8 bits big>
    // __m256i control_vector = _mm256_loadu_si256((__m256i*)vpermd_lut[bitmask]);
    // __m256i result_vector = _mm256_permutevar8x32_epi32(<source_pixels>, control_vector);
    // bitsSet = _mm_popcnt_u32(bitmask ^ 0xff);
    // memcpy (scratch, result_vector, bitsSet);
    // scratch += bitsSet etc.

    return 1;
#endif
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
