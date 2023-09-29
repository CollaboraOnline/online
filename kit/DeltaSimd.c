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
#include <string.h>
#include <stdio.h>
#include "DeltaSimd.h"

#if ENABLE_SIMD
#  include <immintrin.h>

#define DEBUG_LUT 0

// set of control data bytes for vperd
static __m256i vpermd_lut[256];
static __m256i vpermd_shift_left;
static __m256i vpermd_last_to_first;
static __m256i low_pixel_mask;

// Build table we can lookup bitmasks in to generate gather data
void init_gather_lut()
{
    for (unsigned int pattern = 0; pattern < 256; ++pattern)
    {
        unsigned int i = 0, src = 0;
        uint8_t lut[8];
        for (uint32_t bitToCheck = 1; bitToCheck < 256; bitToCheck <<= 1)
        {
            if (!(pattern & bitToCheck)) // set bit is a duplicate -> ignore.
                lut[i++] = src;
            src++;
        }
        while (i<8) // pad to copy first point
                lut[i++] = 0;

#if DEBUG_LUG
        fprintf(stderr, "lut mask: 0x%x generates %d %d %d %d %d %d %d %d\n",
                pattern, lut[7], lut[6], lut[5], lut[4], lut[3], lut[2], lut[1], lut[0]);
#endif
        vpermd_lut[pattern] = _mm256_set_epi8(
            0, 0, 0, lut[7],  0, 0, 0, lut [6],
            0, 0, 0, lut[5],  0, 0, 0, lut [4],
            0, 0, 0, lut[3],  0, 0, 0, lut [2],
            0, 0, 0, lut[1],  0, 0, 0, lut [0]);
    }

    vpermd_shift_left = _mm256_set_epi8(
        0, 0, 0, 6,  0, 0, 0, 5,
        0, 0, 0, 4,  0, 0, 0, 3,
        0, 0, 0, 2,  0, 0, 0, 1,
        0, 0, 0, 0,  0, 0, 0, 0);

    vpermd_last_to_first = _mm256_set_epi8(
        0, 0, 0, 0,  0, 0, 0, 0,
        0, 0, 0, 0,  0, 0, 0, 0,
        0, 0, 0, 0,  0, 0, 0, 0,
        0, 0, 0, 0,  0, 0, 0, 7);

    low_pixel_mask = _mm256_set_epi8(
        0, 0, 0, 0,  0, 0, 0, 0,
        0, 0, 0, 0,  0, 0, 0, 0,
        0, 0, 0, 0,  0, 0, 0, 0,
        0, 0, 0, 0,  0xff, 0xff, 0xff, 0xff);
}

// non-intuitively we need to use the sign bit as
// if floats to gather bits from 32bit words
static uint64_t diffMask(__m256i prev, __m256i curr)
{
    __m256i res = _mm256_cmpeq_epi32(prev, curr);
    __m256 m256 = _mm256_castsi256_ps(res);
    return _mm256_movemask_ps(m256);
}

#endif

void simd_deltaInit(void)
{
#if ENABLE_SIMD
    init_gather_lut();
#endif
}

// accelerated compression of a 256 pixel run
int simd_initPixRowSimd(const uint32_t *from, uint32_t *scratch, size_t *scratchLen, uint64_t *rleMaskBlock)
{
#if !ENABLE_SIMD
    // no fun.
    (void)from; (void)scratch; (void)scratchLen; (void)rleMaskBlock;
    return 0;

#else // ENABLE_SIMD

    *scratchLen = 0;
    for (unsigned int x = 0; x < 4; ++x)
        rleMaskBlock[x] = 0;

    const uint32_t* block = from;
    uint32_t* dest = scratch;
    __m256i prev = _mm256_setzero_si256(); // transparent

    for (unsigned int x = 0; x < 256; x += 8) // 8 pixels per cycle
    {
        __m256i curr = _mm256_loadu_si256((const __m256i_u*)(block));

        // Generate mask

        // get the last pixel into the least significant pixel
// FIXME: mask at the same time ?
//        __m256i lastPix = _mm256_maskz_permutexvar_epi32(0x1, prev, vpermd_last_to_first);
        __m256i lastPix = _mm256_permutevar8x32_epi32(prev, vpermd_last_to_first);
        lastPix = _mm256_and_si256(low_pixel_mask, lastPix);

        // shift the current pixels left
        prev = _mm256_permutevar8x32_epi32(curr, vpermd_shift_left);
        // mask out the bottom pixel
        prev = _mm256_andnot_si256(low_pixel_mask, prev);
        // merge in the last pixel
        prev = _mm256_or_si256(prev, lastPix);

        // turn that into a bit-mask.
        uint64_t newMask = diffMask(prev, curr);
        assert (newMask < 256);

        {
            unsigned int nMask = x >> 6; // 64 bits per mask
            unsigned int i = (x >> 3) & 0x7; // chunk of bits we work on
            rleMaskBlock[nMask] |= newMask << (i * 8);
        }

        // Shuffle the pixels and pack them
        __m256i control_vector = _mm256_loadu_si256(&vpermd_lut[newMask]);
        __m256i packed = _mm256_permutevar8x32_epi32(curr, control_vector);

        unsigned int countBitsUnset = _mm_popcnt_u32(newMask ^ 0xff);
        assert(countBitsUnset <= 8);

        // over-store in dest: we are guaranteed enough space worst-case
        _mm256_storeu_si256((__m256i*)dest, packed);

#if DEBUG_LUT
        if (countBitsUnset > 0)
            fprintf(stderr, "for mask: 0x%2x bits-unset %d we have:\n"
                    "%4x%4x%4x%4x%4x%4x%4x%4x\n"
                    "%4x%4x%4x%4x%4x%4x%4x%4x\n",
                    (unsigned int)newMask, countBitsUnset,
                    block[0], block[1], block[2], block[3], block[4], block[5], block[6], block[7],
                    dest[0], dest[1], dest[2], dest[3], dest[4], dest[5], dest[6], dest[7]);
#endif

        // move on for the next run.
        dest += countBitsUnset;

        // stash current for use next time around
        prev = curr;

        block += 8;
    }
    *scratchLen += dest - scratch;

    return 1;
#endif
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
