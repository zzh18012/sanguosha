# Distributed under the OSI-approved BSD 3-Clause License.  See accompanying
# file LICENSE.rst or https://cmake.org/licensing for details.

cmake_minimum_required(VERSION ${CMAKE_VERSION}) # this file comes with cmake

# If CMAKE_DISABLE_SOURCE_CHANGES is set to true and the source directory is an
# existing directory in our source tree, calling file(MAKE_DIRECTORY) on it
# would cause a fatal error, even though it would be a no-op.
if(NOT EXISTS "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-src")
  file(MAKE_DIRECTORY "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-src")
endif()
file(MAKE_DIRECTORY
  "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-build"
  "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-subbuild/uwebsockets-populate-prefix"
  "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-subbuild/uwebsockets-populate-prefix/tmp"
  "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-subbuild/uwebsockets-populate-prefix/src/uwebsockets-populate-stamp"
  "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-subbuild/uwebsockets-populate-prefix/src"
  "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-subbuild/uwebsockets-populate-prefix/src/uwebsockets-populate-stamp"
)

set(configSubDirs )
foreach(subDir IN LISTS configSubDirs)
    file(MAKE_DIRECTORY "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-subbuild/uwebsockets-populate-prefix/src/uwebsockets-populate-stamp/${subDir}")
endforeach()
if(cfgdir)
  file(MAKE_DIRECTORY "C:/Users/zzhn2/Desktop/sanguosha/server-cpp/build/_deps/uwebsockets-subbuild/uwebsockets-populate-prefix/src/uwebsockets-populate-stamp${cfgdir}") # cfgdir has leading slash
endif()
