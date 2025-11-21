//! Fractional Index: Position-based list ordering
//!
//! A deterministic algorithm for generating positions between any two positions.
//! Enables insertion, reordering, and deletion without renumbering all items.
//!
//! # Use Cases
//!
//! - Todo lists with reordering
//! - Layer/z-index ordering in design tools
//! - Playlist track ordering
//! - Any ordered collection that needs flexible insertion
//!
//! # Properties
//!
//! - **Dense ordering:** Can always insert between any two positions
//! - **Stable:** Positions don't change when items are added elsewhere
//! - **Comparable:** Lexicographic string comparison determines order
//! - **Compact:** Efficient string representation
//!
//! # Example
//!
//! ```
//! use synckit_core::crdt::FractionalIndex;
//!
//! // Create positions
//! let first = FractionalIndex::first();
//! let second = FractionalIndex::after(&first);
//! let between = FractionalIndex::between(&first, &second);
//!
//! // Verify ordering
//! assert!(first < between);
//! assert!(between < second);
//! ```

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

/// Base for fractional indexing
///
/// Using base-62 (0-9, A-Z, a-z) for compact representation
/// Ordered by ASCII value for correct lexicographic comparison
const BASE: u32 = 62;
const DIGITS: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/// Fractional index for ordering items in a list
///
/// Internally represented as a base-62 string for efficient comparison
/// and dense ordering.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FractionalIndex {
    /// Internal representation as base-62 string
    position: String,
}

impl FractionalIndex {
    /// Create the first position in a list
    ///
    /// This is the smallest possible position.
    pub fn first() -> Self {
        Self {
            position: "a0".to_string(),
        }
    }

    /// Create the last position in a list (conceptually infinite)
    ///
    /// This is a very large position using the highest character ('z')
    pub fn last() -> Self {
        Self {
            position: "z".repeat(10),
        }
    }

    /// Generate a position after the given position
    ///
    /// Creates a new position that sorts after the given one.
    pub fn after(pos: &FractionalIndex) -> Self {
        Self::between(pos, &Self::last())
    }

    /// Generate a position before the given position
    ///
    /// Creates a new position that sorts before the given one.
    pub fn before(pos: &FractionalIndex) -> Self {
        Self::between(&Self::first(), pos)
    }

    /// Generate a position between two positions
    ///
    /// # Arguments
    ///
    /// * `left` - The position that should come before
    /// * `right` - The position that should come after
    ///
    /// # Panics
    ///
    /// Panics if left >= right
    pub fn between(left: &FractionalIndex, right: &FractionalIndex) -> Self {
        assert!(
            left < right,
            "Left position must be less than right position"
        );

        let left_str = &left.position;
        let right_str = &right.position;

        // Find the midpoint between the two positions
        let midpoint = Self::compute_midpoint(left_str, right_str);

        Self { position: midpoint }
    }

    /// Compute the midpoint between two position strings
    ///
    /// Uses a digit-by-digit average approach with proper handling of edge cases.
    fn compute_midpoint(left: &str, right: &str) -> String {
        let mut result = String::new();
        let left_chars: Vec<char> = left.chars().collect();
        let right_chars: Vec<char> = right.chars().collect();

        let mut i = 0;
        loop {
            let left_digit = if i < left_chars.len() {
                Self::char_to_value(left_chars[i])
            } else {
                0 // Treat missing chars as '0' (smallest)
            };

            let right_digit = if i < right_chars.len() {
                Self::char_to_value(right_chars[i])
            } else {
                BASE // Treat right's end as one past largest digit
            };

            if left_digit < right_digit {
                if left_digit + 1 < right_digit {
                    // Space between digits: use average and we're done
                    let mid = (left_digit + right_digit) / 2;
                    result.push(Self::value_to_char(mid));
                    break;
                } else {
                    // Adjacent digits (e.g., 'a' and 'b'): copy left, continue deeper
                    result.push(Self::value_to_char(left_digit));
                    i += 1;
                    // Continue to find space in remaining positions
                }
            } else if left_digit == right_digit {
                // Same digit: copy and continue
                result.push(Self::value_to_char(left_digit));
                i += 1;
            } else {
                // left_digit > right_digit shouldn't happen (assertion prevents)
                unreachable!("left should be < right");
            }

            // Safety: prevent infinite loops
            if i > 20 {
                // If we've gone 20 chars deep, just append a mid character
                result.push(Self::value_to_char(BASE / 2));
                break;
            }
        }

        result
    }

    /// Convert a character to its position value
    fn char_to_value(c: char) -> u32 {
        Self::digit_to_value(c as u8)
    }

    /// Convert a value to its character
    fn value_to_char(value: u32) -> char {
        DIGITS[value as usize] as char
    }

