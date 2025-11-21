//! Delta computation for efficient synchronization
//!
//! Computes minimal changes between document states to reduce bandwidth usage.
//! Only transmits fields that actually changed rather than full documents.

use crate::document::{Document, Field};
use crate::sync::VectorClock;
use crate::{DocumentID, FieldPath};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents changes between two document states
///
/// Contains only the fields that changed, making network transmission efficient.
/// A delta can be applied to a document to update it to a new state.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Delta {
    /// Document this delta applies to
    pub document_id: DocumentID,

    /// Changed fields (only includes fields that differ)
    pub fields: HashMap<FieldPath, Field>,

    /// Vector clock after applying this delta
    pub version: VectorClock,
}

impl Delta {
    /// Create a new delta
    pub fn new(
        document_id: DocumentID,
        fields: HashMap<FieldPath, Field>,
        version: VectorClock,
    ) -> Self {
        Self {
            document_id,
            fields,
            version,
        }
    }

    /// Create an empty delta (no changes)
    pub fn empty(document_id: DocumentID, version: VectorClock) -> Self {
        Self {
            document_id,
            fields: HashMap::new(),
            version,
        }
    }

    /// Check if delta is empty (no changes)
    pub fn is_empty(&self) -> bool {
        self.fields.is_empty()
    }

    /// Get the number of changed fields
    pub fn len(&self) -> usize {
        self.fields.len()
    }
}

/// Compute delta between two documents
///
/// Returns a Delta containing only fields that changed between old and new.
/// If documents have the same content, returns an empty delta.
///
/// # Example
/// ```ignore
/// let old = Document::new("doc1");
/// let mut new = old.clone();
/// new.set_field("title", json!("Hello"), 1, "client1".into());
///
/// let delta = compute_delta(&old, &new);
/// assert_eq!(delta.len(), 1); // Only "title" field changed
/// ```
pub fn compute_delta(old: &Document, new: &Document) -> Delta {
    let mut changed_fields = HashMap::new();

    // Find all fields in new document
    for (field_path, new_field) in &new.fields {
        match old.fields.get(field_path) {
            Some(old_field) => {
                // Field exists in both - check if it changed
                if old_field != new_field {
                    changed_fields.insert(field_path.clone(), new_field.clone());
                }
            }
            None => {
                // New field (didn't exist in old)
                changed_fields.insert(field_path.clone(), new_field.clone());
            }
        }
    }

    // Note: Deleted fields would be represented as tombstones in a full implementation
    // For now, we only track additions and modifications

    Delta::new(new.id.clone(), changed_fields, new.version.clone())
}

/// Apply a delta to a document
///
/// Updates the document with all changes from the delta using LWW merge semantics.
/// If a field in the delta is newer, it replaces the local field.
///
/// # Example
/// ```ignore
/// let mut doc = Document::new("doc1");
/// let delta = Delta { /* ... */ };
/// apply_delta(&mut doc, &delta);
/// ```
pub fn apply_delta(doc: &mut Document, delta: &Delta) {
    // Verify we're applying to the correct document
    assert_eq!(doc.id, delta.document_id, "Delta document ID mismatch");

    // Apply each changed field using LWW merge
    for (field_path, delta_field) in &delta.fields {
        match doc.fields.get(field_path) {
            Some(local_field) => {
                // Field exists locally - use LWW merge
                if delta_field.timestamp > local_field.timestamp {
                    doc.fields.insert(field_path.clone(), delta_field.clone());
                } else if delta_field.timestamp == local_field.timestamp {
                    // Tie-breaking: use client_id comparison
                    if delta_field.timestamp.client_id > local_field.timestamp.client_id {
                        doc.fields.insert(field_path.clone(), delta_field.clone());
                    }
                }
                // else: local is newer, keep local
            }
            None => {
                // New field - insert it
                doc.fields.insert(field_path.clone(), delta_field.clone());
            }
        }
    }

    // Merge vector clocks
    doc.version.merge(&delta.version);
}

