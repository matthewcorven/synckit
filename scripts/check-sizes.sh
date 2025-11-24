#!/bin/bash

echo "=== ACTUAL BUNDLE SIZES ==="
echo ""
echo "Uncompressed:"
echo "  Full JS:    $(ls -lh sdk/dist/index.mjs | awk '{print $5}')"
echo "  Full WASM:  $(ls -lh sdk/wasm/default/synckit_core_bg.wasm | awk '{print $5}')"
echo "  Lite JS:    $(ls -lh sdk/dist/index-lite.mjs | awk '{print $5}')"
echo "  Lite WASM:  $(ls -lh sdk/wasm/lite/synckit_core_bg.wasm | awk '{print $5}')"
echo ""

echo "Gzipped (production):"
FULL_JS_GZ=$(gzip -9 -c sdk/dist/index.mjs | wc -c)
FULL_WASM_GZ=$(gzip -9 -c sdk/wasm/default/synckit_core_bg.wasm | wc -c)
LITE_JS_GZ=$(gzip -9 -c sdk/dist/index-lite.mjs | wc -c)
LITE_WASM_GZ=$(gzip -9 -c sdk/wasm/lite/synckit_core_bg.wasm | wc -c)

echo "  Full JS:    $(expr $FULL_JS_GZ / 1024)KB ($FULL_JS_GZ bytes)"
echo "  Full WASM:  $(expr $FULL_WASM_GZ / 1024)KB ($FULL_WASM_GZ bytes)"
echo "  Lite JS:    $(expr $LITE_JS_GZ / 1024)KB ($LITE_JS_GZ bytes)"
echo "  Lite WASM:  $(expr $LITE_WASM_GZ / 1024)KB ($LITE_WASM_GZ bytes)"
echo ""

echo "Total Downloads (gzipped):"
FULL_TOTAL=$(expr $FULL_JS_GZ + $FULL_WASM_GZ)
LITE_TOTAL=$(expr $LITE_JS_GZ + $LITE_WASM_GZ)
echo "  Full SDK:  $(expr $FULL_TOTAL / 1024)KB ($FULL_TOTAL bytes)"
echo "  Lite SDK:  $(expr $LITE_TOTAL / 1024)KB ($LITE_TOTAL bytes)"
echo ""
echo "Network overhead: $(expr \( $FULL_TOTAL - $LITE_TOTAL \) / 1024)KB"
