//! WASM utility functions

use wasm_bindgen::prelude::*;

/// Initialize panic hook for better error messages in browser
#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "wasm")]
    console_error_panic_hook::set_once();
}

/// Log a message to the browser console
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

/// Macro for console.log from Rust
#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => {
        $crate::wasm::utils::log(&format_args!($($t)*).to_string())
    }
}