/// Merge two deltas into a single delta
///
/// Combines changes from both deltas, using LWW semantics when the same field
/// is modified in both deltas.
///
/// Useful for combining multiple pending changes before transmission.
pub fn merge_deltas(delta1: &Delta, delta2: &Delta) -> Delta {
    assert_eq!(
        delta1.document_id, delta2.document_id,
        "Cannot merge deltas for different documents"
    );

    let mut merged_fields = delta1.fields.clone();

    // Merge fields from delta2
    for (field_path, field2) in &delta2.fields {
        match merged_fields.get(field_path) {
            Some(field1) => {
                // Field in both deltas - use LWW
                if field2.timestamp > field1.timestamp {
                    merged_fields.insert(field_path.clone(), field2.clone());
                } else if field2.timestamp == field1.timestamp {
                    // Tie-breaking
                    if field2.timestamp.client_id > field1.timestamp.client_id {
                        merged_fields.insert(field_path.clone(), field2.clone());
                    }
                }
            }
            None => {
                // New field from delta2
                merged_fields.insert(field_path.clone(), field2.clone());
            }
        }
    }

    // Merge vector clocks
    let mut merged_version = delta1.version.clone();
    merged_version.merge(&delta2.version);

    Delta::new(delta1.document_id.clone(), merged_fields, merged_version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::Timestamp;
    use serde_json::json;

    #[test]
    fn test_empty_delta() {
        let doc = Document::new("doc1".to_string());
        let delta = compute_delta(&doc, &doc);

        assert!(delta.is_empty());
        assert_eq!(delta.len(), 0);
    }

    #[test]
    fn test_compute_delta_new_field() {
        let old = Document::new("doc1".to_string());
        let mut new = old.clone();

        new.set_field(
            "title".to_string(),
            json!("Hello World"),
            1,
            "client1".to_string(),
        );

        let delta = compute_delta(&old, &new);

        assert_eq!(delta.len(), 1);
        assert!(delta.fields.contains_key("title"));
        assert_eq!(delta.fields["title"].value, json!("Hello World"));
    }

    #[test]
    fn test_compute_delta_modified_field() {
        let mut old = Document::new("doc1".to_string());
        old.set_field(
            "title".to_string(),
            json!("Old Title"),
            1,
            "client1".to_string(),
        );

        let mut new = old.clone();
        new.set_field(
            "title".to_string(),
            json!("New Title"),
            2,
            "client1".to_string(),
        );

        let delta = compute_delta(&old, &new);

        assert_eq!(delta.len(), 1);
        assert_eq!(delta.fields["title"].value, json!("New Title"));
        assert_eq!(delta.fields["title"].timestamp.clock, 2);
    }

    #[test]
    fn test_compute_delta_multiple_changes() {
        let old = Document::new("doc1".to_string());
        let mut new = old.clone();

        new.set_field(
            "title".to_string(),
            json!("Title"),
            1,
            "client1".to_string(),
        );
        new.set_field("body".to_string(), json!("Body"), 2, "client1".to_string());
        new.set_field(
            "author".to_string(),
            json!("Alice"),
            3,
            "client1".to_string(),
        );

        let delta = compute_delta(&old, &new);

        assert_eq!(delta.len(), 3);
        assert!(delta.fields.contains_key("title"));
        assert!(delta.fields.contains_key("body"));
        assert!(delta.fields.contains_key("author"));
    }

    #[test]
    fn test_apply_delta_new_field() {
        let mut doc = Document::new("doc1".to_string());

        let mut delta_fields = HashMap::new();
        delta_fields.insert(
            "title".to_string(),
            Field {
                value: json!("Hello"),
                timestamp: Timestamp::new(1, "client1".to_string()),
            },
        );

        let delta = Delta::new("doc1".to_string(), delta_fields, VectorClock::new());

        apply_delta(&mut doc, &delta);

        assert!(doc.fields.contains_key("title"));
        assert_eq!(doc.fields["title"].value, json!("Hello"));
    }

    #[test]
    fn test_apply_delta_lww_merge() {
        let mut doc = Document::new("doc1".to_string());
        doc.set_field("title".to_string(), json!("Old"), 1, "client1".to_string());

        // Delta with newer timestamp
        let mut delta_fields = HashMap::new();
        delta_fields.insert(
            "title".to_string(),
            Field {
                value: json!("New"),
                timestamp: Timestamp::new(2, "client1".to_string()),
            },
        );

        let delta = Delta::new("doc1".to_string(), delta_fields, VectorClock::new());

        apply_delta(&mut doc, &delta);

        assert_eq!(doc.fields["title"].value, json!("New"));
        assert_eq!(doc.fields["title"].timestamp.clock, 2);
    }

    #[test]
    fn test_apply_delta_keeps_local_if_newer() {
        let mut doc = Document::new("doc1".to_string());
        doc.set_field("title".to_string(), json!("New"), 2, "client1".to_string());

        // Delta with older timestamp
        let mut delta_fields = HashMap::new();
        delta_fields.insert(
            "title".to_string(),
            Field {
                value: json!("Old"),
                timestamp: Timestamp::new(1, "client1".to_string()),
            },
        );

        let delta = Delta::new("doc1".to_string(), delta_fields, VectorClock::new());

        apply_delta(&mut doc, &delta);

        // Local field is newer, should be kept
        assert_eq!(doc.fields["title"].value, json!("New"));
        assert_eq!(doc.fields["title"].timestamp.clock, 2);
    }

    #[test]
    fn test_merge_deltas_non_overlapping() {
        let mut fields1 = HashMap::new();
        fields1.insert(
            "title".to_string(),
            Field {
                value: json!("Title"),
                timestamp: Timestamp::new(1, "client1".to_string()),
            },
        );

        let mut fields2 = HashMap::new();
        fields2.insert(
            "body".to_string(),
            Field {
                value: json!("Body"),
                timestamp: Timestamp::new(2, "client1".to_string()),
            },
        );

        let delta1 = Delta::new("doc1".to_string(), fields1, VectorClock::new());
        let delta2 = Delta::new("doc1".to_string(), fields2, VectorClock::new());

        let merged = merge_deltas(&delta1, &delta2);

        assert_eq!(merged.len(), 2);
        assert!(merged.fields.contains_key("title"));
        assert!(merged.fields.contains_key("body"));
    }

    #[test]
    fn test_merge_deltas_overlapping_field() {
        let mut fields1 = HashMap::new();
        fields1.insert(
            "title".to_string(),
            Field {
                value: json!("Old"),
                timestamp: Timestamp::new(1, "client1".to_string()),
            },
        );

        let mut fields2 = HashMap::new();
        fields2.insert(
            "title".to_string(),
            Field {
                value: json!("New"),
                timestamp: Timestamp::new(2, "client1".to_string()),
            },
        );

        let delta1 = Delta::new("doc1".to_string(), fields1, VectorClock::new());
        let delta2 = Delta::new("doc1".to_string(), fields2, VectorClock::new());

        let merged = merge_deltas(&delta1, &delta2);

        assert_eq!(merged.len(), 1);
        assert_eq!(merged.fields["title"].value, json!("New"));
        assert_eq!(merged.fields["title"].timestamp.clock, 2);
    }

    #[test]
    fn test_delta_roundtrip() {
        // Test that computing and applying a delta results in identical document
        let old = Document::new("doc1".to_string());
        let mut new = old.clone();

        new.set_field(
            "title".to_string(),
            json!("Hello"),
            1,
            "client1".to_string(),
        );
        new.set_field("body".to_string(), json!("World"), 2, "client1".to_string());

        let delta = compute_delta(&old, &new);
        let mut reconstructed = old.clone();
        apply_delta(&mut reconstructed, &delta);

        // Reconstructed should match new
        assert_eq!(reconstructed.fields["title"], new.fields["title"]);
        assert_eq!(reconstructed.fields["body"], new.fields["body"]);
    }
}