    /// Convert a digit character to its numeric value
    /// Matches the ASCII-ordered DIGITS: 0-9, A-Z, a-z
    fn digit_to_value(digit: u8) -> u32 {
        match digit {
            b'0'..=b'9' => (digit - b'0') as u32,      // 0-9
            b'A'..=b'Z' => (digit - b'A' + 10) as u32, // 10-35
            b'a'..=b'z' => (digit - b'a' + 36) as u32, // 36-61
            _ => 0,
        }
    }

    /// Get the internal position string
    pub fn as_str(&self) -> &str {
        &self.position
    }

    /// Create from a position string (for deserialization)
    pub fn from_str(position: String) -> Self {
        Self { position }
    }
}

impl PartialOrd for FractionalIndex {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for FractionalIndex {
    fn cmp(&self, other: &Self) -> Ordering {
        self.position.cmp(&other.position)
    }
}

impl std::fmt::Display for FractionalIndex {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.position)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_first_position() {
        let first = FractionalIndex::first();
        assert_eq!(first.as_str(), "a0");
    }

    #[test]
    fn test_after() {
        let first = FractionalIndex::first();
        let second = FractionalIndex::after(&first);

        assert!(first < second);
    }

    #[test]
    fn test_before() {
        let second = FractionalIndex::after(&FractionalIndex::first());
        let first = FractionalIndex::before(&second);

        assert!(first < second);
    }

    #[test]
    fn test_between() {
        let first = FractionalIndex::first();
        let third = FractionalIndex::after(&first);
        let second = FractionalIndex::between(&first, &third);

        assert!(first < second);
        assert!(second < third);
    }

    #[test]
    fn test_multiple_insertions() {
        let mut positions = vec![FractionalIndex::first()];

        // Insert 10 items at the end
        for _ in 0..10 {
            let last = positions.last().unwrap();
            positions.push(FractionalIndex::after(last));
        }

        // Verify they're all in order
        for i in 0..positions.len() - 1 {
            assert!(positions[i] < positions[i + 1]);
        }
    }

    #[test]
    fn test_insert_between_many_times() {
        let first = FractionalIndex::first();
        let last = FractionalIndex::after(&first);

        let mut positions = vec![first.clone(), last.clone()];

        // Insert 100 items between first and last
        for _ in 0..100 {
            let left = &positions[0];
            let right = &positions[1];
            let middle = FractionalIndex::between(left, right);
            positions.insert(1, middle);
        }

        // Verify all positions are in order
        for i in 0..positions.len() - 1 {
            assert!(positions[i] < positions[i + 1]);
        }
    }

    #[test]
    fn test_dense_ordering() {
        // We can always insert between any two positions
        let a = FractionalIndex::first();
        let c = FractionalIndex::after(&a);

        // Insert between a and c
        let b = FractionalIndex::between(&a, &c);
        assert!(a < b && b < c);

        // Insert between a and b
        let ab = FractionalIndex::between(&a, &b);
        assert!(a < ab && ab < b);

        // Insert between b and c
        let bc = FractionalIndex::between(&b, &c);
        assert!(b < bc && bc < c);
    }

    #[test]
    fn test_ordering_stability() {
        let pos1 = FractionalIndex::first();
        let pos2 = FractionalIndex::after(&pos1);
        let pos3 = FractionalIndex::after(&pos2);

        // Insert between pos1 and pos2
        let pos_between = FractionalIndex::between(&pos1, &pos2);

        // Original positions should still be in same order
        assert!(pos1 < pos2);
        assert!(pos2 < pos3);

        // New position should be between pos1 and pos2
        assert!(pos1 < pos_between);
        assert!(pos_between < pos2);
    }

    #[test]
    fn test_string_comparison() {
        let a = FractionalIndex::from_str("a0".to_string());
        let b = FractionalIndex::from_str("a1".to_string());
        let c = FractionalIndex::from_str("b0".to_string());

        assert!(a < b);
        assert!(b < c);
        assert!(a < c);
    }

    #[test]
    fn test_lexicographic_ordering() {
        // Shorter strings with same prefix compare less
        let short = FractionalIndex::from_str("a".to_string());
        let long = FractionalIndex::from_str("a0".to_string());

        assert!(short < long);
    }

    #[test]
    fn test_display() {
        let pos = FractionalIndex::first();
        assert_eq!(format!("{}", pos), "a0");
    }

    #[test]
    #[should_panic(expected = "Left position must be less than right position")]
    fn test_between_invalid_order() {
        let a = FractionalIndex::first();
        let b = FractionalIndex::after(&a);

        // This should panic: b < a is false
        FractionalIndex::between(&b, &a);
    }

    #[test]
    fn test_serialization() {
        let pos = FractionalIndex::first();
        let json = serde_json::to_string(&pos).unwrap();
        let deserialized: FractionalIndex = serde_json::from_str(&json).unwrap();

        assert_eq!(pos, deserialized);
    }
}
