cmake_minimum_required(VERSION 3.20)
project(sanguosha-server LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(nlohmann_json)

FetchContent_Declare(
  uwebsockets
  GIT_REPOSITORY https://github.com/uNetworking/uWebSockets.git
  GIT_TAG v20.75.0
)
FetchContent_MakeAvailable(uwebsockets)

file(GLOB_RECURSE SOURCES src/*.cpp src/*.hpp)

add_executable(sanguosha-server ${SOURCES})
target_include_directories(sanguosha-server PRIVATE src)
target_link_libraries(sanguosha-server PRIVATE uWS::uWS nlohmann_json::nlohmann_json)
target_compile_options(sanguosha-server PRIVATE -Wall -Wextra -O2)
