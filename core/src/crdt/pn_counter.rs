//! PN-Counter: Positive-Negative Counter CRDT
//!
//! A state-based CRDT that supports increment and decrement operations.
//! Maintains two grow-only counters (positive and negative) per replica.
//!
//! # Properties
//!
//! - **Convergence:** All replicas converge to same value
//! - **Commutativity:** Operations can be applied in any order
//! - **Idempotence:** Applying same state twice has no effect
//!
//! # Example
//!
//! ```
//! use synckit_core::crdt::PNCounter;
//!
//! let mut counter1 = PNCounter::new("replica1".to_string());
//! let mut counter2 = PNCounter::new("replica2".to_string());
//!
//! // Both replicas increment
//! counter1.increment(5);
//! counter2.increment(3);
//!
//! // Merge states
//! counter1.merge(&counter2);
//!
//! assert_eq!(counter1.value(), 8);
//! ```

use crate::ClientID;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Positive-Negative Counter CRDT
///
/// Tracks increments and decrements across multiple replicas.
/// Each replica maintains its own positive and negative counters.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PNCounter {
    /// Replica identifier
    replica_id: ClientID,

    /// Positive counters (increments) per replica
    positive: HashMap<ClientID, i64>,

    /// Negative counters (decrements) per replica
    negative: HashMap<ClientID, i64>,
}

impl PNCounter {
    /// Create a new PN-Counter for the given replica
    pub fn new(replica_id: ClientID) -> Self {
        let mut positive = HashMap::new();
        let mut negative = HashMap::new();

        // Initialize own counters
        positive.insert(replica_id.clone(), 0);
        negative.insert(replica_id.clone(), 0);

        Self {
            replica_id,
            positive,
            negative,
        }
    }

    /// Increment the counter by the given amount
    ///
    /// # Arguments
    ///
    /// * `amount` - Amount to increment (must be positive)
    ///
    /// # Panics
    ///
    /// Panics if amount is negative. Use `decrement()` for negative values.
    pub fn increment(&mut self, amount: i64) {
        assert!(amount >= 0, "Increment amount must be non-negative");

        let current = self.positive.get(&self.replica_id).unwrap_or(&0);
        self.positive
            .insert(self.replica_id.clone(), current + amount);
    }

    /// Decrement the counter by the given amount
    ///
    /// # Arguments
    ///
    /// * `amount` - Amount to decrement (must be positive)
    ///
    /// # Panics
    ///
    /// Panics if amount is negative. Use `increment()` for positive values.
    pub fn decrement(&mut self, amount: i64) {
        assert!(amount >= 0, "Decrement amount must be non-negative");

        let current = self.negative.get(&self.replica_id).unwrap_or(&0);
        self.negative
            .insert(self.replica_id.clone(), current + amount);
    }

    /// Get the current counter value
    ///
    /// Returns the sum of all positive counters minus the sum of all negative counters.
    pub fn value(&self) -> i64 {
        let positive_sum: i64 = self.positive.values().sum();
        let negative_sum: i64 = self.negative.values().sum();
        positive_sum - negative_sum
    }

    /// Merge another PN-Counter's state into this one
    ///
    /// Takes the component-wise maximum of all counters.
    /// This operation is commutative, associative, and idempotent.
    pub fn merge(&mut self, other: &PNCounter) {
        // Merge positive counters (take maximum)
        for (replica, &count) in &other.positive {
            let current = self.positive.get(replica).unwrap_or(&0);
            self.positive.insert(replica.clone(), (*current).max(count));
        }

        // Merge negative counters (take maximum)
        for (replica, &count) in &other.negative {
            let current = self.negative.get(replica).unwrap_or(&0);
            self.negative.insert(replica.clone(), (*current).max(count));
        }
    }

    /// Get the replica ID
    pub fn replica_id(&self) -> &ClientID {
        &self.replica_id
    }

