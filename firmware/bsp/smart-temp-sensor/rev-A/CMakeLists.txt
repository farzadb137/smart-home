# BSP component (future promotion). Phase B-minimal integrates via main/CMakeLists SRCS+INCLUDE_DIRS,
# this file reserves the standalone-component path for rev-B (Kconfig, own drivers).
# Do NOT add this dir to EXTRA_COMPONENT_DIRS yet — see patches/main-CMakeLists.after.example
idf_component_register(SRCS "src/bsp.c" INCLUDE_DIRS "include")
