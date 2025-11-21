//! JavaScript bindings for SyncKit core types

use crate::document::Document;
use crate::sync::VectorClock;
use wasm_bindgen::prelude::*;

// DocumentDelta is only available with protocol support
#[cfg(feature = "prost")]
use crate::protocol::delta::DocumentDelta;

/// JavaScript-friendly wrapper for Document
#[wasm_bindgen]
pub struct WasmDocument {
    inner: Document,
}

#[wasm_bindgen]
impl WasmDocument {
    /// Create a new document with the given ID
    #[wasm_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        Self {
            inner: Document::new(id),
        }
    }

    /// Set a field value (pass JSON string for value)
    #[wasm_bindgen(js_name = setField)]
    pub fn set_field(
        &mut self,
        path: String,
        value_json: String,
        clock: u64,
        client_id: String,
    ) -> Result<(), JsValue> {
        let value: serde_json::Value = serde_json::from_str(&value_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

        self.inner.set_field(path, value, clock, client_id);
        Ok(())
    }

    /// Get a field value (returns JSON string)
    #[wasm_bindgen(js_name = getField)]
    pub fn get_field(&self, path: String) -> Option<String> {
        self.inner
            .get_field(&path)
            .map(|field| serde_json::to_string(&field).unwrap())
    }

    /// Delete a field
    #[wasm_bindgen(js_name = deleteField)]
    pub fn delete_field(&mut self, path: String) {
        self.inner.delete_field(&path);
    }

    /// Get document ID
    #[wasm_bindgen(js_name = getId)]
    pub fn get_id(&self) -> String {
        self.inner.id().clone()
    }

    /// Get field count
    #[wasm_bindgen(js_name = fieldCount)]
    pub fn field_count(&self) -> usize {
        self.inner.field_count()
    }

    /// Export document as JSON string
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> String {
        serde_json::to_string(&self.inner.to_json()).unwrap()
    }

    /// Merge with another document
    #[wasm_bindgen(js_name = merge)]
    pub fn merge(&mut self, other: &WasmDocument) {
        self.inner.merge(&other.inner);
    }
}

/// JavaScript-friendly wrapper for VectorClock
#[wasm_bindgen]
pub struct WasmVectorClock {
    inner: VectorClock,
}

#[wasm_bindgen]
impl WasmVectorClock {
    /// Create a new empty vector clock
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: VectorClock::new(),
        }
    }

    /// Increment clock for a client
    #[wasm_bindgen(js_name = tick)]
    pub fn tick(&mut self, client_id: String) {
        self.inner.tick(&client_id);
    }

    /// Update clock for a client
    #[wasm_bindgen(js_name = update)]
    pub fn update(&mut self, client_id: String, clock: u64) {
        self.inner.update(&client_id, clock);
    }

    /// Get clock value for a client
    #[wasm_bindgen(js_name = get)]
    pub fn get(&self, client_id: String) -> u64 {
        self.inner.get(&client_id)
    }

    /// Merge with another vector clock
    #[wasm_bindgen(js_name = merge)]
    pub fn merge(&mut self, other: &WasmVectorClock) {
        self.inner.merge(&other.inner);
    }

    /// Export as JSON string
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> String {
        serde_json::to_string(&self.inner).unwrap()
    }
}

/// JavaScript-friendly wrapper for DocumentDelta
/// Only available when protocol support is enabled (core variant, not core-lite)
#[cfg(feature = "prost")]
#[wasm_bindgen]
pub struct WasmDelta {
    inner: DocumentDelta,
}

#[cfg(feature = "prost")]
#[wasm_bindgen]
impl WasmDelta {
    /// Compute delta between two documents
    #[wasm_bindgen(js_name = compute)]
    pub fn compute(from: &WasmDocument, to: &WasmDocument) -> Result<WasmDelta, JsValue> {
        DocumentDelta::compute(&from.inner, &to.inner)
            .map(|delta| WasmDelta { inner: delta })
            .map_err(|e| JsValue::from_str(&format!("Delta computation failed: {}", e)))
    }

    /// Apply delta to a document
    #[wasm_bindgen(js_name = applyTo)]
    pub fn apply_to(&self, document: &mut WasmDocument, client_id: String) -> Result<(), JsValue> {
        self.inner
            .apply_to(&mut document.inner, &client_id)
            .map_err(|e| JsValue::from_str(&format!("Delta application failed: {}", e)))
    }

    /// Get document ID this delta applies to
    #[wasm_bindgen(js_name = getDocumentId)]
    pub fn get_document_id(&self) -> String {
        self.inner.document_id.clone()
    }

    /// Get number of changes in this delta
    #[wasm_bindgen(js_name = changeCount)]
    pub fn change_count(&self) -> usize {
        self.inner.changes.len()
    }

    /// Export as JSON string
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner)
            .map_err(|e| JsValue::from_str(&format!("JSON serialization failed: {}", e)))
    }
}
