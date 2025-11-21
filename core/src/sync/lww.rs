//! Last-Write-Wins (LWW) merge algorithm
//!
//! Implements the TLA+ verified LWW merge algorithm from protocol/tla/lww_merge.tla

use crate::sync::Timestamp;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// A field value with LWW metadata
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LWWField {
    /// The actual field value (JSON-like)
    pub value: JsonValue,

    /// Timestamp for conflict resolution
    pub timestamp: Timestamp,
}

impl LWWField {
    /// Create a new LWW field with a value and timestamp
    pub fn new(value: JsonValue, timestamp: Timestamp) -> Self {
        Self { value, timestamp }
    }

    /// Merge two LWW fields using Last-Write-Wins semantics
    ///
    /// This follows the TLA+ verified algorithm:
    /// - If remote is newer (higher timestamp), use remote
    /// - If local is newer, keep local
    /// - If equal timestamps, use deterministic tie-breaking via client_id
    pub fn merge(&self, other: &LWWField) -> LWWField {
        match self.timestamp.compare_lww(&other.timestamp) {
            std::cmp::Ordering::Less => {
                // Remote is newer - use it
                other.clone()
            }
            std::cmp::Ordering::Greater => {
                // Local is newer - keep it
                self.clone()
            }
            std::cmp::Ordering::Equal => {
                // Equal timestamps - already handled by compare_lww via client_id
                self.clone()
            }
        }
    }

    /// Check if this field is newer than another
    pub fn is_newer_than(&self, other: &LWWField) -> bool {
        self.timestamp.is_newer_than(&other.timestamp)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_merge_remote_newer() {
        let local = LWWField::new(json!("old"), Timestamp::new(1, "client1".into()));
        let remote = LWWField::new(json!("new"), Timestamp::new(2, "client2".into()));

        let result = local.merge(&remote);
        assert_eq!(result.value, json!("new"));
        assert_eq!(result.timestamp.clock, 2);
    }

    #[test]
    fn test_merge_local_newer() {
        let local = LWWField::new(json!("new"), Timestamp::new(2, "client1".into()));
        let remote = LWWField::new(json!("old"), Timestamp::new(1, "client2".into()));

        let result = local.merge(&remote);
        assert_eq!(result.value, json!("new"));
        assert_eq!(result.timestamp.clock, 2);
    }

    #[test]
    fn test_merge_same_timestamp_same_client() {
        let local = LWWField::new(json!("value"), Timestamp::new(1, "client1".into()));
        let remote = LWWField::new(json!("value"), Timestamp::new(1, "client1".into()));

        let result = local.merge(&remote);
        assert_eq!(result.value, json!("value"));
    }

    #[test]
    fn test_merge_same_timestamp_different_clients() {
        let local = LWWField::new(json!("alpha"), Timestamp::new(1, "client_a".into()));
        let remote = LWWField::new(json!("beta"), Timestamp::new(1, "client_b".into()));

        // client_b > client_a lexicographically, so remote should win
        let result = local.merge(&remote);
        assert_eq!(result.value, json!("beta"));

        // Verify commutativity
        let result2 = remote.merge(&local);
        assert_eq!(result.value, result2.value);
    }

    #[test]
    fn test_idempotence() {
        let field = LWWField::new(json!("value"), Timestamp::new(1, "client1".into()));

        let result = field.merge(&field);
        assert_eq!(result.value, field.value);
        assert_eq!(result.timestamp, field.timestamp);
    }
}
