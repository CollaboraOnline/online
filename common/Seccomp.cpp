/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * Code to lock-down the environment of the processes we run, to avoid
 * exotic or un-necessary system calls to be used to break containment.
 */

#include "config.h"

#include <dlfcn.h>
#include <ftw.h>
#include <malloc.h>
#include <sys/capability.h>
#include <unistd.h>
#include <utime.h>

#include <common/Log.hpp>

#include <Seccomp.hpp>

#include <sys/prctl.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>

#if defined(__x86_64__)
#  define AUDIT_ARCH_NR AUDIT_ARCH_X86_64
#else
#  error "Platform does not support seccomp filtering yet - unsafe."
#endif

namespace Seccomp {

bool lockdown(Type type)
{
    (void)type; // so far just the kit.

    #define ACCEPT_SYSCALL(name) \
        BPF_JUMP(BPF_JMP+BPF_JEQ+BPF_K, __NR_##name, 0, 1), \
        BPF_STMT(BPF_RET+BPF_K, SECCOMP_RET_ALLOW)

    #define KILL_SYSCALL(name) \
        BPF_JUMP(BPF_JMP+BPF_JEQ+BPF_K, __NR_##name, 0, 1), \
        BPF_STMT(BPF_RET+BPF_K, SECCOMP_RET_KILL)

    struct sock_filter filterCode[] = {
        // Check our architecture is correct.
        BPF_STMT(BPF_LD+BPF_W+BPF_ABS,  offsetof(struct seccomp_data, arch)),
        BPF_JUMP(BPF_JMP+BPF_JEQ+BPF_K, AUDIT_ARCH_NR, 1, 0),
        BPF_STMT(BPF_RET+BPF_K,         SECCOMP_RET_KILL),

        // Load sycall number
        BPF_STMT(BPF_LD+BPF_W+BPF_ABS,  offsetof(struct seccomp_data, nr)),

        // ------------------------------------------------------------
        // ---   First white-list the syscalls we frequently use.   ---
        // ------------------------------------------------------------
        ACCEPT_SYSCALL(recvfrom),
        ACCEPT_SYSCALL(write),
        ACCEPT_SYSCALL(futex),

        // glibc's 'poll' has to answer for this lot:
        ACCEPT_SYSCALL(epoll_wait),
        ACCEPT_SYSCALL(epoll_ctl),
        ACCEPT_SYSCALL(epoll_create),
        ACCEPT_SYSCALL(close),
        ACCEPT_SYSCALL(nanosleep),

        // ------------------------------------------------------------
        // --- Now block everything that we don't like the look of. ---
        // ------------------------------------------------------------

        // FIXME: should we bother blocking calls that have early
        // permission checks we don't meet ?

#if 0
        // cf. eg. /usr/include/asm/unistd_64.h ...
        KILL_SYSCALL(ioctl),
        KILL_SYSCALL(mincore),
        KILL_SYSCALL(shmget),
        KILL_SYSCALL(shmat),
        KILL_SYSCALL(shmctl),
#endif
        KILL_SYSCALL(getitimer),
        KILL_SYSCALL(setitimer),
        KILL_SYSCALL(sendfile),
        KILL_SYSCALL(shutdown),
        KILL_SYSCALL(listen),  // server sockets
        KILL_SYSCALL(accept),  // server sockets
#if 0
        KILL_SYSCALL(wait4),
#endif
        KILL_SYSCALL(kill),   // !
        KILL_SYSCALL(shmctl),
        KILL_SYSCALL(ptrace), // tracing
        KILL_SYSCALL(capset),
        KILL_SYSCALL(uselib),
        KILL_SYSCALL(personality), // !
        KILL_SYSCALL(vhangup),
        KILL_SYSCALL(modify_ldt), // !
        KILL_SYSCALL(pivot_root), // !
        KILL_SYSCALL(chroot),
        KILL_SYSCALL(acct),   // !
        KILL_SYSCALL(sync),   // I/O perf.
        KILL_SYSCALL(mount),
        KILL_SYSCALL(umount2),
        KILL_SYSCALL(swapon),
        KILL_SYSCALL(swapoff),
        KILL_SYSCALL(reboot), // !
        KILL_SYSCALL(sethostname),
        KILL_SYSCALL(setdomainname),
        KILL_SYSCALL(tkill),
        KILL_SYSCALL(mbind), // vm bits
        KILL_SYSCALL(set_mempolicy), // vm bits
        KILL_SYSCALL(get_mempolicy), // vm bits
        KILL_SYSCALL(kexec_load),
        KILL_SYSCALL(add_key),     // kernel keyring
        KILL_SYSCALL(request_key), // kernel keyring
        KILL_SYSCALL(keyctl),      // kernel keyring
        KILL_SYSCALL(inotify_init),
        KILL_SYSCALL(inotify_add_watch),
        KILL_SYSCALL(inotify_rm_watch),
        KILL_SYSCALL(unshare),
        KILL_SYSCALL(splice),
        KILL_SYSCALL(tee),
        KILL_SYSCALL(vmsplice), // vm bits
        KILL_SYSCALL(move_pages), // vm bits
        KILL_SYSCALL(accept4), // server sockets
        KILL_SYSCALL(inotify_init1),
        KILL_SYSCALL(perf_event_open), // profiling
        KILL_SYSCALL(fanotify_init),
        KILL_SYSCALL(fanotify_mark),
        KILL_SYSCALL(seccomp), // no further fiddling
        KILL_SYSCALL(bpf),     // no further fiddling

        // allow the rest - FIXME: prolly we should white-list
        // but LibreOffice is rather large.
        BPF_STMT(BPF_RET+BPF_K, SECCOMP_RET_ALLOW)
    };

    struct sock_fprog filter = {
        sizeof(filterCode)/sizeof(filterCode[0]), // length
        filterCode
    };

    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0))
    {
        LOG_ERR("Cannot turn off acquisition of new privileges for us & children");
        return false;
    }
    if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &filter))
    {
        LOG_ERR("Failed to install seccomp syscall filter");
        return false;
    }

    LOG_TRC("Install seccomp filter successfully.");
    return true;
}

} // namespace Seccomp

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
