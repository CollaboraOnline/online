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
#include <signal.h>
#include <sys/prctl.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>

#include <common/Log.hpp>
#include <common/SigUtil.hpp>
#include <Seccomp.hpp>

#ifndef SYS_SECCOMP
#  define SYS_SECCOMP 1
#endif

#if defined(__x86_64__)
#  define AUDIT_ARCH_NR AUDIT_ARCH_X86_64
#  define REG_SYSCALL   REG_RAX
#else
#  error "Platform does not support seccomp filtering yet - unsafe."
#endif

extern "C" {

static void handleSysSignal(int /* signal */,
                            siginfo_t *info,
                            void *context)
{
	ucontext_t *uctx = reinterpret_cast<ucontext_t *>(context);

    Log::signalLogPrefix();
    Log::signalLog("SIGSYS trapped with code: ");
    Log::signalLogNumber(info->si_code);
    Log::signalLog(" and context ");
    Log::signalLogNumber(reinterpret_cast<size_t>(context));
    Log::signalLog("\n");

	if (info->si_code != SYS_SECCOMP || !uctx)
		return;

	unsigned int syscall = uctx->uc_mcontext.gregs[REG_SYSCALL];

    Log::signalLogPrefix();
    Log::signalLog(" seccomp trapped signal, un-authorized sys-call: ");
    Log::signalLogNumber(syscall);
    Log::signalLog("\n");

    SigUtil::dumpBacktrace();

    _exit(1);
}

} // extern "C"

namespace Seccomp {

bool lockdown(Type type)
{
    (void)type; // so far just the kit.

    #define ACCEPT_SYSCALL(name) \
        BPF_JUMP(BPF_JMP+BPF_JEQ+BPF_K, __NR_##name, 0, 1), \
        BPF_STMT(BPF_RET+BPF_K, SECCOMP_RET_ALLOW)

    #define KILL_SYSCALL(name) \
        BPF_JUMP(BPF_JMP+BPF_JEQ+BPF_K, __NR_##name, 0, 1), \
        BPF_STMT(BPF_RET+BPF_K, SECCOMP_RET_TRAP)

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
#ifdef __NR_seccomp
        KILL_SYSCALL(seccomp), // no further fiddling
#endif
#ifdef __NR_bpf
        KILL_SYSCALL(bpf),     // no further fiddling
#endif

        // allow the rest.
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

    // Trap, log, and exit on failure
    struct sigaction action;

    sigemptyset(&action.sa_mask);
    action.sa_flags = SA_SIGINFO;
    action.sa_handler = reinterpret_cast<__sighandler_t>(handleSysSignal);

    sigaction(SIGSYS, &action, nullptr);

    LOG_TRC("Install seccomp filter successfully.");

    return true;
}

} // namespace Seccomp

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
