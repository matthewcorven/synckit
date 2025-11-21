//! Synchronization primitives
//!
//! This module contains the core synchronization algorithms:
//! - Vector clocks for causality tracking
//! - Timestamps for LWW conflict resolution
//! - LWW merge algorithm
//! - Delta computation

pub mod delta;
pub mod lww;
pub mod vector_clock;

pub use delta::{apply_delta, compute_delta, merge_deltas, Delta};
pub use lww::LWWField;
pub use vector_clock::VectorClock;

use crate::ClientID;
use serde::{Deserialize, Serialize};

/// Timestamp for Last-Write-Wins conflict resolution
///
/// Contains both a logical clock value and a client ID for deterministic tie-breaking.
/// This ensures that concurrent writes to the same field converge to the same value
/// across all replicas.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Timestamp {
    /// Logical clock value (higher = more recent)
    pub clock: u64,

    /// Client ID for tie-breaking when clocks are equal
    pub client_id: ClientID,
}

impl Timestamp {
    /// Create a new timestamp
    pub fn new(clock: u64, client_id: ClientID) -> Self {
        Self { clock, client_id }
    }

    /// Compare two timestamps for LWW conflict resolution
    ///
    /// Returns:
    /// - Ordering::Greater if self is more recent
    /// - Ordering::Less if other is more recent
    /// - Ordering::Equal if timestamps are identical (same clock and client)
    pub fn compare_lww(&self, other: &Timestamp) -> std::cmp::Ordering {
        match self.clock.cmp(&other.clock) {
            std::cmp::Ordering::Equal => {
                // Tie-breaking by client ID (deterministic)
                self.client_id.cmp(&other.client_id)
            }
            ordering => ordering,
        }
    }

    /// Check if this timestamp is more recent than another (for LWW)
    pub fn is_newer_than(&self, other: &Timestamp) -> bool {
        self.compare_lww(other) == std::cmp::Ordering::Greater
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timestamp_comparison() {
        let ts1 = Timestamp::new(1, "c1".to_string());
        let ts2 = Timestamp::new(2, "c1".to_string());

        // Higher clock wins
        assert!(ts2.is_newer_than(&ts1));
        assert!(!ts1.is_newer_than(&ts2));
    }

    #[test]
    fn test_timestamp_tie_breaking() {
        let ts1 = Timestamp::new(1, "c1".to_string());
        let ts2 = Timestamp::new(1, "c2".to_string());

        // Same clock, break tie by client ID
        // "c2" > "c1" lexicographically
        assert!(ts2.is_newer_than(&ts1));
        assert!(!ts1.is_newer_than(&ts2));
    }

    #[test]
    fn test_timestamp_equality() {
        let ts1 = Timestamp::new(1, "c1".to_string());
        let ts2 = Timestamp::new(1, "c1".to_string());

        assert_eq!(ts1.compare_lww(&ts2), std::cmp::Ordering::Equal);
        assert!(!ts1.is_newer_than(&ts2));
        assert!(!ts2.is_newer_than(&ts1));
    }
}
