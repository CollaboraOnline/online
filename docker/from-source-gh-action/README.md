This directory contains relevant files for building a docker image from source code using GitHub Actions. The Dockerfile is used to build the image is different from the regular from-source approach as it isolates the build within docker so that the build environment is not dependent on the host environment.

The engine is not built from source here. `ENGINE_ASSETS` points at a prebuilt
engine, published as `engine-<branch>-assets.tar.gz` on the `for-code-assets`
release of CollaboraOnline/online, and `build.sh` unpacks it over
`online/engine`. A GitHub Actions runner has no time to build the engine itself.

## What the engine assets tarball has to contain

Online's C++ (`coolwsd`, `coolforkit-caps`, `coolforkit-ns`, `coolmount`,
`coolconfig`, `coolconvert`, `coolstress` and the tools) is built by the engine's
gbuild, which reads the engine's build tree. So the tarball has to be a build
tree, not just an installation. Before the switch from Automake to gbuild an
installation was enough, which is why this list is longer than it used to be.

    instdir
    workdir/Misc/DUMMY
    workdir/Headers
    workdir/Executable/concat-deps.run
    workdir/LinkTarget/Executable/concat-deps
    workdir/LinkTarget/StaticLibrary/libPoco*.a
    workdir/LinkTarget/StaticLibrary/libexpat.a
    workdir/LinkTarget/StaticLibrary/liblibpng.a
    workdir/LinkTarget/StaticLibrary/libzstd.a
    workdir/Package/openssl.filelist
    workdir/Package/prepared/openssl
    workdir/ExternalProject/openssl.done
    workdir/UnpackedTarball/poco/include
    workdir/UnpackedTarball/poco.done
    workdir/UnpackedTarball/poco.update
    workdir/UnpackedTarball/expat/lib
    workdir/UnpackedTarball/expat.done
    workdir/UnpackedTarball/expat.update
    workdir/UnpackedTarball/libpng
    workdir/UnpackedTarball/libpng.done
    workdir/UnpackedTarball/libpng.update
    workdir/UnpackedTarball/zstd/lib
    workdir/UnpackedTarball/zstd.done
    workdir/UnpackedTarball/zstd.update
    workdir/UnpackedTarball/openssl/include
    workdir/UnpackedTarball/openssl/libssl.a
    workdir/UnpackedTarball/openssl/libcrypto.a
    workdir/UnpackedTarball/openssl.done
    workdir/UnpackedTarball/openssl.update

`build.sh` checks these on arrival, so a short tarball fails with a message
naming what is absent rather than an error deep inside gbuild.

## What each entry is for

POCO is one of the engine's own third-party libraries, which is why its archives
and headers come from the engine workdir rather than from a system package. The
other four are the libraries online links against and the engine bundles: expat,
libpng, openssl and zstd. zlib comes from the system.

The rest are the markers gbuild reads to decide that something is already built:
`.done` and `.update` for each unpacked tarball, `openssl.filelist` and
`prepared/openssl` for the openssl package, `openssl.done` for its build,
`Headers` for the archives and for `concat-deps`, and `concat-deps.run` for the
tool that concatenates dependency files.

`workdir/Misc/DUMMY` is easy to overlook and the build fails oddly without it.
Every target under `workdir/LinkTarget` has it as a prerequisite, so if it is
absent it gets created fresh, comes out newer than the archives shipped
alongside it, and gbuild tries to relink them. An engine build creates `DUMMY`
first, so in a faithfully unpacked tree it stays older than everything it
guards. Both archive formats keep modification times, `zip` at 2-second
granularity, which is harmless at that distance.

## Why config_host.mk is not in the list

It records the compiler, the linker and the absolute paths of the machine that
produced it, and gbuild compiles online's C++ with whatever they say. The
publishing job builds the engine on a different distribution and compiler from
the one in this Dockerfile, so those values name a machine that is not the one
doing the compiling. Rewriting the paths alone does not help, because `CC`,
`CXX`, `USE_LD`, `GCC_VERSION` and `PYTHON_FOR_BUILD` are wrong too.

So `build.sh` runs the engine's own `autogen.sh` after unpacking, which writes a
`config_host.mk` and a `config_host_lang.mk` describing this container. It passes
the switches the assets were built with, so the choices between system and
bundled libraries agree with the archives in the tarball. Anything the tarball
ships under that name is overwritten.

## How the publishing job packs it

That job is not in this repository. It builds the engine and then packs the
tarball; this is the part that has to match the list above:

```bash
  # Online's C++ is built by the engine's gbuild, so the assets have to be a
  # complete engine build tree, not just an installation.
  assets=(
      instdir
      workdir/Misc/DUMMY
      workdir/Headers
      workdir/Executable/concat-deps.run
      workdir/LinkTarget/Executable/concat-deps
      workdir/LinkTarget/StaticLibrary/libPoco*.a
      workdir/LinkTarget/StaticLibrary/libexpat.a
      workdir/LinkTarget/StaticLibrary/liblibpng.a
      workdir/LinkTarget/StaticLibrary/libzstd.a
      workdir/Package/openssl.filelist
      workdir/Package/prepared/openssl
      workdir/ExternalProject/openssl.done
      workdir/UnpackedTarball/poco/include
      workdir/UnpackedTarball/poco.done
      workdir/UnpackedTarball/poco.update
      workdir/UnpackedTarball/expat/lib
      workdir/UnpackedTarball/expat.done
      workdir/UnpackedTarball/expat.update
      workdir/UnpackedTarball/libpng
      workdir/UnpackedTarball/libpng.done
      workdir/UnpackedTarball/libpng.update
      workdir/UnpackedTarball/zstd/lib
      workdir/UnpackedTarball/zstd.done
      workdir/UnpackedTarball/zstd.update
      workdir/UnpackedTarball/openssl/include
      workdir/UnpackedTarball/openssl/libssl.a
      workdir/UnpackedTarball/openssl/libcrypto.a
      workdir/UnpackedTarball/openssl.done
      workdir/UnpackedTarball/openssl.update
  )

  tar -czf engine-${CORE}-assets.tar.gz "${assets[@]}"
  zip -qr engine-${CORE}-assets.zip "${assets[@]}"
```

The paths are relative to the engine directory, which is where that job runs.
Running it under `bash -e` is worth keeping: if a future engine stops bundling
one of these libraries, `tar` fails and the run aborts before uploading, rather
than quietly publishing a short tarball.

The list therefore lives in three places that have to agree: the `assets` array
in the publishing job, the `engine_assets_paths` array in `build.sh`, and this
file. What drives all three is which libraries online links against, so the
trigger to revisit them is online gaining or dropping one.

## Build locally

To build the image locally, run the following command:

```bash
docker build -t code .
```

