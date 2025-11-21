//! Item ID: Unique identifier for text items
//!
//! Each item in the text CRDT has a unique ID composed of:
//! - Client ID: Identifies the replica that created the item
//! - Clock: Lamport timestamp for ordering

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

/// Unique identifier for a text item
///
/// Combines client ID and clock for total ordering across replicas.
/// Items from the same client are ordered by clock; items from different
/// clients are ordered deterministically by client ID.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ItemId {
    /// Client that created this item
    pub client: u64,

    /// Lamport clock at creation time
    pub clock: u64,
}

impl ItemId {
    /// Create a new item ID
    pub fn new(client: u64, clock: u64) -> Self {
        Self { client, clock }
    }

    /// Check if this is a root item (clock 0)
    pub fn is_root(&self) -> bool {
        self.clock == 0
    }
}

impl PartialOrd for ItemId {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ItemId {
    fn cmp(&self, other: &Self) -> Ordering {
        // First compare by clock (Lamport timestamp)
        match self.clock.cmp(&other.clock) {
            Ordering::Equal => {
                // If clocks are equal, use client ID for deterministic ordering
                self.client.cmp(&other.client)
            }
            other => other,
        }
    }
}

impl std::fmt::Display for ItemId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.client, self.clock)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_item_id_ordering() {
        let id1 = ItemId::new(1, 10);
        let id2 = ItemId::new(1, 20);
        let id3 = ItemId::new(2, 15);

        // Same client: ordered by clock
        assert!(id1 < id2);

        // Different clients: clock takes precedence
        assert!(id1 < id3);
        assert!(id3 < id2);
    }

    #[test]
    fn test_item_id_equality() {
        let id1 = ItemId::new(1, 10);
        let id2 = ItemId::new(1, 10);
        let id3 = ItemId::new(2, 10);

        assert_eq!(id1, id2);
        assert_ne!(id1, id3);
    }

    #[test]
    fn test_item_id_deterministic_tiebreaking() {
        // When clocks are equal, use client ID
        let id1 = ItemId::new(1, 10);
        let id2 = ItemId::new(2, 10);

        assert!(id1 < id2);
    }

    #[test]
    fn test_root_item() {
        let root = ItemId::new(0, 0);
        let normal = ItemId::new(1, 5);

        assert!(root.is_root());
        assert!(!normal.is_root());
    }
}