    /// Reset the counter to zero
    ///
    /// Note: This is a local operation and won't affect other replicas.
    /// For true distributed reset, all replicas must coordinate.
    pub fn reset(&mut self) {
        self.positive.clear();
        self.negative.clear();
        self.positive.insert(self.replica_id.clone(), 0);
        self.negative.insert(self.replica_id.clone(), 0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counter_creation() {
        let counter = PNCounter::new("replica1".to_string());
        assert_eq!(counter.value(), 0);
        assert_eq!(counter.replica_id(), "replica1");
    }

    #[test]
    fn test_increment() {
        let mut counter = PNCounter::new("replica1".to_string());
        counter.increment(5);
        assert_eq!(counter.value(), 5);

        counter.increment(3);
        assert_eq!(counter.value(), 8);
    }

    #[test]
    fn test_decrement() {
        let mut counter = PNCounter::new("replica1".to_string());
        counter.increment(10);
        counter.decrement(3);
        assert_eq!(counter.value(), 7);
    }

    #[test]
    fn test_negative_value() {
        let mut counter = PNCounter::new("replica1".to_string());
        counter.decrement(5);
        assert_eq!(counter.value(), -5);
    }

    #[test]
    fn test_merge_same_replica() {
        let mut counter1 = PNCounter::new("replica1".to_string());
        let mut counter2 = PNCounter::new("replica1".to_string());

        counter1.increment(5);
        counter2.increment(3);

        counter1.merge(&counter2);

        // Should take maximum (5)
        assert_eq!(counter1.value(), 5);
    }

    #[test]
    fn test_merge_different_replicas() {
        let mut counter1 = PNCounter::new("replica1".to_string());
        let mut counter2 = PNCounter::new("replica2".to_string());

        counter1.increment(5);
        counter2.increment(3);

        counter1.merge(&counter2);

        // Should sum both: 5 + 3 = 8
        assert_eq!(counter1.value(), 8);
    }

    #[test]
    fn test_merge_with_decrements() {
        let mut counter1 = PNCounter::new("replica1".to_string());
        let mut counter2 = PNCounter::new("replica2".to_string());

        counter1.increment(10);
        counter1.decrement(2);

        counter2.increment(5);
        counter2.decrement(3);

        counter1.merge(&counter2);

        // (10 - 2) + (5 - 3) = 8 + 2 = 10
        assert_eq!(counter1.value(), 10);
    }

    #[test]
    fn test_merge_idempotence() {
        let mut counter1 = PNCounter::new("replica1".to_string());
        let counter2 = PNCounter::new("replica2".to_string());

        counter1.increment(5);

        counter1.merge(&counter2);
        let value1 = counter1.value();

        counter1.merge(&counter2);
        let value2 = counter1.value();

        // Merging same state twice should have no effect
        assert_eq!(value1, value2);
    }

    #[test]
    fn test_merge_commutativity() {
        let mut counter1a = PNCounter::new("replica1".to_string());
        let mut counter1b = counter1a.clone();
        let counter2 = {
            let mut c = PNCounter::new("replica2".to_string());
            c.increment(5);
            c
        };
        let counter3 = {
            let mut c = PNCounter::new("replica3".to_string());
            c.increment(3);
            c
        };

        // Merge in different orders
        counter1a.merge(&counter2);
        counter1a.merge(&counter3);

        counter1b.merge(&counter3);
        counter1b.merge(&counter2);

        // Should produce same result
        assert_eq!(counter1a.value(), counter1b.value());
    }

    #[test]
    fn test_reset() {
        let mut counter = PNCounter::new("replica1".to_string());
        counter.increment(10);
        counter.decrement(3);

        assert_eq!(counter.value(), 7);

        counter.reset();
        assert_eq!(counter.value(), 0);
    }

    #[test]
    #[should_panic(expected = "Increment amount must be non-negative")]
    fn test_increment_negative_panics() {
        let mut counter = PNCounter::new("replica1".to_string());
        counter.increment(-5);
    }

    #[test]
    #[should_panic(expected = "Decrement amount must be non-negative")]
    fn test_decrement_negative_panics() {
        let mut counter = PNCounter::new("replica1".to_string());
        counter.decrement(-5);
    }
}
